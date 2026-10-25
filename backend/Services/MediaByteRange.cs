namespace Astro.Api.Services;

public readonly record struct MediaByteRange(long Start, long End, bool Unsatisfiable)
{
    public long Length => Unsatisfiable ? 0 : End - Start + 1;

    /// <summary>
    /// Parses a single HTTP Range header. Returns false when the header is absent
    /// (the caller should send the whole file). Returns true for a satisfiable
    /// range or an unsatisfiable one (416).
    /// </summary>
    public static bool TryParse(string? header, long size, out MediaByteRange range)
    {
        range = default;
        if (string.IsNullOrWhiteSpace(header))
        {
            return false;
        }

        var value = header.Trim();
        if (!value.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
        {
            range = new MediaByteRange(0, 0, Unsatisfiable: true);
            return true;
        }

        var spec = value["bytes=".Length..].Split(',')[0].Trim();
        if (size <= 0 || spec.Length == 0 || !spec.Contains('-'))
        {
            range = new MediaByteRange(0, 0, Unsatisfiable: true);
            return true;
        }

        var dash = spec.IndexOf('-');
        var startText = spec[..dash];
        var endText = spec[(dash + 1)..];

        long start;
        long end;
        if (startText.Length == 0)
        {
            if (!long.TryParse(endText, out var suffix) || suffix <= 0)
            {
                range = new MediaByteRange(0, 0, Unsatisfiable: true);
                return true;
            }

            if (suffix > size)
            {
                suffix = size;
            }

            start = size - suffix;
            end = size - 1;
        }
        else
        {
            if (!long.TryParse(startText, out start) || start < 0)
            {
                range = new MediaByteRange(0, 0, Unsatisfiable: true);
                return true;
            }

            if (endText.Length == 0)
            {
                end = size - 1;
            }
            else if (!long.TryParse(endText, out end) || end < start)
            {
                range = new MediaByteRange(0, 0, Unsatisfiable: true);
                return true;
            }

            if (start >= size)
            {
                range = new MediaByteRange(0, 0, Unsatisfiable: true);
                return true;
            }

            if (end >= size)
            {
                end = size - 1;
            }
        }

        range = new MediaByteRange(start, end, Unsatisfiable: false);
        return true;
    }
}
