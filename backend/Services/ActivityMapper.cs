using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class ActivityMapper
{
    public static ActivitySummaryResponse ToSummary(Activity activity) =>
        new(
            activity.Id,
            activity.ProfessorId,
            activity.Title,
            activity.Type,
            activity.CreatedAt,
            activity.Items.Count,
            activity.SourceActivityId,
            activity.LinkedClassIds(),
            activity.IsPublic);

    public static ActivityResponse ToResponse(Activity activity, bool includeAnswers)
    {
        var sections = ActivityContentBuilder.ResolveSections(activity)
            .Select(section => new ActivitySectionResponse(
                section.Id,
                section.Role,
                section.Title,
                section.Body,
                section.FeedbackTemplate,
                section.Position,
                section.ItemIds,
                section.Objectives,
                section.EstimatedMinutes,
                section.Tips,
                ActivityImage.ToDataUrl(section)))
            .ToList();

        return new ActivityResponse(
            activity.Id,
            activity.ProfessorId,
            activity.Title,
            activity.Type,
            activity.CreatedAt,
            activity.SourceActivityId,
            activity.LinkedClassIds(),
            activity.IsPublic,
            activity.Items
                .OrderBy(item => item.Position)
                .Select(item => ToItemResponse(item, includeAnswers))
                .ToList(),
            sections);
    }

    public static ActivityItemResponse ToItemResponse(ActivityItem item, bool includeAnswers)
    {
        var prompt = includeAnswers || item.Kind != ItemKinds.Cloze
            ? item.Prompt
            : ClozeMarkup.ToStudentPrompt(item.Prompt, item.ClozeBlanks ?? []);

        return new ActivityItemResponse(
            item.Id,
            item.Kind,
            prompt,
            includeAnswers ? item.Explanation : null,
            item.TimeLimitSeconds,
            item.Position,
            item.Options?
                .OrderBy(option => option.Position)
                .Select(option => new QuestionOptionResponse(
                    option.Id,
                    option.Text,
                    includeAnswers ? option.IsCorrect : null,
                    option.Position))
                .ToList(),
            item.Front,
            includeAnswers ? item.Back : null,
            ActivityImage.ToDataUrl(item),
            item.SectionId,
            item.Kind == ItemKinds.MultipleChoice ? item.AllowMultiple : null,
            includeAnswers ? item.AcceptedAnswers : null,
            includeAnswers && item.Kind is ItemKinds.ShortAnswer or ItemKinds.Cloze ? item.CaseSensitive : null,
            includeAnswers
                ? item.Pairs?
                    .Select(pair => new MatchingPairResponse(pair.LeftId, pair.RightId, pair.Left, pair.Right))
                    .ToList()
                : null,
            item.Kind == ItemKinds.Ordering
                ? item.OrderEntries?
                    .OrderBy(entry => entry.Position)
                    .Select(entry => new OrderEntryResponse(entry.Id, entry.Text, entry.Position))
                    .ToList()
                : null,
            item.Kind == ItemKinds.Cloze
                ? item.ClozeBlanks?
                    .OrderBy(blank => blank.Position)
                    .Select(blank => new ClozeBlankResponse(
                        blank.Id,
                        blank.Position,
                        includeAnswers ? blank.AcceptedAnswers : null))
                    .ToList()
                : null,
            item.Kind == ItemKinds.Categorize
                ? item.Categories?
                    .OrderBy(category => category.Position)
                    .Select(category => new CategoryResponse(category.Id, category.Label, category.Position))
                    .ToList()
                : null,
            item.Kind == ItemKinds.Categorize
                ? item.CategoryItems?
                    .Select(member => new CategoryItemResponse(
                        member.Id,
                        member.Text,
                        includeAnswers ? member.CategoryId : null))
                    .ToList()
                : null,
            ContentBlocks.ToResponse(item.Intro),
            ContentBlocks.ToResponse(item.PromptBlocks),
            includeAnswers ? ContentBlocks.ToResponse(item.FeedbackBlocks) : null,
            includeAnswers ? item.FeedbackMessages : null,
            item.Topics,
            item.Difficulty,
            item.ChallengeId,
            item.RequireExplanation ? true : null,
            item.RequireExplanation ? item.ExplanationMinLength : null,
            item.RequireExplanation ? item.ExplanationPrompt : null,
            string.IsNullOrWhiteSpace(item.ImagePosition) ? "after" : item.ImagePosition);
    }
}
