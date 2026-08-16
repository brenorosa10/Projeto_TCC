using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/study")]
public class StudyController(
    MongoDbContext db,
    CurrentUserService currentUser) : ControllerBase
{
    [HttpGet("quizzes")]
    public async Task<ActionResult<IEnumerable<StudyQuizSummaryResponse>>> ListQuizzes(
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas alunos podem acessar o estudo off-line." });
        }

        var classes = await EnrolledClassesAsync(profile.Id, cancellationToken);
        if (classes.Count == 0)
        {
            return Ok(Array.Empty<StudyQuizSummaryResponse>());
        }

        var classIds = classes.Select(c => c.Id).ToList();
        var nameById = classes.ToDictionary(c => c.Id, c => c.Name);

        var filter = Builders<Activity>.Filter.Eq(a => a.Type, ActivityTypes.Quiz)
            & Builders<Activity>.Filter.Or(
                Builders<Activity>.Filter.AnyIn(a => a.ClassIds, classIds),
                Builders<Activity>.Filter.In(a => a.ClassId, classIds));

        var quizzes = await db.Activities
            .Find(filter)
            .SortByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

        var summaries = quizzes.Select(quiz =>
        {
            var names = quiz.LinkedClassIds()
                .Where(nameById.ContainsKey)
                .Select(id => nameById[id])
                .Distinct()
                .ToList();

            return new StudyQuizSummaryResponse(quiz.Id, quiz.Title, quiz.Items.Count, names);
        });

        return Ok(summaries);
    }

    [HttpGet("flashcards")]
    public async Task<ActionResult<IEnumerable<StudyFlashcardSummaryResponse>>> ListFlashcards(
        CancellationToken cancellationToken)
    {
        var access = await RequireStudentAsync(cancellationToken);
        if (access.Error is not null)
        {
            return access.Error;
        }

        var classes = await EnrolledClassesAsync(access.Profile!.Id, cancellationToken);
        if (classes.Count == 0)
        {
            return Ok(Array.Empty<StudyFlashcardSummaryResponse>());
        }

        var classIds = classes.Select(c => c.Id).ToList();
        var nameById = classes.ToDictionary(c => c.Id, c => c.Name);
        var decks = await FindLinkedActivitiesAsync(classIds, ActivityTypes.Flashcards, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var summaries = new List<StudyFlashcardSummaryResponse>();

        foreach (var deck in decks)
        {
            var progress = await db.ReviewProgress
                .Find(p => p.StudentId == access.Profile.Id && p.ActivityId == deck.Id)
                .ToListAsync(cancellationToken);
            var progressByItem = progress.ToDictionary(p => p.ItemId);

            var dueCount = deck.Items.Count(item => IsDue(progressByItem.GetValueOrDefault(item.Id), now));
            var names = deck.LinkedClassIds()
                .Where(nameById.ContainsKey)
                .Select(id => nameById[id])
                .Distinct()
                .ToList();

            summaries.Add(new StudyFlashcardSummaryResponse(deck.Id, deck.Title, deck.Items.Count, dueCount, names));
        }

        return Ok(summaries);
    }

    [HttpGet("flashcards/{activityId:guid}")]
    public async Task<ActionResult<StudyFlashcardSessionResponse>> GetFlashcardSession(
        Guid activityId,
        CancellationToken cancellationToken)
    {
        var access = await RequireStudentAsync(cancellationToken);
        if (access.Error is not null)
        {
            return access.Error;
        }

        var deck = await db.Activities
            .Find(a => a.Id == activityId)
            .FirstOrDefaultAsync(cancellationToken);

        if (deck is null || deck.Type != ActivityTypes.Flashcards)
        {
            return NotFound(new { detail = "Deck de flashcards não encontrado." });
        }

        if (!await StudentCanAccessAsync(access.Profile!.Id, deck, cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Este deck não está vinculado às suas turmas." });
        }

        var progress = await db.ReviewProgress
            .Find(p => p.StudentId == access.Profile.Id && p.ActivityId == deck.Id)
            .ToListAsync(cancellationToken);
        var progressByItem = progress.ToDictionary(p => p.ItemId);
        var now = DateTimeOffset.UtcNow;

        var cards = deck.Items
            .OrderBy(item => item.Position)
            .Select(item =>
            {
                var state = progressByItem.GetValueOrDefault(item.Id);
                if (!IsDue(state, now))
                {
                    return null;
                }

                return new StudyFlashcardCardResponse(
                    item.Id,
                    item.Front ?? string.Empty,
                    item.Back ?? string.Empty,
                    state?.BoxLevel ?? LeitnerScheduler.MinBox);
            })
            .Where(card => card is not null)
            .Cast<StudyFlashcardCardResponse>()
            .OrderBy(card => card.BoxLevel)
            .ToList();

        return Ok(new StudyFlashcardSessionResponse(deck.Id, deck.Title, deck.Items.Count, cards.Count, cards));
    }

    [HttpPost("flashcards/{activityId:guid}/reviews")]
    public async Task<ActionResult<FlashcardReviewResponse>> SubmitFlashcardReview(
        Guid activityId,
        [FromBody] SubmitFlashcardReviewRequest request,
        CancellationToken cancellationToken)
    {
        var access = await RequireStudentAsync(cancellationToken);
        if (access.Error is not null)
        {
            return access.Error;
        }

        var deck = await db.Activities
            .Find(a => a.Id == activityId)
            .FirstOrDefaultAsync(cancellationToken);

        if (deck is null || deck.Type != ActivityTypes.Flashcards)
        {
            return NotFound(new { detail = "Deck de flashcards não encontrado." });
        }

        if (!await StudentCanAccessAsync(access.Profile!.Id, deck, cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Este deck não está vinculado às suas turmas." });
        }

        var item = deck.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item is null)
        {
            return BadRequest(new { detail = "Cartão não encontrado neste deck." });
        }

        var existing = await db.ReviewProgress
            .Find(p =>
                p.StudentId == access.Profile.Id
                && p.ActivityId == deck.Id
                && p.ItemId == item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var currentBox = existing?.BoxLevel ?? LeitnerScheduler.MinBox;
        var now = DateTimeOffset.UtcNow;
        var (box, nextReviewAt) = LeitnerScheduler.Next(currentBox, request.Remembered, now);

        if (existing is null)
        {
            existing = new ReviewProgress
            {
                Id = Guid.NewGuid(),
                StudentId = access.Profile.Id,
                ActivityId = deck.Id,
                ItemId = item.Id
            };
        }

        existing.BoxLevel = box;
        existing.NextReviewAt = nextReviewAt;
        existing.UpdatedAt = now;

        await db.ReviewProgress.ReplaceOneAsync(
            p => p.StudentId == access.Profile.Id && p.ActivityId == deck.Id && p.ItemId == item.Id,
            existing,
            new ReplaceOptions { IsUpsert = true },
            cancellationToken);

        return Ok(new FlashcardReviewResponse(item.Id, request.Remembered, box, nextReviewAt));
    }

    private async Task<(Profile? Profile, ActionResult? Error)> RequireStudentAsync(
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return (null, Unauthorized(new { detail = "Perfil não encontrado." }));
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return (profile, StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas alunos podem acessar o estudo off-line." }));
        }

        return (profile, null);
    }

    private Task<List<Activity>> FindLinkedActivitiesAsync(
        List<Guid> classIds,
        string type,
        CancellationToken cancellationToken)
    {
        var filter = Builders<Activity>.Filter.Eq(a => a.Type, type)
            & Builders<Activity>.Filter.Or(
                Builders<Activity>.Filter.AnyIn(a => a.ClassIds, classIds),
                Builders<Activity>.Filter.In(a => a.ClassId, classIds));

        return db.Activities
            .Find(filter)
            .SortByDescending(a => a.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    private static bool IsDue(ReviewProgress? progress, DateTimeOffset now) =>
        progress is null || progress.NextReviewAt is null || progress.NextReviewAt <= now;


    [HttpPost("quizzes/{activityId:guid}/answers")]
    public async Task<ActionResult<StudyAnswerResponse>> SubmitAnswer(
        Guid activityId,
        [FromBody] SubmitStudyAnswerRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "Perfil não encontrado." });
        }

        if (profile.Role != UserRoles.Aluno)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Apenas alunos podem responder o estudo off-line." });
        }

        var quiz = await db.Activities
            .Find(a => a.Id == activityId)
            .FirstOrDefaultAsync(cancellationToken);

        if (quiz is null || quiz.Type != ActivityTypes.Quiz)
        {
            return NotFound(new { detail = "Quiz não encontrado." });
        }

        if (!await StudentCanAccessAsync(profile.Id, quiz, cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Este quiz não está vinculado às suas turmas." });
        }

        var item = quiz.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item is null)
        {
            return BadRequest(new { detail = "Questão não encontrada neste quiz." });
        }

        var options = item.Options ?? [];
        if (request.SelectedOptionId is Guid selectedId && options.All(option => option.Id != selectedId))
        {
            return BadRequest(new { detail = "Alternativa inválida para esta questão." });
        }

        var correct = options.FirstOrDefault(option => option.IsCorrect);
        var isCorrect = request.SelectedOptionId is Guid chosen
            && correct is not null
            && chosen == correct.Id;

        var attempt = new AnswerAttempt
        {
            Id = Guid.NewGuid(),
            StudentId = profile.Id,
            ActivityId = quiz.Id,
            ItemId = item.Id,
            SelectedOptionId = request.SelectedOptionId,
            IsCorrect = isCorrect,
            ResponseTimeMs = request.ResponseTimeMs,
            AnsweredAt = DateTimeOffset.UtcNow
        };

        await db.AnswerAttempts.InsertOneAsync(attempt, cancellationToken: cancellationToken);

        return Ok(new StudyAnswerResponse(
            item.Id,
            request.SelectedOptionId,
            correct?.Id,
            isCorrect,
            item.Explanation));
    }

    private async Task<bool> StudentCanAccessAsync(Guid studentId, Activity activity, CancellationToken cancellationToken)
    {
        var linked = activity.LinkedClassIds();
        if (linked.Count == 0)
        {
            return false;
        }

        return await db.Classes
            .Find(c => linked.Contains(c.Id) && c.Enrollments.Any(e => e.StudentId == studentId))
            .AnyAsync(cancellationToken);
    }

    private Task<List<ClassRoom>> EnrolledClassesAsync(Guid studentId, CancellationToken cancellationToken) =>
        db.Classes
            .Find(Builders<ClassRoom>.Filter.ElemMatch(c => c.Enrollments, e => e.StudentId == studentId))
            .ToListAsync(cancellationToken);

    private async Task<Profile?> GetCurrentProfileAsync(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        if (userId is null)
        {
            return null;
        }

        return await db.Profiles
            .Find(p => p.Id == userId)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
