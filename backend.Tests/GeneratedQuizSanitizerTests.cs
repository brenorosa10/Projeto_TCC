using Astro.Api.Contracts;
using Astro.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Astro.Api.Tests;

public class GeneratedQuizSanitizerTests
{
    [Fact]
    public void KeepsOneCorrectAlternativeAndTrimsToRequestedCount()
    {
        const string json = """
            {
              "questions": [
                {
                  "kind": "multiple_choice",
                  "prompt": "Qual planeta é conhecido como planeta vermelho?",
                  "explanation": "Marte tem óxido de ferro na superfície.",
                  "options": [
                    { "text": "Vênus", "isCorrect": false },
                    { "text": "Marte", "isCorrect": true },
                    { "text": "Marte", "isCorrect": false },
                    { "text": "Júpiter", "isCorrect": true }
                  ]
                },
                {
                  "kind": "true_false",
                  "prompt": "A Terra é o terceiro planeta a partir do Sol.",
                  "explanation": "A ordem é Mercúrio, Vênus e Terra.",
                  "options": [
                    { "text": "Verdadeiro", "isCorrect": true },
                    { "text": "Falso", "isCorrect": false }
                  ]
                },
                {
                  "kind": "multiple_choice",
                  "prompt": "Esta pergunta extra não deve entrar.",
                  "options": [
                    { "text": "A", "isCorrect": true },
                    { "text": "B", "isCorrect": false }
                  ]
                }
              ],
              "prep": {
                "title": "Antes de começar",
                "body": "Releia as características dos planetas rochosos.\nDepois comece as questões.",
                "objectives": ["Identificar os planetas interiores", "Identificar os planetas interiores", ""],
                "estimatedMinutes": 400,
                "tips": ["Leia o enunciado até o fim"]
              },
              "feedback": {
                "title": "",
                "body": "Revise as questões erradas e compare com o gabarito."
              }
            }
            """;

        var generated = GeneratedQuizSanitizer.Sanitize(json, requestedCount: 2, requestedKind: null);
        var questions = generated.Questions;

        Assert.Equal("Antes de começar", generated.Prep.Title);
        Assert.Contains("planetas rochosos", generated.Prep.Body);
        Assert.Equal(["Identificar os planetas interiores"], generated.Prep.Objectives);
        Assert.Null(generated.Prep.EstimatedMinutes);
        Assert.Equal(["Leia o enunciado até o fim"], generated.Prep.Tips);
        Assert.Equal("Resultados", generated.Feedback.Title);
        Assert.Contains("gabarito", generated.Feedback.Body);

        Assert.Equal(2, questions.Count);
        Assert.Equal("multiple_choice", questions[0].Kind);
        Assert.Equal(3, questions[0].Options.Count);
        Assert.Equal(1, questions[0].Options.Count(option => option.IsCorrect));
        Assert.Equal("Marte", questions[0].Options.Single(option => option.IsCorrect).Text);
        Assert.Equal("true_false", questions[1].Kind);
        Assert.Equal(["Verdadeiro", "Falso"], questions[1].Options.Select(option => option.Text).ToArray());
        Assert.True(questions[1].Options[0].IsCorrect);
        Assert.False(questions[1].Options[1].IsCorrect);
        Assert.Null(generated.Theme);
    }

    [Fact]
    public void SuggestedTheme_IsCanonicalizedAndOptional()
    {
        const string json = """
            {
              "theme": "  historia ",
              "questions": [
                {
                  "kind": "multiple_choice",
                  "prompt": "Qual planeta é conhecido como planeta vermelho?",
                  "explanation": "Marte tem óxido de ferro na superfície.",
                  "options": [
                    { "text": "Marte", "isCorrect": true },
                    { "text": "Vênus", "isCorrect": false }
                  ]
                }
              ],
              "prep": {
                "title": "Antes de começar",
                "body": "Releia as características dos planetas rochosos antes das questões."
              },
              "feedback": {
                "title": "Resultados",
                "body": "Revise as questões erradas e compare com o gabarito."
              }
            }
            """;

        var generated = GeneratedQuizSanitizer.Sanitize(json, requestedCount: 1, requestedKind: null);
        Assert.Equal("História", generated.Theme);

        var generic = json.Replace("\"  historia \"", "\"Geral\"");
        Assert.Null(GeneratedQuizSanitizer.Sanitize(generic, 1, null).Theme);
    }

    [Fact]
    public void DropsQuestionsWithoutACorrectAnswer()
    {
        const string json = """
            {
              "questions": [
                {
                  "kind": "multiple_choice",
                  "prompt": "Pergunta sem gabarito definido pela IA.",
                  "options": [
                    { "text": "A", "isCorrect": false },
                    { "text": "B", "isCorrect": false }
                  ]
                }
              ]
            }
            """;

        var error = Assert.Throws<GeneratedQuizException>(() =>
            GeneratedQuizSanitizer.Sanitize(json, 1, null));

        Assert.Contains("válidas", error.Message);
    }

    [Fact]
    public void ReadsJsonWrappedInAMarkdownFence()
    {
        const string json = """
            ```json
            {"questions":[{"kind":"true_false","prompt":"O Sol é uma estrela.","explanation":"Sim.","options":[{"text":"Falso","isCorrect":true},{"text":"Verdadeiro","isCorrect":false}]}],"prep":{"title":"Aquecimento","body":"Lembre o que é uma estrela antes de responder.","objectives":["Relacionar o Sol às estrelas"],"estimatedMinutes":5,"tips":["Não tenha pressa"]},"feedback":{"title":"Depois do quiz","body":"Se errou, volte ao texto e marque o que ainda está confuso."}}
            ```
            """;

        var questions = GeneratedQuizSanitizer.Sanitize(json, 1, "true_false").Questions;

        Assert.Single(questions);
        Assert.False(questions[0].Options.Single(option => option.Text == "Verdadeiro").IsCorrect);
        Assert.True(questions[0].Options.Single(option => option.Text == "Falso").IsCorrect);
    }

