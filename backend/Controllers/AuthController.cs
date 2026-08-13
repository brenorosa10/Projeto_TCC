using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    MongoDbContext db,
    JwtTokenService jwtTokenService,
    IConfiguration configuration) : ControllerBase
{
    private const string ExternalScheme = CookieAuthenticationDefaults.AuthenticationScheme;

    [HttpGet("google")]
    [AllowAnonymous]
    public IActionResult Google([FromQuery] string? returnUrl)
    {
        var properties = new AuthenticationProperties
        {
            RedirectUri = "/api/auth/google-callback"
        };
        properties.Items["returnUrl"] = SanitizeReturnUrl(returnUrl);
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("google-callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback(CancellationToken cancellationToken)
    {
        var result = await HttpContext.AuthenticateAsync(ExternalScheme);
        var frontendCallback = DefaultFrontendCallback();

        if (!result.Succeeded || result.Principal is null)
        {
            await HttpContext.SignOutAsync(ExternalScheme);
            return Redirect($"{frontendCallback}?error=google");
        }

        var googleId = result.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var email = result.Principal.FindFirstValue(ClaimTypes.Email)
            ?? result.Principal.FindFirstValue("email");
        var name = result.Principal.FindFirstValue(ClaimTypes.Name)
            ?? result.Principal.FindFirstValue("name");
        var picture = result.Principal.FindFirstValue("picture");

        await HttpContext.SignOutAsync(ExternalScheme);

        if (string.IsNullOrWhiteSpace(googleId) || string.IsNullOrWhiteSpace(email))
        {
            return Redirect($"{frontendCallback}?error=google");
        }

        var profile = await db.Profiles
            .Find(p => p.GoogleId == googleId)
            .FirstOrDefaultAsync(cancellationToken);

        if (profile is null)
        {
            profile = new Profile
            {
                Id = Guid.NewGuid(),
                GoogleId = googleId,
                Email = email,
                FullName = name,
                AvatarUrl = picture,
                Role = string.Empty,
                CreatedAt = DateTimeOffset.UtcNow
            };
            await db.Profiles.InsertOneAsync(profile, cancellationToken: cancellationToken);
        }
        else
        {
            profile.Email = email;
            profile.FullName = name ?? profile.FullName;
            profile.AvatarUrl = picture ?? profile.AvatarUrl;
            await db.Profiles.ReplaceOneAsync(p => p.Id == profile.Id, profile, cancellationToken: cancellationToken);
        }

        var token = jwtTokenService.CreateToken(profile);
        string? storedReturnUrl = null;
        result.Properties?.Items.TryGetValue("returnUrl", out storedReturnUrl);
        var returnUrl = SanitizeReturnUrl(storedReturnUrl);
        return Redirect($"{returnUrl}#access_token={Uri.EscapeDataString(token)}");
    }

    private string DefaultFrontendCallback()
    {
        var frontend = configuration["Auth:FrontendUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
        return $"{frontend}/auth/callback";
    }

    private string SanitizeReturnUrl(string? returnUrl)
    {
        var fallback = DefaultFrontendCallback();
        if (!Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri))
        {
            return fallback;
        }

        var allowedOrigins = (configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
            .Append(configuration["Auth:FrontendUrl"])
            .Where(origin => !string.IsNullOrWhiteSpace(origin))
            .Select(origin => origin!.TrimEnd('/'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var origin = uri.GetLeftPart(UriPartial.Authority);
        if (!allowedOrigins.Contains(origin) || !uri.AbsolutePath.Equals("/auth/callback", StringComparison.OrdinalIgnoreCase))
        {
            return fallback;
        }

        return $"{origin}{uri.AbsolutePath}";
    }
}
