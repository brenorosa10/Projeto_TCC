using MongoDB.Bson.Serialization.Conventions;
using Astro.Api.Domain;
using Astro.Api.Services;
using Xunit;

namespace Astro.Api.Tests;

public class PublicCatalogTests
{
    static PublicCatalogTests()
    {
        ConventionRegistry.Register(
            "astro-catalog-tests",
            new ConventionPack { new CamelCaseElementNameConvention() },
            _ => true);
    }

    [Fact]
    public void SearchPattern_EscapesRegexMetacharacters()
    {
        Assert.Equal(@"\.\*", PublicCatalogLogic.ContainsPattern(".*"));
        var inlineFlag = PublicCatalogLogic.ContainsPattern("(?i)admin");
        Assert.StartsWith(@"\(\?", inlineFlag);
        Assert.DoesNotContain("(?i)", inlineFlag);
        Assert.Contains("[oóòôõöOÓÒÔÕÖ]", PublicCatalogLogic.ContainsPattern("historia"));
    }

    [Fact]
    public void MongoFilter_DoesNotTreatUserTextAsRegex()
    {
        var parsed = PublicCatalogLogic.Parse(
            q: ".*",
            type: "quiz",
            themes: ["História", "Geral"],
            sort: "recent",
            minItems: null,
            maxItems: null,
            difficulty: "iniciante",
            page: 1,
            pageSize: 12,
            view: "list");

        Assert.Null(parsed.Error);
        var rendered = PublicCatalogFilter.Render(PublicCatalogFilter.Build(parsed.Criteria!, [])).ToString();

        Assert.Contains("themeKey", rendered);
        Assert.Contains(@"\\.\\*", rendered);
        Assert.DoesNotContain("\"pattern\" : \".*\"", rendered);
        Assert.DoesNotContain("\"pattern\": \".*\"", rendered);
        Assert.Contains("historia", rendered);
        Assert.Contains("isPublic", rendered);
        Assert.Contains("quiz", rendered);
        Assert.Contains("iniciante", rendered);
    }

    [Fact]
    public void LiteralDotStar_DoesNotMatchEveryTitle()
    {
        var items = new[]
        {
            Sample("abc", theme: "História"),
            Sample("a.c", theme: "História"),
            Sample("tudo.*", theme: "História")
        };
        var criteria = MustParse(q: ".*");

        var matches = items.Where(item => PublicCatalogLogic.Matches(item, criteria)).Select(item => item.Title).ToArray();

        Assert.Equal(["tudo.*"], matches);
    }

    [Fact]
    public void Search_MatchesTitleDescriptionThemeAuthorAndPrep_IgnoringAccents()
    {
        var items = new[]
        {
            Sample("Sistema Solar", theme: "Astronomia", description: "Planetas internos"),
            Sample("Relevo", theme: "Geografia", prep: "Planaltos e depressões"),
            Sample("Equações", theme: "Matemática", author: "Ana Souza"),
            Sample("Outro assunto", theme: "Física")
        };

        Assert.Equal(["Sistema Solar"], Titles(items, MustParse(q: "planetas")));
        Assert.Equal(["Relevo"], Titles(items, MustParse(q: "planalto")));
        Assert.Equal(["Equações"], Titles(items, MustParse(q: "souza")));
        Assert.Equal(["Sistema Solar"], Titles(items, MustParse(q: "astronomia")));
        Assert.Equal(["Equações"], Titles(items, MustParse(q: "equacoes")));
        Assert.Empty(Titles(items, MustParse(q: "biologia")));
    }

