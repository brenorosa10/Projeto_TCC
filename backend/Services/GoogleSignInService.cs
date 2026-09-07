using System.Security.Claims;
using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using Astro.Api.Data;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public class GoogleSignInService(
    MongoDbContext db,
    JwtTokenService jwtTokenService,
    IConfiguration configuration,
    ILogger<GoogleSignInService> logger)
{
    public async Task<string> CompleteAsync(
        ClaimsPrincipal principal,
        string? returnUrl,
        CancellationToken cancellationToken)
    {
        var googleId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        var email = NormalizeEmail(
            principal.FindFirstValue(ClaimTypes.Email)
            ?? principal.FindFirstValue("email"));
        var name = principal.FindFirstValue(ClaimTypes.Name)
            ?? principal.FindFirstValue("name");
        var picture = principal.FindFirstValue("picture");

        if (string.IsNullOrWhiteSpace(googleId) || string.IsNullOrWhiteSpace(email))
        {
            logger.LogWarning("Google OAuth sem googleId ou e-mail.");
            return ErrorRedirect();
        }

        var profile = await db.Profiles
            .Find(p => p.GoogleId == googleId)
            .FirstOrDefaultAsync(cancellationToken);

        if (profile is null)
        {
            profile = await db.Profiles
                .Find(EmailFilter(email))
                .FirstOrDefaultAsync(cancellationToken);
        }

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
            try
            {
                await db.Profiles.InsertOneAsync(profile, cancellationToken: cancellationToken);
            }
            catch (MongoWriteException)
            {
                profile = await db.Profiles
                    .Find(EmailFilter(email))
                    .FirstOrDefaultAsync(cancellationToken);
                if (profile is null)
                {
                    logger.LogWarning("Falha ao criar perfil Google para {Email}.", email);
                    return ErrorRedirect();
                }
            }
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(profile.GoogleId)
                && !string.Equals(profile.GoogleId, googleId, StringComparison.Ordinal))
            {
                logger.LogWarning("E-mail {Email} já vinculado a outro GoogleId.", email);
                return ErrorRedirect();
            }

            profile.GoogleId = googleId;
            profile.Email = email;
            profile.FullName = name ?? profile.FullName;
            profile.AvatarUrl = picture ?? profile.AvatarUrl;
            await db.Profiles.ReplaceOneAsync(p => p.Id == profile.Id, profile, cancellationToken: cancellationToken);
        }

        var token = jwtTokenService.CreateToken(profile);
        return $"{SanitizeReturnUrl(returnUrl)}#access_token={Uri.EscapeDataString(token)}";
    }

    public string ErrorRedirect(string error = "google") =>
        $"{DefaultFrontendCallback()}?error={Uri.EscapeDataString(error)}";

    public string SanitizeReturnUrl(string? returnUrl)
    {
        var fallback = DefaultFrontendCallback();
        if (!Uri.TryCreate(returnUrl, UriKind.Absolute, out var uri))
        {
            return fallback;
        }

        var allowedOrigins = ReadAllowedOrigins()
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

    private string[] ReadAllowedOrigins()
    {
        var fromEnv = configuration["Cors:Origins"];
        if (!string.IsNullOrWhiteSpace(fromEnv) && !fromEnv.TrimStart().StartsWith('['))
        {
            return fromEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        return configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
    }

    private string DefaultFrontendCallback()
    {
        var frontend = configuration["Auth:FrontendUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
        return $"{frontend}/auth/callback";
    }

    private static FilterDefinition<Profile> EmailFilter(string email)
    {
        var escaped = Regex.Escape(email);
        return Builders<Profile>.Filter.Regex(p => p.Email, new BsonRegularExpression($"^{escaped}$", "i"));
    }

    private static string NormalizeEmail(string? email) =>
        (email ?? string.Empty).Trim().ToLowerInvariant();
}
