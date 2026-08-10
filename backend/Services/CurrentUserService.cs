using System.Security.Claims;

namespace Astro.Api.Services;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor)
{
    public Guid? UserId
    {
        get
        {
            var value = httpContextAccessor.HttpContext?.User.FindFirstValue("sub")
                ?? httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var id) ? id : null;
        }
    }

    public string? Email =>
        httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Email)
        ?? httpContextAccessor.HttpContext?.User.FindFirstValue("email");

    public string? FullName =>
        httpContextAccessor.HttpContext?.User.FindFirstValue("name")
        ?? httpContextAccessor.HttpContext?.User.FindFirstValue("full_name");

    public string? AvatarUrl =>
        httpContextAccessor.HttpContext?.User.FindFirstValue("avatar_url")
        ?? httpContextAccessor.HttpContext?.User.FindFirstValue("picture");
}
