using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Astro.Api.Domain;

public class Profile
{
    [BsonId]
    public Guid Id { get; set; }

    public string? GoogleId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string? UsernameNormalized { get; set; }
    public string? PasswordHash { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class ClassEnrollment
{
    public Guid StudentId { get; set; }
    public string? StudentName { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class ClassRoom
{
    [BsonId]
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public Guid ProfessorId { get; set; }
    public string? ProfessorName { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<ClassEnrollment> Enrollments { get; set; } = [];

    [BsonIgnore]
    public int StudentCount => Enrollments.Count;
}

/// <summary>
/// Atividade polimórfica: quiz, prova, flashcards ou tipos futuros.
/// Campos específicos de cada tipo ficam em <see cref="Items"/> e em <see cref="Extra"/>.
/// </summary>
public class Activity
{
    [BsonId]
    public Guid Id { get; set; }

    public Guid ProfessorId { get; set; }

    /// <summary>Campo legado de quando a atividade pertencia a uma única turma.</summary>
    [BsonIgnoreIfDefault]
    public Guid ClassId { get; set; }

    public List<Guid> ClassIds { get; set; } = [];
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public Guid? SourceActivityId { get; set; }
    public bool IsPublic { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<ActivitySection> Sections { get; set; } = [];
    public List<ActivityItem> Items { get; set; } = [];

    [BsonExtraElements]
    public BsonDocument? Extra { get; set; }

    public List<Guid> LinkedClassIds()
    {
        if (ClassIds.Count > 0)
        {
            return ClassIds;
        }

        return ClassId != Guid.Empty ? [ClassId] : [];
    }
}

/// <summary>
/// Item polimórfico de uma atividade (múltipla escolha, V/F, flashcard, resposta curta, etc.).
/// </summary>
public class ActivitySection
{
    public Guid Id { get; set; }
    public string Role { get; set; } = SectionRoles.Practice;
    public string? Title { get; set; }
    public string? Body { get; set; }
    public string? FeedbackTemplate { get; set; }
    public int Position { get; set; }
    public List<Guid> ItemIds { get; set; } = [];
    public List<string>? Objectives { get; set; }
    public int? EstimatedMinutes { get; set; }
    public List<string>? Tips { get; set; }

    [BsonIgnoreIfNull]
    public byte[]? ImageBytes { get; set; }

    [BsonIgnoreIfNull]
    public string? ImageContentType { get; set; }
}

public class ActivityItem
{
    public Guid Id { get; set; }
    public Guid? SectionId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string? Prompt { get; set; }
    public string? Explanation { get; set; }
    public int? TimeLimitSeconds { get; set; }
    public int Position { get; set; }
    public List<QuestionOption>? Options { get; set; }
    public bool AllowMultiple { get; set; }
    public List<string>? AcceptedAnswers { get; set; }
    public bool CaseSensitive { get; set; }
    public List<MatchingPair>? Pairs { get; set; }
    public List<OrderEntry>? OrderEntries { get; set; }
    public List<ClozeBlank>? ClozeBlanks { get; set; }
    public List<CategoryBucket>? Categories { get; set; }
    public List<CategoryItem>? CategoryItems { get; set; }
    public string? Front { get; set; }
    public string? Back { get; set; }

    [BsonIgnoreIfNull]
    public byte[]? ImageBytes { get; set; }

    [BsonIgnoreIfNull]
    public string? ImageContentType { get; set; }

    [BsonExtraElements]
    public BsonDocument? Extra { get; set; }
}

public class QuestionOption
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int Position { get; set; }
}

public class MatchingPair
{
    public Guid LeftId { get; set; }
    public Guid RightId { get; set; }
    public string Left { get; set; } = string.Empty;
    public string Right { get; set; } = string.Empty;
}

public class OrderEntry
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public int Position { get; set; }
}

public class ClozeBlank
{
    public Guid Id { get; set; }
    public int Position { get; set; }
    public List<string> AcceptedAnswers { get; set; } = [];
}

public class CategoryBucket
{
    public Guid Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public int Position { get; set; }
}

public class CategoryItem
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public Guid CategoryId { get; set; }
}

public class ClozeAnswer
{
    public Guid BlankId { get; set; }
    public string Text { get; set; } = string.Empty;
}

public class CategoryPlacement
{
    public Guid ItemId { get; set; }
    public Guid CategoryId { get; set; }
}

public class LiveSession
{
    [BsonId]
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Guid ClassId { get; set; }
    public string Pin { get; set; } = string.Empty;
    public string Status { get; set; } = "lobby";
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAt { get; set; }
}

public class AnswerAttempt
{
    [BsonId]
    public Guid Id { get; set; }

    public Guid StudentId { get; set; }
    public Guid ActivityId { get; set; }
    public Guid ItemId { get; set; }
    public Guid? LiveSessionId { get; set; }
    public Guid? StudySessionId { get; set; }
    public Guid? SelectedOptionId { get; set; }
    public List<Guid>? SelectedOptionIds { get; set; }
    public string? TextAnswer { get; set; }
    public bool? Remembered { get; set; }
    public bool? IsCorrect { get; set; }
    public int? ResponseTimeMs { get; set; }
    public int? Score { get; set; }
    public DateTimeOffset AnsweredAt { get; set; } = DateTimeOffset.UtcNow;

    [BsonExtraElements]
    public BsonDocument? Extra { get; set; }
}

public class ReviewProgress
{
    [BsonId]
    public Guid Id { get; set; }

    public Guid StudentId { get; set; }
    public Guid ActivityId { get; set; }
    public Guid ItemId { get; set; }
    public int BoxLevel { get; set; } = 1;
    public DateTimeOffset? NextReviewAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class ActivityTypes
{
    public const string Quiz = "quiz";
    public const string Prova = "prova";
    public const string Flashcards = "flashcards";
}

public static class ActivityModes
{
    public const string Live = "live";
    public const string Async = "async";
}

public static class ItemKinds
{
    public const string MultipleChoice = "multiple_choice";
    public const string TrueFalse = "true_false";
    public const string Flashcard = "flashcard";
    public const string ShortAnswer = "short_answer";
    public const string Matching = "matching";
    public const string Ordering = "ordering";
    public const string Cloze = "cloze";
    public const string Categorize = "categorize";

    public static readonly string[] All =
    [
        MultipleChoice,
        TrueFalse,
        Flashcard,
        ShortAnswer,
        Matching,
        Ordering,
        Cloze,
        Categorize
    ];
}

public static class SectionRoles
{
    public const string Prep = "prep";
    public const string Practice = "practice";
    public const string Feedback = "feedback";

    public static readonly string[] All = [Prep, Practice, Feedback];
}

public static class FeedbackTemplates
{
    public const string ScoreSummary = "score_summary";
    public const string Explanations = "explanations";
    public const string DueCards = "due_cards";
}

public static class StudySessionStatuses
{
    public const string Prep = "prep";
    public const string Practice = "practice";
    public const string Feedback = "feedback";
    public const string Completed = "completed";
}

public class StudySessionPlanSection
{
    public Guid Id { get; set; }
    public string Role { get; set; } = SectionRoles.Practice;
    public string? Title { get; set; }
    public string? Body { get; set; }
    public string? FeedbackTemplate { get; set; }
    public List<Guid> ItemIds { get; set; } = [];
    public List<string>? Objectives { get; set; }
    public int? EstimatedMinutes { get; set; }
    public List<string>? Tips { get; set; }
    public bool HasImage { get; set; }
}

public class StudySessionAnswer
{
    public Guid ItemId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public Guid? SelectedOptionId { get; set; }
    public List<Guid>? SelectedOptionIds { get; set; }
    public string? TextAnswer { get; set; }
    public List<Guid>? OrderedIds { get; set; }
    public List<ClozeAnswer>? ClozeAnswers { get; set; }
    public List<CategoryPlacement>? CategoryPlacements { get; set; }
    public bool? Remembered { get; set; }
    public bool? IsCorrect { get; set; }
    public int? Score { get; set; }
    public int? ResponseTimeMs { get; set; }
    public int? BoxLevel { get; set; }
    public DateTimeOffset? NextReviewAt { get; set; }
    public DateTimeOffset AnsweredAt { get; set; } = DateTimeOffset.UtcNow;
}

public class StudySession
{
    [BsonId]
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Guid? StudentId { get; set; }
    public string Status { get; set; } = StudySessionStatuses.Prep;
    public int SectionIndex { get; set; }
    public int ItemIndex { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public List<StudySessionPlanSection> Plan { get; set; } = [];
    public List<StudySessionAnswer> Answers { get; set; } = [];
}
