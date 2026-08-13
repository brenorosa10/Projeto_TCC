using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using Astro.Api.Data;

namespace Astro.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController(MongoDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        await db.Database.RunCommandAsync<BsonDocument>(
            new BsonDocument("ping", 1),
            cancellationToken: cancellationToken);

        return Ok(new
        {
            status = "ok",
            service = "Astro.Api",
            database = "mongodb"
        });
    }
}
