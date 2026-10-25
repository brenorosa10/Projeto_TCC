using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public sealed record PublicCatalogCandidate(
    Guid Id,
    string Title,
    string Type,
    int ItemCount,
    DateTimeOffset CreatedAt,
    string? Theme,
    string? ThemeKey,
    string? Description,
    string? PrepBody,
    string? AuthorName,
    int PlayCount,
    IReadOnlyList<string> Difficulties,
    bool HasCover);

public sealed record PublicCatalogEntry(
    Guid Id,
    string Title,
    string Type,
    int ItemCount,
    DateTimeOffset CreatedAt,
    string? Theme,
    string? Description,
    string? AuthorName,
    int PlayCount,
    string? Difficulty,
    bool HasCover);

public sealed record PublicCatalogGroup(string Theme, int Total, IReadOnlyList<PublicCatalogEntry> Items);

public sealed record PublicCatalogFacet(string Name, int Count);

public sealed record PublicCatalogPageResult(
    IReadOnlyList<PublicCatalogEntry> Items,
    int Total,
    int Page,
    int PageSize,
    string Sort,
    IReadOnlyList<PublicCatalogFacet> Themes,
    IReadOnlyList<PublicCatalogGroup>? Groups);

public sealed record PublicCatalogCriteria(
    string? Query,
    string? Type,
    IReadOnlyList<string> ThemeKeys,
    bool IncludeUncategorized,
    string Sort,
    int? MinItems,
    int? MaxItems,
    string? Difficulty,
    int Page,
    int PageSize,
    bool Grouped)
{
    public string? Pattern => string.IsNullOrEmpty(Query) ? null : PublicCatalogLogic.ContainsPattern(Query);

    public PublicCatalogCriteria WithoutTheme() => this with
    {
        ThemeKeys = [],
        IncludeUncategorized = false
    };
}

public static partial class PublicCatalogLogic
{
    public const int DefaultPageSize = 12;
    public const int MaxPageSize = 48;
    public const int GroupPreviewSize = 8;
    public const int MaxQueryLength = 80;
    public const int MaxThemes = 12;
    public const int MaxItemBound = 500;

    public static readonly StringComparer TitleComparer = CreateTitleComparer();

    public static (PublicCatalogCriteria? Criteria, string? Error) Parse(
        string? q,
        string? type,
        IEnumerable<string>? themes,
        string? sort,
        int? minItems,
        int? maxItems,
        string? difficulty,
        int? page,
        int? pageSize,
        string? view)
    {
        string? query = null;
        if (!string.IsNullOrWhiteSpace(q))
        {
            query = Whitespace().Replace(q.Trim(), " ");
            if (query.Length > MaxQueryLength)
            {
                return (null, "A busca deve ter no máximo 80 caracteres.");
            }
        }

        var activityType = type?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(activityType) || activityType == "all")
        {
            activityType = null;
        }
        else if (activityType is not (ActivityTypes.Quiz or ActivityTypes.Flashcards))
        {
            return (null, "Tipo de atividade inválido.");
        }

        var sortKey = string.IsNullOrWhiteSpace(sort) ? "recent" : sort.Trim().ToLowerInvariant();
        if (sortKey is not ("recent" or "popular" or "alpha"))
        {
            return (null, "Ordenação inválida. Use mais recentes, mais jogados ou A–Z.");
        }

        if (minItems is < 0 or > MaxItemBound || maxItems is < 0 or > MaxItemBound)
        {
            return (null, "O filtro de quantidade de questões é inválido.");
        }

        if (minItems is int min && maxItems is int max && min > max)
        {
            return (null, "O intervalo de questões é inválido.");
        }

        string? difficultyKey = null;
        if (!string.IsNullOrWhiteSpace(difficulty))
        {
            difficultyKey = ActivityDifficulties.Normalize(difficulty);
            if (difficultyKey is null)
            {
                return (null, "Dificuldade inválida.");
            }
        }

        var pageNumber = page ?? 1;
        var size = pageSize ?? DefaultPageSize;
        if (pageNumber < 1)
        {
            return (null, "A página pedida é inválida.");
        }

        if (size < 1 || size > MaxPageSize)
        {
            return (null, "A quantidade por página deve ficar entre 1 e 48.");
        }

        var themeKeys = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var includeUncategorized = false;
        var themeCount = 0;
        foreach (var raw in SplitThemes(themes))
        {
            themeCount++;
            if (themeCount > MaxThemes)
            {
                return (null, "Escolha no máximo 12 temas.");
            }

            if (ActivityThemes.IsUncategorizedAlias(raw))
            {
                includeUncategorized = true;
                continue;
            }

            var (display, key) = ActivityThemes.Normalize(raw);
            if (key is null || display is null)
            {
                return (null, "Tema inválido.");
            }

            if (seen.Add(key))
            {
                themeKeys.Add(key);
            }
        }

