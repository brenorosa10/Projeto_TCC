using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Astro.Api.Contracts;
using Astro.Api.Data;
using Astro.Api.Domain;
using Astro.Api.Services;

namespace Astro.Api.Controllers;

[ApiController]
[Authorize]
public class MediaController(
    MongoDbContext db,
    CurrentUserService currentUser,
    MediaStorage storage) : ControllerBase
{
    [HttpPost("api/media")]
    [RequestSizeLimit(64 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 64 * 1024 * 1024)]
    public async Task<ActionResult<MediaUploadResponse>> Upload(
        IFormFile? file,
        CancellationToken cancellationToken)
    {
        var profile = await GetCurrentProfileAsync(cancellationToken);
        if (profile is null)
        {
            return Unauthorized(new { detail = "É preciso entrar para enviar arquivos." });
        }

        if (profile.Role is not (UserRoles.Professor or UserRoles.Aluno))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Você não pode enviar arquivos." });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { detail = "Selecione uma imagem ou um vídeo." });
        }

        await using var stream = file.OpenReadStream();
        var saved = await storage.SaveAsync(stream, file.Length, profile.Id, cancellationToken);
        if (saved.Error is not null || saved.Url is null)
        {
            return BadRequest(new { detail = saved.Error ?? "Não foi possível salvar o arquivo." });
        }

        return Ok(new MediaUploadResponse(saved.Url));
    }

    [AllowAnonymous]
    [HttpGet("api/media/{id:guid}")]
    public IActionResult Download(Guid id)
    {
        var file = storage.Open(id);
        if (file is null)
        {
            return NotFound(new { detail = "Arquivo não encontrado." });
        }

        var length = new FileInfo(file.Path).Length;
        Response.Headers.AcceptRanges = "bytes";
        Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        if (!MediaByteRange.TryParse(Request.Headers.Range.ToString(), length, out var range))
        {
            return PhysicalFile(file.Path, file.ContentType);
        }

        if (range.Unsatisfiable)
        {
            Response.Headers.ContentRange = $"bytes */{length}";
            return StatusCode(StatusCodes.Status416RangeNotSatisfiable);
        }

        var stream = new FileStream(
            file.Path,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            64 * 1024,
            FileOptions.Asynchronous);
        stream.Seek(range.Start, SeekOrigin.Begin);
        return new PartialMediaResult(new BoundedReadStream(stream, range.Length), file.ContentType, range, length);
    }

    private async Task<Profile?> GetCurrentProfileAsync(CancellationToken cancellationToken)
    {
        var userId = currentUser.UserId;
        if (userId is null)
        {
            return null;
        }

        return await db.Profiles
            .Find(p => p.Id == userId)
            .FirstOrDefaultAsync(cancellationToken);
    }
}

file sealed class PartialMediaResult(
    Stream stream,
    string contentType,
    MediaByteRange range,
    long totalLength) : IActionResult
{
    public async Task ExecuteResultAsync(ActionContext context)
    {
        var response = context.HttpContext.Response;
        response.StatusCode = StatusCodes.Status206PartialContent;
        response.ContentType = contentType;
        response.ContentLength = range.Length;
        response.Headers.AcceptRanges = "bytes";
        response.Headers.ContentRange = $"bytes {range.Start}-{range.End}/{totalLength}";
        await stream.CopyToAsync(response.Body, context.HttpContext.RequestAborted);
        await stream.DisposeAsync();
    }
}

file sealed class BoundedReadStream : Stream
{
    private readonly Stream _inner;
    private readonly long _length;
    private long _remaining;

    public BoundedReadStream(Stream inner, long length)
    {
        _inner = inner;
        _length = length;
        _remaining = length;
    }

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => _length;
    public override long Position
    {
        get => _length - _remaining;
        set => throw new NotSupportedException();
    }

    public override int Read(byte[] buffer, int offset, int count) =>
        Read(buffer.AsSpan(offset, count));

    public override int Read(Span<byte> buffer)
    {
        if (_remaining <= 0)
        {
            return 0;
        }

        var toRead = (int)Math.Min(buffer.Length, _remaining);
        var read = _inner.Read(buffer[..toRead]);
        _remaining -= read;
        return read;
    }

    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        if (_remaining <= 0)
        {
            return 0;
        }

        var toRead = (int)Math.Min(buffer.Length, _remaining);
        var read = await _inner.ReadAsync(buffer[..toRead], cancellationToken);
        _remaining -= read;
        return read;
    }

    public override void Flush()
    {
    }

    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _inner.Dispose();
        }

        base.Dispose(disposing);
    }
}
