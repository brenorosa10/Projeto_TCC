namespace Astro.Api.Domain;

public static class UserRoles
{
    public const string Professor = "professor";
    public const string Aluno = "aluno";

    public static bool IsValid(string? role) =>
        role is Professor or Aluno;
}
