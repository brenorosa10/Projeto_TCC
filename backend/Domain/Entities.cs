namespace Astro.Api.Domain;

public class Profile
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ClassRoom> TaughtClasses { get; set; } = new List<ClassRoom>();
    public ICollection<ClassEnrollment> Enrollments { get; set; } = new List<ClassEnrollment>();
}

public class ClassRoom
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public Guid ProfessorId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Profile? Professor { get; set; }
    public ICollection<ClassEnrollment> Enrollments { get; set; } = new List<ClassEnrollment>();
}

public class ClassEnrollment
{
    public Guid ClassId { get; set; }
    public Guid StudentId { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;

    public ClassRoom? Class { get; set; }
    public Profile? Student { get; set; }
}

public class Activity
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Mode { get; set; } = "async";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Question
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Prompt { get; set; } = string.Empty;
    public string? Explanation { get; set; }
    public int TimeLimitSeconds { get; set; } = 30;
    public int Position { get; set; }
}

public class QuestionOption
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int Position { get; set; }
}

public class LiveSession
{
    public Guid Id { get; set; }
    public Guid ActivityId { get; set; }
    public string Pin { get; set; } = string.Empty;
    public string Status { get; set; } = "lobby";
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAt { get; set; }
}

public class AnswerAttempt
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid? LiveSessionId { get; set; }
    public Guid? SelectedOptionId { get; set; }
    public bool? IsCorrect { get; set; }
    public int? ResponseTimeMs { get; set; }
    public int? Score { get; set; }
    public DateTimeOffset AnsweredAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Flashcard
{
    public Guid Id { get; set; }
    public Guid ClassId { get; set; }
    public string Front { get; set; } = string.Empty;
    public string Back { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class FlashcardProgress
{
    public Guid FlashcardId { get; set; }
    public Guid StudentId { get; set; }
    public int BoxLevel { get; set; } = 1;
    public DateTimeOffset? NextReviewAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
