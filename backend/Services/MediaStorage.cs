using System.Text.Json;

namespace Astro.Api.Services;

public sealed class MediaStorage
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly string _root;

    public MediaStorage(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(_root);
    }

    public async Task<(string? Url, string? Error)> SaveAsync(
        Stream content,
        long? declaredLength,
        Guid ownerId,
        CancellationToken cancellationToken)
    {
        if (declaredLength is > ImageSignatures.MaxUploadBytes)
        {
            return (null, SizeError());
        }

        using var buffer = new MemoryStream();
        var chunk = new byte[81_920];
        while (true)
        {
            var read = await content.ReadAsync(chunk, cancellationToken);
            if (read == 0)
            {
                break;
            }

            if (buffer.Length + read > ImageSignatures.MaxUploadBytes)
            {
                return (null, SizeError());
            }

            buffer.Write(chunk, 0, read);
        }

        if (buffer.Length == 0)
        {
            return (null, "A imagem enviada está vazia.");
        }

        var bytes = buffer.ToArray();
        var contentType = ImageSignatures.Detect(bytes);
        if (contentType is null)
        {
            return (null, "Envie um arquivo JPEG, PNG, WebP ou GIF.");
        }

        var id = Guid.NewGuid();
        var fileName = $"{id:N}{ImageSignatures.Extension(contentType)}";
        var fullPath = SafePath(fileName);
        await File.WriteAllBytesAsync(fullPath, bytes, cancellationToken);

        var meta = new MediaMeta(id, ownerId, contentType, fileName, bytes.LongLength, DateTimeOffset.UtcNow);
        await File.WriteAllTextAsync(SafePath($"{id:N}.json"), JsonSerializer.Serialize(meta, JsonOptions), cancellationToken);
        return ($"/api/media/{id}", null);
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

        var expectedName = $"{id:N}{ImageSignatures.Extension(meta.ContentType)}";
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

    private static string SizeError() =>
        $"A imagem deve ter no máximo {ImageSignatures.MaxUploadBytes / (1024 * 1024)} MB.";

    private sealed record MediaMeta(
        Guid Id,
        Guid OwnerId,
        string ContentType,
        string FileName,
        long Size,
        DateTimeOffset CreatedAt);
}

public sealed record MediaFile(string Path, string ContentType);
