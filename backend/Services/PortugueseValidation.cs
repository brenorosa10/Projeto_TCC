using System.Text.RegularExpressions;

namespace Astro.Api.Services;

/// <summary>
/// Traduz as mensagens padrão (em inglês) do DataAnnotations para pt-BR.
/// Mensagens já escritas pela aplicação são preservadas.
/// </summary>
public static partial class PortugueseValidation
{
    public static string Localize(string key, string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return "Dados inválidos.";
        }

        if (!IsDefaultEnglish(message))
        {
            return message;
        }

        var field = FieldPhrase(key);

        var range = LengthRangeRegex().Match(message);
        if (range.Success)
        {
            var min = range.Groups[1].Value;
            var max = range.Groups[2].Value;
            if (min == max)
            {
                return $"{Capitalize(field)} deve ter {min} caracteres.";
            }

            return $"{Capitalize(field)} deve ter entre {min} e {max} caracteres.";
        }

        var maxOnly = MaxLengthRegex().Match(message);
        if (maxOnly.Success)
        {
            return $"{Capitalize(field)} deve ter no máximo {maxOnly.Groups[1].Value} caracteres.";
        }

        var minOnly = MinLengthRegex().Match(message);
        if (minOnly.Success)
        {
            return $"{Capitalize(field)} deve ter no mínimo {minOnly.Groups[1].Value} caracteres.";
        }

        if (message.Contains("e-mail", StringComparison.OrdinalIgnoreCase)
            || message.Contains("email address", StringComparison.OrdinalIgnoreCase))
        {
            return "Informe um e-mail válido.";
        }

        if (message.Contains("is required", StringComparison.OrdinalIgnoreCase))
        {
            return field == "o campo" ? "Preencha este campo." : $"Informe {field}.";
        }

        if (message.Contains("regular expression", StringComparison.OrdinalIgnoreCase))
        {
            return $"{Capitalize(field)} está em um formato inválido.";
        }

        if (message.Contains("not valid", StringComparison.OrdinalIgnoreCase)
            || message.Contains("could not be converted", StringComparison.OrdinalIgnoreCase)
            || message.Contains("is invalid", StringComparison.OrdinalIgnoreCase))
        {
            if (field == "o campo")
            {
                return "Valor inválido.";
            }

            var agreement = field.StartsWith("a ", StringComparison.Ordinal) ? "inválida" : "inválido";
            return $"{Capitalize(field)} é {agreement}.";
        }

        return "Dados inválidos. Verifique os campos e tente novamente.";
    }

    private static string Capitalize(string value) =>
        string.IsNullOrEmpty(value) ? value : char.ToUpperInvariant(value[0]) + value[1..];

    private static bool IsDefaultEnglish(string message)
    {
        return message.Contains("The ", StringComparison.Ordinal)
            || message.Contains("must ", StringComparison.Ordinal)
            || message.Contains("could not be converted", StringComparison.OrdinalIgnoreCase)
            || message.Contains("is required", StringComparison.OrdinalIgnoreCase)
            || message.Contains("is not valid", StringComparison.OrdinalIgnoreCase);
    }

    private static string FieldPhrase(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return "o campo";
        }

        var leaf = key.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).LastOrDefault() ?? key;
        var bracket = leaf.IndexOf('[');
        if (bracket >= 0)
        {
            leaf = leaf[..bracket];
        }

        if (leaf.StartsWith('$'))
        {
            return "o campo";
        }

        return leaf.ToLowerInvariant() switch
        {
            "name" => "o nome",
            "title" => "o título",
            "email" => "o e-mail",
            "password" => "a senha",
            "username" => "o nome de usuário",
            "login" => "o login",
            "code" => "o código",
            "text" => "o texto",
            "role" => "o perfil",
            "left" => "o texto da esquerda",
            "right" => "o texto da direita",
            "label" => "o nome",
            "content" => "o conteúdo",
            "body" => "o texto",
            "prompt" => "o enunciado",
            "front" => "a frente",
            "back" => "o verso",
            "itemid" => "o item",
            "activityid" => "a atividade",
            "classid" => "a turma",
            _ => "o campo"
        };
    }

    [GeneratedRegex(@"minimum length of (\d+) and a maximum length of (\d+)", RegexOptions.IgnoreCase)]
    private static partial Regex LengthRangeRegex();

    [GeneratedRegex(@"maximum length of '?(\d+)'?", RegexOptions.IgnoreCase)]
    private static partial Regex MaxLengthRegex();

    [GeneratedRegex(@"minimum length of '?(\d+)'?", RegexOptions.IgnoreCase)]
    private static partial Regex MinLengthRegex();
}
