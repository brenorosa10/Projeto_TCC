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
    [Required(ErrorMessage = "Informe o nome da turma.")]
    [MinLength(2, ErrorMessage = "O nome da turma deve ter pelo menos 2 caracteres.")]
    [MaxLength(200, ErrorMessage = "O nome da turma deve ter no máximo 200 caracteres.")]
    string Name
);

public record UpdateClassRequest(
    [Required(ErrorMessage = "Informe o nome da turma.")]
    [MinLength(2, ErrorMessage = "O nome da turma deve ter pelo menos 2 caracteres.")]
    [MaxLength(200, ErrorMessage = "O nome da turma deve ter no máximo 200 caracteres.")]
    string Name
);

public record JoinClassRequest(
    [Required(ErrorMessage = "Informe o código da turma.")]
    [StringLength(8, MinimumLength = 8, ErrorMessage = "O código deve ter 8 caracteres.")]
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
    [MaxLength(500)]
    string? Text,
    bool IsCorrect,
    [MaxLength(2000)]
    string? ImageUrl = null
);

public record MediaUploadResponse(string Url);

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

public record ContentBlockRequest(
    string? Type,
    [MaxLength(20000)]
    string? Content,
    [MaxLength(40)]
    string? Language = null
);

public record ContentBlockResponse(
    string Type,
    string Content,
    string? Language
);

public record CreateActivityItemRequest(
    Guid? Id,
    string? Kind,
    string? Prompt,
    string? Explanation,
    List<CreateQuestionOptionRequest>? Options,
    bool? AllowMultiple,
    List<string>? AcceptedAnswers,
    bool? CaseSensitive,
    bool? CorrectTrue,
    List<CreateMatchingPairRequest>? Pairs,
    string? Front,
    string? Back,
    string? ImageDataUrl,
    List<CreateOrderEntryRequest>? OrderEntries = null,
    List<CreateClozeBlankRequest>? ClozeBlanks = null,
    List<CreateCategoryRequest>? Categories = null,
    List<CreateCategoryItemRequest>? CategoryItems = null,
    List<ContentBlockRequest>? Intro = null,
    List<ContentBlockRequest>? PromptBlocks = null,
    List<ContentBlockRequest>? FeedbackBlocks = null,
    List<string>? FeedbackMessages = null,
    List<string>? Topics = null,
    string? Difficulty = null,
    string? ChallengeId = null,
    bool? RequireExplanation = null,
    int? ExplanationMinLength = null,
    string? ExplanationPrompt = null,
    string? ImagePosition = null,
    [MaxLength(2000)]
    string? VideoUrl = null
);

public record CreateOrderEntryRequest(
    Guid? Id,
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    string Text
);

public record CreateClozeBlankRequest(
    Guid? Id,
    List<string>? AcceptedAnswers
);

public record CreateCategoryRequest(
    Guid? Id,
    [Required]
    [MinLength(1)]
    [MaxLength(200)]
    string Label
);

public record CreateCategoryItemRequest(
    Guid? Id,
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    string Text,
    Guid? CategoryId
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
    List<CreateActivityItemRequest>? Items,
    List<string>? Objectives = null,
    int? EstimatedMinutes = null,
    List<string>? Tips = null,
    string? ImageDataUrl = null,
    [MaxLength(2000)]
    string? VideoUrl = null
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
    List<CreateActivitySectionRequest>? Sections = null,
    [MaxLength(40, ErrorMessage = "O tema deve ter no máximo 40 caracteres.")]
    string? Theme = null,
    [MaxLength(280, ErrorMessage = "A descrição deve ter no máximo 280 caracteres.")]
    string? Description = null
);

public record AssignActivityClassesRequest(
    [Required]
    List<Guid> ClassIds
);

public record QuestionOptionResponse(
    Guid Id,
    string Text,
    bool? IsCorrect,
    int Position,
    string? ImageUrl = null
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
    int Position,
    IReadOnlyList<QuestionOptionResponse>? Options,
    string? Front,
    string? Back,
    string? ImageDataUrl,
    Guid? SectionId = null,
    bool? AllowMultiple = null,
    IReadOnlyList<string>? AcceptedAnswers = null,
    bool? CaseSensitive = null,
    IReadOnlyList<MatchingPairResponse>? Pairs = null,
    IReadOnlyList<OrderEntryResponse>? OrderEntries = null,
    IReadOnlyList<ClozeBlankResponse>? ClozeBlanks = null,
    IReadOnlyList<CategoryResponse>? Categories = null,
    IReadOnlyList<CategoryItemResponse>? CategoryItems = null,
    IReadOnlyList<ContentBlockResponse>? Intro = null,
    IReadOnlyList<ContentBlockResponse>? PromptBlocks = null,
    IReadOnlyList<ContentBlockResponse>? FeedbackBlocks = null,
    IReadOnlyList<string>? FeedbackMessages = null,
    IReadOnlyList<string>? Topics = null,
    string? Difficulty = null,
    string? ChallengeId = null,
    bool? RequireExplanation = null,
    int? ExplanationMinLength = null,
    string? ExplanationPrompt = null,
    string? ImagePosition = null,
    string? VideoUrl = null,
    string? VideoKind = null
);

