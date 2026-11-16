using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class AnalyticsReflectionBuilder
{
    public const string LiveSource = "live";
    public const string IndividualSource = "individual";

    public static bool AcceptsReflection(ActivityItem item) =>
        item.RequireExplanation && ContentBlocks.SupportsReflection(item.Kind);

    public static List<AnswerAttempt> LatestLive(IEnumerable<AnswerAttempt> attempts) =>
        attempts
            .Where(attempt => attempt.LiveSessionId is not null)
            .GroupBy(attempt => (attempt.LiveSessionId, attempt.StudentId, attempt.ItemId))
            .Select(group => group.OrderByDescending(attempt => attempt.AnsweredAt).First())
            .ToList();

    public static List<AnswerAttempt> LatestIndividual(IEnumerable<AnswerAttempt> attempts) =>
        attempts
            .Where(attempt => attempt.LiveSessionId is null)
            .GroupBy(attempt => (attempt.StudentId, attempt.ItemId))
            .Select(group => group.OrderByDescending(attempt => attempt.AnsweredAt).First())
            .ToList();

    public static IReadOnlyList<AnalyticsReflectionResponse> Build(
        ActivityItem item,
        IEnumerable<AnswerAttempt> liveLatest,
        IReadOnlyDictionary<(Guid Id, Guid StudentId), string> liveNames,
        IEnumerable<AnswerAttempt> individualLatest,
        IReadOnlyDictionary<Guid, string> profileNames)
    {
        if (!AcceptsReflection(item))
        {
            return [];
        }

        var rows = new List<AnalyticsReflectionResponse>();
        foreach (var attempt in liveLatest.Where(attempt => attempt.ItemId == item.Id))
        {
            if (!TryText(attempt, out var text))
            {
                continue;
            }

            rows.Add(ToResponse(
                item,
                attempt,
                LiveName(attempt, liveNames),
                text,
                LiveSource));
        }

        foreach (var attempt in individualLatest.Where(attempt => attempt.ItemId == item.Id))
        {
            if (!TryText(attempt, out var text))
            {
                continue;
            }

            var name = profileNames.TryGetValue(attempt.StudentId, out var profileName)
                && !string.IsNullOrWhiteSpace(profileName)
                ? profileName
                : "Aluno";
            rows.Add(ToResponse(item, attempt, name, text, IndividualSource));
        }

        return rows
            .OrderByDescending(row => row.AnsweredAt)
            .ThenBy(row => row.StudentName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static AnalyticsReflectionResponse ToResponse(
        ActivityItem item,
        AnswerAttempt attempt,
        string studentName,
        string text,
        string source) =>
        new(
            attempt.StudentId,
            studentName,
            StudyAnswerFormatter.SelectedOptionLabels(item, attempt.SelectedOptionId, attempt.SelectedOptionIds),
            attempt.IsCorrect,
            text,
            attempt.AnsweredAt,
            source);

    private static string LiveName(
        AnswerAttempt attempt,
        IReadOnlyDictionary<(Guid Id, Guid StudentId), string> liveNames)
    {
        if (attempt.LiveSessionId is Guid sessionId
            && liveNames.TryGetValue((sessionId, attempt.StudentId), out var name)
            && !string.IsNullOrWhiteSpace(name))
        {
            return name;
        }

        return "Participante";
    }

    private static bool TryText(AnswerAttempt attempt, out string text)
    {
        text = attempt.TextAnswer?.Trim() ?? string.Empty;
        return text.Length > 0;
    }
}
