using System.ComponentModel.DataAnnotations;

namespace Astro.Api.Contracts;

public record EnsureProfileRequest(
    [Required]
    [RegularExpression("^(professor|aluno)$")]
    string Role
);

public record ProfileResponse(
    Guid Id,
    string Email,
    string? FullName,
    string? AvatarUrl,
    string Role,
    DateTimeOffset CreatedAt
);

public record CreateClassRequest(
    [Required]
    [MinLength(2)]
    [MaxLength(200)]
    string Name
);

public record JoinClassRequest(
    [Required]
    [StringLength(8, MinimumLength = 8)]
    string Code
);

public record ClassResponse(
    Guid Id,
    string Name,
    string Code,
    Guid ProfessorId,
    string? ProfessorName,
    DateTimeOffset CreatedAt,
    int StudentCount
);

public record CreateQuestionOptionRequest(
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    string Text,
    bool IsCorrect
);

public record CreateActivityItemRequest(
    string? Kind,
    string? Prompt,
    string? Explanation,
    int? TimeLimitSeconds,
    List<CreateQuestionOptionRequest>? Options,
    string? Front,
    string? Back
);

public record CreateActivityRequest(
    [Required]
    [MinLength(2)]
    [MaxLength(200)]
    string Title,
    [Required]
    [RegularExpression("^(quiz|flashcards)$")]
    string Type,
    [Required]
    [MinLength(1)]
    List<CreateActivityItemRequest> Items
);

public record AssignActivityClassesRequest(
    [Required]
    List<Guid> ClassIds
);

public record QuestionOptionResponse(
    Guid Id,
    string Text,
    bool? IsCorrect,
    int Position
);

public record ActivityItemResponse(
    Guid Id,
    string Kind,
    string? Prompt,
    string? Explanation,
    int? TimeLimitSeconds,
    int Position,
    IReadOnlyList<QuestionOptionResponse>? Options,
    string? Front,
    string? Back
);

public record ActivitySummaryResponse(
    Guid Id,
    Guid ProfessorId,
    string Title,
    string Type,
    DateTimeOffset CreatedAt,
    int ItemCount,
    Guid? SourceActivityId,
    IReadOnlyList<Guid> ClassIds
);

public record ActivityResponse(
    Guid Id,
    Guid ProfessorId,
    string Title,
    string Type,
    DateTimeOffset CreatedAt,
    Guid? SourceActivityId,
    IReadOnlyList<Guid> ClassIds,
    IReadOnlyList<ActivityItemResponse> Items
);

public record StudyQuizSummaryResponse(
    Guid Id,
    string Title,
    int ItemCount,
    IReadOnlyList<string> ClassNames
);

public record SubmitStudyAnswerRequest(
    [Required]
    Guid ItemId,
    Guid? SelectedOptionId,
    int? ResponseTimeMs
);

public record StudyAnswerResponse(
    Guid ItemId,
    Guid? SelectedOptionId,
    Guid? CorrectOptionId,
    bool IsCorrect,
    string? Explanation
);

public record StudyFlashcardSummaryResponse(
    Guid Id,
    string Title,
    int ItemCount,
    int DueCount,
    IReadOnlyList<string> ClassNames
);

public record StudyFlashcardCardResponse(
    Guid Id,
    string Front,
    string Back,
    int BoxLevel
);

public record StudyFlashcardSessionResponse(
    Guid Id,
    string Title,
    int ItemCount,
    int DueCount,
    IReadOnlyList<StudyFlashcardCardResponse> Cards
);

public record SubmitFlashcardReviewRequest(
    [Required]
    Guid ItemId,
    bool Remembered
);

public record FlashcardReviewResponse(
    Guid ItemId,
    bool Remembered,
    int BoxLevel,
    DateTimeOffset NextReviewAt
);
