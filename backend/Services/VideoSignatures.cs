namespace Astro.Api.Services;

public static class VideoSignatures
{
    public static string? Detect(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 4
            && bytes[0] == 0x1A && bytes[1] == 0x45 && bytes[2] == 0xDF && bytes[3] == 0xA3)
        {
            return "video/webm";
        }

        if (bytes.Length >= 12
            && bytes[4] == (byte)'f' && bytes[5] == (byte)'t' && bytes[6] == (byte)'y' && bytes[7] == (byte)'p')
        {
            var brand = bytes.Slice(8, 4);
            if (brand.SequenceEqual("qt  "u8))
            {
                return "video/quicktime";
            }

            return "video/mp4";
        }

        return null;
    }

    public static string Extension(string contentType) => contentType switch
    {
        "video/mp4" => ".mp4",
        "video/webm" => ".webm",
        "video/quicktime" => ".mov",
        _ => ".bin"
    };

    public static bool IsVideo(string? contentType) =>
        contentType is "video/mp4" or "video/webm" or "video/quicktime";
}
