using MongoDB.Bson;
using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public class PublicCatalogService(MongoDbContext db)
{
    public async Task<PublicCatalogResponse> SearchAsync(
        PublicCatalogCriteria criteria,
        CancellationToken cancellationToken)
    {
        var authorIds = await FindAuthorIdsAsync(criteria, cancellationToken);
        var listFilter = PublicCatalogFilter.Build(criteria, authorIds);
        var facetFilter = PublicCatalogFilter.Build(criteria, authorIds, includeTheme: false);
        var themes = await LoadFacetsAsync(facetFilter, criteria, cancellationToken);

        if (criteria.Grouped)
        {
            var groups = await LoadGroupsAsync(listFilter, criteria, cancellationToken);
            var total = groups.Sum(group => group.Total);
            return new PublicCatalogResponse(
                [],
                total,
                1,
                criteria.PageSize,
                criteria.Sort,
                themes,
                groups);
        }

        var (items, totalItems) = await LoadPageAsync(listFilter, criteria, cancellationToken);
        return new PublicCatalogResponse(
            items,
            totalItems,
            criteria.Page,
            criteria.PageSize,
            criteria.Sort,
            themes,
            null);
    }

    private async Task<List<Guid>> FindAuthorIdsAsync(
        PublicCatalogCriteria criteria,
        CancellationToken cancellationToken)
    {
        if (criteria.Pattern is null)
        {
            return [];
        }

        var regex = new BsonRegularExpression(criteria.Pattern, "i");
        var filter = Builders<Profile>.Filter.Or(
            Builders<Profile>.Filter.Regex(profile => profile.FullName, regex),
            Builders<Profile>.Filter.Regex(profile => profile.Username, regex));
        return await db.Profiles
            .Find(filter)
            .Limit(40)
            .Project(profile => profile.Id)
            .ToListAsync(cancellationToken);
    }

    private async Task<List<PublicThemeFacetResponse>> LoadFacetsAsync(
        FilterDefinition<Activity> filter,
        PublicCatalogCriteria criteria,
        CancellationToken cancellationToken)
    {
        var stages = Prefix(filter, criteria);
        stages.Add(new BsonDocument("$group", new BsonDocument
        {
            { "_id", new BsonDocument("$ifNull", new BsonArray { "$themeKey", "" }) },
            { "label", new BsonDocument("$max", "$theme") },
            { "count", new BsonDocument("$sum", 1) }
        }));

        var docs = await AggregateAsync(stages, criteria, cancellationToken);
        return docs
            .Select(doc => new PublicThemeFacetResponse(ReadLabel(doc), ReadInt(doc, "count")))
            .OrderBy(facet => ActivityThemes.SortRank(facet.Name))
            .ThenBy(facet => facet.Name, PublicCatalogLogic.TitleComparer)
            .ToList();
    }

    private async Task<List<PublicThemeGroupResponse>> LoadGroupsAsync(
        FilterDefinition<Activity> filter,
        PublicCatalogCriteria criteria,
        CancellationToken cancellationToken)
    {
        var stages = Prefix(filter, criteria);
        stages.Add(new BsonDocument("$group", new BsonDocument
        {
            { "_id", new BsonDocument("$ifNull", new BsonArray { "$themeKey", "" }) },
            { "label", new BsonDocument("$max", "$theme") },
            { "count", new BsonDocument("$sum", 1) },
            { "preview", new BsonDocument("$topN", new BsonDocument
                {
                    { "n", PublicCatalogLogic.GroupPreviewSize },
                    { "sortBy", SortDocument(criteria.Sort) },
                    { "output", PreviewOutput() }
                })
            }
        }));

        var docs = await AggregateAsync(stages, criteria, cancellationToken);
        var previews = docs.SelectMany(ReadPreview).ToList();
        var names = await NamesAsync(previews.Select(ReadProfessorId), cancellationToken);
        return docs
            .Select(doc =>
            {
                var items = ReadPreview(doc).Select(row => MapRow(row, names)).ToList();
                return new PublicThemeGroupResponse(ReadLabel(doc), ReadInt(doc, "count"), items);
            })
            .OrderBy(group => ActivityThemes.SortRank(group.Theme))
            .ThenBy(group => group.Theme, PublicCatalogLogic.TitleComparer)
            .ToList();
    }

    private async Task<(List<PublicActivitySummaryResponse> Items, int Total)> LoadPageAsync(
        FilterDefinition<Activity> filter,
        PublicCatalogCriteria criteria,
        CancellationToken cancellationToken)
    {
        var stages = Prefix(filter, criteria);
        stages.Add(new BsonDocument("$facet", new BsonDocument
        {
            { "items", new BsonArray
                {
                    new BsonDocument("$sort", SortDocument(criteria.Sort)),
                    new BsonDocument("$skip", (criteria.Page - 1) * criteria.PageSize),
                    new BsonDocument("$limit", criteria.PageSize)
                }
            },
            { "total", new BsonArray { new BsonDocument("$count", "n") } }
        }));

        var docs = await AggregateAsync(stages, criteria, cancellationToken);
        if (docs.Count == 0)
        {
            return ([], 0);
        }

        var facet = docs[0];
        var rows = facet.GetValue("items", new BsonArray()).AsBsonArray
            .Where(value => value.IsBsonDocument)
            .Select(value => value.AsBsonDocument)
            .ToList();
        var totalArray = facet.GetValue("total", new BsonArray()).AsBsonArray;
        var total = totalArray.Count == 0 ? 0 : ReadIntValue(totalArray[0].AsBsonDocument.GetValue("n", 0));
        var names = await NamesAsync(rows.Select(ReadProfessorId), cancellationToken);
        return (rows.Select(row => MapRow(row, names)).ToList(), total);
    }

    private async Task<List<BsonDocument>> AggregateAsync(
        List<BsonDocument> stages,
        PublicCatalogCriteria criteria,
        CancellationToken cancellationToken)
    {
        var options = new AggregateOptions();
        if (criteria.Sort == "alpha")
        {
            options.Collation = new Collation("pt", strength: CollationStrength.Secondary);
        }

        var pipeline = PipelineDefinition<Activity, BsonDocument>.Create(stages);
        return await db.Activities.Aggregate(pipeline, options, cancellationToken).ToListAsync(cancellationToken);
    }

    private async Task<Dictionary<Guid, string>> NamesAsync(
        IEnumerable<Guid> ids,
        CancellationToken cancellationToken)
    {
        var list = ids.Where(id => id != Guid.Empty).Distinct().ToList();
        if (list.Count == 0)
        {
            return [];
        }

        var profiles = await db.Profiles
            .Find(Builders<Profile>.Filter.In(profile => profile.Id, list))
            .ToListAsync(cancellationToken);
        return profiles.ToDictionary(
            profile => profile.Id,
            profile => profile.Username ?? profile.FullName ?? profile.Email);
    }

    private static List<BsonDocument> Prefix(FilterDefinition<Activity> filter, PublicCatalogCriteria criteria)
    {
        var stages = new List<BsonDocument>
        {
            new("$match", PublicCatalogFilter.Render(filter)),
            new("$addFields", AddFields())
        };
        var itemMatch = ItemMatch(criteria);
        if (itemMatch is not null)
        {
            stages.Add(itemMatch);
        }

        stages.Add(new BsonDocument("$project", new BsonDocument
        {
            { "title", 1 },
            { "type", 1 },
            { "createdAt", 1 },
            { "professorId", 1 },
            { "theme", 1 },
            { "themeKey", 1 },
            { "description", 1 },
            { "prepBody", 1 },
            { "playCount", 1 },
            { "itemCount", 1 },
            { "hasCover", 1 },
            { "rawDifficulties", 1 }
        }));
        return stages;
    }

    private static BsonDocument AddFields() => new()
    {
        { "itemCount", new BsonDocument("$size", new BsonDocument("$ifNull", new BsonArray { "$items", new BsonArray() })) },
        { "playCount", new BsonDocument("$ifNull", new BsonArray { "$playCount", 0 }) },
        { "prepBody", new BsonDocument("$substrCP", new BsonArray { new BsonDocument("$ifNull", new BsonArray { PrepBodyExpression(), "" }), 0, 240 }) },
        { "hasCover", HasCoverExpression() },
        { "rawDifficulties", DifficultiesExpression() }
    };

    private static BsonDocument? ItemMatch(PublicCatalogCriteria criteria)
    {
        if (criteria.MinItems is null && criteria.MaxItems is null)
        {
            return null;
        }

        var range = new BsonDocument();
        if (criteria.MinItems is int min)
        {
            range.Add("$gte", min);
        }

        if (criteria.MaxItems is int max)
        {
            range.Add("$lte", max);
        }

        return new BsonDocument("$match", new BsonDocument("itemCount", range));
    }

    private static BsonDocument PrepBodyExpression() => new("$let", new BsonDocument
    {
        { "vars", new BsonDocument("preps", new BsonDocument("$filter", new BsonDocument
            {
                { "input", new BsonDocument("$ifNull", new BsonArray { "$sections", new BsonArray() }) },
                { "as", "section" },
                { "cond", new BsonDocument("$eq", new BsonArray { "$$section.role", SectionRoles.Prep }) }
            }))
        },
        { "in", new BsonDocument("$arrayElemAt", new BsonArray
            {
                new BsonDocument("$map", new BsonDocument
                {
                    { "input", "$$preps" },
                    { "as", "prep" },
                    { "in", "$$prep.body" }
                }),
                0
            })
        }
    });

    private static BsonDocument HasCoverExpression() => new("$anyElementTrue", new BsonDocument("$map", new BsonDocument
    {
        { "input", new BsonDocument("$ifNull", new BsonArray { "$sections", new BsonArray() }) },
        { "as", "section" },
        { "in", new BsonDocument("$and", new BsonArray
            {
                new BsonDocument("$eq", new BsonArray { "$$section.role", SectionRoles.Prep }),
                new BsonDocument("$ne", new BsonArray
                {
                    new BsonDocument("$ifNull", new BsonArray { "$$section.imageBytes", BsonNull.Value }),
                    BsonNull.Value
                })
            })
        }
    }));

    private static BsonDocument DifficultiesExpression() => new("$setUnion", new BsonArray
    {
        new BsonDocument("$ifNull", new BsonArray { "$difficulties", new BsonArray() }),
        new BsonDocument("$map", new BsonDocument
        {
            { "input", new BsonDocument("$ifNull", new BsonArray { "$items", new BsonArray() }) },
            { "as", "item" },
            { "in", new BsonDocument("$ifNull", new BsonArray { "$$item.difficulty", "" }) }
        })
    });

    private static BsonDocument PreviewOutput() => new()
    {
        { "_id", "$_id" },
        { "title", "$title" },
        { "type", "$type" },
        { "createdAt", "$createdAt" },
        { "professorId", "$professorId" },
        { "theme", "$theme" },
        { "description", "$description" },
        { "prepBody", "$prepBody" },
        { "playCount", "$playCount" },
        { "itemCount", "$itemCount" },
        { "hasCover", "$hasCover" },
        { "rawDifficulties", "$rawDifficulties" }
    };

    private static BsonDocument SortDocument(string sort) => sort switch
    {
        "popular" => new BsonDocument { { "playCount", -1 }, { "createdAt", -1 }, { "title", 1 } },
        "alpha" => new BsonDocument { { "title", 1 }, { "createdAt", -1 } },
        _ => new BsonDocument { { "createdAt", -1 }, { "title", 1 } }
    };

    private static PublicActivitySummaryResponse MapRow(
        BsonDocument doc,
        IReadOnlyDictionary<Guid, string> names)
    {
        var professorId = ReadProfessorId(doc);
        names.TryGetValue(professorId, out var name);
        var difficulties = ReadDifficulties(doc);
        return new PublicActivitySummaryResponse(
            ReadGuid(doc, "_id"),
            ReadString(doc, "title"),
            ReadString(doc, "type"),
            ReadInt(doc, "itemCount"),
            ReadDate(doc, "createdAt"),
            name,
            ActivityThemes.Label(ReadOptionalString(doc, "theme")),
            ActivityBlurb.Excerpt(ReadOptionalString(doc, "description"), ReadOptionalString(doc, "prepBody")),
            ReadBool(doc, "hasCover"),
            ReadInt(doc, "playCount"),
            difficulties.Count == 1 ? difficulties[0] : null);
    }

    private static string ReadLabel(BsonDocument doc) =>
        ActivityThemes.Label(ReadOptionalString(doc, "label"));

    private static IEnumerable<BsonDocument> ReadPreview(BsonDocument doc)
    {
        if (!doc.TryGetValue("preview", out var value) || !value.IsBsonArray)
        {
            return [];
        }

        return value.AsBsonArray.Where(item => item.IsBsonDocument).Select(item => item.AsBsonDocument);
    }

    private static List<string> ReadDifficulties(BsonDocument doc)
    {
        if (!doc.TryGetValue("rawDifficulties", out var value) || !value.IsBsonArray)
        {
            return [];
        }

        var found = new List<string>();
        foreach (var item in value.AsBsonArray)
        {
            if (!item.IsString)
            {
                continue;
            }

            var normalized = ActivityDifficulties.Normalize(item.AsString);
            if (normalized is not null && !found.Contains(normalized))
            {
                found.Add(normalized);
            }
        }

        return found;
    }

    private static Guid ReadProfessorId(BsonDocument doc) => ReadGuid(doc, "professorId");

    private static Guid ReadGuid(BsonDocument doc, string name)
    {
        if (!doc.TryGetValue(name, out var value) || value.IsBsonNull)
        {
            return Guid.Empty;
        }

        if (value.IsGuid)
        {
            return value.AsGuid;
        }

        if (value.BsonType == BsonType.Binary)
        {
            return value.AsBsonBinaryData.ToGuid(GuidRepresentation.Standard);
        }

        return value.IsString && Guid.TryParse(value.AsString, out var parsed) ? parsed : Guid.Empty;
    }

    private static DateTimeOffset ReadDate(BsonDocument doc, string name)
    {
        if (!doc.TryGetValue(name, out var value) || !value.IsValidDateTime)
        {
            return DateTimeOffset.UnixEpoch;
        }

        return new DateTimeOffset(DateTime.SpecifyKind(value.ToUniversalTime(), DateTimeKind.Utc));
    }

    private static string ReadString(BsonDocument doc, string name) => ReadOptionalString(doc, name) ?? "";

    private static string? ReadOptionalString(BsonDocument doc, string name)
    {
        if (!doc.TryGetValue(name, out var value) || value.IsBsonNull)
        {
            return null;
        }

        var text = value.IsString ? value.AsString : value.ToString();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static bool ReadBool(BsonDocument doc, string name) =>
        doc.TryGetValue(name, out var value) && value.IsBoolean && value.AsBoolean;

    private static int ReadInt(BsonDocument doc, string name) =>
        doc.TryGetValue(name, out var value) ? ReadIntValue(value) : 0;

    private static int ReadIntValue(BsonValue value)
    {
        if (value.IsBsonNull || !value.IsNumeric)
        {
            return 0;
        }

        return Convert.ToInt32(value.ToInt64());
    }
}
