using Astro.Api.Contracts;
using Astro.Api.Services;
using Xunit;

namespace Astro.Api.Tests;

public class VideoMediaTests
{
    [Theory]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", "youtube")]
    [InlineData("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ", "youtube")]
    [InlineData("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ", "youtube")]
    [InlineData("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ", "youtube")]
    [InlineData("https://vimeo.com/123456789", "123456789", "vimeo")]
    [InlineData("https://player.vimeo.com/video/123456789", "123456789", "vimeo")]
    public void NormalizesKnownPlayers(string input, string expected, string kind)
    {
        var parsed = AttachedVideo.Normalize(input);
        Assert.Null(parsed.Error);
        Assert.Equal(expected, parsed.Url);
        Assert.Equal(kind, parsed.Kind);
    }

    [Fact]
    public void DirectAndUploadedVideosStayFiles()
    {
        var direct = AttachedVideo.Normalize("https://cdn.exemplo.com/aula.mp4");
        Assert.Equal("file", direct.Kind);
        Assert.Equal("https://cdn.exemplo.com/aula.mp4", direct.Url);

        var id = Guid.NewGuid();
        var uploaded = AttachedVideo.Normalize($"/api/media/{id}");
        Assert.Equal("file", uploaded.Kind);
        Assert.Equal($"/api/media/{id}", uploaded.Url);
    }

    [Theory]
    [InlineData("dQw4w9WgXcQ", "dQw4w9WgXcQ", "youtube")]
    [InlineData("123456789", "123456789", "vimeo")]
    public void AcceptsStoredPlayerIds(string input, string expected, string kind)
    {
        var parsed = AttachedVideo.Normalize(input);
        Assert.Null(parsed.Error);
        Assert.Equal(expected, parsed.Url);
        Assert.Equal(kind, parsed.Kind);
    }

    [Theory]
    [InlineData("dQw4w9WgXcQ", "youtube")]
    [InlineData("123456789", "vimeo")]
    [InlineData("/api/media/11111111-1111-1111-1111-111111111111", "file")]
    [InlineData("https://cdn.exemplo.com/aula.mp4", "file")]
    public void ResavingStoredVideoKeepsIt(string stored, string kind)
    {
        var item = new CreateActivityItemRequest(
            null,
            "multiple_choice",
            "Assista e responda",
            null,
            [
                new CreateQuestionOptionRequest(null, "A", true),
                new CreateQuestionOptionRequest(null, "B", false)
            ],
            false,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            VideoUrl: stored);
        var built = ActivityContentBuilder.Build(
            "quiz",
            new CreateActivityRequest(
                "Quiz",
                "quiz",
                null,
                Sections:
                [
                    new CreateActivitySectionRequest(null, "prep", null, null, null, null, VideoUrl: stored),
                    new CreateActivitySectionRequest(null, "practice", null, null, null, [item]),
                    new CreateActivitySectionRequest(null, "feedback", "Resultados", null, "score_summary", null)
                ]));

        Assert.Null(built.Error);
        Assert.Equal(stored, built.Items![0].VideoUrl);
        Assert.Equal(kind, built.Items[0].VideoKind);
        Assert.Equal(stored, built.Sections![0].VideoUrl);
        Assert.Equal(kind, built.Sections[0].VideoKind);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("ftp://exemplo.com/a.mp4")]
    [InlineData("https://user:pass@exemplo.com/a.mp4")]
    public void RejectsUnsafeVideoAddresses(string input)
    {
        var parsed = AttachedVideo.Normalize(input);
        Assert.NotNull(parsed.Error);
        Assert.Null(parsed.Kind);
    }

    [Fact]
    public void QuestionStoresVideoAndDropsImage()
    {
        var built = ActivityContentBuilder.Build(
            "quiz",
            new CreateActivityRequest(
                "Quiz",
                "quiz",
                [
                    new CreateActivityItemRequest(
                        null,
                        "multiple_choice",
                        "Assista e responda",
                        null,
                        [
                            new CreateQuestionOptionRequest(null, "A", true),
                            new CreateQuestionOptionRequest(null, "B", false)
                        ],
                        false,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        VideoUrl: "https://youtu.be/dQw4w9WgXcQ")
                ]));

        Assert.Null(built.Error);
        Assert.Equal("dQw4w9WgXcQ", built.Items![0].VideoUrl);
        Assert.Equal("youtube", built.Items[0].VideoKind);
        Assert.Null(built.Items[0].ImageBytes);
    }