        var grouped = string.Equals(view?.Trim(), "grouped", StringComparison.OrdinalIgnoreCase);
        return (new PublicCatalogCriteria(
            query,
            activityType,
            themeKeys,
            includeUncategorized,
            sortKey,
            minItems,
            maxItems,
            difficultyKey,
            pageNumber,
            size,
            grouped), null);
    }

    public static string ContainsPattern(string query)
    {
        var folded = ActivityThemes.Fold(query);
        var builder = new StringBuilder(folded.Length * 8);
        foreach (var character in folded)
        {
            builder.Append(ClassFor(character));
        }

        return builder.ToString();
    }

    public static string AnchoredPattern(string literal) => "^" + ContainsPattern(literal) + "$";

    public static bool Matches(PublicCatalogCandidate item, PublicCatalogCriteria criteria)
    {
        if (criteria.Type is not null
            && !string.Equals(item.Type, criteria.Type, StringComparison.Ordinal))
        {
            return false;
        }

        if (!ThemeMatches(item, criteria))
        {
            return false;
        }

        if (criteria.MinItems is int min && item.ItemCount < min)
        {
            return false;
        }

        if (criteria.MaxItems is int max && item.ItemCount > max)
        {
            return false;
        }

        if (criteria.Difficulty is not null && !item.Difficulties.Contains(criteria.Difficulty))
        {
            return false;
        }

        return criteria.Query is null || TextMatches(item, criteria.Query);
    }

    public static List<PublicCatalogCandidate> Sort(IReadOnlyList<PublicCatalogCandidate> items, string sort)
    {
        return sort switch
        {
            "popular" => items
                .OrderByDescending(item => item.PlayCount)
                .ThenByDescending(item => item.CreatedAt)
                .ThenBy(item => item.Title, TitleComparer)
                .ToList(),
            "alpha" => items
                .OrderBy(item => item.Title, TitleComparer)
                .ThenByDescending(item => item.CreatedAt)
                .ToList(),
            _ => items
                .OrderByDescending(item => item.CreatedAt)
                .ThenBy(item => item.Title, TitleComparer)
                .ToList()
        };
    }

    public static PublicCatalogPageResult Apply(
        IReadOnlyList<PublicCatalogCandidate> source,
        PublicCatalogCriteria criteria)
    {
        var filtered = Sort(source.Where(item => Matches(item, criteria)).ToList(), criteria.Sort);
        var facets = Facets(source.Where(item => Matches(item, criteria.WithoutTheme())).ToList());
        if (criteria.Grouped)
        {
            return new PublicCatalogPageResult(
                [],
                filtered.Count,
                1,
                criteria.PageSize,
                criteria.Sort,
                facets,
                Group(filtered));
        }

        var skip = (criteria.Page - 1) * criteria.PageSize;
        return new PublicCatalogPageResult(
            filtered.Skip(skip).Take(criteria.PageSize).Select(ToEntry).ToList(),
            filtered.Count,
            criteria.Page,
            criteria.PageSize,
            criteria.Sort,
            facets,
            null);
    }

    public static List<PublicCatalogGroup> Group(IReadOnlyList<PublicCatalogCandidate> sorted) =>
        sorted
            .GroupBy(item => ActivityThemes.Label(item.Theme))
            .Select(group => new PublicCatalogGroup(
                group.Key,
                group.Count(),
                group.Take(GroupPreviewSize).Select(ToEntry).ToList()))
            .OrderBy(group => ActivityThemes.SortRank(group.Theme))
            .ThenBy(group => group.Theme, TitleComparer)
            .ToList();

    public static List<PublicCatalogFacet> Facets(IReadOnlyList<PublicCatalogCandidate> items) =>
        items
            .GroupBy(item => ActivityThemes.Label(item.Theme))
            .Select(group => new PublicCatalogFacet(group.Key, group.Count()))
            .OrderBy(facet => ActivityThemes.SortRank(facet.Name))
            .ThenBy(facet => facet.Name, TitleComparer)
            .ToList();

    public static PublicCatalogEntry ToEntry(PublicCatalogCandidate item)
    {
        var difficulties = item.Difficulties.Distinct().ToList();
        return new PublicCatalogEntry(
            item.Id,
            item.Title,
            item.Type,
            item.ItemCount,
            item.CreatedAt,
            ActivityThemes.Label(item.Theme),
            ActivityBlurb.Excerpt(item.Description, item.PrepBody),
            string.IsNullOrWhiteSpace(item.AuthorName) ? null : item.AuthorName.Trim(),
            item.PlayCount,
            difficulties.Count == 1 ? difficulties[0] : null,
            item.HasCover);
    }

    private static bool ThemeMatches(PublicCatalogCandidate item, PublicCatalogCriteria criteria)
    {
        if (criteria.ThemeKeys.Count == 0 && !criteria.IncludeUncategorized)
        {
            return true;
        }

        var uncategorized = string.IsNullOrEmpty(item.ThemeKey);
        if (uncategorized && criteria.IncludeUncategorized)
        {
            return true;
        }

        return item.ThemeKey is not null && criteria.ThemeKeys.Contains(item.ThemeKey, StringComparer.Ordinal);
    }

    private static bool TextMatches(PublicCatalogCandidate item, string query)
    {
        var needle = ActivityThemes.Fold(query);
        if (needle.Length == 0)
        {
            return true;
        }

        return Contains(item.Title)
            || Contains(item.Description)
            || Contains(item.Theme)
            || Contains(item.PrepBody)
            || Contains(item.AuthorName);

        bool Contains(string? value) =>
            value is not null && ActivityThemes.Fold(value).Contains(needle, StringComparison.Ordinal);
    }

    private static IEnumerable<string> SplitThemes(IEnumerable<string>? themes)
    {
        if (themes is null)
        {
            yield break;
        }

        foreach (var value in themes)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            foreach (var part in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (!string.IsNullOrWhiteSpace(part))
                {
                    yield return part;
                }
            }
        }
    }

    private static string ClassFor(char character) => character switch
    {
        'a' => "[aáàâãäAÁÀÂÃÄ]",
        'e' => "[eéèêëEÉÈÊË]",
        'i' => "[iíìîïIÍÌÎÏ]",
        'o' => "[oóòôõöOÓÒÔÕÖ]",
        'u' => "[uúùûüUÚÙÛÜ]",
        'c' => "[cçCÇ]",
        'n' => "[nñNÑ]",
        'y' => "[yýÿYÝŸ]",
        _ => Regex.Escape(character.ToString())
    };

    private static StringComparer CreateTitleComparer()
    {
        try
        {
            return StringComparer.Create(CultureInfo.GetCultureInfo("pt-BR"), ignoreCase: true);
        }
        catch (CultureNotFoundException)
        {
            return StringComparer.OrdinalIgnoreCase;
        }
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}

