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
    string? Username,
    string? FullName,
    string? AvatarUrl,
    string Role,
    DateTimeOffset CreatedAt
);

public record RegisterRequest(
    [Required]
    [RegularExpression("^[a-zA-Z0-9_]{3,32}$", ErrorMessage = "O nome de usuário deve ter 3 a 32 caracteres (letras, números ou _).")]
    string Username,
    [Required]
    [EmailAddress]
    [MaxLength(200)]
    string Email,
    [Required]
    [MinLength(8)]
    [MaxLength(128)]
    string Password,
    [Required]
    [RegularExpression("^(professor|aluno)$")]
    string Role
);

public record LoginRequest(
    [Required]
    [MinLength(3)]
    [MaxLength(200)]
    string Login,
    [Required]
    [MinLength(1)]
    [MaxLength(128)]
    string Password
);

public record AuthResponse(
    string AccessToken,
    ProfileResponse Profile
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
    Guid? Id,
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    string Text,
    bool IsCorrect
);

public record CreateActivityItemRequest(
    Guid? Id,
    string? Kind,
    string? Prompt,
    string? Explanation,
    int? TimeLimitSeconds,
    List<CreateQuestionOptionRequest>? Options,
    string? Front,
    string? Back,
    string? ImageDataUrl
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
    List<CreateActivityItemRequest> Items,
    bool IsPublic = false
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
    string? Back,
    string? ImageDataUrl
);

public record ActivitySummaryResponse(
    Guid Id,
    Guid ProfessorId,
    string Title,
    string Type,
    DateTimeOffset CreatedAt,
    int ItemCount,
    Guid? SourceActivityId,
    IReadOnlyList<Guid> ClassIds,
    bool IsPublic
);

public record ActivityResponse(
    Guid Id,
    Guid ProfessorId,
    string Title,
    string Type,
    DateTimeOffset CreatedAt,
    Guid? SourceActivityId,
    IReadOnlyList<Guid> ClassIds,
    bool IsPublic,
    IReadOnlyList<ActivityItemResponse> Items
);

public record PublicActivitySummaryResponse(
    Guid Id,
    string Title,
    string Type,
    int ItemCount,
    DateTimeOffset CreatedAt,
    string? ProfessorName
);

public record StudyQuizSummaryResponse(
    Guid Id,
    string Title,
    int ItemCount,
    IReadOnlyList<string> ClassNames,
    bool IsPublic
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
    IReadOnlyList<string> ClassNames,
    bool IsPublic
);

public record StudyFlashcardCardResponse(
    Guid Id,
    string Front,
    string Back,
    int BoxLevel,
    string? ImageDataUrl
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
