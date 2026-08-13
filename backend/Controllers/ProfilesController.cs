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
[Route("api/profiles")]
public class ProfilesController(
    MongoDbContext db,
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

        var profile = await db.Profiles
            .Find(p => p.Id == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (profile is null || string.IsNullOrWhiteSpace(profile.Role))
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

        var existing = await db.Profiles
            .Find(p => p.Id == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            if (!string.IsNullOrWhiteSpace(existing.Role)
                && !string.Equals(existing.Role, request.Role, StringComparison.OrdinalIgnoreCase))
            {
                return Conflict(new
                {
                    detail = $"Esta conta já está registrada como {existing.Role}. O perfil não pode ser alterado."
                });
            }

            existing.Email = currentUser.Email ?? existing.Email;
            existing.FullName = currentUser.FullName ?? existing.FullName;
            existing.AvatarUrl = currentUser.AvatarUrl ?? existing.AvatarUrl;
            existing.Role = string.IsNullOrWhiteSpace(existing.Role)
                ? request.Role.ToLowerInvariant()
                : existing.Role;
            await db.Profiles.ReplaceOneAsync(p => p.Id == existing.Id, existing, cancellationToken: cancellationToken);
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

        await db.Profiles.InsertOneAsync(profile, cancellationToken: cancellationToken);
        return Ok(ToResponse(profile));
    }

    private static ProfileResponse ToResponse(Profile profile) =>
        new(profile.Id, profile.Email, profile.FullName, profile.AvatarUrl, profile.Role, profile.CreatedAt);
}
