using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static partial class ActivityThemes
{
    public const string UncategorizedLabel = "Geral";
    public const int MaxLength = 40;

    public static readonly string[] Suggestions =
    [
        "Arquitetura",
        "Astronomia",
        "Matemática",
        "Português",
        "História",
        "Geografia",
        "Ciências",
        "Biologia",
        "Física",
        "Química",
        "Inglês",
        "Artes",
        "Computação",
        "Filosofia"
    ];

    public static string Fold(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
        var buffer = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            buffer.Append(char.ToLowerInvariant(character));
        }

        return Whitespace().Replace(buffer.ToString().Normalize(NormalizationForm.FormC), " ").Trim();
    }

    public static (string? Display, string? Key) Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return (null, null);
        }

        var cleaned = Whitespace().Replace(Disallowed().Replace(raw, " "), " ").Trim();
        if (cleaned.Length > MaxLength)
        {
            cleaned = cleaned[..MaxLength].TrimEnd();
        }

        if (cleaned.Length < 2)
        {
            return (null, null);
        }

        var key = Fold(cleaned);
        if (key is "geral" or "outros" or "outro")
        {
            return (null, null);
        }

        foreach (var suggestion in Suggestions)
        {
            if (Fold(suggestion) == key)
            {
                return (suggestion, key);
            }
        }

        return (cleaned, key);
    }

    public static string Label(string? display) =>
        string.IsNullOrWhiteSpace(display) ? UncategorizedLabel : display.Trim();

    public static int SortRank(string label)
    {
        if (string.Equals(label, UncategorizedLabel, StringComparison.OrdinalIgnoreCase))
        {
            return int.MaxValue;
        }

        var index = Array.FindIndex(
            Suggestions,
            item => string.Equals(item, label, StringComparison.OrdinalIgnoreCase));
        return index >= 0 ? index : Suggestions.Length;
    }

    public static bool IsUncategorizedAlias(string? raw)
    {
        var key = Fold(raw);
        return key is "geral" or "outros" or "outro";
    }

    [GeneratedRegex(@"[^\p{L}\p{N}\s\-'’]")]
    private static partial Regex Disallowed();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

public static partial class ActivityBlurb
{
    public const int MaxLength = 280;
    public const int ExcerptLength = 160;

    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var cleaned = Whitespace().Replace(raw.Trim(), " ");
        if (cleaned.Length > MaxLength)
        {
            cleaned = cleaned[..MaxLength].TrimEnd();
        }

        return cleaned.Length == 0 ? null : cleaned;
    }

    public static string? Excerpt(string? description, string? prepBody)
    {
        var source = !string.IsNullOrWhiteSpace(description) ? description : prepBody;
        if (string.IsNullOrWhiteSpace(source))
        {
            return null;
        }

        var plain = Strip(source);
        if (plain.Length == 0)
        {
            return null;
        }

        if (plain.Length <= ExcerptLength)
        {
            return plain;
        }

        return plain[..ExcerptLength].TrimEnd() + "…";
    }

    public static string Strip(string value)
    {
        var text = value.Replace("\r\n", "\n").Replace('\r', '\n');
        text = CodeFence().Replace(text, " ");
        text = InlineCode().Replace(text, "$1");
        text = Image().Replace(text, " ");
        text = Link().Replace(text, "$1");
        text = Heading().Replace(text, "");
        text = MarkdownMarks().Replace(text, " ");
        return Whitespace().Replace(text, " ").Trim();
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"```[\s\S]*?```")]
    private static partial Regex CodeFence();

    [GeneratedRegex(@"`([^`]*)`")]
    private static partial Regex InlineCode();

    [GeneratedRegex(@"!\[[^\]]*\]\([^)]*\)")]
    private static partial Regex Image();

    [GeneratedRegex(@"\[([^\]]*)\]\([^)]*\)")]
    private static partial Regex Link();

    [GeneratedRegex(@"^\s{0,3}#{1,6}\s+", RegexOptions.Multiline)]
    private static partial Regex Heading();

    [GeneratedRegex(@"[*_~>#]")]
    private static partial Regex MarkdownMarks();
}

public static class ActivityDifficulties
{
    public static readonly string[] All = ["iniciante", "intermediario", "avancado"];

    public static string? Normalize(string? value)
    {
        var folded = ActivityThemes.Fold(value);
        return folded switch
        {
            "iniciante" => "iniciante",
            "intermediario" => "intermediario",
            "avancado" => "avancado",
            _ => null
        };
    }

    public static List<string> FromItems(IEnumerable<ActivityItem> items)
    {
        var found = new List<string>();
        foreach (var item in items)
        {
            var difficulty = Normalize(item.Difficulty);
            if (difficulty is not null && !found.Contains(difficulty))
            {
                found.Add(difficulty);
            }
        }

        return found;
    }
}

public static class ActivityCatalog
{
    public static void Apply(Activity activity, string? theme, string? description)
    {
        var (display, key) = ActivityThemes.Normalize(theme);
        activity.Theme = display;
        activity.ThemeKey = key;
        activity.Description = ActivityBlurb.Normalize(description);
        activity.Difficulties = ActivityDifficulties.FromItems(activity.Items);
    }

    public static void CopyListing(Activity from, Activity to)
    {
        to.Theme = from.Theme;
        to.ThemeKey = from.ThemeKey;
        to.Description = from.Description;
        to.Difficulties = ActivityDifficulties.FromItems(to.Items);
    }
}
