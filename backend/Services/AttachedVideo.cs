using System.Text.RegularExpressions;

namespace Astro.Api.Services;

public static partial class AttachedVideo
{
    public const string File = "file";
    public const string YouTube = "youtube";
    public const string Vimeo = "vimeo";

    public static (string? Url, string? Kind, string? Error) Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return (null, null, null);
        }

        var value = raw.Trim();
        if (value.Length > 2000)
        {
            return (null, null, "O endereço do vídeo é longo demais.");
        }

        if (OwnMediaPattern().IsMatch(value))
        {
            return (value, File, null);
        }

        if (YouTubeIdPattern().IsMatch(value))
        {
            return (value, YouTube, null);
        }

        if (value.Length is >= 6 and <= 12 && value.All(char.IsDigit))
        {
            return (value, Vimeo, null);
        }

        if (value.StartsWith("//", StringComparison.Ordinal) || value.Contains('\\') || value.Contains(' '))
        {
            return (null, null, "O vídeo por endereço precisa ser um link http ou https.");
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https")
            || string.IsNullOrWhiteSpace(uri.Host)
            || !string.IsNullOrEmpty(uri.UserInfo))
        {
            return (null, null, "O vídeo por endereço precisa ser um link http ou https, sem usuário ou senha.");
        }

        var youtube = YouTubeId(uri);
        if (youtube is not null)
        {
            return (youtube, YouTube, null);
        }

        var vimeo = VimeoId(uri);
        if (vimeo is not null)
        {
            return (vimeo, Vimeo, null);
        }

        return (uri.AbsoluteUri, File, null);
    }

    public static string? YouTubeId(Uri uri)
    {
        var host = uri.Host.Trim().TrimEnd('.').ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal))
        {
            host = host[4..];
        }

        if (host is "youtu.be")
        {
            return MatchId(uri.AbsolutePath.Trim('/'));
        }

        if (host is not ("youtube.com" or "m.youtube.com" or "music.youtube.com" or "youtube-nocookie.com"))
        {
            return null;
        }

        var path = uri.AbsolutePath.Trim('/');
        if (path.StartsWith("embed/", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("shorts/", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("live/", StringComparison.OrdinalIgnoreCase))
        {
            return MatchId(path.Split('/')[1]);
        }

        if (path.Equals("watch", StringComparison.OrdinalIgnoreCase))
        {
            var query = ParseQuery(uri.Query);
            return query.TryGetValue("v", out var id) ? MatchId(id) : null;
        }

        return null;
    }

    public static string? VimeoId(Uri uri)
    {
        var host = uri.Host.Trim().TrimEnd('.').ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal))
        {
            host = host[4..];
        }

        if (host is not ("vimeo.com" or "player.vimeo.com"))
        {
            return null;
        }

        var parts = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (var i = parts.Length - 1; i >= 0; i--)
        {
            if (parts[i].All(char.IsDigit) && parts[i].Length is >= 6 and <= 12)
            {
                return parts[i];
            }
        }

        return null;
    }

    private static string? MatchId(string? value) =>
        value is not null && YouTubeIdPattern().IsMatch(value) ? value : null;

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var trimmed = query.TrimStart('?');
        if (trimmed.Length == 0)
        {
            return result;
        }

        foreach (var pair in trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = pair.IndexOf('=');
            var key = Uri.UnescapeDataString(eq >= 0 ? pair[..eq] : pair);
            var val = Uri.UnescapeDataString(eq >= 0 ? pair[(eq + 1)..] : string.Empty);
            result[key] = val;
        }

        return result;
    }

    [GeneratedRegex(@"^[A-Za-z0-9_-]{11}$", RegexOptions.CultureInvariant)]
    private static partial Regex YouTubeIdPattern();

    [GeneratedRegex(
        @"^/api/media/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        RegexOptions.CultureInvariant)]
    private static partial Regex OwnMediaPattern();
}
