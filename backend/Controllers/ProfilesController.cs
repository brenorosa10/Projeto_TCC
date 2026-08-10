using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/profiles")]
public class ProfilesController(
    AppDbContext db,
    CurrentUserService currentUser) : ControllerBase
{
    [HttpGet("me")]
    public async Task<ActionResult<ProfileResponse>> GetMe(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        if (userId is null)
        {
            return Unauthorized();
        }

        var profile = await db.Profiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == userId, cancellationToken);

        if (profile is null)
        {
            return NotFound(new { detail = "Perfil ainda não criado." });
        }

        return Ok(ToResponse(profile));
    }

    [HttpPost("ensure")]
    public async Task<ActionResult<ProfileResponse>> Ensure(
        [FromBody] EnsureProfileRequest request,
        CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        if (userId is null)
        {
            return Unauthorized();
        }

        if (!UserRoles.IsValid(request.Role))
        {
            return BadRequest(new { detail = "Role inválida. Use professor ou aluno." });
        }

        var existing = await db.Profiles.FirstOrDefaultAsync(p => p.Id == userId, cancellationToken);
        if (existing is not null)
        {
            if (!string.Equals(existing.Role, request.Role, StringComparison.OrdinalIgnoreCase))
            {
                return Conflict(new
                {
                    detail = $"Esta conta já está registrada como {existing.Role}. O perfil não pode ser alterado."
                });
            }

            existing.Email = currentUser.Email ?? existing.Email;
            existing.FullName = currentUser.FullName ?? existing.FullName;
            existing.AvatarUrl = currentUser.AvatarUrl ?? existing.AvatarUrl;
            await db.SaveChangesAsync(cancellationToken);
            return Ok(ToResponse(existing));
        }

        var profile = new Profile
        {
            Id = userId.Value,
            Email = currentUser.Email ?? string.Empty,
            FullName = currentUser.FullName,
            AvatarUrl = currentUser.AvatarUrl,
            Role = request.Role.ToLowerInvariant(),
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.Profiles.Add(profile);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(profile));
    }

    private static ProfileResponse ToResponse(Profile profile) =>
        new(profile.Id, profile.Email, profile.FullName, profile.AvatarUrl, profile.Role, profile.CreatedAt);
}