public record OrderEntryResponse(
    Guid Id,
    string Text,
    int Position
);

public record ClozeBlankResponse(
    Guid Id,
    int Position,
    IReadOnlyList<string>? AcceptedAnswers
);

public record CategoryResponse(
    Guid Id,
    string Label,
    int Position
);

public record CategoryItemResponse(
    Guid Id,
    string Text,
    Guid? CategoryId
);

public record ActivitySectionResponse(
    Guid Id,
    string Role,
    string? Title,
    string? Body,
    string? FeedbackTemplate,
    int Position,
    IReadOnlyList<Guid> ItemIds,
    IReadOnlyList<string>? Objectives = null,
    int? EstimatedMinutes = null,
    IReadOnlyList<string>? Tips = null,
    string? ImageDataUrl = null,
    string? VideoUrl = null,
    string? VideoKind = null
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
    bool IsPublic,
    string? Theme = null,
    string? Description = null
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
    IReadOnlyList<ActivitySectionResponse>? Sections = null,
    int ItemCount = 0,
    string? Theme = null,
    string? Description = null
);

public record PublicActivitySummaryResponse(
    Guid Id,
    string Title,
    string Type,
    int ItemCount,
    DateTimeOffset CreatedAt,
    string? ProfessorName,
    string? Theme = null,
    string? Description = null,
    bool HasCover = false,
    int PlayCount = 0,
    string? Difficulty = null
);

public record PublicThemeFacetResponse(string Name, int Count);

public record PublicThemeGroupResponse(
    string Theme,
    int Total,
    IReadOnlyList<PublicActivitySummaryResponse> Items
);

public record PublicCatalogResponse(
    IReadOnlyList<PublicActivitySummaryResponse> Items,
    int Total,
    int Page,
    int PageSize,
    string Sort,
    IReadOnlyList<PublicThemeFacetResponse> Themes,
    IReadOnlyList<PublicThemeGroupResponse>? Groups
);

public record StudyQuizSummaryResponse(
    Guid Id,
    string Title,
    int ItemCount,
    IReadOnlyList<string> ClassNames,
    bool IsPublic,
    IReadOnlyList<Guid> ClassIds,
    bool OwnedByMe,
    bool Completed = false,
    int? BestCorrect = null,
    int? BestTotal = null
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
    List<MatchingAnswerRequest>? Pairs = null,
    List<Guid>? OrderedIds = null,
    List<ClozeAnswerRequest>? ClozeAnswers = null,
    List<CategoryPlacementRequest>? CategoryPlacements = null
);

public record ClozeAnswerRequest(
    Guid BlankId,
    [Required]
    [MinLength(1)]
    [MaxLength(500)]
    string Text
);

public record CategoryPlacementRequest(
    Guid ItemId,
    Guid CategoryId
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
    DateTimeOffset? NextReviewAt = null,
    IReadOnlyList<ContentBlockResponse>? FeedbackBlocks = null,
    IReadOnlyList<string>? FeedbackMessages = null
);

public record StudyFlashcardSummaryResponse(
    Guid Id,
    string Title,
    int ItemCount,
    int DueCount,
    IReadOnlyList<string> ClassNames,
    bool IsPublic,
    IReadOnlyList<Guid> ClassIds,
    bool OwnedByMe
);

public record StudyFlashcardCardResponse(
    Guid Id,
    string Front,
    string Back,
    int BoxLevel,
    string? ImageDataUrl,
    string? VideoUrl = null,
    string? VideoKind = null
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
    string? FeedbackTemplate,
    IReadOnlyList<string>? Objectives = null,
    int? EstimatedMinutes = null,
    IReadOnlyList<string>? Tips = null,
    string? ImageDataUrl = null,
    string? VideoUrl = null,
    string? VideoKind = null
);

public record StudySessionItemResponse(
    Guid Id,
    string Kind,
    string? Prompt,
    IReadOnlyList<QuestionOptionResponse>? Options,
    string? Front,
    string? Back,
    string? ImageDataUrl,
    bool? AllowMultiple,
    IReadOnlyList<MatchingEntryResponse>? Left,
    IReadOnlyList<MatchingEntryResponse>? Right,
    IReadOnlyList<MatchingEntryResponse>? OrderItems = null,
    IReadOnlyList<MatchingEntryResponse>? Categories = null,
    IReadOnlyList<MatchingEntryResponse>? CategoryItems = null,
    IReadOnlyList<MatchingEntryResponse>? ClozeBlanks = null,
    IReadOnlyList<ContentBlockResponse>? Intro = null,
    IReadOnlyList<ContentBlockResponse>? PromptBlocks = null,
    IReadOnlyList<string>? Topics = null,
    string? Difficulty = null,
    bool? RequireExplanation = null,
    int? ExplanationMinLength = null,
    string? ExplanationPrompt = null,
    string? ImagePosition = null,
    string? VideoUrl = null,
    string? VideoKind = null
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
    int? Score,
    string? StudentAnswer = null,
    string? CorrectAnswer = null,
    IReadOnlyList<string>? StudentAnswerImageUrls = null,
    IReadOnlyList<string>? CorrectAnswerImageUrls = null
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
    StudySessionFeedbackResponse? Feedback,
    StudySessionSectionViewResponse? PrepSection = null
);

