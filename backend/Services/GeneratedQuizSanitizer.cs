using System.Text.Json;
using System.Text.RegularExpressions;
using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public sealed class GeneratedQuizException(string message) : Exception(message);

/// <summary>
/// Turns the JSON returned by Gemini into quiz items the editor already understands.
/// Invalid items are dropped; the rest are forced to one correct alternative.
/// </summary>
public static partial class GeneratedQuizSanitizer
{
    public const int MinCount = 1;
    public const int MaxCount = 20;
    public const int MinContextLength = 10;
    public const int MaxContextLength = 12_000;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static IReadOnlyList<GeneratedQuizQuestionResponse> Sanitize(string rawJson, int requestedCount, string? requestedKind)
    {
        var payload = Parse(rawJson);
        var drafts = payload.Questions ?? [];
        var kindFilter = NormalizeKindFilter(requestedKind);
        var limit = Math.Clamp(requestedCount, MinCount, MaxCount);
        var accepted = new List<GeneratedQuizQuestionResponse>();

        foreach (var draft in drafts)
        {
            if (accepted.Count >= limit)
            {
                break;
            }

            var question = TryAccept(draft, kindFilter);
            if (question is not null)
            {
                accepted.Add(question);
            }
        }

        if (accepted.Count == 0)
        {
            throw new GeneratedQuizException(
                "A IA não devolveu questões válidas. Tente reformular o contexto ou gerar de novo.");
        }

        return accepted;
    }

    private static GeneratedQuizPayload Parse(string rawJson)
    {
        var json = Unwrap(rawJson);
        if (string.IsNullOrWhiteSpace(json))
        {
            throw new GeneratedQuizException("A IA devolveu uma resposta vazia. Tente novamente.");
        }

        try
        {
            return JsonSerializer.Deserialize<GeneratedQuizPayload>(json, JsonOptions)
                ?? throw new GeneratedQuizException("A IA devolveu um formato inválido. Tente novamente.");
        }
        catch (JsonException)
        {
            throw new GeneratedQuizException("A IA devolveu um formato inválido. Tente novamente.");
        }
    }

    internal static string Unwrap(string raw)
    {
        var text = raw.Trim();
        var fenced = FencePattern().Match(text);
        if (fenced.Success)
        {
            text = fenced.Groups["json"].Value.Trim();
        }

        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start >= 0 && end > start)
        {
            text = text[start..(end + 1)];
        }

