using System.Text.Json;
using Astro.Api.Contracts;
using Astro.Api.Services;
using Xunit;

namespace Astro.Api.Tests;

public class LiveHostAnswerPolicyTests
{
    [Theory]
    [InlineData(null, true)]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public void MissingChoiceKeepsAnswersVisible(bool? stored, bool expected) =>
        Assert.Equal(expected, LiveHostAnswerPolicy.ShowsAnswers(stored));

    [Fact]
    public void OmittedCreateFieldDoesNotHideAnswers()
    {
        var request = JsonSerializer.Deserialize<CreateLiveSessionRequest>(
            """{"activityId":"11111111-1111-1111-1111-111111111111","classId":"22222222-2222-2222-2222-222222222222"}""",
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(request);
        Assert.Null(request.ShowHostAnswers);
        Assert.True(LiveHostAnswerPolicy.ShowsAnswers(request.ShowHostAnswers));
    }

    [Fact]
    public void HiddenHostRevealDropsTheAnswerKey()
    {
        var optionId = Guid.NewGuid();
        var reveal = new LiveQuestionRevealResponse(
            Guid.NewGuid(),
            2,
            1,
            0,
            66.7,
            [optionId],
            "Porque Marte é o planeta vermelho.",
            [new ContentBlockResponse("markdown", "A correta é Marte.", null)],
            ["Marte"]);

        var hidden = LiveHostAnswerPolicy.SanitizeReveal(reveal, isHost: true, showHostAnswers: false);

        Assert.NotNull(hidden);
        Assert.Null(hidden.CorrectOptionIds);
        Assert.Null(hidden.Explanation);
        Assert.Null(hidden.FeedbackBlocks);
        Assert.Null(hidden.FeedbackMessages);
        Assert.Equal(2, hidden.CorrectCount);
        Assert.Equal(66.7, hidden.AccuracyPercent);
    }

    [Fact]
    public void StudentRevealKeepsTheAnswerKey()
    {
        var reveal = new LiveQuestionRevealResponse(
            Guid.NewGuid(),
            1,
            0,
            0,
            100,
            [Guid.NewGuid()],
            "Explicação",
            null,
            null);

        var shown = LiveHostAnswerPolicy.SanitizeReveal(reveal, isHost: false, showHostAnswers: false);

        Assert.Same(reveal, shown);
        Assert.NotNull(shown!.CorrectOptionIds);
        Assert.Equal("Explicação", shown.Explanation);
    }
}
