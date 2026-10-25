using System.Text.Json;

namespace Astro.Api.Services;

public sealed class MediaStorage
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public const long DefaultMaxVideoBytes = 50L * 1024 * 1024;

    private readonly string _root;
    private readonly long _maxVideoBytes;

    public MediaStorage(string root, long maxVideoBytes = DefaultMaxVideoBytes)
    {
        _root = Path.GetFullPath(root);
        _maxVideoBytes = maxVideoBytes > 0 ? maxVideoBytes : DefaultMaxVideoBytes;
        Directory.CreateDirectory(_root);
    }

    public long MaxVideoBytes => _maxVideoBytes;

    public async Task<(string? Url, string? Error)> SaveAsync(
        Stream content,
        long? declaredLength,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        if (declaredLength is > 0 && declaredLength > _maxVideoBytes)
        {
            return (null, VideoSizeError());
        }

        var tempName = $"{Guid.NewGuid():N}.part";
        var tempPath = SafePath(tempName);
        long total = 0;
        try
        {
            await using (var output = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81_920, FileOptions.Asynchronous))
            {
                var chunk = new byte[81_920];
                while (true)
                {
                    var read = await content.ReadAsync(chunk, cancellationToken);
                    if (read == 0)
                    {
                        break;
                    }

                    if (total + read > _maxVideoBytes)
                    {
                        return (null, VideoSizeError());
                    }

                    await output.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
                    total += read;
                }
            }

            if (total == 0)
            {
                return (null, "O arquivo enviado está vazio.");
            }

            var header = new byte[Math.Min(32, total)];
            await using (var peek = File.OpenRead(tempPath))
            {
                var got = await peek.ReadAsync(header, cancellationToken);
                if (got < header.Length)
                {
                    header = header[..got];
                }
            }

            var contentType = ImageSignatures.Detect(header) ?? VideoSignatures.Detect(header);
            if (contentType is null)
            {
                return (null, "Envie uma imagem JPEG, PNG, WebP ou GIF, ou um vídeo MP4, WebM ou MOV.");
            }

            if (!VideoSignatures.IsVideo(contentType) && total > ImageSignatures.MaxUploadBytes)
            {
                return (null, $"A imagem deve ter no máximo {ImageSignatures.MaxUploadBytes / (1024 * 1024)} MB.");
            }

            var id = Guid.NewGuid();
            var extension = VideoSignatures.IsVideo(contentType)
                ? VideoSignatures.Extension(contentType)
                : ImageSignatures.Extension(contentType);
            var fileName = $"{id:N}{extension}";
            var fullPath = SafePath(fileName);
            File.Move(tempPath, fullPath);

            var meta = new MediaMeta(id, ownerId, contentType, fileName, total, DateTimeOffset.UtcNow);
            await File.WriteAllTextAsync(SafePath($"{id:N}.json"), JsonSerializer.Serialize(meta, JsonOptions), cancellationToken);
            return ($"/api/media/{id}", null);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    public MediaFile? Open(Guid id)
    {
        var metaPath = SafePath($"{id:N}.json");
        if (!File.Exists(metaPath))
        {
            return null;
        }

        MediaMeta? meta;
        try
        {
            meta = JsonSerializer.Deserialize<MediaMeta>(File.ReadAllText(metaPath), JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }

        if (meta is null
            || meta.Id != id
            || string.IsNullOrWhiteSpace(meta.ContentType)
            || string.IsNullOrWhiteSpace(meta.FileName))
        {
            return null;
        }

        var extension = VideoSignatures.IsVideo(meta.ContentType)
            ? VideoSignatures.Extension(meta.ContentType)
            : ImageSignatures.Extension(meta.ContentType);
        var expectedName = $"{id:N}{extension}";
        if (!string.Equals(meta.FileName, expectedName, StringComparison.Ordinal))
        {
            return null;
        }

        var path = SafePath(meta.FileName);
        return File.Exists(path) ? new MediaFile(path, meta.ContentType) : null;
    }

    private string SafePath(string fileName)
    {
        if (fileName.Contains('/', StringComparison.Ordinal)
            || fileName.Contains('\\', StringComparison.Ordinal)
            || fileName.Contains("..", StringComparison.Ordinal)
            || Path.IsPathRooted(fileName))
        {
            throw new InvalidOperationException("Nome de arquivo inválido.");
        }

        var full = Path.GetFullPath(Path.Combine(_root, fileName));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;
        if (!full.StartsWith(rootWithSeparator, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Caminho inválido.");
        }

        return full;
    }

    private string VideoSizeError()
    {
        if (_maxVideoBytes % (1024 * 1024) == 0 && _maxVideoBytes >= 1024 * 1024)
        {
            return $"O vídeo deve ter no máximo {_maxVideoBytes / (1024 * 1024)} MB.";
        }

        return $"O vídeo deve ter no máximo {_maxVideoBytes} bytes.";
    }

    private sealed record MediaMeta(
        Guid Id,
        Guid OwnerId,
        string ContentType,
        string FileName,
        long Size,
        DateTimeOffset CreatedAt);
}

public sealed record MediaFile(string Path, string ContentType);