        return text;
    }

    private static GeneratedQuizQuestionResponse? TryAccept(GeneratedQuizQuestionDraft draft, string? kindFilter)
    {
        var prompt = Clean(draft.Prompt, 2000);
        if (prompt.Length < 8)
        {
            return null;
        }

        var kind = NormalizeKind(draft.Kind);
        if (kindFilter is not null && kind != kindFilter)
        {
            kind = kindFilter;
        }

        var explanation = Clean(draft.Explanation, 2000);
        var options = (draft.Options ?? [])
            .Select(option => (Text: Clean(option.Text, 500), option.IsCorrect))
            .Where(option => option.Text.Length > 0)
            .ToList();

        if (kind == ItemKinds.TrueFalse)
        {
            return BuildTrueFalse(prompt, explanation, options);
        }

        return BuildMultipleChoice(prompt, explanation, options);
    }

    private static GeneratedQuizQuestionResponse? BuildMultipleChoice(
        string prompt,
        string explanation,
        List<(string Text, bool IsCorrect)> options)
    {
        var unique = new List<(string Text, bool IsCorrect)>();
        foreach (var option in options)
        {
            if (unique.Any(existing => string.Equals(existing.Text, option.Text, StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            unique.Add(option);
        }

        var correctIndex = unique.FindIndex(option => option.IsCorrect);
        if (correctIndex < 0 || unique.Count < 2)
        {
            return null;
        }

        if (unique.Count > 6)
        {
            var kept = new List<(string Text, bool IsCorrect)> { unique[correctIndex] };
            foreach (var (option, index) in unique.Select((option, index) => (option, index)))
            {
                if (index == correctIndex)
                {
                    continue;
                }

                kept.Add(option);
                if (kept.Count == 6)
                {
                    break;
                }
            }

            unique = kept;
            correctIndex = 0;
        }

        return new GeneratedQuizQuestionResponse(
            ItemKinds.MultipleChoice,
            prompt,
            string.IsNullOrEmpty(explanation) ? null : explanation,
            unique.Select((option, index) => new GeneratedQuizOptionResponse(option.Text, index == correctIndex)).ToList());
    }

    private static GeneratedQuizQuestionResponse? BuildTrueFalse(
        string prompt,
        string explanation,
        List<(string Text, bool IsCorrect)> options)
    {
        bool? correctTrue = null;
        foreach (var option in options)
        {
            if (!option.IsCorrect)
            {
                continue;
            }

            if (option.Text.StartsWith("verd", StringComparison.OrdinalIgnoreCase)
                || option.Text.Equals("true", StringComparison.OrdinalIgnoreCase)
                || option.Text.Equals("v", StringComparison.OrdinalIgnoreCase))
            {
                correctTrue = true;
            }
            else if (option.Text.StartsWith("fals", StringComparison.OrdinalIgnoreCase)
                || option.Text.Equals("false", StringComparison.OrdinalIgnoreCase)
                || option.Text.Equals("f", StringComparison.OrdinalIgnoreCase))
            {
                correctTrue = false;
            }
        }

        if (correctTrue is null && options.Count > 0 && options.Any(option => option.IsCorrect))
        {
            var firstCorrect = options.First(option => option.IsCorrect).Text;
            correctTrue = !firstCorrect.Contains("não", StringComparison.OrdinalIgnoreCase)
                && !firstCorrect.Contains("nao", StringComparison.OrdinalIgnoreCase)
                && !firstCorrect.StartsWith("fals", StringComparison.OrdinalIgnoreCase);
        }

        if (correctTrue is null)
        {
            return null;
        }

        return new GeneratedQuizQuestionResponse(
            ItemKinds.TrueFalse,
            prompt,
            string.IsNullOrEmpty(explanation) ? null : explanation,
            [
                new GeneratedQuizOptionResponse("Verdadeiro", correctTrue.Value),
                new GeneratedQuizOptionResponse("Falso", !correctTrue.Value)
            ]);
    }

    private static string? NormalizeKindFilter(string? kind)
    {
        var normalized = kind?.Trim().ToLowerInvariant();
        return normalized is ItemKinds.MultipleChoice or ItemKinds.TrueFalse ? normalized : null;
    }

    private static string NormalizeKind(string? kind)
    {
        var normalized = kind?.Trim().ToLowerInvariant().Replace('-', '_').Replace(' ', '_');
        return normalized is "true_false" or "verdadeiro_falso" or "tf"
            ? ItemKinds.TrueFalse
            : ItemKinds.MultipleChoice;
    }

    private static string Clean(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        var collapsed = Whitespace().Replace(value.Trim(), " ");
        return collapsed.Length <= max ? collapsed : collapsed[..max].TrimEnd();
    }

    [GeneratedRegex(@"```(?:json)?\s*(?<json>\{.*\})\s*```", RegexOptions.Singleline)]
    private static partial Regex FencePattern();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    private sealed class GeneratedQuizPayload
    {
        public List<GeneratedQuizQuestionDraft>? Questions { get; set; }
    }

    private sealed class GeneratedQuizQuestionDraft
    {
        public string? Kind { get; set; }
        public string? Prompt { get; set; }
        public string? Explanation { get; set; }
        public List<GeneratedQuizOptionDraft>? Options { get; set; }
    }

    private sealed class GeneratedQuizOptionDraft
    {
        public string? Text { get; set; }
        public bool IsCorrect { get; set; }
    }
}
