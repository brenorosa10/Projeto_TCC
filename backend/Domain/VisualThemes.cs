namespace Astro.Api.Domain;

/// <summary>
/// Aparência da questão (cores e fundo). Não é o tema de catálogo da atividade.
/// </summary>
public static class VisualThemes
{
    public const string Padrao = "padrao";

    public static readonly string[] All =
    [
        Padrao,
        "espaco",
        "oceano",
        "floresta",
        "por-do-sol",
        "neon",
        "ambar",
        "lavanda",
        "gelo"
    ];

    /// <summary>
    /// Null e "padrao" não são gravados, para quizzes antigos continuarem no visual do sistema.
    /// </summary>
    public static string? TryNormalize(string? value, out string? stored)
    {
        stored = null;
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        var match = All.FirstOrDefault(id => id.Equals(trimmed, StringComparison.OrdinalIgnoreCase));
        if (match is null)
        {
            return "Tema visual inválido. Escolha padrão, espaço, oceano, floresta, pôr do sol, neon, âmbar, lavanda ou gelo.";
        }

        stored = match == Padrao ? null : match;
        return null;
    }
}
