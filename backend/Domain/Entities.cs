using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Astro.Api.Domain;

public class Profile
{
    [BsonId]
    public Guid Id { get; set; }

    [BsonIgnoreIfNull]
    public string? GoogleId { get; set; }
    public string Email { get; set; } = string.Empty;
    [BsonIgnoreIfNull]
    public string? Username { get; set; }
    [BsonIgnoreIfNull]
    public string? UsernameNormalized { get; set; }
    [BsonIgnoreIfNull]
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

    /// <summary>Rótulo exibido na vitrine. Ausente nos documentos antigos (caem em Geral).</summary>
    [BsonIgnoreIfNull]
    public string? Theme { get; set; }

    /// <summary>Tema dobrado (sem acento, minúsculo) para filtro e agrupamento.</summary>
    [BsonIgnoreIfNull]
    public string? ThemeKey { get; set; }

    /// <summary>Resumo curto opcional da vitrine. A pré-seção continua sendo a descrição longa.</summary>
    [BsonIgnoreIfNull]
    public string? Description { get; set; }

    /// <summary>Sessões de estudo iniciadas. Documentos antigos não têm o campo e contam como zero.</summary>
    public int PlayCount { get; set; }

    /// <summary>Dificuldades distintas das questões, gravadas na hora de salvar.</summary>
    public List<string> Difficulties { get; set; } = [];

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

    /// <summary>Endereço normalizado: caminho /api/media, URL direta, id do YouTube ou id do Vimeo.</summary>
    [BsonIgnoreIfNull]
    public string? VideoUrl { get; set; }

    /// <summary>file, youtube ou vimeo. Ausente nas atividades só com imagem.</summary>
    [BsonIgnoreIfNull]
    public string? VideoKind { get; set; }
}

public class ContentBlock
{
    public string Type { get; set; } = ContentBlockTypes.Markdown;
    public string Content { get; set; } = string.Empty;
    public string? Language { get; set; }
}

public static class ContentBlockTypes
{
    public const string Markdown = "markdown";
    public const string Code = "code";
    public const string Question = "question";

    public static readonly string[] All = [Markdown, Code, Question];
}

public class ActivityItem
{
    public Guid Id { get; set; }
    public Guid? SectionId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string? Prompt { get; set; }
    public string? Explanation { get; set; }
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
    public List<ContentBlock>? Intro { get; set; }
    public List<ContentBlock>? PromptBlocks { get; set; }
    public List<ContentBlock>? FeedbackBlocks { get; set; }
    public List<string>? FeedbackMessages { get; set; }
    public List<string>? Topics { get; set; }
    public string? Difficulty { get; set; }
    public string? ChallengeId { get; set; }
    public bool RequireExplanation { get; set; }
    public int? ExplanationMinLength { get; set; }
    public string? ExplanationPrompt { get; set; }
    public string? ImagePosition { get; set; }

    [BsonIgnoreIfNull]
    public byte[]? ImageBytes { get; set; }

    [BsonIgnoreIfNull]
    public string? ImageContentType { get; set; }

    [BsonIgnoreIfNull]
    public string? VideoUrl { get; set; }

    [BsonIgnoreIfNull]
    public string? VideoKind { get; set; }

    /// <summary>
    /// Aparência da questão (espaço, oceano, ...). Ausente = visual padrão do sistema.
    /// Não confundir com Activity.Theme, que é a categoria do catálogo público.
    /// </summary>
    [BsonIgnoreIfNull]
    public string? VisualTheme { get; set; }

    [BsonExtraElements]
    public BsonDocument? Extra { get; set; }
}

public class QuestionOption
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int Position { get; set; }

    /// <summary>
    /// Link http(s) colado pelo autor ou caminho /api/media/{id} de um upload.
    /// Ausente nos quizzes criados antes das imagens de alternativa.
    /// </summary>
    [BsonIgnoreIfNull]
    public string? ImageUrl { get; set; }
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

public class LiveParticipant
{
    public Guid StudentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsConnected { get; set; } = true;
    public string? ConnectionId { get; set; }
}

public class LiveSession
{
    [BsonId]
    public Guid Id { get; set; }

    public Guid ActivityId { get; set; }
    public Guid ClassId { get; set; }
    public Guid ProfessorId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Mode { get; set; } = ActivityTypes.Quiz;
    public string Pin { get; set; } = string.Empty;
    public string Status { get; set; } = LiveSessionStatuses.Lobby;
    public string Phase { get; set; } = LiveSessionPhases.Lobby;
    public int ItemIndex { get; set; }
    public List<Guid> ItemIds { get; set; } = [];
    public DateTimeOffset? QuestionStartedAt { get; set; }
    public string? HostConnectionId { get; set; }
    public List<LiveParticipant> Participants { get; set; } = [];
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? EndedAt { get; set; }
}

public static class LiveSessionStatuses
{
    public const string Lobby = "lobby";
    public const string Running = "running";
    public const string Ended = "ended";
}

public static class LiveSessionPhases
{
    public const string Lobby = "lobby";
    public const string Question = "question";
    public const string Reveal = "reveal";
    public const string Ended = "ended";
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
