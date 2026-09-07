using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    MongoDbContext db,
    JwtTokenService jwtTokenService,
    PasswordHashingService passwordHasher,
    GoogleSignInService googleSignIn) : ControllerBase
{
    private const string ExternalScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    private static readonly Regex UsernamePattern = new("^[a-zA-Z0-9_]{3,32}$", RegexOptions.Compiled);

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        if (!UserRoles.IsValid(request.Role))
        {
            return BadRequest(new { detail = "Role inválida. Use professor ou aluno." });
        }

        var email = NormalizeEmail(request.Email);
        var username = request.Username.Trim();
        if (!UsernamePattern.IsMatch(username))
        {
            return BadRequest(new { detail = "O nome de usuário deve ter 3 a 32 caracteres (letras, números ou _)." });
        }

        var usernameNormalized = username.ToLowerInvariant();

        var existing = await db.Profiles
            .Find(EmailOrUsernameFilter(email, usernameNormalized))
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            if (string.Equals(existing.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                return Conflict(new
                {
                    detail = string.IsNullOrWhiteSpace(existing.PasswordHash) && !string.IsNullOrWhiteSpace(existing.GoogleId)
                        ? "Este e-mail já está cadastrado com Google. Entre com o Google."
                        : "Este e-mail já está cadastrado. Faça login."
                });
            }

            return Conflict(new { detail = "Este nome de usuário já está em uso." });
        }

        var profile = new Profile
        {
            Id = Guid.NewGuid(),
            Email = email,
            Username = username,
            UsernameNormalized = usernameNormalized,
            FullName = username,
            Role = request.Role.Trim().ToLowerInvariant(),
            CreatedAt = DateTimeOffset.UtcNow
        };
        profile.PasswordHash = passwordHasher.Hash(profile, request.Password);

        try
        {
            await db.Profiles.InsertOneAsync(profile, cancellationToken: cancellationToken);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Code == 11000)
        {
            return Conflict(new { detail = "E-mail ou nome de usuário já cadastrado." });
        }

        return Ok(ToAuthResponse(profile));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var login = request.Login.Trim();
        if (string.IsNullOrWhiteSpace(login) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { detail = "Informe e-mail ou usuário e a senha." });
        }

        var email = NormalizeEmail(login);
        var usernameNormalized = login.ToLowerInvariant();

        var profile = await db.Profiles
            .Find(EmailOrUsernameFilter(email, usernameNormalized))
            .FirstOrDefaultAsync(cancellationToken);

        if (profile is null)
        {
            return Unauthorized(new { detail = "Credenciais inválidas." });
        }

        if (string.IsNullOrWhiteSpace(profile.PasswordHash))
        {
            return Unauthorized(new { detail = "Esta conta entra com o Google. Use o botão do Google." });
        }

        if (!passwordHasher.Verify(profile, request.Password))
        {
            return Unauthorized(new { detail = "Credenciais inválidas." });
        }

        if (string.IsNullOrWhiteSpace(profile.Role))
        {
            return BadRequest(new { detail = "Esta conta ainda não tem um perfil. Cadastre-se novamente escolhendo Professor ou Aluno." });
        }

        return Ok(ToAuthResponse(profile));
    }

    [HttpGet("google")]
    [AllowAnonymous]
    public IActionResult Google([FromQuery] string? returnUrl)
    {
        var properties = new AuthenticationProperties
        {
            RedirectUri = "/api/auth/google-callback"
        };
        properties.Items["returnUrl"] = googleSignIn.SanitizeReturnUrl(returnUrl);
        return Challenge(properties, GoogleDefaults.AuthenticationScheme);
    }

    [HttpGet("google-callback")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleCallback(CancellationToken cancellationToken)
    {
        var result = await HttpContext.AuthenticateAsync(ExternalScheme);
        if (!result.Succeeded || result.Principal is null)
        {
            await HttpContext.SignOutAsync(ExternalScheme);
            return Redirect(googleSignIn.ErrorRedirect());
        }

        string? storedReturnUrl = null;
        result.Properties?.Items.TryGetValue("returnUrl", out storedReturnUrl);
        var redirect = await googleSignIn.CompleteAsync(result.Principal, storedReturnUrl, cancellationToken);
        await HttpContext.SignOutAsync(ExternalScheme);
        return Redirect(redirect);
    }

    private AuthResponse ToAuthResponse(Profile profile) =>
        new(
            jwtTokenService.CreateToken(profile),
            new ProfileResponse(
                profile.Id,
                profile.Email,
                profile.Username,
                profile.FullName,
                profile.AvatarUrl,
                profile.Role,
                profile.CreatedAt));

    private static FilterDefinition<Profile> EmailFilter(string email)
    {
        var escaped = Regex.Escape(email);
        return Builders<Profile>.Filter.Regex(p => p.Email, new BsonRegularExpression($"^{escaped}$", "i"));
    }

    private static FilterDefinition<Profile> EmailOrUsernameFilter(string email, string usernameNormalized) =>
        Builders<Profile>.Filter.Or(
            EmailFilter(email),
            Builders<Profile>.Filter.Eq(p => p.UsernameNormalized, usernameNormalized));

    private static string NormalizeEmail(string? email) =>
        (email ?? string.Empty).Trim().ToLowerInvariant();
}
