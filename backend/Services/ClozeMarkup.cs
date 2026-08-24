using System.Text.RegularExpressions;
using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class ClozeMarkup
{
    private static readonly Regex TokenPattern = new(
        @"\{\{([^}]*)\}\}",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static string ToStudentPrompt(string? prompt, IReadOnlyList<ClozeBlank> blanks)
    {
        if (string.IsNullOrWhiteSpace(prompt) || blanks.Count == 0)
        {
            return prompt ?? string.Empty;
        }

        var index = 0;
        return TokenPattern.Replace(prompt, _ =>
        {
            if (index >= blanks.Count)
            {
                return "{{}}";
            }

            var token = $"{{{{{blanks[index].Id}}}}}";
            index++;
            return token;
        });
    }

    public static List<ClozeBlank> ParseBlanks(
        string? prompt,
        IReadOnlyList<ClozeBlank>? existing,
        IReadOnlyList<CreateClozeBlankRequest>? incoming)
    {
        var existingByIndex = existing?.OrderBy(blank => blank.Position).ToList() ?? [];
        var incomingList = incoming ?? [];
        var fromPrompt = ExtractAnswersFromPrompt(prompt);

        var count = Math.Max(fromPrompt.Count, incomingList.Count);
        var blanks = new List<ClozeBlank>(count);
        for (var i = 0; i < count; i++)
        {
            var existingBlank = i < existingByIndex.Count ? existingByIndex[i] : null;
            var incomingBlank = i < incomingList.Count ? incomingList[i] : null;
            var promptAnswers = i < fromPrompt.Count ? fromPrompt[i] : [];

            var accepted = NormalizeAnswers(incomingBlank?.AcceptedAnswers)
                .Concat(promptAnswers)
                .Where(answer => answer.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToList();

            blanks.Add(new ClozeBlank
            {
                Id = ResolveBlankId(incomingBlank?.Id, existingBlank),
                Position = i,
                AcceptedAnswers = accepted
            });
        }

        return blanks;
    }

    private static List<List<string>> ExtractAnswersFromPrompt(string? prompt)
    {
        if (string.IsNullOrWhiteSpace(prompt))
        {
            return [];
        }

        return TokenPattern.Matches(prompt)
            .Select(match => NormalizeAnswers(match.Groups[1].Value.Split('|')))
            .ToList();
    }

    private static List<string> NormalizeAnswers(IEnumerable<string>? values) =>
        (values ?? [])
            .Select(value => value.Trim())
            .Where(value => value.Length > 0 && !Guid.TryParse(value, out _))
            .ToList();

    private static Guid ResolveBlankId(Guid? incomingId, ClozeBlank? existing)
    {
        if (incomingId is Guid id && existing is not null && existing.Id == id)
        {
            return id;
        }

        return existing?.Id ?? Guid.NewGuid();
    }
}
