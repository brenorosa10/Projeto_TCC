using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class StudyAnswerFormatter
{
    public static string? SelectedOptionLabels(
        ActivityItem? item,
        Guid? selectedOptionId,
        IReadOnlyList<Guid>? selectedOptionIds)
    {
        if (item is null || item.Kind is not (ItemKinds.MultipleChoice or ItemKinds.TrueFalse))
        {
            return null;
        }

        return OptionText(item, selectedOptionIds, selectedOptionId);
    }

    public static string? StudentAnswer(ActivityItem? item, StudySessionAnswer answer)
    {
        if (item is null)
        {
            return Clean(answer.TextAnswer);
        }

        return item.Kind switch
        {
            ItemKinds.MultipleChoice or ItemKinds.TrueFalse => OptionText(
                item,
                answer.SelectedOptionIds,
                answer.SelectedOptionId),
            ItemKinds.ShortAnswer => Clean(answer.TextAnswer),
            ItemKinds.Ordering => OrderingText(item, answer.OrderedIds),
            ItemKinds.Cloze => ClozeText(answer.ClozeAnswers),
            ItemKinds.Categorize => CategoryText(item, answer.CategoryPlacements, correct: false),
            ItemKinds.Flashcard => answer.Remembered switch
            {
                true => "Lembrei",
                false => "Não lembrei",
                _ => null
            },
            _ => Clean(answer.TextAnswer)
        };
    }

    public static string? CorrectAnswer(ActivityItem? item)
    {
        if (item is null || item.Kind == ItemKinds.Flashcard)
        {
            return null;
        }

        return item.Kind switch
        {
            ItemKinds.MultipleChoice or ItemKinds.TrueFalse => Join(
                item.Options?
                    .Where(option => option.IsCorrect)
                    .OrderBy(option => option.Position)
                    .Select(OptionLabel)),
            ItemKinds.ShortAnswer => Join(item.AcceptedAnswers, " ou "),
            ItemKinds.Ordering => Join(
                item.OrderEntries?.OrderBy(entry => entry.Position).Select(entry => entry.Text),
                " → "),
            ItemKinds.Cloze => Join(
                item.ClozeBlanks?
                    .OrderBy(blank => blank.Position)
                    .Select(blank => string.Join(" / ", blank.AcceptedAnswers.Where(answer => !string.IsNullOrWhiteSpace(answer))))),
            ItemKinds.Matching => Join(
                item.Pairs?.Select(pair => $"{pair.Left} → {pair.Right}")),
            ItemKinds.Categorize => CategoryText(item, null, correct: true),
            _ => null
        };
    }

    private static string? OptionText(ActivityItem item, IReadOnlyList<Guid>? selectedIds, Guid? selectedId)
    {
        var ids = selectedIds is { Count: > 0 }
            ? selectedIds
            : selectedId is Guid id
                ? [id]
                : [];
        if (ids.Count == 0 || item.Options is null)
        {
            return null;
        }

        var textById = item.Options.ToDictionary(option => option.Id, OptionLabel);
        return Join(ids.Select(id => textById.GetValueOrDefault(id)));
    }

    public static IReadOnlyList<string>? SelectedImageUrls(ActivityItem? item, StudySessionAnswer answer)
    {
        if (item?.Options is not { Count: > 0 })
        {
            return null;
        }

        var ids = answer.SelectedOptionIds is { Count: > 0 }
            ? answer.SelectedOptionIds
            : answer.SelectedOptionId is Guid id
                ? new List<Guid> { id }
                : [];
        return ImageUrls(item.Options.Where(option => ids.Contains(option.Id)));
    }

    public static IReadOnlyList<string>? CorrectImageUrls(ActivityItem? item)
    {
        if (item?.Options is not { Count: > 0 })
        {
            return null;
        }

        return ImageUrls(item.Options.Where(option => option.IsCorrect).OrderBy(option => option.Position));
    }

    private static string? OptionLabel(QuestionOption option) =>
        Clean(option.Text) ?? (string.IsNullOrWhiteSpace(option.ImageUrl) ? null : "Imagem");

    private static IReadOnlyList<string>? ImageUrls(IEnumerable<QuestionOption> options)
    {
        var urls = options
            .Select(option => option.ImageUrl)
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .Cast<string>()
            .ToList();
        return urls.Count == 0 ? null : urls;
    }

    private static string? OrderingText(ActivityItem item, IReadOnlyList<Guid>? orderedIds)
    {
        if (orderedIds is not { Count: > 0 } || item.OrderEntries is null)
        {
            return null;
        }

        var textById = item.OrderEntries.ToDictionary(entry => entry.Id, entry => entry.Text);
        return Join(orderedIds.Select(id => textById.GetValueOrDefault(id)), " → ");
    }

    private static string? ClozeText(IReadOnlyList<ClozeAnswer>? answers)
    {
        if (answers is not { Count: > 0 })
        {
            return null;
        }

        return Join(answers.Select(answer => answer.Text));
    }

    private static string? CategoryText(
        ActivityItem item,
        IReadOnlyList<CategoryPlacement>? placements,
        bool correct)
    {
        var members = item.CategoryItems ?? [];
        var categories = item.Categories ?? [];
        if (members.Count == 0 || categories.Count == 0)
        {
            return null;
        }

        var categoryById = categories.ToDictionary(category => category.Id, category => category.Label);
        if (correct)
        {
            return Join(members.Select(member =>
                $"{member.Text} → {categoryById.GetValueOrDefault(member.CategoryId)}"));
        }

        if (placements is not { Count: > 0 })
        {
            return null;
        }

        var memberById = members.ToDictionary(member => member.Id, member => member.Text);
        return Join(placements.Select(placement =>
            $"{memberById.GetValueOrDefault(placement.ItemId)} → {categoryById.GetValueOrDefault(placement.CategoryId)}"));
    }

    private static string? Join(IEnumerable<string?>? parts, string separator = ", ")
    {
        if (parts is null)
        {
            return null;
        }

        var values = parts.Select(Clean).Where(value => value is not null).Cast<string>().ToList();
        return values.Count == 0 ? null : string.Join(separator, values);
    }

    private static string? Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }
}