public record CreateLiveSessionRequest(
    [Required]
    Guid ActivityId,
    [Required]
    Guid ClassId
);

public record LiveParticipantResponse(
    Guid StudentId,
    string Name,
    DateTimeOffset JoinedAt,
    bool IsConnected
);

public record LiveRankingEntryResponse(
    Guid StudentId,
    string Name,
    int Score,
    int CorrectCount
);

public record LiveAnswerTallyResponse(
    int AnsweredCount,
    int ParticipantCount
);

public record LivePersonalResultResponse(
    bool HasAnswered,
    bool? IsCorrect,
    int Score,
    int CorrectCount,
    int TotalAnswered
);

public record LiveQuestionRevealResponse(
    Guid ItemId,
    int CorrectCount,
    int IncorrectCount,
    int UnansweredCount,
    double AccuracyPercent,
    IReadOnlyList<Guid>? CorrectOptionIds,
    string? Explanation,
    IReadOnlyList<ContentBlockResponse>? FeedbackBlocks,
    IReadOnlyList<string>? FeedbackMessages
);

public record LiveSessionStateResponse(
    Guid Id,
    Guid ActivityId,
    Guid ClassId,
    string ActivityTitle,
    string ClassName,
    string Pin,
    string Status,
    string Phase,
    string Mode,
    int ItemIndex,
    int ItemCount,
    int PresentedCount,
    DateTimeOffset? QuestionStartedAt,
    StudySessionItemResponse? CurrentItem,
    LiveAnswerTallyResponse Tally,
    IReadOnlyList<LiveParticipantResponse> Participants,
    IReadOnlyList<LiveRankingEntryResponse>? Ranking,
    LiveQuestionRevealResponse? Reveal,
    LivePersonalResultResponse? Personal,
    bool ShowAnswerKey
);

public record AnalyticsActivitySummaryResponse(
    Guid Id,
    string Title,
    string Type,
    int SessionCount,
    int ParticipantCount
);

public record AnalyticsSessionSummaryResponse(
    Guid Id,
    Guid ActivityId,
    string Pin,
    string ClassName,
    string Title,
    string Mode,
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? EndedAt,
    IReadOnlyList<LiveParticipantResponse> Participants
);

public record AnalyticsQuestionResponse(
    Guid ItemId,
    string Prompt,
    string Kind,
    int Attempts,
    int CorrectCount,
    int IncorrectCount,
    double AccuracyPercent,
    double ErrorPercent,
    bool HighError,
    IReadOnlyList<string> CorrectNames,
    IReadOnlyList<string> IncorrectNames
);

public record GenerateQuizQuestionsRequest(
    [Required(ErrorMessage = "Descreva o assunto das questões.")]
    [MinLength(10, ErrorMessage = "Descreva o assunto com pelo menos algumas frases.")]
    [MaxLength(12000, ErrorMessage = "O contexto deve ter no máximo 12000 caracteres.")]
    string Context,
    [Range(1, 20, ErrorMessage = "Escolha entre 1 e 20 questões.")]
    int Count,
    [MaxLength(40)]
    string? Difficulty = null,
    [MaxLength(40)]
    string? Kind = null
);

public record GeneratedQuizOptionResponse(
    string Text,
    bool IsCorrect
);

public record GeneratedQuizQuestionResponse(
    string Kind,
    string Prompt,
    string? Explanation,
    IReadOnlyList<GeneratedQuizOptionResponse> Options
);

public record GeneratedPrepSectionResponse(
    string Title,
    string Body,
    IReadOnlyList<string> Objectives,
    int? EstimatedMinutes,
    IReadOnlyList<string> Tips
);

public record GeneratedFeedbackSectionResponse(
    string Title,
    string Body
);

public record GenerateQuizQuestionsResponse(
    IReadOnlyList<GeneratedQuizQuestionResponse> Questions,
    GeneratedPrepSectionResponse Prep,
    GeneratedFeedbackSectionResponse Feedback,
    string? Theme = null
);

public record AnalyticsOverviewResponse(
    IReadOnlyList<AnalyticsActivitySummaryResponse> Activities,
    Guid? SelectedActivityId,
    Guid? SelectedSessionId,
    IReadOnlyList<AnalyticsSessionSummaryResponse> Sessions,
    IReadOnlyList<AnalyticsQuestionResponse> Questions
);