    [Fact]
    public void ForcesRequestedKindAndCapsAlternativesAtSix()
    {
        var options = string.Join(
            ",",
            Enumerable.Range(1, 8).Select(index =>
                $$"""{ "text": "Opção {{index}}", "isCorrect": {{(index == 7 ? "true" : "false")}} }"""));
        var json = $$"""
            { "questions": [ { "kind": "true_false", "prompt": "Escolha a opção correta deste conjunto.", "options": [ {{options}} ] } ], "prep": { "title": "Preparação", "body": "Observe as opções com atenção antes de marcar.", "objectives": ["Comparar alternativas"], "estimatedMinutes": 6, "tips": ["Elimine o que for absurdo"] }, "feedback": { "title": "Encerramento", "body": "Anote a alternativa correta e o motivo da escolha." } }
            """;

        var questions = GeneratedQuizSanitizer.Sanitize(json, 1, "multiple_choice").Questions;

        Assert.Equal("multiple_choice", questions[0].Kind);
        Assert.Equal(6, questions[0].Options.Count);
        Assert.Equal(1, questions[0].Options.Count(option => option.IsCorrect));
        Assert.Contains(questions[0].Options, option => option.Text == "Opção 7" && option.IsCorrect);
    }

    [Fact]
    public void RejectsAPrepSectionWithoutOpeningText()
    {
        const string json = """
            {
              "questions": [
                {
                  "kind": "multiple_choice",
                  "prompt": "Qual é a capital do Brasil?",
                  "options": [
                    { "text": "Brasília", "isCorrect": true },
                    { "text": "Salvador", "isCorrect": false }
                  ]
                }
              ],
              "prep": { "title": "Pré", "body": "curto" },
              "feedback": { "title": "Pós", "body": "Mensagem longa o bastante para encerrar." }
            }
            """;

        var error = Assert.Throws<GeneratedQuizException>(() =>
            GeneratedQuizSanitizer.Sanitize(json, 1, null));

        Assert.Contains("pré-seção", error.Message);
    }
}

public class QuizGenerationRateLimiterTests
{
    [Fact]
    public void BlocksTheNinthCallInsideTheWindow()
    {
        var limiter = new QuizGenerationRateLimiter();
        var user = Guid.NewGuid();
        var now = DateTimeOffset.Parse("2026-10-24T12:00:00Z");

        for (var attempt = 0; attempt < QuizGenerationRateLimiter.MaxRequests; attempt++)
        {
            Assert.True(limiter.TryAcquire(user, now));
        }

        Assert.False(limiter.TryAcquire(user, now));
        Assert.True(limiter.TryAcquire(user, now.Add(QuizGenerationRateLimiter.Window)));
    }
}

public class GeminiQuizGeneratorTests
{
    [Fact]
    public async Task MissingKeyReturnsAFriendlyErrorWithoutCallingTheNetwork()
    {
        var handler = new RecordingHandler();
        var generator = new GeminiQuizGenerator(
            new HttpClient(handler) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") },
            Options.Create(new GeminiOptions { ApiKey = "  ", Model = "gemini-2.5-flash" }),
            new QuizGenerationRateLimiter(),
            NullLogger<GeminiQuizGenerator>.Instance);

        var error = await Assert.ThrowsAsync<GeminiApiException>(() =>
            generator.GenerateAsync(
                new GenerateQuizQuestionsRequest("Contexto suficiente para o teste.", 2),
                Guid.NewGuid(),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, error.StatusCode);
        Assert.Contains("GEMINI_API_KEY", error.Message);
        Assert.Equal(0, handler.Calls);
    }

    [Fact]
    public async Task RateLimitFromGeminiIsTranslated()
    {
        var handler = new RecordingHandler(StatusCodes.Status429TooManyRequests, "{}");
        var generator = new GeminiQuizGenerator(
            new HttpClient(handler) { BaseAddress = new Uri("https://generativelanguage.googleapis.com/") },
            Options.Create(new GeminiOptions { ApiKey = "test-key", Model = "gemini-2.5-flash" }),
            new QuizGenerationRateLimiter(),
            NullLogger<GeminiQuizGenerator>.Instance);

        var error = await Assert.ThrowsAsync<GeminiApiException>(() =>
            generator.GenerateAsync(
                new GenerateQuizQuestionsRequest("A fotossíntese transforma luz em energia química nas plantas.", 1, "iniciante", "multiple_choice"),
                Guid.NewGuid(),
                CancellationToken.None));

        Assert.Equal(StatusCodes.Status429TooManyRequests, error.StatusCode);
        Assert.Contains("limite gratuito", error.Message);
        Assert.DoesNotContain("test-key", error.Message);
    }

    private sealed class RecordingHandler(int status = 200, string body = "{}") : HttpMessageHandler
    {
        public int Calls { get; private set; }
        public string? LastUrl { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            LastUrl = request.RequestUri?.ToString();
            return Task.FromResult(new HttpResponseMessage((System.Net.HttpStatusCode)status)
            {
                Content = new StringContent(body)
            });
        }
    }
}
