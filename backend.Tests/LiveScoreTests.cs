using System.Text.Json;
using Astro.Api.Contracts;
using Astro.Api.Domain;
using Astro.Api.Services;
using Xunit;

namespace Astro.Api.Tests;

public class LiveScoreTests
{
    [Theory]
    [InlineData(ActivityTypes.Quiz, true, LiveScore.QuizPoints)]
    [InlineData(ActivityTypes.Quiz, false, 0)]
    [InlineData(ActivityTypes.Prova, true, LiveScore.ProvaPoints)]
    [InlineData(ActivityTypes.Prova, false, 0)]
    public void PointsDoNotDependOnResponseTime(string mode, bool isCorrect, int expected) =>
        Assert.Equal(expected, LiveScore.ForAnswer(mode, isCorrect));

    [Fact]
    public void LegacyTimeLimitOnCreateIsIgnored()
    {
        const string json = """
            {
              "title": "Quiz antigo",
              "type": "quiz",
              "items": [
                {
                  "kind": "multiple_choice",
                  "prompt": "Qual é o planeta vermelho?",
                  "timeLimitSeconds": 15,
                  "options": [
                    { "text": "Marte", "isCorrect": true },
                    { "text": "Vênus", "isCorrect": false }
                  ]
                }
              ]
            }
            """;

        var request = JsonSerializer.Deserialize<CreateActivityRequest>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        var built = ActivityContentBuilder.Build(request!.Type, request);

        Assert.Null(built.Error);
        Assert.Equal("Qual é o planeta vermelho?", built.Items![0].Prompt);
    }
}
