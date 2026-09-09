using Astro.Api.Contracts;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public sealed class GradeResult
{
    public bool Success { get; init; }
    public string? Error { get; init; }
    public string Kind { get; init; } = string.Empty;
    public bool IsCorrect { get; init; }
    public int Score { get; init; }
    public Guid? SelectedOptionId { get; init; }
    public IReadOnlyList<Guid>? SelectedOptionIds { get; init; }
    public Guid? CorrectOptionId { get; init; }
    public IReadOnlyList<Guid>? CorrectOptionIds { get; init; }
    public string? TextAnswer { get; init; }
    public bool? Remembered { get; init; }
    public string? Explanation { get; init; }
    public string? Back { get; init; }
    public IReadOnlyList<ContentBlockResponse>? FeedbackBlocks { get; init; }
    public IReadOnlyList<string>? FeedbackMessages { get; init; }

    public static GradeResult Fail(string error) => new() { Success = false, Error = error };
}

public static class ItemGrader
{
    public static GradeResult Grade(ActivityItem item, SubmitStudyAnswerRequest request)
    {
        var result = item.Kind switch
        {
            ItemKinds.MultipleChoice => GradeOptions(item, request, allowMultiple: item.AllowMultiple),
            ItemKinds.TrueFalse => GradeOptions(item, request, allowMultiple: false),
            ItemKinds.ShortAnswer => GradeShortAnswer(item, request),
            ItemKinds.Matching => GradeMatching(item, request),
            ItemKinds.Ordering => GradeOrdering(item, request),
            ItemKinds.Cloze => GradeCloze(item, request),
            ItemKinds.Categorize => GradeCategorize(item, request),
            ItemKinds.Flashcard => GradeFlashcard(item, request),
            _ => GradeResult.Fail("Este tipo de questão ainda não pode ser corrigido.")
        };

        if (!result.Success)
        {
            return result;
        }

        var reflectionError = ContentBlocks.CheckReflection(item, request.TextAnswer);
        if (reflectionError is not null)
        {
            return GradeResult.Fail(reflectionError);
        }

        return WithFeedback(result, item, request.TextAnswer);
    }

    public static StudyAnswerResponse ToResponse(GradeResult grade, Guid itemId) =>
        new(
            itemId,
            grade.SelectedOptionId,
            grade.CorrectOptionId,
            grade.IsCorrect,
            grade.Explanation,
            grade.Kind,
            grade.SelectedOptionIds,
            grade.CorrectOptionIds,
            grade.TextAnswer,
            grade.Remembered,
            grade.Back,
            grade.Score,
            null,
            null,
            grade.FeedbackBlocks,
            grade.FeedbackMessages);

    private static GradeResult GradeOptions(ActivityItem item, SubmitStudyAnswerRequest request, bool allowMultiple)
    {
        var options = item.Options ?? [];
        var selected = NormalizeSelected(request);
        if (selected.Count == 0)
        {
            return GradeResult.Fail("Selecione ao menos uma alternativa.");
        }

        if (selected.Any(id => options.All(option => option.Id != id)))
        {
            return GradeResult.Fail("Alternativa inválida para esta questão.");
        }

        if (!allowMultiple && selected.Count != 1)
        {
            return GradeResult.Fail("Esta questão aceita apenas uma alternativa.");
        }

        var correctIds = options.Where(option => option.IsCorrect).Select(option => option.Id).OrderBy(id => id).ToList();
        var selectedOrdered = selected.OrderBy(id => id).ToList();
        var isCorrect = correctIds.SequenceEqual(selectedOrdered);

        return new GradeResult
        {
            Success = true,
            Kind = item.Kind,
            IsCorrect = isCorrect,
            Score = isCorrect ? 1 : 0,
            SelectedOptionId = selectedOrdered.Count == 1 ? selectedOrdered[0] : null,
            SelectedOptionIds = selectedOrdered,
            CorrectOptionId = correctIds.Count == 1 ? correctIds[0] : null,
            CorrectOptionIds = correctIds,
            Explanation = item.Explanation
        };
    }

    private static GradeResult GradeShortAnswer(ActivityItem item, SubmitStudyAnswerRequest request)
    {
        var text = request.TextAnswer?.Trim() ?? string.Empty;
        if (text.Length == 0)
        {
            return GradeResult.Fail("Informe uma resposta.");
        }

        var comparer = item.CaseSensitive ? StringComparer.Ordinal : StringComparer.OrdinalIgnoreCase;
        var accepted = item.AcceptedAnswers ?? [];
        var isCorrect = accepted.Any(answer => comparer.Equals(answer.Trim(), text));

        return new GradeResult
        {
            Success = true,
            Kind = item.Kind,
            IsCorrect = isCorrect,
            Score = isCorrect ? 1 : 0,
            TextAnswer = text,
            Explanation = item.Explanation
        };
    }

    private static GradeResult GradeMatching(ActivityItem item, SubmitStudyAnswerRequest request)
    {
        var pairs = item.Pairs ?? [];
        var submitted = request.Pairs ?? [];
        if (submitted.Count != pairs.Count)
        {
            return GradeResult.Fail("Associe todos os pares antes de enviar.");
        }

        var expected = pairs.ToDictionary(pair => pair.LeftId, pair => pair.RightId);
        var seenLeft = new HashSet<Guid>();
        foreach (var answer in submitted)
        {
            if (!seenLeft.Add(answer.LeftId) || !expected.TryGetValue(answer.LeftId, out var rightId))
            {
                return GradeResult.Fail("Associação inválida para esta questão.");
            }

            if (pairs.All(pair => pair.RightId != answer.RightId))
            {
                return GradeResult.Fail("Associação inválida para esta questão.");
            }

            if (rightId != answer.RightId)
            {
                return new GradeResult
                {
                    Success = true,
                    Kind = item.Kind,
                    IsCorrect = false,
                    Score = 0,
                    Explanation = item.Explanation
                };
            }
        }

        return new GradeResult
        {
            Success = true,
            Kind = item.Kind,
            IsCorrect = true,
            Score = 1,
            Explanation = item.Explanation
        };
    }

