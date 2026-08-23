using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Astro.Api.Contracts;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/study/sessions")]
public class StudySessionsController(StudySessionService sessions) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<StudySessionResponse>> Create(
        [FromBody] CreateStudySessionRequest request,
        CancellationToken cancellationToken) =>
        ToActionResult(await sessions.CreateAsync(request, cancellationToken), created: true);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StudySessionResponse>> Get(
        Guid id,
        CancellationToken cancellationToken) =>
        ToActionResult(await sessions.GetAsync(id, cancellationToken));

    [HttpPost("{id:guid}/advance")]
    public async Task<ActionResult<StudySessionResponse>> Advance(
        Guid id,
        CancellationToken cancellationToken) =>
        ToActionResult(await sessions.AdvanceAsync(id, cancellationToken));

    [HttpPost("{id:guid}/answers")]
    public async Task<ActionResult<StudySessionResponse>> SubmitAnswer(
        Guid id,
        [FromBody] SubmitStudyAnswerRequest request,
        CancellationToken cancellationToken) =>
        ToActionResult(await sessions.SubmitAnswerAsync(id, request, cancellationToken));

    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<StudySessionResponse>> Complete(
        Guid id,
        CancellationToken cancellationToken) =>
        ToActionResult(await sessions.CompleteAsync(id, cancellationToken));

    private ActionResult<StudySessionResponse> ToActionResult(SessionOperationResult result, bool created = false)
    {
        if (result.Session is null)
        {
            return StatusCode(result.StatusCode, new { detail = result.Error });
        }

        if (created)
        {
            return CreatedAtAction(nameof(Get), new { id = result.Session.Id }, result.Session);
        }

        return Ok(result.Session);
    }
}
