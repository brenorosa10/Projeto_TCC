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
                section.ItemIds))
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

    public static ActivityItemResponse ToItemResponse(ActivityItem item, bool includeAnswers) =>
        new(
            item.Id,
            item.Kind,
            item.Prompt,
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
            item.Back,
            ActivityImage.ToDataUrl(item),
            item.SectionId,
            item.Kind == ItemKinds.MultipleChoice ? item.AllowMultiple : null,
            includeAnswers ? item.AcceptedAnswers : null,
            includeAnswers && item.Kind == ItemKinds.ShortAnswer ? item.CaseSensitive : null,
            includeAnswers
                ? item.Pairs?
                    .Select(pair => new MatchingPairResponse(pair.LeftId, pair.RightId, pair.Left, pair.Right))
                    .ToList()
                : null);
}
