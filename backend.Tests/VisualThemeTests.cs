using Astro.Api.Contracts;
using Astro.Api.Domain;
using Astro.Api.Services;
using Xunit;

namespace Astro.Api.Tests;

public class VisualThemeTests
{
    [Fact]
    public void MissingTheme_StaysOnSystemLook()
    {
        var built = ActivityContentBuilder.Build("quiz", Quiz(null));

        Assert.Null(built.Error);
        Assert.Null(built.Items![0].VisualTheme);
        Assert.Null(ActivityMapper.ToItemResponse(built.Items[0], includeAnswers: true).VisualTheme);
        Assert.Null(ActivityItemPresenter.ToStudentItem(built.Items[0], Guid.NewGuid()).VisualTheme);
    }

    [Fact]
    public void Padrao_IsStoredAsAbsent()
    {
        var built = ActivityContentBuilder.Build("quiz", Quiz("padrao"));

        Assert.Null(built.Error);
        Assert.Null(built.Items![0].VisualTheme);
    }

    [Theory]
    [InlineData("espaco")]
    [InlineData("Oceano")]
    [InlineData("por-do-sol")]
    [InlineData("neon")]
    [InlineData("gelo")]
    public void KnownTheme_IsPersistedAndShownToStudent(string theme)
    {
        var built = ActivityContentBuilder.Build("quiz", Quiz(theme));

        Assert.Null(built.Error);
        var expected = theme.ToLowerInvariant();
        Assert.Equal(expected, built.Items![0].VisualTheme);

        var host = ActivityItemPresenter.ToHostItem(built.Items[0], Guid.NewGuid());
        Assert.Equal(expected, host.VisualTheme);
        Assert.True(host.Options![0].IsCorrect);
    }

    [Fact]
    public void UnknownTheme_IsRejected()
    {
        var built = ActivityContentBuilder.Build("quiz", Quiz("galaxia"));

        Assert.Null(built.Items);
        Assert.Contains("Tema visual inválido", built.Error);
    }

    private static CreateActivityRequest Quiz(string? visualTheme) =>
        new(
            "Quiz",
            "quiz",
            [
                new CreateActivityItemRequest(
                    null,
                    "multiple_choice",
                    "Qual planeta é vermelho?",
                    null,
                    [
                        new CreateQuestionOptionRequest(null, "Marte", true),
                        new CreateQuestionOptionRequest(null, "Vênus", false)
                    ],
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    VisualTheme: visualTheme)
            ]);
}
