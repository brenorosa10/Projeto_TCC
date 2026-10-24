using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class ActivityItemPresenter
{
    public static StudySessionItemResponse ToStudentItem(ActivityItem item, Guid shuffleSeed)
    {
        IReadOnlyList<MatchingEntryResponse>? left = null;
        IReadOnlyList<MatchingEntryResponse>? right = null;
        IReadOnlyList<MatchingEntryResponse>? orderItems = null;
        IReadOnlyList<MatchingEntryResponse>? categories = null;
        IReadOnlyList<MatchingEntryResponse>? categoryItems = null;
        IReadOnlyList<MatchingEntryResponse>? clozeBlanks = null;
        var prompt = item.Prompt;

        if (item.Kind == ItemKinds.Matching && item.Pairs is { Count: > 0 })
        {
            left = item.Pairs
                .Select(pair => new MatchingEntryResponse(pair.LeftId, pair.Left))
                .ToList();
            right = Shuffle(
                item.Pairs.Select(pair => new MatchingEntryResponse(pair.RightId, pair.Right)).ToList(),
                shuffleSeed,
                item.Id);
        }

        if (item.Kind == ItemKinds.Ordering && item.OrderEntries is { Count: > 0 })
        {
            orderItems = Shuffle(
                item.OrderEntries
                    .OrderBy(entry => entry.Position)
                    .Select(entry => new MatchingEntryResponse(entry.Id, entry.Text))
                    .ToList(),
                shuffleSeed,
                item.Id);
        }

        if (item.Kind == ItemKinds.Categorize)
        {
            categories = (item.Categories ?? [])
                .OrderBy(category => category.Position)
                .Select(category => new MatchingEntryResponse(category.Id, category.Label))
                .ToList();
            categoryItems = Shuffle(
                (item.CategoryItems ?? [])
                    .Select(member => new MatchingEntryResponse(member.Id, member.Text))
                    .ToList(),
                shuffleSeed,
                item.Id);
        }

        if (item.Kind == ItemKinds.Cloze && item.ClozeBlanks is { Count: > 0 })
        {
            prompt = ClozeMarkup.ToStudentPrompt(item.Prompt, item.ClozeBlanks);
            clozeBlanks = item.ClozeBlanks
                .OrderBy(blank => blank.Position)
                .Select(blank => new MatchingEntryResponse(blank.Id, string.Empty))
                .ToList();
        }

        return new StudySessionItemResponse(
            item.Id,
            item.Kind,
            prompt,
            item.TimeLimitSeconds,
            item.Options?
                .OrderBy(option => option.Position)
                .Select(option => new QuestionOptionResponse(
                    option.Id,
                    option.Text,
                    null,
                    option.Position,
                    option.ImageUrl))
                .ToList(),
            item.Front,
            null,
            ActivityImage.ToDataUrl(item),
            item.Kind == ItemKinds.MultipleChoice ? item.AllowMultiple : null,
            left,
            right,
            orderItems,
            categories,
            categoryItems,
            clozeBlanks,
            ContentBlocks.ToResponse(item.Intro),
            ContentBlocks.ToResponse(item.PromptBlocks),
            item.Topics,
            item.Difficulty,
            item.RequireExplanation ? true : null,
            item.RequireExplanation ? item.ExplanationMinLength : null,
            item.RequireExplanation ? item.ExplanationPrompt : null,
            string.IsNullOrWhiteSpace(item.ImagePosition) ? "after" : item.ImagePosition);
    }

    public static StudySessionItemResponse ToHostItem(ActivityItem item, Guid shuffleSeed)
    {
        var student = ToStudentItem(item, shuffleSeed);
        return student with
        {
            Options = item.Options?
                .OrderBy(option => option.Position)
                .Select(option => new QuestionOptionResponse(
                    option.Id,
                    option.Text,
                    option.IsCorrect,
                    option.Position,
                    option.ImageUrl))
                .ToList()
        };
    }

    public static string PromptPreview(ActivityItem item)
    {
        if (!string.IsNullOrWhiteSpace(item.Prompt))
        {
            return StripMarkup(item.Prompt);
        }

        if (!string.IsNullOrWhiteSpace(item.Front))
        {
            return StripMarkup(item.Front);
        }

        var block = item.PromptBlocks?.FirstOrDefault(entry => !string.IsNullOrWhiteSpace(entry.Content));
        return block is null ? item.Kind : StripMarkup(block.Content);
    }

    public static List<Guid> PracticeItemIds(Activity activity)
    {
        var sections = ActivityContentBuilder.ResolveSections(activity);
        var practice = sections.FirstOrDefault(section => section.Role == SectionRoles.Practice);
        if (practice is { ItemIds.Count: > 0 })
        {
            return practice.ItemIds
                .Where(id => activity.Items.Any(item => item.Id == id && item.Kind != ItemKinds.Flashcard))
                .ToList();
        }

        return activity.Items
            .Where(item => item.Kind != ItemKinds.Flashcard)
            .OrderBy(item => item.Position)
            .Select(item => item.Id)
            .ToList();
    }

    private static string StripMarkup(string value)
    {
        return value
            .Replace("```", " ")
            .Replace("`", "")
            .Trim();
    }

    private static List<MatchingEntryResponse> Shuffle(
        List<MatchingEntryResponse> entries,
        Guid sessionId,
        Guid itemId)
    {
        var seed = BitConverter.ToInt32(sessionId.ToByteArray(), 0)
            ^ BitConverter.ToInt32(itemId.ToByteArray(), 0);
        var rng = new Random(seed);
        for (var i = entries.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (entries[i], entries[j]) = (entries[j], entries[i]);
        }

        return entries;
    }
}
