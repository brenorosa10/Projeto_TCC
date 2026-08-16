using Microsoft.AspNetCore.Identity;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public class PasswordHashingService
{
    private readonly PasswordHasher<Profile> _hasher = new();

    public string Hash(Profile profile, string password) =>
        _hasher.HashPassword(profile, password);

    public bool Verify(Profile profile, string password)
    {
        if (string.IsNullOrWhiteSpace(profile.PasswordHash))
        {
            return false;
        }

        var result = _hasher.VerifyHashedPassword(profile, profile.PasswordHash, password);
        return result is PasswordVerificationResult.Success
            or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
