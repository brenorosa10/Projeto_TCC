using System.Text.RegularExpressions;
using MongoDB.Bson;
using Astro.Api.Domain;

namespace Astro.Api.Services;

public static class ActivityImage
{
    public const int MaxBytesPerImage = 600_000;
    public const int MaxBytesPerDocument = 15_000_000;

    private static readonly Regex DataUrlPattern = new(
        @"^data:(image/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    public static string? Apply(ActivityItem item, string? imageDataUrl)
    {
        if (string.IsNullOrWhiteSpace(imageDataUrl))
        {
            item.ImageBytes = null;
            item.ImageContentType = null;
            return null;
        }

        var match = DataUrlPattern.Match(imageDataUrl.Trim());
        if (!match.Success)
        {
            return "A imagem deve ser JPEG, PNG ou WebP em data URL base64.";
        }

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(Regex.Replace(match.Groups[3].Value, @"\s+", ""));
        }
        catch (FormatException)
        {
            return "A imagem enviada não é um base64 válido.";
        }

        if (bytes.Length == 0)
        {
            return "A imagem enviada está vazia.";
        }

        if (bytes.Length > MaxBytesPerImage)
        {
            return $"Cada imagem deve ter no máximo {MaxBytesPerImage / 1024} KB após a compressão.";
        }

        var contentType = NormalizeContentType(match.Groups[1].Value, bytes);
        if (contentType is null)
        {
            return "O arquivo enviado não é uma imagem JPEG, PNG ou WebP válida.";
        }

        item.ImageBytes = bytes;
        item.ImageContentType = contentType;
        return null;
    }

    public static string? ToDataUrl(ActivityItem item)
    {
        if (item.ImageBytes is null || item.ImageBytes.Length == 0 || string.IsNullOrWhiteSpace(item.ImageContentType))
        {
            return null;
        }

        return $"data:{item.ImageContentType};base64,{Convert.ToBase64String(item.ImageBytes)}";
    }

    public static string? ValidateDocumentSize(Activity activity)
    {
        var bsonSize = activity.ToBson().Length;
        if (bsonSize > MaxBytesPerDocument)
        {
            return "O quiz/deck com as imagens ultrapassa o limite de 16 MB do MongoDB. Remova ou comprima algumas imagens.";
        }

        return null;
    }

    private static string? NormalizeContentType(string declared, byte[] bytes)
    {
        var detected = DetectContentType(bytes);
        if (detected is null)
        {
            return null;
        }

        var normalizedDeclared = declared.Equals("image/jpg", StringComparison.OrdinalIgnoreCase)
            ? "image/jpeg"
            : declared.ToLowerInvariant();

        return normalizedDeclared == detected ? detected : detected;
    }

    private static string? DetectContentType(byte[] bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (bytes.Length >= 8
            && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47
            && bytes[4] == 0x0D && bytes[5] == 0x0A && bytes[6] == 0x1A && bytes[7] == 0x0A)
        {
            return "image/png";
        }

        if (bytes.Length >= 12
            && bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
            && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
        {
            return "image/webp";
        }

        return null;
    }
}