    [Fact]
    public void ImageOnlyQuestionStillHasNoVideo()
    {
        var jpeg = "data:image/jpeg;base64," + Convert.ToBase64String([0xFF, 0xD8, 0xFF, 0xD9]);
        var built = ActivityContentBuilder.Build(
            "quiz",
            new CreateActivityRequest(
                "Quiz",
                "quiz",
                [
                    new CreateActivityItemRequest(
                        null,
                        "short_answer",
                        "Pergunta",
                        null,
                        null,
                        null,
                        ["marte"],
                        null,
                        null,
                        null,
                        null,
                        null,
                        jpeg)
                ]));

        Assert.Null(built.Error);
        Assert.Null(built.Items![0].VideoUrl);
        Assert.Null(built.Items[0].VideoKind);
        Assert.NotNull(built.Items[0].ImageBytes);
    }

    [Theory]
    [InlineData(null, 100, false)]
    [InlineData("", 100, false)]
    public void MissingRangeMeansWholeFile(string? header, long size, bool parsed)
    {
        Assert.Equal(parsed, MediaByteRange.TryParse(header, size, out _));
    }

    [Fact]
    public void ParsesByteRanges()
    {
        Assert.True(MediaByteRange.TryParse("bytes=0-1", 10, out var first));
        Assert.False(first.Unsatisfiable);
        Assert.Equal(0, first.Start);
        Assert.Equal(1, first.End);
        Assert.Equal(2, first.Length);

        Assert.True(MediaByteRange.TryParse("bytes=2-", 10, out var open));
        Assert.Equal(2, open.Start);
        Assert.Equal(9, open.End);

        Assert.True(MediaByteRange.TryParse("bytes=-4", 10, out var suffix));
        Assert.Equal(6, suffix.Start);
        Assert.Equal(9, suffix.End);

        Assert.True(MediaByteRange.TryParse("bytes=0-99", 10, out var clamped));
        Assert.False(clamped.Unsatisfiable);
        Assert.Equal(9, clamped.End);

        Assert.True(MediaByteRange.TryParse("bytes=10-20", 10, out var beyond));
        Assert.True(beyond.Unsatisfiable);

        Assert.True(MediaByteRange.TryParse("items=0-1", 10, out var unit));
        Assert.True(unit.Unsatisfiable);
    }

    [Fact]
    public async Task AcceptsMp4AndRejectsHugeVideo()
    {
        var root = Path.Combine(Path.GetTempPath(), "astro-video-tests", Guid.NewGuid().ToString("N"));
        var storage = new MediaStorage(root, maxVideoBytes: 32);
        var mp4 = new byte[24];
        "ftyp"u8.CopyTo(mp4.AsSpan(4));
        "isom"u8.CopyTo(mp4.AsSpan(8));

        var saved = await storage.SaveAsync(new MemoryStream(mp4), mp4.Length, Guid.NewGuid(), CancellationToken.None);
        Assert.Null(saved.Error);
        var id = Guid.Parse(saved.Url!["/api/media/".Length..]);
        Assert.Equal("video/mp4", storage.Open(id)!.ContentType);

        var huge = new byte[33];
        var rejected = await storage.SaveAsync(new MemoryStream(huge), huge.Length, Guid.NewGuid(), CancellationToken.None);
        Assert.Contains("32", rejected.Error);
    }

    [Fact]
    public void DetectsWebmAndQuickTime()
    {
        Assert.Equal("video/webm", VideoSignatures.Detect([0x1A, 0x45, 0xDF, 0xA3, 0, 0, 0, 0]));
        var mov = new byte[12];
        "ftyp"u8.CopyTo(mov.AsSpan(4));
        "qt  "u8.CopyTo(mov.AsSpan(8));
        Assert.Equal("video/quicktime", VideoSignatures.Detect(mov));
    }
}