    [Fact]
    public void Themes_GroupMissingAsGeral_AndFilterIsAccentInsensitive()
    {
        var items = new[]
        {
            Sample("Órbitas", theme: "astronomia", createdAt: Date(3)),
            Sample("Estrelas", theme: "Astronomia", createdAt: Date(2)),
            Sample("Sem tema", theme: null, createdAt: Date(1)),
            Sample("Outros legado", theme: "Outros", createdAt: Date(4)),
            Sample("Barroco", theme: "Arte barroca", createdAt: Date(5))
        };

        var grouped = PublicCatalogLogic.Apply(items, MustParse(view: "grouped"));
        Assert.Equal(["Astronomia", "Arte barroca", "Geral"], grouped.Groups!.Select(group => group.Theme).ToArray());
        Assert.Equal(2, grouped.Groups!.Single(group => group.Theme == "Geral").Total);
        Assert.Equal(["Órbitas", "Estrelas"], grouped.Groups!.Single(group => group.Theme == "Astronomia").Items.Select(item => item.Title).ToArray());

        var historia = PublicCatalogLogic.Apply(items, MustParse(themes: ["História"]));
        Assert.Empty(historia.Items);

        var onlyGeral = PublicCatalogLogic.Apply(items, MustParse(themes: ["Geral"]));
        Assert.Equal(["Outros legado", "Sem tema"], onlyGeral.Items.Select(item => item.Title).ToArray());

        var both = PublicCatalogLogic.Apply(items, MustParse(themes: ["astronomia", "outros"], view: "grouped"));
        Assert.Equal(4, both.Total);
        Assert.Contains(both.Themes, facet => facet.Name == "Arte barroca" && facet.Count == 1);
        Assert.Equal(2, both.Groups!.Single(group => group.Theme == "Astronomia").Total);
    }

    [Fact]
    public void Filters_ItemCountDifficultyAndSorts()
    {
        var items = new[]
        {
            Sample("Curto", theme: "Física", itemCount: 4, difficulty: "iniciante", plays: 1, createdAt: Date(1)),
            Sample("Médio", theme: "Física", itemCount: 8, difficulty: "intermediario", plays: 9, createdAt: Date(2)),
            Sample("Longo", theme: "Física", itemCount: 12, difficulty: "avançado", plays: 3, createdAt: Date(3)),
            Sample("Misto", theme: "Física", itemCount: 8, difficulties: ["iniciante", "avancado"], plays: 0, createdAt: Date(4))
        };

        Assert.Equal(["Curto"], Titles(items, MustParse(maxItems: 5)));
        Assert.Equal(["Médio", "Misto"], Titles(items, MustParse(minItems: 6, maxItems: 10, sort: "alpha")));
        Assert.Equal(["Longo"], Titles(items, MustParse(minItems: 11)));
        Assert.Equal(["Misto", "Curto"], Titles(items, MustParse(difficulty: "Iniciante")));
        Assert.Equal(["Misto", "Longo"], Titles(items, MustParse(difficulty: "avancado")));
        Assert.Equal(
            ["Médio", "Longo", "Curto", "Misto"],
            Titles(items, MustParse(sort: "popular")));
        Assert.Equal(
            ["Curto", "Longo", "Médio", "Misto"],
            Titles(items, MustParse(sort: "alpha")));
    }

    [Fact]
    public void Pagination_AndGroupPreview_StopAtTheRequestedWindow()
    {
        var items = Enumerable.Range(1, 25)
            .Select(index => Sample($"Quiz {index:00}", theme: index <= 9 ? "História" : null, createdAt: Date(index)))
            .ToArray();

        var page = PublicCatalogLogic.Apply(items, MustParse(page: 2, pageSize: 12, sort: "alpha"));
        Assert.Equal(25, page.Total);
        Assert.Equal(12, page.Items.Count);
        Assert.Equal("Quiz 13", page.Items[0].Title);
        Assert.Null(page.Groups);

        var last = PublicCatalogLogic.Apply(items, MustParse(page: 3, pageSize: 12, sort: "alpha"));
        Assert.Single(last.Items);

        var grouped = PublicCatalogLogic.Apply(items, MustParse(view: "grouped"));
        var history = grouped.Groups!.Single(group => group.Theme == "História");
        Assert.Equal(9, history.Total);
        Assert.Equal(8, history.Items.Count);
        Assert.Equal("Quiz 09", history.Items[0].Title);
    }

    [Fact]
    public void Parse_RejectsUnsafeOrInvalidFilters()
    {
        Assert.NotNull(PublicCatalogLogic.Parse(new string('a', 81), null, null, null, null, null, null, null, null, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, "prova", null, null, null, null, null, null, null, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, null, null, "rank", null, null, null, null, null, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, null, null, null, 10, 2, null, null, null, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, null, null, null, null, null, "{$gt:1}", null, null, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, null, null, null, null, null, null, 0, null, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, null, null, null, null, null, null, 1, 100, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, null, Enumerable.Repeat("Tema extra", 13), null, null, null, null, null, null, null).Error);
        Assert.NotNull(PublicCatalogLogic.Parse(null, null, ["***"], null, null, null, null, null, null, null).Error);
    }

