using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Astro.Api.Domain;

public class Profile
{
    [BsonId]
    public Guid Id { get; set; }

    public string? GoogleId { get; set; }
    public string Email { get; set; } = string.Empty;
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

    public Guid ClassId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Mode { get; set; } = ActivityModes.Async;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<ActivityItem> Items { get; set; } = [];

    [BsonExtraElements]
    public BsonDocument? Extra { get; set; }
}

/// <summary>
/// Item polimórfico de uma atividade (múltipla escolha, V/F, flashcard, resposta curta, etc.).
/// </summary>
public class ActivityItem
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string? Prompt { get; set; }
    public string? Explanation { get; set; }
    public int? TimeLimitSeconds { get; set; }
    public int Position { get; set; }
    public List<QuestionOption>? Options { get; set; }
    public string? Front { get; set; }
    public string? Back { get; set; }

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
    public Guid? SelectedOptionId { get; set; }
    public string? TextAnswer { get; set; }
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
}
