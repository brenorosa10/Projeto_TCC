using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public class AnalyticsService(
    MongoDbContext db,
    CurrentUserService currentUser)
{
    public async Task<(AnalyticsOverviewResponse? Data, int StatusCode, string? Error)> GetAsync(
        Guid? activityId,
        Guid? sessionId,
        CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return (null, StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        if (profile.Role != UserRoles.Professor)
        {
            return (null, StatusCodes.Status403Forbidden, "Apenas professores acessam o painel analítico.");
        }

        var sessions = await db.LiveSessions
            .Find(session => session.ProfessorId == profile.Id)
            .SortByDescending(session => session.StartedAt)
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0)
        {
            return (new AnalyticsOverviewResponse([], activityId, sessionId, [], []), StatusCodes.Status200OK, null);
        }

        var activityIds = sessions.Select(session => session.ActivityId).Distinct().ToList();
        var activities = await db.Activities
            .Find(activity => activityIds.Contains(activity.Id))
            .ToListAsync(cancellationToken);
        var activitiesById = activities.ToDictionary(activity => activity.Id);

        var classIds = sessions.Select(session => session.ClassId).Distinct().ToList();
        var classes = await db.Classes
            .Find(classroom => classIds.Contains(classroom.Id))
            .ToListAsync(cancellationToken);
        var classesById = classes.ToDictionary(classroom => classroom.Id);

        var activitySummaries = activityIds
            .Select(id =>
            {
                activitiesById.TryGetValue(id, out var activity);
                var ofActivity = sessions.Where(session => session.ActivityId == id).ToList();
                var participantCount = ofActivity
                    .SelectMany(session => session.Participants)
                    .Select(participant => participant.StudentId)
                    .Distinct()
                    .Count();
                return new AnalyticsActivitySummaryResponse(
                    id,
                    activity?.Title ?? ofActivity.FirstOrDefault()?.Title ?? "Atividade",
                    activity?.Type ?? ofActivity.FirstOrDefault()?.Mode ?? ActivityTypes.Quiz,
                    ofActivity.Count,
                    participantCount);
            })
            .OrderBy(item => item.Title, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var selectedActivityId = activityId
            ?? (activitySummaries.Count == 1 ? activitySummaries[0].Id : null);

        if (sessionId is Guid requestedSession)
        {
            var match = sessions.FirstOrDefault(session => session.Id == requestedSession);
            if (match is null)
            {
                return (null, StatusCodes.Status404NotFound, "Sessão não encontrada.");
            }

            selectedActivityId = match.ActivityId;
        }

        var scopedSessions = selectedActivityId is Guid selected
            ? sessions.Where(session => session.ActivityId == selected).ToList()
            : sessions;

        var questionSessions = sessionId is Guid selectedSession
            ? scopedSessions.Where(session => session.Id == selectedSession).ToList()
            : scopedSessions;

        var sessionSummaries = scopedSessions
            .Select(session =>
            {
                classesById.TryGetValue(session.ClassId, out var classroom);
                return new AnalyticsSessionSummaryResponse(
                    session.Id,
                    session.ActivityId,
                    session.Pin,
                    classroom?.Name ?? "Turma",
                    session.Title,
                    session.Mode,
                    session.Status,
                    session.StartedAt,
                    session.EndedAt,
                    session.Participants
                        .OrderBy(participant => participant.JoinedAt)
                        .Select(participant => new LiveParticipantResponse(
                            participant.StudentId,
                            participant.Name,
                            participant.JoinedAt,
                            participant.IsConnected))
                        .ToList());
            })
            .ToList();

        var questions = selectedActivityId is Guid activityKey && activitiesById.TryGetValue(activityKey, out var selectedActivity)
            ? await BuildQuestionsAsync(
                selectedActivity,
                questionSessions,
                includeIndividual: sessionId is null && selectedActivity.ProfessorId == profile.Id,
                cancellationToken)
            : [];

        return (
            new AnalyticsOverviewResponse(
                activitySummaries,
                selectedActivityId,
                sessionId,
                sessionSummaries,
                questions),
            StatusCodes.Status200OK,
            null);
    }

    private async Task<List<AnalyticsQuestionResponse>> BuildQuestionsAsync(
        Activity activity,
        IReadOnlyList<LiveSession> sessions,
        bool includeIndividual,
        CancellationToken cancellationToken)
    {
        var sessionIds = sessions.Select(session => session.Id).ToList();
        if (sessionIds.Count == 0)
        {
            return [];
        }

        var attempts = await db.AnswerAttempts
            .Find(attempt => attempt.LiveSessionId != null && sessionIds.Contains(attempt.LiveSessionId.Value))
            .ToListAsync(cancellationToken);

        var latest = AnalyticsReflectionBuilder.LatestLive(attempts);

        var names = sessions
            .SelectMany(session => session.Participants.Select(participant => (session.Id, participant.StudentId, participant.Name)))
            .GroupBy(entry => (entry.Id, entry.StudentId))
            .ToDictionary(group => group.Key, group => group.First().Name);

        var itemIds = ActivityItemPresenter.PracticeItemIds(activity);
        var itemsById = activity.Items.ToDictionary(item => item.Id);
        var reflectionItemIds = itemIds
            .Where(id => itemsById.TryGetValue(id, out var item) && AnalyticsReflectionBuilder.AcceptsReflection(item))
            .ToList();

        var individualLatest = new List<AnswerAttempt>();
        var profileNames = new Dictionary<Guid, string>();
        if (includeIndividual && reflectionItemIds.Count > 0)
        {
            var individual = await db.AnswerAttempts
                .Find(attempt =>
                    attempt.ActivityId == activity.Id
                    && attempt.LiveSessionId == null
                    && reflectionItemIds.Contains(attempt.ItemId))
                .ToListAsync(cancellationToken);
            individualLatest = AnalyticsReflectionBuilder.LatestIndividual(individual);
            var studentIds = individualLatest.Select(attempt => attempt.StudentId).Distinct().ToList();
            if (studentIds.Count > 0)
            {
                var profiles = await db.Profiles
                    .Find(profile => studentIds.Contains(profile.Id))
                    .ToListAsync(cancellationToken);
                profileNames = profiles.ToDictionary(
                    profile => profile.Id,
                    profile => ProfileDisplayName(profile));
            }
        }

        return itemIds
            .Select(itemId =>
            {
                itemsById.TryGetValue(itemId, out var item);
                var ofItem = latest.Where(attempt => attempt.ItemId == itemId).ToList();
                var correct = ofItem.Where(attempt => attempt.IsCorrect == true).ToList();
                var incorrect = ofItem.Where(attempt => attempt.IsCorrect == false).ToList();
                var total = ofItem.Count;
                var accuracy = total == 0 ? 0 : Math.Round(100.0 * correct.Count / total, 1);
                var error = total == 0 ? 0 : Math.Round(100.0 * incorrect.Count / total, 1);
                var requiresReflection = item is not null && AnalyticsReflectionBuilder.AcceptsReflection(item);
                return new AnalyticsQuestionResponse(
                    itemId,
                    item is null ? "Questão" : ActivityItemPresenter.PromptPreview(item),
                    item?.Kind ?? "question",
                    total,
                    correct.Count,
                    incorrect.Count,
                    accuracy,
                    error,
                    error > 50,
                    Names(correct, names),
                    Names(incorrect, names),
                    requiresReflection,
                    requiresReflection
                        ? AnalyticsReflectionBuilder.Build(item!, ofItem, names, individualLatest, profileNames)
                        : []);
            })
            .ToList();
    }

    private static string ProfileDisplayName(Profile profile)
    {
        if (!string.IsNullOrWhiteSpace(profile.FullName))
        {
            return profile.FullName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(profile.Username))
        {
            return profile.Username.Trim();
        }

        return string.IsNullOrWhiteSpace(profile.Email) ? "Aluno" : profile.Email.Trim();
    }

    private static List<string> Names(
        IEnumerable<AnswerAttempt> attempts,
        IReadOnlyDictionary<(Guid Id, Guid StudentId), string> names)
    {
        return attempts
            .Select(attempt =>
            {
                if (attempt.LiveSessionId is Guid sessionId
                    && names.TryGetValue((sessionId, attempt.StudentId), out var name)
                    && !string.IsNullOrWhiteSpace(name))
                {
                    return name;
                }

                return "Participante";
            })
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task<Profile?> GetProfileAsync(CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not Guid userId)
        {
            return null;
        }

        return await db.Profiles.Find(profile => profile.Id == userId).FirstOrDefaultAsync(cancellationToken);
    }
}