    [Fact]
    public void NormalizeTheme_CanonicalizesSuggestions_AndDropsOperators()
    {
        Assert.Equal(("História", "historia"), ActivityThemes.Normalize("  história  "));
        Assert.Equal((null, null), ActivityThemes.Normalize("Outros"));
        Assert.Equal((null, null), ActivityThemes.Normalize("Geral"));
        var (display, key) = ActivityThemes.Normalize("{$ne: null}");
        Assert.DoesNotContain("$", display + key);
        Assert.DoesNotContain("{", display + key);
        Assert.Equal("ne null", key);
    }

    [Fact]
    public void Apply_KeepsPlayCount_AndStoresDifficultyAndBlurb()
    {
        var activity = new Activity
        {
            PlayCount = 4,
            Items =
            [
                new ActivityItem { Difficulty = "Iniciante" },
                new ActivityItem { Difficulty = "iniciante" },
                new ActivityItem { Difficulty = "avançado" }
            ]
        };

        ActivityCatalog.Apply(activity, "historia", "  Um resumo\ncurto  ");

        Assert.Equal(4, activity.PlayCount);
        Assert.Equal("História", activity.Theme);
        Assert.Equal("historia", activity.ThemeKey);
        Assert.Equal("Um resumo curto", activity.Description);
        Assert.Equal(["iniciante", "avancado"], activity.Difficulties);
    }

    [Fact]
    public void Excerpt_PrefersDescriptionAndStripsMarkdown()
    {
        Assert.Equal(
            "Título Abertura com código",
            ActivityBlurb.Excerpt(null, "# Título\nAbertura com `código`"));
        Assert.Equal("Resumo da vitrine", ActivityBlurb.Excerpt("Resumo da vitrine", "Texto longo da pré-seção"));
        Assert.Null(ActivityBlurb.Excerpt("   ", null));
    }

    [Fact]
    public void Card_ShowsSingleDifficultyAndGeralLabel()
    {
        var entry = PublicCatalogLogic.ToEntry(Sample("Avulso", theme: null, difficulty: "iniciante", prep: "Leia antes"));
        Assert.Equal("Geral", entry.Theme);
        Assert.Equal("iniciante", entry.Difficulty);
        Assert.Equal("Leia antes", entry.Description);

        var mixed = PublicCatalogLogic.ToEntry(Sample("Misto", difficulties: ["iniciante", "avancado"]));
        Assert.Null(mixed.Difficulty);
    }

    private static string[] Titles(IEnumerable<PublicCatalogCandidate> items, PublicCatalogCriteria criteria) =>
        PublicCatalogLogic.Apply(items.ToList(), criteria).Items.Select(item => item.Title).ToArray();

    private static PublicCatalogCriteria MustParse(
        string? q = null,
        string? type = null,
        IEnumerable<string>? themes = null,
        string? sort = null,
        int? minItems = null,
        int? maxItems = null,
        string? difficulty = null,
        int? page = null,
        int? pageSize = null,
        string? view = null)
    {
        var parsed = PublicCatalogLogic.Parse(q, type, themes, sort, minItems, maxItems, difficulty, page, pageSize, view);
        Assert.Null(parsed.Error);
        return parsed.Criteria!;
    }

    private static PublicCatalogCandidate Sample(
        string title,
        string? theme = "História",
        string? description = null,
        string? prep = null,
        string? author = "Professora",
        int itemCount = 5,
        int plays = 0,
        string? difficulty = null,
        IReadOnlyList<string>? difficulties = null,
        DateTimeOffset? createdAt = null,
        string type = "quiz")
    {
        var (display, key) = ActivityThemes.Normalize(theme);
        var stored = difficulties
            ?? (difficulty is null ? [] : new[] { ActivityDifficulties.Normalize(difficulty)! });
        return new PublicCatalogCandidate(
            Guid.NewGuid(),
            title,
            type,
            itemCount,
            createdAt ?? Date(1),
            display,
            key,
            description,
            prep,
            author,
            plays,
            stored,
            false);
    }

    private static DateTimeOffset Date(int day) => new(2026, 1, day, 12, 0, 0, TimeSpan.Zero);
}
