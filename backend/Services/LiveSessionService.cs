using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public sealed class LiveOperationResult
{
    public LiveSessionStateResponse? State { get; init; }
    public int StatusCode { get; init; } = StatusCodes.Status200OK;
    public string? Error { get; init; }

    public static LiveOperationResult Ok(LiveSessionStateResponse state) => new() { State = state };

    public static LiveOperationResult Fail(int statusCode, string error) =>
        new() { StatusCode = statusCode, Error = error };
}

public class LiveSessionService(
    MongoDbContext db,
    CurrentUserService currentUser)
{
    public async Task<LiveOperationResult> CreateAsync(CreateLiveSessionRequest request, CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        if (profile.Role != UserRoles.Professor)
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Apenas professores podem iniciar uma sessão ao vivo.");
        }

        var activity = await db.Activities
            .Find(item => item.Id == request.ActivityId)
            .FirstOrDefaultAsync(cancellationToken);
        if (activity is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Atividade não encontrada.");
        }

        if (activity.ProfessorId != profile.Id)
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Você só pode aplicar atividades da sua biblioteca.");
        }

        if (activity.Type is not (ActivityTypes.Quiz or ActivityTypes.Prova))
        {
            return LiveOperationResult.Fail(StatusCodes.Status400BadRequest, "Apenas quizzes e provas podem ser aplicados ao vivo.");
        }

        var classroom = await db.Classes
            .Find(item => item.Id == request.ClassId)
            .FirstOrDefaultAsync(cancellationToken);
        if (classroom is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Turma não encontrada.");
        }

        if (classroom.ProfessorId != profile.Id)
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "A turma não pertence a você.");
        }

        if (!activity.LinkedClassIds().Contains(classroom.Id))
        {
            return LiveOperationResult.Fail(StatusCodes.Status400BadRequest, "Vincule a atividade a esta turma antes de iniciar ao vivo.");
        }

        var itemIds = ActivityItemPresenter.PracticeItemIds(activity);
        if (itemIds.Count == 0)
        {
            return LiveOperationResult.Fail(StatusCodes.Status400BadRequest, "A atividade não tem questões para aplicar ao vivo.");
        }

        var existing = await db.LiveSessions
            .Find(session =>
                session.ProfessorId == profile.Id
                && session.ClassId == classroom.Id
                && session.ActivityId == activity.Id
                && (session.Status == LiveSessionStatuses.Lobby || session.Status == LiveSessionStatuses.Running))
            .SortByDescending(session => session.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null)
        {
            return LiveOperationResult.Ok(
                await BuildStateAsync(existing, activity, classroom, profile.Id, isHost: true, cancellationToken));
        }

        var pin = await GeneratePinAsync(cancellationToken);
        var session = new LiveSession
        {
            Id = Guid.NewGuid(),
            ActivityId = activity.Id,
            ClassId = classroom.Id,
            ProfessorId = profile.Id,
            Title = activity.Title,
            Mode = activity.Type == ActivityTypes.Prova ? ActivityTypes.Prova : ActivityTypes.Quiz,
            Pin = pin,
            Status = LiveSessionStatuses.Lobby,
            Phase = LiveSessionPhases.Lobby,
            ItemIds = itemIds,
            StartedAt = DateTimeOffset.UtcNow
        };

        await db.LiveSessions.InsertOneAsync(session, cancellationToken: cancellationToken);
        return LiveOperationResult.Ok(await BuildStateAsync(session, activity, classroom, profile.Id, isHost: true, cancellationToken));
    }

    public async Task<(IReadOnlyList<LiveSessionStateResponse>? Sessions, int StatusCode, string? Error)> ListActiveAsync(
        CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return (null, StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        if (profile.Role != UserRoles.Professor)
        {
            return (null, StatusCodes.Status403Forbidden, "Apenas professores podem ver sessões ao vivo.");
        }

        var sessions = await db.LiveSessions
            .Find(session =>
                session.ProfessorId == profile.Id
                && (session.Status == LiveSessionStatuses.Lobby || session.Status == LiveSessionStatuses.Running))
            .SortByDescending(session => session.StartedAt)
            .ToListAsync(cancellationToken);

        var states = new List<LiveSessionStateResponse>();
        foreach (var session in sessions)
        {
            var loaded = await LoadBundleAsync(session.Id, cancellationToken);
            if (loaded.Error is not null || loaded.Session is null || loaded.Activity is null || loaded.Classroom is null)
            {
                continue;
            }

            states.Add(await BuildStateAsync(
                loaded.Session,
                loaded.Activity,
                loaded.Classroom,
                profile.Id,
                isHost: true,
                cancellationToken));
        }

        return (states, StatusCodes.Status200OK, null);
    }

    public async Task<LiveOperationResult> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        var loaded = await LoadBundleAsync(id, cancellationToken);
        if (loaded.Error is not null)
        {
            return loaded.Error;
        }

        var isHost = loaded.Session!.ProfessorId == profile.Id;
        if (!isHost && !loaded.Classroom!.Enrollments.Any(enrollment => enrollment.StudentId == profile.Id))
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Você não participa desta sessão.");
        }

        return LiveOperationResult.Ok(
            await BuildStateAsync(loaded.Session, loaded.Activity!, loaded.Classroom!, profile.Id, isHost, cancellationToken));
    }

    public async Task<LiveOperationResult> GetByPinAsync(string pin, CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        var session = await FindActiveByPinAsync(pin, cancellationToken);
        if (session is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Nenhuma sessão ativa com este PIN.");
        }

        var loaded = await LoadBundleAsync(session.Id, cancellationToken);
        if (loaded.Error is not null)
        {
            return loaded.Error;
        }

        var isHost = loaded.Session!.ProfessorId == profile.Id;
        if (!isHost)
        {
            if (profile.Role != UserRoles.Aluno)
            {
                return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Entre com uma conta de aluno para participar.");
            }

            if (!loaded.Classroom!.Enrollments.Any(enrollment => enrollment.StudentId == profile.Id))
            {
                return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Você precisa estar matriculado na turma desta sessão.");
            }
        }

        return LiveOperationResult.Ok(
            await BuildStateAsync(loaded.Session, loaded.Activity!, loaded.Classroom!, profile.Id, isHost, cancellationToken));
    }

    public async Task<LiveOperationResult> JoinHostAsync(Guid sessionId, string connectionId, CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        var loaded = await LoadBundleAsync(sessionId, cancellationToken);
        if (loaded.Error is not null)
        {
            return loaded.Error;
        }

        if (loaded.Session!.ProfessorId != profile.Id)
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Apenas o professor desta sessão pode controlá-la.");
        }

        loaded.Session.HostConnectionId = connectionId;
        await db.LiveSessions.UpdateOneAsync(
            item => item.Id == loaded.Session.Id && item.ProfessorId == profile.Id,
            Builders<LiveSession>.Update.Set(item => item.HostConnectionId, connectionId),
            cancellationToken: cancellationToken);
        var current = await db.LiveSessions.Find(item => item.Id == loaded.Session.Id).FirstOrDefaultAsync(cancellationToken)
            ?? loaded.Session;
        return LiveOperationResult.Ok(
            await BuildStateAsync(current, loaded.Activity!, loaded.Classroom!, profile.Id, isHost: true, cancellationToken));
    }

    public async Task<LiveOperationResult> JoinStudentAsync(string pin, string connectionId, CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Apenas alunos entram com PIN.");
        }

        var session = await FindActiveByPinAsync(pin, cancellationToken);
        if (session is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Nenhuma sessão ativa com este PIN.");
        }

        var loaded = await LoadBundleAsync(session.Id, cancellationToken);
        if (loaded.Error is not null)
        {
            return loaded.Error;
        }

        session = loaded.Session!;
        if (session.Status == LiveSessionStatuses.Ended)
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "Esta sessão já encerrou.");
        }

        if (!loaded.Classroom!.Enrollments.Any(enrollment => enrollment.StudentId == profile.Id))
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Você precisa estar matriculado na turma desta sessão.");
        }

        var name = DisplayName(profile);
        var existingFilter = Builders<LiveSession>.Filter.And(
            Builders<LiveSession>.Filter.Eq(item => item.Id, session.Id),
            Builders<LiveSession>.Filter.ElemMatch(item => item.Participants, participant => participant.StudentId == profile.Id));
        var existingUpdate = Builders<LiveSession>.Update
            .Set("participants.$.name", name)
            .Set("participants.$.isConnected", true)
            .Set("participants.$.connectionId", connectionId);

        var updated = await db.LiveSessions.FindOneAndUpdateAsync(
            existingFilter,
            existingUpdate,
            new FindOneAndUpdateOptions<LiveSession> { ReturnDocument = ReturnDocument.After },
            cancellationToken);

        if (updated is null)
        {
            updated = await db.LiveSessions.FindOneAndUpdateAsync(
                item => item.Id == session.Id,
                Builders<LiveSession>.Update.Push(item => item.Participants, new LiveParticipant
                {
                    StudentId = profile.Id,
                    Name = name,
                    JoinedAt = DateTimeOffset.UtcNow,
                    IsConnected = true,
                    ConnectionId = connectionId
                }),
                new FindOneAndUpdateOptions<LiveSession> { ReturnDocument = ReturnDocument.After },
                cancellationToken);
        }

        if (updated is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Sessão não encontrada.");
        }

        return LiveOperationResult.Ok(
            await BuildStateAsync(updated, loaded.Activity!, loaded.Classroom!, profile.Id, isHost: false, cancellationToken));
    }

    public async Task<LiveOperationResult?> DisconnectAsync(string connectionId, CancellationToken cancellationToken)
    {
        var hostUpdate = await db.LiveSessions.FindOneAndUpdateAsync(
            item => item.HostConnectionId == connectionId,
            Builders<LiveSession>.Update.Set(item => item.HostConnectionId, null),
            new FindOneAndUpdateOptions<LiveSession> { ReturnDocument = ReturnDocument.After },
            cancellationToken);

        var participantFilter = Builders<LiveSession>.Filter.ElemMatch(
            item => item.Participants,
            participant => participant.ConnectionId == connectionId);
        var participantUpdate = Builders<LiveSession>.Update
            .Set("participants.$.isConnected", false)
            .Set("participants.$.connectionId", (string?)null);
        var participantUpdateResult = await db.LiveSessions.FindOneAndUpdateAsync(
            participantFilter,
            participantUpdate,
            new FindOneAndUpdateOptions<LiveSession> { ReturnDocument = ReturnDocument.After },
            cancellationToken);

        var session = participantUpdateResult ?? hostUpdate;
        if (session is null)
        {
            return null;
        }

        var loaded = await LoadBundleAsync(session.Id, cancellationToken);
        if (loaded.Error is not null || loaded.Session is null)
        {
            return loaded.Error;
        }

        return LiveOperationResult.Ok(
            await BuildStateAsync(loaded.Session, loaded.Activity!, loaded.Classroom!, session.ProfessorId, isHost: true, cancellationToken));
    }

    public async Task<LiveOperationResult> StartAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var host = await RequireHostAsync(sessionId, cancellationToken);
        if (host.Error is not null)
        {
            return host.Error;
        }

        var session = host.Session!;
        if (session.Status != LiveSessionStatuses.Lobby)
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "A sessão já foi iniciada.");
        }

        OpenQuestion(session, 0);
        if (!await TryReplaceExpectedAsync(session, LiveSessionStatuses.Lobby, LiveSessionPhases.Lobby, cancellationToken))
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "A sessão já foi iniciada.");
        }
        return await SnapshotAsync(session, host.Activity!, host.Classroom!, host.Profile!.Id, true, cancellationToken);
    }

    public async Task<LiveOperationResult> AdvanceAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var host = await RequireHostAsync(sessionId, cancellationToken);
        if (host.Error is not null)
        {
            return host.Error;
        }

        var session = host.Session!;
        if (session.Status != LiveSessionStatuses.Running)
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "A sessão não está em andamento.");
        }

        var expectedStatus = session.Status;
        var expectedPhase = session.Phase;

        if (session.Phase == LiveSessionPhases.Question && session.Mode == ActivityTypes.Quiz)
        {
            session.Phase = LiveSessionPhases.Reveal;
        }
        else
        {
            var nextIndex = session.ItemIndex + 1;
            if (nextIndex >= session.ItemIds.Count)
            {
                EndSession(session);
            }
            else
            {
                OpenQuestion(session, nextIndex);
            }
        }

        if (!await TryReplaceExpectedAsync(session, expectedStatus, expectedPhase, cancellationToken))
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "A sessão mudou. Tente avançar de novo.");
        }
        return await SnapshotAsync(session, host.Activity!, host.Classroom!, host.Profile!.Id, true, cancellationToken);
    }

    public async Task<LiveOperationResult> EndAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var host = await RequireHostAsync(sessionId, cancellationToken);
        if (host.Error is not null)
        {
            return host.Error;
        }

        var session = host.Session!;
        if (session.Status != LiveSessionStatuses.Ended)
        {
            var expectedStatus = session.Status;
            var expectedPhase = session.Phase;
            EndSession(session);
            if (!await TryReplaceExpectedAsync(session, expectedStatus, expectedPhase, cancellationToken))
            {
                var current = await db.LiveSessions.Find(item => item.Id == session.Id).FirstOrDefaultAsync(cancellationToken);
                if (current is not null)
                {
                    session = current;
                }
            }
        }

        return await SnapshotAsync(session, host.Activity!, host.Classroom!, host.Profile!.Id, true, cancellationToken);
    }

    public async Task<LiveOperationResult> SubmitAnswerAsync(
        Guid sessionId,
        SubmitStudyAnswerRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status401Unauthorized, "Perfil não encontrado.");
        }

        var loaded = await LoadBundleAsync(sessionId, cancellationToken);
        if (loaded.Error is not null)
        {
            return loaded.Error;
        }

        var session = loaded.Session!;
        if (session.Status != LiveSessionStatuses.Running || session.Phase != LiveSessionPhases.Question)
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "Não há questão aberta para responder.");
        }

        var participant = session.Participants.FirstOrDefault(item => item.StudentId == profile.Id);
        if (participant is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Entre na sessão antes de responder.");
        }

        var currentItemId = CurrentItemId(session);
        if (currentItemId is null || request.ItemId != currentItemId)
        {
            return LiveOperationResult.Fail(StatusCodes.Status400BadRequest, "Esta não é a questão atual.");
        }

        var item = loaded.Activity!.Items.FirstOrDefault(entry => entry.Id == currentItemId);
        if (item is null)
        {
            return LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Questão não encontrada.");
        }

        var already = await db.AnswerAttempts
            .Find(attempt =>
                attempt.LiveSessionId == session.Id
                && attempt.StudentId == profile.Id
                && attempt.ItemId == item.Id)
            .AnyAsync(cancellationToken);
        if (already)
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "Você já respondeu esta questão.");
        }

        var grade = ItemGrader.Grade(item, request);
        if (!grade.Success)
        {
            return LiveOperationResult.Fail(StatusCodes.Status400BadRequest, grade.Error ?? "Resposta inválida.");
        }

        var responseTimeMs = 0;
        if (session.QuestionStartedAt is DateTimeOffset started)
        {
            responseTimeMs = (int)Math.Max(0, (DateTimeOffset.UtcNow - started).TotalMilliseconds);
        }

        var score = ComputeScore(session, grade.IsCorrect);
        try
        {
            await db.AnswerAttempts.InsertOneAsync(
                new AnswerAttempt
                {
                    Id = Guid.NewGuid(),
                    StudentId = profile.Id,
                    ActivityId = session.ActivityId,
                    ItemId = item.Id,
                    LiveSessionId = session.Id,
                    SelectedOptionId = grade.SelectedOptionId,
                    SelectedOptionIds = grade.SelectedOptionIds?.ToList(),
                    TextAnswer = grade.TextAnswer,
                    Remembered = grade.Remembered,
                    IsCorrect = grade.IsCorrect,
                    ResponseTimeMs = responseTimeMs,
                    Score = score,
                    AnsweredAt = DateTimeOffset.UtcNow
                },
                cancellationToken: cancellationToken);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return LiveOperationResult.Fail(StatusCodes.Status409Conflict, "Você já respondeu esta questão.");
        }

        return await SnapshotAsync(session, loaded.Activity, loaded.Classroom!, profile.Id, isHost: false, cancellationToken);
    }

    public async Task<IReadOnlyList<(string ConnectionId, LiveSessionStateResponse State)>> BuildConnectionStatesAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var loaded = await LoadBundleAsync(sessionId, cancellationToken);
        if (loaded.Error is not null || loaded.Session is null)
        {
            return [];
        }

        var session = loaded.Session;
        var attempts = await db.AnswerAttempts
            .Find(attempt => attempt.LiveSessionId == session.Id)
            .ToListAsync(cancellationToken);

        var states = new List<(string ConnectionId, LiveSessionStateResponse State)>();
        if (!string.IsNullOrWhiteSpace(session.HostConnectionId))
        {
            states.Add((
                session.HostConnectionId,
                BuildStateFromAttempts(session, loaded.Activity!, loaded.Classroom!, session.ProfessorId, isHost: true, attempts)));
        }

        foreach (var participant in session.Participants.Where(item => item.IsConnected && !string.IsNullOrWhiteSpace(item.ConnectionId)))
        {
            states.Add((
                participant.ConnectionId!,
                BuildStateFromAttempts(session, loaded.Activity!, loaded.Classroom!, participant.StudentId, isHost: false, attempts)));
        }

        return states;
    }

    private async Task<LiveOperationResult> SnapshotAsync(
        LiveSession session,
        Activity activity,
        ClassRoom classroom,
        Guid viewerId,
        bool isHost,
        CancellationToken cancellationToken) =>
        LiveOperationResult.Ok(await BuildStateAsync(session, activity, classroom, viewerId, isHost, cancellationToken));

    private async Task<LiveSessionStateResponse> BuildStateAsync(
        LiveSession session,
        Activity activity,
        ClassRoom classroom,
        Guid viewerId,
        bool isHost,
        CancellationToken cancellationToken)
    {
        var attempts = await db.AnswerAttempts
            .Find(attempt => attempt.LiveSessionId == session.Id)
            .ToListAsync(cancellationToken);

        return BuildStateFromAttempts(session, activity, classroom, viewerId, isHost, attempts);
    }

    private static LiveSessionStateResponse BuildStateFromAttempts(
        LiveSession session,
        Activity activity,
        ClassRoom classroom,
        Guid viewerId,
        bool isHost,
        IReadOnlyList<AnswerAttempt> attempts)
    {
        var currentId = CurrentItemId(session);
        var currentEntity = currentId is Guid id
            ? activity.Items.FirstOrDefault(item => item.Id == id)
            : null;

        var showAnswerKey = isHost
            || (session.Mode == ActivityTypes.Quiz
                && session.Phase is LiveSessionPhases.Reveal or LiveSessionPhases.Ended);

        StudySessionItemResponse? currentItem = null;
        if (currentEntity is not null
            && session.Phase is LiveSessionPhases.Question or LiveSessionPhases.Reveal or LiveSessionPhases.Ended)
        {
            currentItem = showAnswerKey
                ? ActivityItemPresenter.ToHostItem(currentEntity, session.Id)
                : ActivityItemPresenter.ToStudentItem(currentEntity, session.Id);
        }

        var currentAttempts = currentId is Guid current
            ? attempts.Where(attempt => attempt.ItemId == current).ToList()
            : [];

        var tally = new LiveAnswerTallyResponse(
            currentAttempts.Count,
            session.Participants.Count);

        LiveQuestionRevealResponse? reveal = null;
        if (currentEntity is not null
            && currentId is Guid revealId
            && session.Phase is LiveSessionPhases.Reveal or LiveSessionPhases.Ended
            && (isHost || session.Mode == ActivityTypes.Quiz))
        {
            var correct = currentAttempts.Count(attempt => attempt.IsCorrect == true);
            var incorrect = currentAttempts.Count(attempt => attempt.IsCorrect == false);
            var unanswered = Math.Max(0, session.Participants.Count - currentAttempts.Count);
            var answered = correct + incorrect;
            reveal = new LiveQuestionRevealResponse(
                revealId,
                correct,
                incorrect,
                unanswered,
                answered == 0 ? 0 : Math.Round(100.0 * correct / answered, 1),
                currentEntity.Options?.Where(option => option.IsCorrect).Select(option => option.Id).ToList(),
                ContentBlocks.CombinedExplanation(currentEntity),
                ContentBlocks.ToResponse(currentEntity.FeedbackBlocks),
                currentEntity.FeedbackMessages);
        }

        IReadOnlyList<LiveRankingEntryResponse>? ranking = null;
        if (session.Mode == ActivityTypes.Quiz
            && session.Phase is LiveSessionPhases.Reveal or LiveSessionPhases.Ended)
        {
            ranking = BuildRanking(session, attempts);
        }

        LivePersonalResultResponse? personal = null;
        if (!isHost)
        {
            var mine = attempts.Where(attempt => attempt.StudentId == viewerId).ToList();
            var currentMine = currentId is Guid qid
                ? mine.FirstOrDefault(attempt => attempt.ItemId == qid)
                : null;
            var revealPersonal = session.Phase is LiveSessionPhases.Reveal or LiveSessionPhases.Ended
                && session.Mode == ActivityTypes.Quiz;
            personal = new LivePersonalResultResponse(
                currentMine is not null,
                revealPersonal || session.Phase == LiveSessionPhases.Ended ? currentMine?.IsCorrect : null,
                mine.Sum(attempt => attempt.Score ?? 0),
                mine.Count(attempt => attempt.IsCorrect == true),
                mine.Count);
        }

        return new LiveSessionStateResponse(
            session.Id,
            session.ActivityId,
            session.ClassId,
            session.Title,
            classroom.Name,
            session.Pin,
            session.Status,
            session.Phase,
            session.Mode,
            session.ItemIndex,
            session.ItemIds.Count,
            session.QuestionStartedAt,
            session.TimeLimitSeconds,
            null,
            currentItem,
            tally,
            session.Participants
                .OrderBy(participant => participant.JoinedAt)
                .Select(participant => new LiveParticipantResponse(
                    participant.StudentId,
                    participant.Name,
                    participant.JoinedAt,
                    participant.IsConnected))
                .ToList(),
            ranking,
            reveal,
            personal,
            showAnswerKey);
    }

    private static List<LiveRankingEntryResponse> BuildRanking(LiveSession session, IReadOnlyList<AnswerAttempt> attempts)
    {
        return session.Participants
            .Select(participant =>
            {
                var mine = attempts.Where(attempt => attempt.StudentId == participant.StudentId).ToList();
                return new LiveRankingEntryResponse(
                    participant.StudentId,
                    participant.Name,
                    mine.Sum(attempt => attempt.Score ?? 0),
                    mine.Count(attempt => attempt.IsCorrect == true));
            })
            .OrderByDescending(entry => entry.Score)
            .ThenByDescending(entry => entry.CorrectCount)
            .ThenBy(entry => entry.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static int ComputeScore(LiveSession session, bool isCorrect)
    {
        if (!isCorrect)
        {
            return 0;
        }

        return session.Mode == ActivityTypes.Prova ? 1 : 1000;
    }

    private static Guid? CurrentItemId(LiveSession session)
    {
        if (session.ItemIndex < 0 || session.ItemIndex >= session.ItemIds.Count)
        {
            return null;
        }

        return session.ItemIds[session.ItemIndex];
    }

    private static void OpenQuestion(LiveSession session, int index)
    {
        session.Status = LiveSessionStatuses.Running;
        session.Phase = LiveSessionPhases.Question;
        session.ItemIndex = index;
        session.QuestionStartedAt = DateTimeOffset.UtcNow;
        session.TimeLimitSeconds = null;
    }

    private static void EndSession(LiveSession session)
    {
        session.Status = LiveSessionStatuses.Ended;
        session.Phase = LiveSessionPhases.Ended;
        session.EndedAt = DateTimeOffset.UtcNow;
        session.QuestionStartedAt = null;
    }

    private async Task<bool> TryReplaceExpectedAsync(
        LiveSession session,
        string expectedStatus,
        string expectedPhase,
        CancellationToken cancellationToken)
    {
        var result = await db.LiveSessions.ReplaceOneAsync(
            item => item.Id == session.Id && item.Status == expectedStatus && item.Phase == expectedPhase,
            session,
            cancellationToken: cancellationToken);
        return result.ModifiedCount == 1;
    }

    private async Task<string> GeneratePinAsync(CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < 30; attempt++)
        {
            var pin = Random.Shared.Next(100000, 1000000).ToString();
            var taken = await db.LiveSessions
                .Find(session =>
                    session.Pin == pin
                    && (session.Status == LiveSessionStatuses.Lobby || session.Status == LiveSessionStatuses.Running))
                .AnyAsync(cancellationToken);
            if (!taken)
            {
                return pin;
            }
        }

        throw new InvalidOperationException("Não foi possível gerar um PIN único.");
    }

    private async Task<LiveSession?> FindActiveByPinAsync(string pin, CancellationToken cancellationToken)
    {
        var normalized = pin.Trim();
        return await db.LiveSessions
            .Find(session =>
                session.Pin == normalized
                && session.Status != LiveSessionStatuses.Ended)
            .SortByDescending(session => session.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<Profile?> GetProfileAsync(CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not Guid userId)
        {
            return null;
        }

        return await db.Profiles.Find(profile => profile.Id == userId).FirstOrDefaultAsync(cancellationToken);
    }

    private static string DisplayName(Profile profile)
    {
        if (!string.IsNullOrWhiteSpace(profile.FullName))
        {
            return profile.FullName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(profile.Username))
        {
            return profile.Username.Trim();
        }

        return profile.Email;
    }

    private async Task<(LiveSession? Session, Activity? Activity, ClassRoom? Classroom, Profile? Profile, LiveOperationResult? Error)> RequireHostAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(cancellationToken);
        if (profile is null)
        {
            return (null, null, null, null, LiveOperationResult.Fail(StatusCodes.Status401Unauthorized, "Perfil não encontrado."));
        }

        var loaded = await LoadBundleAsync(sessionId, cancellationToken);
        if (loaded.Error is not null)
        {
            return (null, null, null, profile, loaded.Error);
        }

        if (loaded.Session!.ProfessorId != profile.Id)
        {
            return (null, null, null, profile, LiveOperationResult.Fail(StatusCodes.Status403Forbidden, "Apenas o professor desta sessão pode controlá-la."));
        }

        return (loaded.Session, loaded.Activity, loaded.Classroom, profile, null);
    }

    private async Task<(LiveSession? Session, Activity? Activity, ClassRoom? Classroom, LiveOperationResult? Error)> LoadBundleAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await db.LiveSessions.Find(item => item.Id == sessionId).FirstOrDefaultAsync(cancellationToken);
        if (session is null)
        {
            return (null, null, null, LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Sessão não encontrada."));
        }

        var activity = await db.Activities.Find(item => item.Id == session.ActivityId).FirstOrDefaultAsync(cancellationToken);
        if (activity is null)
        {
            return (null, null, null, LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Atividade da sessão não encontrada."));
        }

        var classroom = await db.Classes.Find(item => item.Id == session.ClassId).FirstOrDefaultAsync(cancellationToken);
        if (classroom is null)
        {
            return (null, null, null, LiveOperationResult.Fail(StatusCodes.Status404NotFound, "Turma da sessão não encontrada."));
        }

        return (session, activity, classroom, null);
    }
}
