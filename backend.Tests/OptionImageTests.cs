using Astro.Api.Contracts;
using Astro.Api.Services;
using Xunit;

namespace Astro.Api.Tests;

public class OptionImageTests
{
    [Fact]
    public void TextOnlyAlternative_StaysCompatible()
    {
        var built = ActivityContentBuilder.Build("quiz", Quiz(Choice("Mercúrio", true), Choice("Vênus", false)));

        Assert.Null(built.Error);
        var options = built.Items![0].Options!;
        Assert.Equal("Mercúrio", options[0].Text);
        Assert.Null(options[0].ImageUrl);
        Assert.Null(options[1].ImageUrl);
    }

    [Fact]
    public void ImageOnlyAlternative_IsAccepted()
    {
        var built = ActivityContentBuilder.Build(
            "quiz",
            Quiz(
                new CreateQuestionOptionRequest(null, null, true, "https://exemplo.com/marte.png"),
                Choice("Saturno", false)));

        Assert.Null(built.Error);
        Assert.Equal(string.Empty, built.Items![0].Options![0].Text);
        Assert.Equal("https://exemplo.com/marte.png", built.Items[0].Options![0].ImageUrl);
    }

    [Fact]
    public void UploadedMediaPath_IsStored()
    {
        var id = Guid.NewGuid();
        var built = ActivityContentBuilder.Build(
            "quiz",
            Quiz(
                new CreateQuestionOptionRequest(null, "A", true, $"/api/media/{id}"),
                Choice("B", false)));

        Assert.Null(built.Error);
        Assert.Equal($"/api/media/{id}", built.Items![0].Options![0].ImageUrl);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("data:image/png;base64,aaaa")]
    [InlineData("ftp://exemplo.com/a.png")]
    [InlineData("/etc/passwd")]
    public void RejectsUnsafeImageAddress(string imageUrl)
    {
        var built = ActivityContentBuilder.Build(
            "quiz",
            Quiz(new CreateQuestionOptionRequest(null, "A", true, imageUrl), Choice("B", false)));

        Assert.Null(built.Items);
        Assert.Contains("http", built.Error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RejectsCredentialsInImageAddress()
    {
        var built = ActivityContentBuilder.Build(
            "quiz",
            Quiz(
                new CreateQuestionOptionRequest(null, "A", true, "https://usuario:senha@exemplo.com/a.png"),
                Choice("B", false)));

        Assert.Equal("O endereço da imagem não pode conter usuário ou senha.", built.Error);
    }

    [Fact]
    public void AlternativeNeedsTextOrImage()
    {
        var built = ActivityContentBuilder.Build(
            "quiz",
            Quiz(new CreateQuestionOptionRequest(null, "  ", true, null), Choice("B", false)));

        Assert.Equal("Cada alternativa precisa de texto ou de uma imagem.", built.Error);
    }

    [Fact]
    public void TrueFalseWithoutOptions_StillWorks()
    {
        var built = ActivityContentBuilder.Build(
            "quiz",
            new CreateActivityRequest(
                "Quiz",
                "quiz",
                [
                    new CreateActivityItemRequest(
                        null,
                        "true_false",
                        "A Terra é um planeta.",
                        null,
                        null,
                        null,
                        null,
                        null,
                        true,
                        null,
                        null,
                        null,
                        null)
                ]));

        Assert.Null(built.Error);
        Assert.Equal(["Verdadeiro", "Falso"], built.Items![0].Options!.Select(option => option.Text));
        Assert.All(built.Items[0].Options!, option => Assert.Null(option.ImageUrl));
    }

    [Fact]
    public void DetectsImageSignatures()
    {
        Assert.Equal("image/jpeg", ImageSignatures.Detect([0xFF, 0xD8, 0xFF, 0x00]));
        Assert.Equal("image/png", ImageSignatures.Detect([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
        Assert.Equal("image/gif", ImageSignatures.Detect("GIF89a"u8.ToArray()));
        Assert.Null(ImageSignatures.Detect("<svg>"u8.ToArray()));
    }

    [Fact]
    public async Task UploadRoundTrip_ServesOnlyRealImages()
    {
        var root = Path.Combine(Path.GetTempPath(), "astro-media-tests", Guid.NewGuid().ToString("N"));
        var storage = new MediaStorage(root);
        var jpeg = new byte[] { 0xFF, 0xD8, 0xFF, 0xD9 };

        var saved = await storage.SaveAsync(new MemoryStream(jpeg), jpeg.Length, Guid.NewGuid(), CancellationToken.None);

        Assert.Null(saved.Error);
        Assert.Matches("^/api/media/[0-9a-fA-F-]{36}$", saved.Url);
        var id = Guid.Parse(saved.Url!["/api/media/".Length..]);
        var opened = storage.Open(id);
        Assert.NotNull(opened);
        Assert.Equal("image/jpeg", opened!.ContentType);
        Assert.Equal(jpeg, await File.ReadAllBytesAsync(opened.Path));

        var rejected = await storage.SaveAsync(new MemoryStream("<html>"u8.ToArray()), 6, Guid.NewGuid(), CancellationToken.None);
        Assert.Equal("Envie um arquivo JPEG, PNG, WebP ou GIF.", rejected.Error);

        var oversized = new byte[ImageSignatures.MaxUploadBytes + 1];
        var tooBig = await storage.SaveAsync(new MemoryStream(oversized), oversized.Length, Guid.NewGuid(), CancellationToken.None);
        Assert.Contains("3 MB", tooBig.Error);
    }

    private static CreateActivityRequest Quiz(params CreateQuestionOptionRequest[] options) =>
        new(
            "Quiz",
            "quiz",
            [
                new CreateActivityItemRequest(
                    null,
                    "multiple_choice",
                    "Qual é o planeta?",
                    null,
                    options.ToList(),
                    false,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null)
            ]);

    private static CreateQuestionOptionRequest Choice(string text, bool correct) =>
        new(null, text, correct);
}
