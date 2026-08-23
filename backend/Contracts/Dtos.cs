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

public record CreateMatchingPairRequest(
    Guid? LeftId,
    Guid? RightId,
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    string Left,
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    string Right
);

public record CreateActivityItemRequest(
    Guid? Id,
    string? Kind,
    string? Prompt,
    string? Explanation,
    int? TimeLimitSeconds,
    List<CreateQuestionOptionRequest>? Options,
    bool? AllowMultiple,
    List<string>? AcceptedAnswers,
    bool? CaseSensitive,
    bool? CorrectTrue,
    List<CreateMatchingPairRequest>? Pairs,
    string? Front,
    string? Back,
    string? ImageDataUrl
);

public record CreateActivitySectionRequest(
    Guid? Id,
    [Required]
    [RegularExpression("^(prep|practice|feedback)$")]
    string Role,
    [MaxLength(200)]
    string? Title,
    [MaxLength(8000)]
    string? Body,
    [MaxLength(50)]
    string? FeedbackTemplate,
    List<CreateActivityItemRequest>? Items
);

public record CreateActivityRequest(
    [Required]
    [MinLength(2)]
    [MaxLength(200)]
    string Title,
    [Required]
    [RegularExpression("^(quiz|flashcards)$")]
    string Type,
    List<CreateActivityItemRequest>? Items,
    bool IsPublic = false,
    List<CreateActivitySectionRequest>? Sections = null
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

public record MatchingPairResponse(
    Guid LeftId,
    Guid RightId,
    string Left,
    string Right
);

public record MatchingEntryResponse(
    Guid Id,
    string Text
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
    string? ImageDataUrl,
    Guid? SectionId = null,
    bool? AllowMultiple = null,
    IReadOnlyList<string>? AcceptedAnswers = null,
    bool? CaseSensitive = null,
    IReadOnlyList<MatchingPairResponse>? Pairs = null
);

public record ActivitySectionResponse(
    Guid Id,
    string Role,
    string? Title,
    string? Body,
    string? FeedbackTemplate,
    int Position,
    IReadOnlyList<Guid> ItemIds
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
    IReadOnlyList<ActivityItemResponse> Items,
    IReadOnlyList<ActivitySectionResponse>? Sections = null
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

public record MatchingAnswerRequest(
    Guid LeftId,
    Guid RightId
);

public record SubmitStudyAnswerRequest(
    [Required]
    Guid ItemId,
    Guid? SelectedOptionId,
    int? ResponseTimeMs,
    List<Guid>? SelectedOptionIds = null,
    string? TextAnswer = null,
    bool? Remembered = null,
    List<MatchingAnswerRequest>? Pairs = null
);

public record StudyAnswerResponse(
    Guid ItemId,
    Guid? SelectedOptionId,
    Guid? CorrectOptionId,
    bool IsCorrect,
    string? Explanation,
    string? Kind = null,
    IReadOnlyList<Guid>? SelectedOptionIds = null,
    IReadOnlyList<Guid>? CorrectOptionIds = null,
    string? TextAnswer = null,
    bool? Remembered = null,
    string? Back = null,
    int? Score = null,
    int? BoxLevel = null,
    DateTimeOffset? NextReviewAt = null
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

public record CreateStudySessionRequest(
    [Required]
    Guid ActivityId,
    bool ForceNew = false
);

public record StudySessionProgressResponse(
    int AnsweredCount,
    int PracticeTotal,
    int CorrectCount
);

public record StudySessionSectionViewResponse(
    Guid Id,
    string Role,
    string? Title,
    string? Body,
    string? FeedbackTemplate
);

public record StudySessionItemResponse(
    Guid Id,
    string Kind,
    string? Prompt,
    int? TimeLimitSeconds,
    IReadOnlyList<QuestionOptionResponse>? Options,
    string? Front,
    string? Back,
    string? ImageDataUrl,
    bool? AllowMultiple,
    IReadOnlyList<MatchingEntryResponse>? Left,
    IReadOnlyList<MatchingEntryResponse>? Right
);

public record StudySessionFeedbackItemResponse(
    Guid ItemId,
    string Kind,
    string? Prompt,
    bool? IsCorrect,
    string? Explanation,
    Guid? SelectedOptionId,
    Guid? CorrectOptionId,
    string? TextAnswer,
    bool? Remembered,
    int? Score
);

public record StudySessionFeedbackResponse(
    string Template,
    string? Title,
    string? Body,
    int Total,
    int CorrectCount,
    int IncorrectCount,
    IReadOnlyList<StudySessionFeedbackItemResponse> Items
);

public record StudySessionResponse(
    Guid Id,
    Guid ActivityId,
    string ActivityTitle,
    string ActivityType,
    string Status,
    int SectionIndex,
    int SectionCount,
    StudySessionSectionViewResponse? CurrentSection,
    StudySessionItemResponse? CurrentItem,
    StudyAnswerResponse? CurrentItemFeedback,
    StudySessionProgressResponse Progress,
    StudySessionFeedbackResponse? Feedback
);