    private static GradeResult GradeOrdering(ActivityItem item, SubmitStudyAnswerRequest request)
    {
        var entries = (item.OrderEntries ?? []).OrderBy(entry => entry.Position).ToList();
        var submitted = request.OrderedIds ?? [];
        if (submitted.Count != entries.Count)
        {
            return GradeResult.Fail("Ordene todos os itens antes de enviar.");
        }

        if (submitted.Distinct().Count() != submitted.Count || submitted.Any(id => entries.All(entry => entry.Id != id)))
        {
            return GradeResult.Fail("A ordem enviada é inválida para esta questão.");
        }

        var expected = entries.Select(entry => entry.Id).ToList();
        var isCorrect = expected.SequenceEqual(submitted);
        return new GradeResult
        {
            Success = true,
            Kind = item.Kind,
            IsCorrect = isCorrect,
            Score = isCorrect ? 1 : 0,
            Explanation = item.Explanation
        };
    }

    private static GradeResult GradeCloze(ActivityItem item, SubmitStudyAnswerRequest request)
    {
        var blanks = (item.ClozeBlanks ?? []).OrderBy(blank => blank.Position).ToList();
        var submitted = request.ClozeAnswers ?? [];
        if (submitted.Count != blanks.Count)
        {
            return GradeResult.Fail("Preencha todas as lacunas antes de enviar.");
        }

        var comparer = item.CaseSensitive ? StringComparer.Ordinal : StringComparer.OrdinalIgnoreCase;
        foreach (var blank in blanks)
        {
            var answer = submitted.FirstOrDefault(entry => entry.BlankId == blank.Id)?.Text.Trim();
            if (string.IsNullOrWhiteSpace(answer))
            {
                return GradeResult.Fail("Preencha todas as lacunas antes de enviar.");
            }

            if (!blank.AcceptedAnswers.Any(accepted => comparer.Equals(accepted.Trim(), answer)))
            {
                return new GradeResult
                {
                    Success = true,
                    Kind = item.Kind,
                    IsCorrect = false,
                    Score = 0,
                    Explanation = item.Explanation
                };
            }
        }

        return new GradeResult
        {
            Success = true,
            Kind = item.Kind,
            IsCorrect = true,
            Score = 1,
            Explanation = item.Explanation
        };
    }

    private static GradeResult GradeCategorize(ActivityItem item, SubmitStudyAnswerRequest request)
    {
        var members = item.CategoryItems ?? [];
        var categories = item.Categories ?? [];
        var submitted = request.CategoryPlacements ?? [];
        if (submitted.Count != members.Count)
        {
            return GradeResult.Fail("Classifique todos os itens antes de enviar.");
        }

        var expected = members.ToDictionary(member => member.Id, member => member.CategoryId);
        var seen = new HashSet<Guid>();
        foreach (var placement in submitted)
        {
            if (!seen.Add(placement.ItemId) || !expected.TryGetValue(placement.ItemId, out var categoryId))
            {
                return GradeResult.Fail("Classificação inválida para esta questão.");
            }

            if (categories.All(category => category.Id != placement.CategoryId))
            {
                return GradeResult.Fail("Classificação inválida para esta questão.");
            }

            if (categoryId != placement.CategoryId)
            {
                return new GradeResult
                {
                    Success = true,
                    Kind = item.Kind,
                    IsCorrect = false,
                    Score = 0,
                    Explanation = item.Explanation
                };
            }
        }

        return new GradeResult
        {
            Success = true,
            Kind = item.Kind,
            IsCorrect = true,
            Score = 1,
            Explanation = item.Explanation
        };
    }

    private static GradeResult GradeFlashcard(ActivityItem item, SubmitStudyAnswerRequest request)
    {
        if (request.Remembered is not bool remembered)
        {
            return GradeResult.Fail("Informe se o cartão foi lembrado.");
        }

        return new GradeResult
        {
            Success = true,
            Kind = item.Kind,
            IsCorrect = remembered,
            Score = remembered ? 1 : 0,
            Remembered = remembered,
            Back = item.Back,
            Explanation = item.Explanation
        };
    }

    private static GradeResult WithFeedback(GradeResult grade, ActivityItem item, string? textAnswer) =>
        new()
        {
            Success = true,
            Kind = grade.Kind,
            IsCorrect = grade.IsCorrect,
            Score = grade.Score,
            SelectedOptionId = grade.SelectedOptionId,
            SelectedOptionIds = grade.SelectedOptionIds,
            CorrectOptionId = grade.CorrectOptionId,
            CorrectOptionIds = grade.CorrectOptionIds,
            TextAnswer = item.RequireExplanation
                ? textAnswer?.Trim()
                : grade.TextAnswer,
            Remembered = grade.Remembered,
            Explanation = ContentBlocks.CombinedExplanation(item),
            Back = grade.Back,
            FeedbackBlocks = ContentBlocks.ToResponse(item.FeedbackBlocks),
            FeedbackMessages = item.FeedbackMessages
        };

    private static List<Guid> NormalizeSelected(SubmitStudyAnswerRequest request)
    {
        if (request.SelectedOptionIds is { Count: > 0 })
        {
            return request.SelectedOptionIds.Distinct().ToList();
        }

        return request.SelectedOptionId is Guid id ? [id] : [];
    }
}
