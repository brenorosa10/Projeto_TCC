using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Astro.Api.Contracts;
using Astro.Api.Hubs;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/live/sessions")]
public class LiveSessionsController(
    LiveSessionService liveSessions,
    IHubContext<LiveSessionHub> hub) : ControllerBase
{
    [HttpGet("active")]
    public async Task<ActionResult<IEnumerable<LiveSessionStateResponse>>> ListActive(CancellationToken cancellationToken)
    {
        var result = await liveSessions.ListActiveAsync(cancellationToken);
        if (result.Error is not null || result.Sessions is null)
        {
            return StatusCode(result.StatusCode, new { detail = result.Error });
        }

        return Ok(result.Sessions);
    }

    [HttpPost]
    public async Task<ActionResult<LiveSessionStateResponse>> Create(
        [FromBody] CreateLiveSessionRequest request,
        CancellationToken cancellationToken) =>
        ToActionResult(await liveSessions.CreateAsync(request, cancellationToken), created: true);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LiveSessionStateResponse>> Get(
        Guid id,
        CancellationToken cancellationToken) =>
        ToActionResult(await liveSessions.GetAsync(id, cancellationToken));

    [HttpGet("by-pin/{pin}")]
    public async Task<ActionResult<LiveSessionStateResponse>> GetByPin(
        string pin,
        CancellationToken cancellationToken) =>
        ToActionResult(await liveSessions.GetByPinAsync(pin, cancellationToken));

    [HttpPost("{id:guid}/end")]
    public async Task<ActionResult<LiveSessionStateResponse>> End(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await liveSessions.EndAsync(id, cancellationToken);
        if (result.State is not null)
        {
            await LiveSessionHub.BroadcastAsync(hub, liveSessions, result.State.Id, cancellationToken);
        }

        return ToActionResult(result);
    }

    private ActionResult<LiveSessionStateResponse> ToActionResult(LiveOperationResult result, bool created = false)
    {
        if (result.State is null)
        {
            return StatusCode(result.StatusCode, new { detail = result.Error });
        }

        if (created)
        {
            return CreatedAtAction(nameof(Get), new { id = result.State.Id }, result.State);
        }

        return Ok(result.State);
    }
}
