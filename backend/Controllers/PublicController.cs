using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public")]
public class PublicController(MongoDbContext db) : ControllerBase
{
    [HttpGet("activities")]
    public async Task<ActionResult<IEnumerable<PublicActivitySummaryResponse>>> List(
        CancellationToken cancellationToken)
    {
        var activities = await db.Activities
            .Find(a => a.IsPublic && (a.Type == ActivityTypes.Quiz || a.Type == ActivityTypes.Flashcards))
            .SortByDescending(a => a.CreatedAt)
            .Limit(48)
            .ToListAsync(cancellationToken);

        var professorIds = activities.Select(a => a.ProfessorId).Distinct().ToList();
        var professors = professorIds.Count == 0
            ? []
            : await db.Profiles
                .Find(Builders<Profile>.Filter.In(p => p.Id, professorIds))
                .ToListAsync(cancellationToken);
        var nameById = professors.ToDictionary(
            p => p.Id,
            p => p.Username ?? p.FullName ?? p.Email);

        var summaries = activities.Select(activity =>
            new PublicActivitySummaryResponse(
                activity.Id,
                activity.Title,
                activity.Type,
                activity.Items.Count,
                activity.CreatedAt,
                nameById.GetValueOrDefault(activity.ProfessorId)));

        return Ok(summaries);
    }

    [HttpGet("activities/{id:guid}")]
    public async Task<ActionResult<ActivityResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var activity = await FindPublicAsync(id, cancellationToken);
        if (activity is null)
        {
            return NotFound(new { detail = "Conteúdo público não encontrado." });
        }

        return Ok(ActivityMapper.ToResponse(activity, includeAnswers: false));
    }

    [HttpPost("quizzes/{id:guid}/answers")]
    public async Task<ActionResult<StudyAnswerResponse>> SubmitAnswer(
        Guid id,
        [FromBody] SubmitStudyAnswerRequest request,
        CancellationToken cancellationToken)
    {
        var quiz = await FindPublicAsync(id, cancellationToken);
        if (quiz is null || quiz.Type != ActivityTypes.Quiz)
        {
            return NotFound(new { detail = "Quiz público não encontrado." });
        }

        var item = quiz.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item is null)
        {
            return BadRequest(new { detail = "Questão não encontrada neste quiz." });
        }

        var grade = ItemGrader.Grade(item, request);
        if (!grade.Success)
        {
            return BadRequest(new { detail = grade.Error });
        }

        return Ok(ItemGrader.ToResponse(grade, item.Id));
    }

    [HttpGet("flashcards/{id:guid}")]
    public async Task<ActionResult<StudyFlashcardSessionResponse>> GetFlashcards(
        Guid id,
        CancellationToken cancellationToken)
    {
        var deck = await FindPublicAsync(id, cancellationToken);
        if (deck is null || deck.Type != ActivityTypes.Flashcards)
        {
            return NotFound(new { detail = "Deck público não encontrado." });
        }

        var cards = deck.Items
            .OrderBy(item => item.Position)
            .Select(item => new StudyFlashcardCardResponse(
                item.Id,
                item.Front ?? string.Empty,
                item.Back ?? string.Empty,
                LeitnerScheduler.MinBox,
                ActivityImage.ToDataUrl(item)))
            .ToList();

        return Ok(new StudyFlashcardSessionResponse(deck.Id, deck.Title, deck.Items.Count, cards.Count, cards));
    }

    private async Task<Activity?> FindPublicAsync(Guid id, CancellationToken cancellationToken)
    {
        var activity = await db.Activities
            .Find(a => a.Id == id)
            .FirstOrDefaultAsync(cancellationToken);

        if (activity is null || !activity.IsPublic)
        {
            return null;
        }

        return activity;
    }
}
