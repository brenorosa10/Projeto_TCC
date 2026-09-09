using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Astro.Api.Contracts;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/analytics")]
public class AnalyticsController(AnalyticsService analytics) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AnalyticsOverviewResponse>> Get(
        [FromQuery] Guid? activityId,
        [FromQuery] Guid? sessionId,
        CancellationToken cancellationToken)
    {
        var result = await analytics.GetAsync(activityId, sessionId, cancellationToken);
        if (result.Data is null)
        {
            return StatusCode(result.StatusCode, new { detail = result.Error });
        }

        return Ok(result.Data);
    }
}