public static class PublicCatalogFilter
{
    public static FilterDefinition<Activity> Build(
        PublicCatalogCriteria criteria,
        IReadOnlyList<Guid> authorIds,
        bool includeTheme = true)
    {
        var filters = new List<FilterDefinition<Activity>>
        {
            Builders<Activity>.Filter.Eq(activity => activity.IsPublic, true)
        };

        filters.Add(criteria.Type is null
            ? Builders<Activity>.Filter.In(activity => activity.Type, [ActivityTypes.Quiz, ActivityTypes.Flashcards])
            : Builders<Activity>.Filter.Eq(activity => activity.Type, criteria.Type));

        if (includeTheme)
        {
            var theme = ThemeFilter(criteria);
            if (theme is not null)
            {
                filters.Add(theme);
            }
        }

        if (criteria.Difficulty is not null)
        {
            var pattern = new BsonRegularExpression(PublicCatalogLogic.AnchoredPattern(criteria.Difficulty), "i");
            filters.Add(Builders<Activity>.Filter.Or(
                Builders<Activity>.Filter.AnyEq(activity => activity.Difficulties, criteria.Difficulty),
                Builders<Activity>.Filter.Regex("items.difficulty", pattern)));
        }

        if (criteria.Pattern is not null)
        {
            var pattern = new BsonRegularExpression(criteria.Pattern, "i");
            var text = new List<FilterDefinition<Activity>>
            {
                Builders<Activity>.Filter.Regex(activity => activity.Title, pattern),
                Builders<Activity>.Filter.Regex(activity => activity.Description, pattern),
                Builders<Activity>.Filter.Regex(activity => activity.Theme, pattern),
                Builders<Activity>.Filter.Regex("sections.body", pattern),
                Builders<Activity>.Filter.Regex("sections.title", pattern)
            };
            if (authorIds.Count > 0)
            {
                text.Add(Builders<Activity>.Filter.In(activity => activity.ProfessorId, authorIds));
            }

            filters.Add(Builders<Activity>.Filter.Or(text));
        }

        return Builders<Activity>.Filter.And(filters);
    }

    public static BsonDocument Render(FilterDefinition<Activity> filter)
    {
        var registry = BsonSerializer.SerializerRegistry;
        var serializer = registry.GetSerializer<Activity>();
        return filter.Render(new RenderArgs<Activity>(serializer, registry));
    }

    private static FilterDefinition<Activity>? ThemeFilter(PublicCatalogCriteria criteria)
    {
        var parts = new List<FilterDefinition<Activity>>();
        if (criteria.ThemeKeys.Count > 0)
        {
            parts.Add(Builders<Activity>.Filter.In(activity => activity.ThemeKey, criteria.ThemeKeys));
        }

        if (criteria.IncludeUncategorized)
        {
            parts.Add(Builders<Activity>.Filter.Or(
                Builders<Activity>.Filter.Eq(activity => activity.ThemeKey, null),
                Builders<Activity>.Filter.Eq(activity => activity.ThemeKey, "")));
        }

        return parts.Count switch
        {
            0 => null,
            1 => parts[0],
            _ => Builders<Activity>.Filter.Or(parts)
        };
    }
}
