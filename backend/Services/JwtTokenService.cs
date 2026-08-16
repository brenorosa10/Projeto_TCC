using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public class JwtTokenService(IConfiguration configuration)
{
    public string CreateToken(Profile profile)
    {
        var key = configuration["Auth:Jwt:Key"]
            ?? throw new InvalidOperationException("Auth:Jwt:Key não configurada.");
        var issuer = configuration["Auth:Jwt:Issuer"] ?? "Astro.Api";
        var audience = configuration["Auth:Jwt:Audience"] ?? "Astro.Frontend";
        var hours = int.TryParse(configuration["Auth:Jwt:ExpiresHours"], out var parsed) ? parsed : 168;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, profile.Id.ToString()),
            new(ClaimTypes.NameIdentifier, profile.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, profile.Email),
            new(ClaimTypes.Email, profile.Email)
        };

        if (!string.IsNullOrWhiteSpace(profile.Username))
        {
            claims.Add(new Claim("username", profile.Username));
        }

        if (!string.IsNullOrWhiteSpace(profile.FullName))
        {
            claims.Add(new Claim("name", profile.FullName));
            claims.Add(new Claim(ClaimTypes.Name, profile.FullName));
        }

        if (!string.IsNullOrWhiteSpace(profile.AvatarUrl))
        {
            claims.Add(new Claim("picture", profile.AvatarUrl));
        }

        if (!string.IsNullOrWhiteSpace(profile.Role))
        {
            claims.Add(new Claim(ClaimTypes.Role, profile.Role));
        }

        if (!string.IsNullOrWhiteSpace(profile.GoogleId))
        {
            claims.Add(new Claim("google_id", profile.GoogleId));
        }

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: DateTime.UtcNow.AddHours(hours),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
