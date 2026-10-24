using System.Text.RegularExpressions;

namespace Astro.Api.Services;

public static partial class OptionImageUrl
{
    public const int MaxLength = 2000;

    public static (string? Value, string? Error) Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return (null, null);
        }

        var value = raw.Trim();
        if (value.Length > MaxLength)
        {
            return (null, "O endereço da imagem da alternativa é longo demais.");
        }

        if (value.StartsWith("/api/media/", StringComparison.Ordinal))
        {
            return OwnMediaPattern().IsMatch(value)
                ? (value, null)
                : (null, "O endereço da imagem enviada é inválido.");
        }

        if (value.StartsWith("//", StringComparison.Ordinal)
            || value.Contains('\\', StringComparison.Ordinal)
            || value.Contains(' ', StringComparison.Ordinal))
        {
            return (null, "A imagem por endereço precisa ser um link http ou https.");
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https")
            || string.IsNullOrWhiteSpace(uri.Host)
            || uri.Host.Contains('.', StringComparison.Ordinal) == false && uri.Host != "localhost")
        {
            return (null, "A imagem por endereço precisa ser um link http ou https.");
        }

        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            return (null, "O endereço da imagem não pode conter usuário ou senha.");
        }

        return (uri.AbsoluteUri, null);
    }

    [GeneratedRegex(
        @"^/api/media/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        RegexOptions.CultureInvariant)]
    private static partial Regex OwnMediaPattern();
}
