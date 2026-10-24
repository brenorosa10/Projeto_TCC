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
public class MediaController(
    MongoDbContext db,
    CurrentUserService currentUser,
    MediaStorage storage) : ControllerBase
{
    [HttpPost("api/media")]
    [RequestSizeLimit(4 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 4 * 1024 * 1024)]
    public async Task<ActionResult<MediaUploadResponse>> Upload(
        IFormFile? file,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "É preciso entrar para enviar imagens." });
        }

        if (profile.Role is not (UserRoles.Professor or UserRoles.Aluno))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não pode enviar imagens." });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { detail = "Selecione uma imagem." });
        }

        await using var stream = file.OpenReadStream();
        var saved = await storage.SaveAsync(stream, file.Length, profile.Id, cancellationToken);
        if (saved.Error is not null || saved.Url is null)
        {
            return BadRequest(new { detail = saved.Error ?? "Não foi possível salvar a imagem." });
        }

        return Ok(new MediaUploadResponse(saved.Url));
    }

    [AllowAnonymous]
    [HttpGet("api/media/{id:guid}")]
    public IActionResult Download(Guid id)
    {
        var file = storage.Open(id);
        if (file is null)
        {
            return NotFound(new { detail = "Imagem não encontrada." });
        }

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return PhysicalFile(file.Path, file.ContentType);
    }

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
