using System.ComponentModel.DataAnnotations;

namespace Astro.Api.Contracts;

public record EnsureProfileRequest(
    [Required]
    [RegularExpression("^(professor|aluno)$")]
    string Role
);

public record ProfileResponse(
    Guid Id,
    string Email,
    string? FullName,
    string? AvatarUrl,
    string Role,
    DateTimeOffset CreatedAt
);

public record CreateClassRequest(
    [Required]
    [MinLength(2)]
    [MaxLength(200)]
    string Name
);

public record JoinClassRequest(
    [Required]
    [StringLength(8, MinimumLength = 8)]
    string Code
);

public record ClassResponse(
    Guid Id,
    string Name,
    string Code,
    Guid ProfessorId,
    string? ProfessorName,
    DateTimeOffset CreatedAt,
    int StudentCount
);
