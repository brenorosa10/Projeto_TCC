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
public class PublicController(MongoDbContext db, PublicCatalogService catalog) : ControllerBase
{
    [HttpGet("activities")]
    public async Task<ActionResult<PublicCatalogResponse>> List(
        [FromQuery] string? q,
        [FromQuery] string? type,
        [FromQuery] string[]? themes,
        [FromQuery] string? sort,
        [FromQuery] int? minItems,
        [FromQuery] int? maxItems,
        [FromQuery] string? difficulty,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? view,
        CancellationToken cancellationToken)
    {
        var parsed = PublicCatalogLogic.Parse(
            q,
            type,
            themes,
            sort,
            minItems,
            maxItems,
            difficulty,
            page,
            pageSize,
            view);
        if (parsed.Error is not null || parsed.Criteria is null)
        {
            return BadRequest(new { detail = parsed.Error ?? "Não foi possível filtrar a vitrine." });
        }

        return Ok(await catalog.SearchAsync(parsed.Criteria, cancellationToken));
    }

    [HttpGet("activities/{id:guid}/cover")]
    public async Task<IActionResult> Cover(Guid id, CancellationToken cancellationToken)
    {
        var activity = await FindPublicAsync(id, cancellationToken);
        var prep = activity?.Sections.FirstOrDefault(section =>
            section.Role == SectionRoles.Prep
            && section.ImageBytes is { Length: > 0 }
            && !string.IsNullOrWhiteSpace(section.ImageContentType));
        if (prep?.ImageBytes is null || string.IsNullOrWhiteSpace(prep.ImageContentType))
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public,max-age=86400";
        return File(prep.ImageBytes, prep.ImageContentType);
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
