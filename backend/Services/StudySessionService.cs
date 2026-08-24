using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public sealed class SessionOperationResult
{
    public StudySessionResponse? Session { get; init; }
    public int StatusCode { get; init; } = StatusCodes.Status200OK;
    public string? Error { get; init; }

    public static SessionOperationResult Ok(StudySessionResponse session) => new() { Session = session };

    public static SessionOperationResult Fail(int statusCode, string error) =>
        new() { StatusCode = statusCode, Error = error };
}

public class StudySessionService(
    MongoDbContext db,
    StudyAccessService access,
    CurrentUserService currentUser)
{
    public async Task<SessionOperationResult> CreateAsync(
        CreateStudySessionRequest request,
        CancellationToken cancellationToken)
    {
        var activity = await db.Activities
            .Find(item => item.Id == request.ActivityId)
            .FirstOrDefaultAsync(cancellationToken);

        if (activity is null)
        {
            return SessionOperationResult.Fail(StatusCodes.Status404NotFound, "Atividade não encontrada.");
        }

        var profile = await access.GetProfileAsync(currentUser.UserId, cancellationToken);
        if (!await access.CanStudyAsync(profile, activity, cancellationToken))
        {
            return SessionOperationResult.Fail(StatusCodes.Status403Forbidden, "Você não tem acesso a esta atividade.");
        }

        if (profile is not null && !request.ForceNew)
        {
            var existing = await db.StudySessions
                .Find(session =>
                    session.StudentId == profile.Id
                    && session.ActivityId == activity.Id
                    && session.Status != StudySessionStatuses.Completed)
                .SortByDescending(session => session.StartedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (existing is not null)
            {
                return SessionOperationResult.Ok(ToResponse(existing, activity));
            }
        }

        var plan = BuildPlan(activity);
        if (plan.All(section => section.Role != SectionRoles.Practice || section.ItemIds.Count == 0))
        {
            return SessionOperationResult.Fail(StatusCodes.Status400BadRequest, "Esta atividade não tem itens para praticar.");
        }

        var session = new StudySession
        {
            Id = Guid.NewGuid(),
            ActivityId = activity.Id,
            StudentId = profile?.Id,
            Plan = plan,
            StartedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        MoveTo(session, FirstPlayableIndex(plan));
        await db.StudySessions.InsertOneAsync(session, cancellationToken: cancellationToken);
        return new SessionOperationResult
        {
            Session = ToResponse(session, activity),
            StatusCode = StatusCodes.Status201Created
        };
    }

    public async Task<SessionOperationResult> GetAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var loaded = await LoadOwnedAsync(sessionId, cancellationToken);
        return loaded.Error is not null
            ? SessionOperationResult.Fail(loaded.StatusCode, loaded.Error)
            : SessionOperationResult.Ok(ToResponse(loaded.Session!, loaded.Activity!));
    }

    public async Task<SessionOperationResult> AdvanceAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var loaded = await LoadOwnedAsync(sessionId, cancellationToken);
        if (loaded.Error is not null)
        {
            return SessionOperationResult.Fail(loaded.StatusCode, loaded.Error);
        }

        var session = loaded.Session!;
        var activity = loaded.Activity!;
        if (session.Status == StudySessionStatuses.Completed)
        {
            return SessionOperationResult.Ok(ToResponse(session, activity));
        }

        var current = CurrentPlanSection(session);
        if (current is null)
        {
            Complete(session);
        }
        else if (current.Role == SectionRoles.Practice)
        {
            var currentItemId = CurrentItemId(session);
            if (currentItemId is Guid itemId && session.Answers.All(answer => answer.ItemId != itemId))
            {
                return SessionOperationResult.Fail(
                    StatusCodes.Status400BadRequest,
                    "Responda o item atual antes de avançar.");
            }

            AdvanceFromPractice(session);
        }
        else if (current.Role == SectionRoles.Prep)
        {
            MoveTo(session, session.SectionIndex + 1);
        }
        else
        {
            Complete(session);
        }

        await SaveAsync(session, cancellationToken);
        return SessionOperationResult.Ok(ToResponse(session, activity));
    }

    public async Task<SessionOperationResult> SubmitAnswerAsync(
        Guid sessionId,
        SubmitStudyAnswerRequest request,
        CancellationToken cancellationToken)
    {
        var loaded = await LoadOwnedAsync(sessionId, cancellationToken);
        if (loaded.Error is not null)
        {
            return SessionOperationResult.Fail(loaded.StatusCode, loaded.Error);
        }

        var session = loaded.Session!;
        var activity = loaded.Activity!;
        if (session.Status != StudySessionStatuses.Practice)
        {
            return SessionOperationResult.Fail(
                StatusCodes.Status400BadRequest,
                "Não há um item em prática para responder agora.");
        }

        var currentItemId = CurrentItemId(session);
        if (currentItemId is not Guid itemId || itemId != request.ItemId)
        {
            return SessionOperationResult.Fail(StatusCodes.Status400BadRequest, "Este não é o item atual da sessão.");
        }

        if (session.Answers.Any(answer => answer.ItemId == itemId))
        {
            return SessionOperationResult.Fail(StatusCodes.Status400BadRequest, "Este item já foi respondido nesta sessão.");
        }

        var item = activity.Items.FirstOrDefault(candidate => candidate.Id == itemId);
        if (item is null)
        {
            return SessionOperationResult.Fail(StatusCodes.Status400BadRequest, "Item não encontrado nesta atividade.");
        }

        var grade = ItemGrader.Grade(item, request);
        if (!grade.Success)
        {
            return SessionOperationResult.Fail(StatusCodes.Status400BadRequest, grade.Error ?? "Não foi possível corrigir a resposta.");
        }

        int? boxLevel = null;
        DateTimeOffset? nextReviewAt = null;
        if (item.Kind == ItemKinds.Flashcard && session.StudentId is Guid studentId)
        {
            (boxLevel, nextReviewAt) = await ApplyLeitnerAsync(
                studentId,
                activity.Id,
                item.Id,
                grade.Remembered == true,
                cancellationToken);
        }

            session.Answers.Add(new StudySessionAnswer
            {
                ItemId = item.Id,
                Kind = item.Kind,
                SelectedOptionId = grade.SelectedOptionId,
                SelectedOptionIds = grade.SelectedOptionIds?.ToList(),
                TextAnswer = grade.TextAnswer,
                OrderedIds = request.OrderedIds,
                ClozeAnswers = request.ClozeAnswers?
                    .Select(answer => new ClozeAnswer { BlankId = answer.BlankId, Text = answer.Text })
                    .ToList(),
                CategoryPlacements = request.CategoryPlacements?
                    .Select(placement => new CategoryPlacement { ItemId = placement.ItemId, CategoryId = placement.CategoryId })
                    .ToList(),
                Remembered = grade.Remembered,
            IsCorrect = grade.IsCorrect,
            Score = grade.Score,
            ResponseTimeMs = request.ResponseTimeMs,
            BoxLevel = boxLevel,
            NextReviewAt = nextReviewAt,
            AnsweredAt = DateTimeOffset.UtcNow
        });

        if (session.StudentId is Guid attemptStudentId)
        {
            await db.AnswerAttempts.InsertOneAsync(
                new AnswerAttempt
                {
                    Id = Guid.NewGuid(),
                    StudentId = attemptStudentId,
                    ActivityId = activity.Id,
                    ItemId = item.Id,
                    StudySessionId = session.Id,
                    SelectedOptionId = grade.SelectedOptionId,
                    SelectedOptionIds = grade.SelectedOptionIds?.ToList(),
                    TextAnswer = grade.TextAnswer,
                    Remembered = grade.Remembered,
                    IsCorrect = grade.IsCorrect,
                    Score = grade.Score,
                    ResponseTimeMs = request.ResponseTimeMs,
                    AnsweredAt = DateTimeOffset.UtcNow
                },
                cancellationToken: cancellationToken);
        }

        await SaveAsync(session, cancellationToken);
        return SessionOperationResult.Ok(ToResponse(session, activity, grade, item.Id, boxLevel, nextReviewAt));
    }

    public async Task<SessionOperationResult> CompleteAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var loaded = await LoadOwnedAsync(sessionId, cancellationToken);
        if (loaded.Error is not null)
        {
            return SessionOperationResult.Fail(loaded.StatusCode, loaded.Error);
        }

        Complete(loaded.Session!);
        await SaveAsync(loaded.Session!, cancellationToken);
        return SessionOperationResult.Ok(ToResponse(loaded.Session!, loaded.Activity!));
    }

    private async Task<(StudySession? Session, Activity? Activity, int StatusCode, string? Error)> LoadOwnedAsync(
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var session = await db.StudySessions
            .Find(item => item.Id == sessionId)
            .FirstOrDefaultAsync(cancellationToken);

        if (session is null)
        {
            return (null, null, StatusCodes.Status404NotFound, "Sessão não encontrada.");
        }

        var profile = await access.GetProfileAsync(currentUser.UserId, cancellationToken);
        if (session.StudentId is Guid ownerId && profile?.Id != ownerId)
        {
            return (null, null, StatusCodes.Status403Forbidden, "Esta sessão pertence a outro usuário.");
        }

        var activity = await db.Activities
            .Find(item => item.Id == session.ActivityId)
            .FirstOrDefaultAsync(cancellationToken);

        if (activity is null)
        {
            return (null, null, StatusCodes.Status404NotFound, "Atividade não encontrada.");
        }

        if (!await access.CanStudyAsync(profile, activity, cancellationToken))
        {
            return (null, null, StatusCodes.Status403Forbidden, "Você não tem acesso a esta atividade.");
        }

        return (session, activity, StatusCodes.Status200OK, null);
    }

    private async Task SaveAsync(StudySession session, CancellationToken cancellationToken)
    {
        session.UpdatedAt = DateTimeOffset.UtcNow;
        await db.StudySessions.ReplaceOneAsync(
            item => item.Id == session.Id,
            session,
            cancellationToken: cancellationToken);
    }

    private async Task<(int BoxLevel, DateTimeOffset NextReviewAt)> ApplyLeitnerAsync(
        Guid studentId,
        Guid activityId,
        Guid itemId,
        bool remembered,
        CancellationToken cancellationToken)
    {
        var existing = await db.ReviewProgress
            .Find(progress =>
                progress.StudentId == studentId
                && progress.ActivityId == activityId
                && progress.ItemId == itemId)
            .FirstOrDefaultAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var (box, nextReviewAt) = LeitnerScheduler.Next(
            existing?.BoxLevel ?? LeitnerScheduler.MinBox,
            remembered,
            now);

        existing ??= new ReviewProgress
        {
            Id = Guid.NewGuid(),
            StudentId = studentId,
            ActivityId = activityId,
            ItemId = itemId
        };

        existing.BoxLevel = box;
        existing.NextReviewAt = nextReviewAt;
        existing.UpdatedAt = now;

        await db.ReviewProgress.ReplaceOneAsync(
            progress => progress.StudentId == studentId && progress.ActivityId == activityId && progress.ItemId == itemId,
            existing,
            new ReplaceOptions { IsUpsert = true },
            cancellationToken);

        return (box, nextReviewAt);
    }

    private static List<StudySessionPlanSection> BuildPlan(Activity activity) =>
        ActivityContentBuilder.ResolveSections(activity)
            .Select(section => new StudySessionPlanSection
            {
                Id = section.Id,
                Role = section.Role,
                Title = section.Title,
                Body = section.Body,
                FeedbackTemplate = section.FeedbackTemplate,
                ItemIds = section.Role == SectionRoles.Practice
                    ? (section.ItemIds.Count > 0
                        ? section.ItemIds
                        : activity.Items.OrderBy(item => item.Position).Select(item => item.Id).ToList())
                    : [],
                Objectives = section.Objectives,
                EstimatedMinutes = section.EstimatedMinutes,
                Tips = section.Tips,
                HasImage = section.ImageBytes is { Length: > 0 }
            })
            .ToList();

    private static int FirstPlayableIndex(IReadOnlyList<StudySessionPlanSection> plan)
    {
        for (var i = 0; i < plan.Count; i++)
        {
            if (IsPlayable(plan[i]))
            {
                return i;
            }
        }

        return Math.Max(plan.Count - 1, 0);
    }

    private static bool IsPlayable(StudySessionPlanSection section) =>
        section.Role switch
        {
            SectionRoles.Prep => HasPrepContent(section),
            SectionRoles.Practice => section.ItemIds.Count > 0,
            SectionRoles.Feedback => true,
            _ => false
        };

    private static bool HasPrepContent(StudySessionPlanSection section) =>
        !string.IsNullOrWhiteSpace(section.Title)
        || !string.IsNullOrWhiteSpace(section.Body)
        || section.Objectives is { Count: > 0 }
        || section.Tips is { Count: > 0 }
        || section.EstimatedMinutes is > 0
        || section.HasImage;

    private static void MoveTo(StudySession session, int sectionIndex)
    {
        while (sectionIndex < session.Plan.Count && !IsPlayable(session.Plan[sectionIndex]))
        {
            sectionIndex++;
        }

        if (sectionIndex >= session.Plan.Count)
        {
            Complete(session);
            return;
        }

        session.SectionIndex = sectionIndex;
        session.ItemIndex = 0;
        session.CompletedAt = null;
        session.Status = session.Plan[sectionIndex].Role switch
        {
            SectionRoles.Prep => StudySessionStatuses.Prep,
            SectionRoles.Practice => StudySessionStatuses.Practice,
            _ => StudySessionStatuses.Feedback
        };
    }

    private static void AdvanceFromPractice(StudySession session)
    {
        var current = CurrentPlanSection(session);
        if (current is null || current.Role != SectionRoles.Practice)
        {
            MoveTo(session, session.SectionIndex + 1);
            return;
        }

        var currentItemId = CurrentItemId(session);
        if (currentItemId is Guid itemId && session.Answers.All(answer => answer.ItemId != itemId))
        {
            return;
        }

        if (session.ItemIndex + 1 < current.ItemIds.Count)
        {
            session.ItemIndex++;
            session.Status = StudySessionStatuses.Practice;
            return;
        }

        MoveTo(session, session.SectionIndex + 1);
    }

    private static void Complete(StudySession session)
    {
        session.Status = StudySessionStatuses.Completed;
        session.CompletedAt ??= DateTimeOffset.UtcNow;
        if (session.Plan.Count > 0)
        {
            session.SectionIndex = session.Plan.Count - 1;
        }
    }

    private static StudySessionPlanSection? CurrentPlanSection(StudySession session) =>
        session.SectionIndex >= 0 && session.SectionIndex < session.Plan.Count
            ? session.Plan[session.SectionIndex]
            : null;

    private static Guid? CurrentItemId(StudySession session)
    {
        var current = CurrentPlanSection(session);
        if (current is null || current.Role != SectionRoles.Practice)
        {
            return null;
        }

        return session.ItemIndex >= 0 && session.ItemIndex < current.ItemIds.Count
            ? current.ItemIds[session.ItemIndex]
            : null;
    }

    private static StudySessionResponse ToResponse(
        StudySession session,
        Activity activity,
        GradeResult? justGraded = null,
        Guid? gradedItemId = null,
        int? boxLevel = null,
        DateTimeOffset? nextReviewAt = null)
    {
        var currentSection = CurrentPlanSection(session);
        var practiceTotal = session.Plan
            .Where(section => section.Role == SectionRoles.Practice)
            .Sum(section => section.ItemIds.Count);
        var correctCount = session.Answers.Count(answer => answer.IsCorrect == true);

        StudySessionItemResponse? currentItem = null;
        StudyAnswerResponse? currentFeedback = null;
        if (session.Status == StudySessionStatuses.Practice)
        {
            var itemId = CurrentItemId(session);
            var item = itemId is Guid id
                ? activity.Items.FirstOrDefault(candidate => candidate.Id == id)
                : null;
            if (item is not null)
            {
                currentItem = ToSessionItem(item, session.Id);
            }

            if (justGraded is not null && gradedItemId is Guid gradedId && gradedId == itemId)
            {
                currentFeedback = ToAnswerResponse(justGraded, gradedId, boxLevel, nextReviewAt);
            }
            else if (itemId is Guid answeredId)
            {
                var stored = session.Answers.LastOrDefault(answer => answer.ItemId == answeredId);
                if (stored is not null)
                {
                    currentFeedback = StoredToAnswer(stored, item);
                }
            }
        }

        var showFeedback = session.Status is StudySessionStatuses.Feedback or StudySessionStatuses.Completed;

        return new StudySessionResponse(
            session.Id,
            activity.Id,
            activity.Title,
            activity.Type,
            session.Status,
            session.SectionIndex,
            session.Plan.Count,
            currentSection is null
                ? null
                : new StudySessionSectionViewResponse(
                    currentSection.Id,
                    currentSection.Role,
                    currentSection.Title,
                    currentSection.Body,
                    currentSection.FeedbackTemplate,
                    currentSection.Objectives,
                    currentSection.EstimatedMinutes,
                    currentSection.Tips,
                    ActivityImage.ToDataUrl(activity.Sections.FirstOrDefault(section => section.Id == currentSection.Id))),
            currentItem,
            currentFeedback,
            new StudySessionProgressResponse(session.Answers.Count, practiceTotal, correctCount),
            showFeedback ? BuildFeedback(session, activity, currentSection) : null);
    }

    private static StudyAnswerResponse ToAnswerResponse(
        GradeResult grade,
        Guid itemId,
        int? boxLevel,
        DateTimeOffset? nextReviewAt) =>
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
            boxLevel,
            nextReviewAt);

    private static StudyAnswerResponse StoredToAnswer(StudySessionAnswer answer, ActivityItem? item)
    {
        var correct = item?.Options?.Where(option => option.IsCorrect).Select(option => option.Id).ToList();
        return new StudyAnswerResponse(
            answer.ItemId,
            answer.SelectedOptionId,
            correct is { Count: 1 } ? correct[0] : null,
            answer.IsCorrect == true,
            item?.Explanation,
            answer.Kind,
            answer.SelectedOptionIds,
            correct,
            answer.TextAnswer,
            answer.Remembered,
            item?.Kind == ItemKinds.Flashcard ? item.Back : null,
            answer.Score,
            answer.BoxLevel,
            answer.NextReviewAt);
    }

    private static StudySessionItemResponse ToSessionItem(ActivityItem item, Guid sessionId)
    {
        IReadOnlyList<MatchingEntryResponse>? left = null;
        IReadOnlyList<MatchingEntryResponse>? right = null;
        IReadOnlyList<MatchingEntryResponse>? orderItems = null;
        IReadOnlyList<MatchingEntryResponse>? categories = null;
        IReadOnlyList<MatchingEntryResponse>? categoryItems = null;
        IReadOnlyList<MatchingEntryResponse>? clozeBlanks = null;
        var prompt = item.Prompt;

        if (item.Kind == ItemKinds.Matching && item.Pairs is { Count: > 0 })
        {
            left = item.Pairs
                .Select(pair => new MatchingEntryResponse(pair.LeftId, pair.Left))
                .ToList();
            right = Shuffle(
                item.Pairs.Select(pair => new MatchingEntryResponse(pair.RightId, pair.Right)).ToList(),
                sessionId,
                item.Id);
        }

        if (item.Kind == ItemKinds.Ordering && item.OrderEntries is { Count: > 0 })
        {
            orderItems = Shuffle(
                item.OrderEntries
                    .OrderBy(entry => entry.Position)
                    .Select(entry => new MatchingEntryResponse(entry.Id, entry.Text))
                    .ToList(),
                sessionId,
                item.Id);
        }

        if (item.Kind == ItemKinds.Categorize)
        {
            categories = (item.Categories ?? [])
                .OrderBy(category => category.Position)
                .Select(category => new MatchingEntryResponse(category.Id, category.Label))
                .ToList();
            categoryItems = Shuffle(
                (item.CategoryItems ?? [])
                    .Select(member => new MatchingEntryResponse(member.Id, member.Text))
                    .ToList(),
                sessionId,
                item.Id);
        }

        if (item.Kind == ItemKinds.Cloze && item.ClozeBlanks is { Count: > 0 })
        {
            prompt = ClozeMarkup.ToStudentPrompt(item.Prompt, item.ClozeBlanks);
            clozeBlanks = item.ClozeBlanks
                .OrderBy(blank => blank.Position)
                .Select(blank => new MatchingEntryResponse(blank.Id, string.Empty))
                .ToList();
        }

        return new StudySessionItemResponse(
            item.Id,
            item.Kind,
            prompt,
            item.TimeLimitSeconds,
            item.Options?
                .OrderBy(option => option.Position)
                .Select(option => new QuestionOptionResponse(option.Id, option.Text, null, option.Position))
                .ToList(),
            item.Front,
            item.Kind == ItemKinds.Flashcard ? item.Back : null,
            ActivityImage.ToDataUrl(item),
            item.Kind == ItemKinds.MultipleChoice ? item.AllowMultiple : null,
            left,
            right,
            orderItems,
            categories,
            categoryItems,
            clozeBlanks);
    }

    private static StudySessionFeedbackResponse BuildFeedback(
        StudySession session,
        Activity activity,
        StudySessionPlanSection? currentSection)
    {
        var itemsById = activity.Items.ToDictionary(item => item.Id);
        var items = session.Answers
            .Select(answer =>
            {
                itemsById.TryGetValue(answer.ItemId, out var item);
                var correct = item?.Options?.FirstOrDefault(option => option.IsCorrect);
                return new StudySessionFeedbackItemResponse(
                    answer.ItemId,
                    answer.Kind,
                    item?.Prompt ?? item?.Front,
                    answer.IsCorrect,
                    item?.Explanation,
                    answer.SelectedOptionId,
                    correct?.Id,
                    answer.TextAnswer,
                    answer.Remembered,
                    answer.Score);
            })
            .ToList();

        var feedbackSection = currentSection?.Role == SectionRoles.Feedback
            ? currentSection
            : session.Plan.LastOrDefault(section => section.Role == SectionRoles.Feedback);

        return new StudySessionFeedbackResponse(
            feedbackSection?.FeedbackTemplate ?? FeedbackTemplates.ScoreSummary,
            feedbackSection?.Title ?? "Resultados",
            feedbackSection?.Body,
            session.Answers.Count,
            session.Answers.Count(answer => answer.IsCorrect == true),
            session.Answers.Count(answer => answer.IsCorrect == false),
            items);
    }

    private static List<MatchingEntryResponse> Shuffle(
        List<MatchingEntryResponse> entries,
        Guid sessionId,
        Guid itemId)
    {
        var seed = BitConverter.ToInt32(sessionId.ToByteArray(), 0)
            ^ BitConverter.ToInt32(itemId.ToByteArray(), 0);
        var rng = new Random(seed);
        for (var i = entries.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (entries[i], entries[j]) = (entries[j], entries[i]);
        }

        return entries;
    }
}
