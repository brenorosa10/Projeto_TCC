using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class ContentBlocks
{
    public static readonly string[] Difficulties = ["iniciante", "intermediario", "avancado"];

    public static List<ContentBlock>? Normalize(IEnumerable<ContentBlockRequest>? incoming)
    {
        var blocks = (incoming ?? [])
            .Select(block => new ContentBlock
            {
                Type = NormalizeType(block.Type),
                Content = block.Content?.Trim() ?? string.Empty,
                Language = NormalizeType(block.Type) == ContentBlockTypes.Code
                    ? TrimToNull(block.Language)?.ToLowerInvariant()
                    : null
            })
            .Where(block => block.Content.Length > 0)
            .ToList();

        return blocks.Count == 0 ? null : blocks;
    }

    public static IReadOnlyList<ContentBlockResponse>? ToResponse(IEnumerable<ContentBlock>? blocks)
    {
        var list = (blocks ?? [])
            .Where(block => !string.IsNullOrWhiteSpace(block.Content))
            .Select(block => new ContentBlockResponse(block.Type, block.Content, block.Language))
            .ToList();
        return list.Count == 0 ? null : list;
    }

    public static string? Flatten(params IEnumerable<ContentBlock>?[] groups)
    {
        var parts = new List<string>();
        foreach (var group in groups)
        {
            foreach (var block in group ?? [])
            {
                if (string.IsNullOrWhiteSpace(block.Content))
                {
                    continue;
                }

                parts.Add(block.Type == ContentBlockTypes.Code
                    ? Fence(block.Language, block.Content)
                    : block.Content.Trim());
            }
        }

        return parts.Count == 0 ? null : string.Join("\n\n", parts);
    }

    public static bool HasPrompt(
        string? prompt,
        IEnumerable<ContentBlock>? intro,
        IEnumerable<ContentBlock>? promptBlocks) =>
        !string.IsNullOrWhiteSpace(prompt)
        || (intro ?? []).Any(block => !string.IsNullOrWhiteSpace(block.Content))
        || (promptBlocks ?? []).Any(block => !string.IsNullOrWhiteSpace(block.Content));

    public static string? Validate(IEnumerable<ContentBlockRequest>? incoming)
    {
        foreach (var block in incoming ?? [])
        {
            var type = (block.Type ?? string.Empty).Trim().ToLowerInvariant();
            if (!string.IsNullOrEmpty(type) && !ContentBlockTypes.All.Contains(type))
            {
                return "Cada bloco deve ser markdown, code ou question.";
            }
        }

        return null;
    }

    public static List<string>? CleanList(IEnumerable<string>? values)
    {
        var cleaned = (values ?? [])
            .Select(value => value.Trim())
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return cleaned.Count == 0 ? null : cleaned;
    }

    public static string? NormalizeDifficulty(string? value)
    {
        var difficulty = value?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(difficulty))
        {
            return null;
        }

        return Difficulties.Contains(difficulty) ? difficulty : null;
    }

    public static bool SupportsReflection(string kind) =>
        kind is ItemKinds.MultipleChoice or ItemKinds.TrueFalse;

    public static string? CheckReflection(ActivityItem item, string? textAnswer)
    {
        if (!item.RequireExplanation || !SupportsReflection(item.Kind))
        {
            return null;
        }

        var min = item.ExplanationMinLength is >= 1 and <= 2000 ? item.ExplanationMinLength.Value : 20;
        var text = textAnswer?.Trim() ?? string.Empty;
        return text.Length < min
            ? $"Explique seu raciocínio com pelo menos {min} caracteres."
            : null;
    }

    public static string? CombinedExplanation(ActivityItem item)
    {
        var messages = string.Join("\n\n", item.FeedbackMessages ?? []).Trim();
        var blocks = Flatten(item.FeedbackBlocks);
        if (!string.IsNullOrWhiteSpace(messages) || !string.IsNullOrWhiteSpace(blocks))
        {
            return string.Join("\n\n", new[] { messages, blocks }.Where(part => !string.IsNullOrWhiteSpace(part)));
        }

        return string.IsNullOrWhiteSpace(item.Explanation) ? null : item.Explanation.Trim();
    }

    private static string NormalizeType(string? type)
    {
        var value = type?.Trim().ToLowerInvariant();
        return value is not null && ContentBlockTypes.All.Contains(value)
            ? value
            : ContentBlockTypes.Markdown;
    }

    private static string Fence(string? language, string content)
    {
        var lang = string.IsNullOrWhiteSpace(language) ? string.Empty : language.Trim();
        return $"```{lang}\n{content.TrimEnd()}\n```";
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
