using System.Net;
using System.Text;
using System.Text.Json;
using Astro.Api.Contracts;
using Microsoft.Extensions.Options;

namespace Astro.Api.Services;

public sealed class GeminiApiException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public sealed class GeminiQuizGenerator(
    HttpClient http,
    IOptions<GeminiOptions> options,
    QuizGenerationRateLimiter rateLimiter,
    ILogger<GeminiQuizGenerator> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<GenerateQuizQuestionsResponse> GenerateAsync(
        GenerateQuizQuestionsRequest request,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var settings = options.Value;
        var apiKey = settings.ApiKey?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new GeminiApiException(
                StatusCodes.Status503ServiceUnavailable,
                "A geração com IA não está configurada neste servidor. Peça para definir a variável GEMINI_API_KEY.");
        }

        var model = string.IsNullOrWhiteSpace(settings.Model) ? "gemini-2.5-flash" : settings.Model.Trim();
        var context = request.Context.Trim();
        if (context.Length < GeneratedQuizSanitizer.MinContextLength)
        {
            throw new GeminiApiException(
                StatusCodes.Status400BadRequest,
                "Descreva o assunto com pelo menos algumas frases antes de gerar.");
        }

        if (context.Length > GeneratedQuizSanitizer.MaxContextLength)
        {
            context = context[..GeneratedQuizSanitizer.MaxContextLength];
        }

        if (userId != Guid.Empty && !rateLimiter.TryAcquire(userId, DateTimeOffset.UtcNow))
        {
            throw new GeminiApiException(
                StatusCodes.Status429TooManyRequests,
                "Você gerou muitas questões em pouco tempo. Espere alguns minutos e tente de novo.");
        }

        var count = Math.Clamp(request.Count, GeneratedQuizSanitizer.MinCount, GeneratedQuizSanitizer.MaxCount);
        var kind = request.Kind?.Trim().ToLowerInvariant();
        if (kind is not ("multiple_choice" or "true_false"))
        {
            kind = "mixed";
        }

        var url = $"v1beta/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(apiKey)}";
        using var content = new StringContent(BuildBody(context, count, kind, request.Difficulty), Encoding.UTF8, "application/json");

        HttpResponseMessage response;
        try
        {
            response = await http.PostAsync(url, content, cancellationToken);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new GeminiApiException(
                StatusCodes.Status504GatewayTimeout,
                "A IA demorou demais para responder. Tente novamente com menos questões.");
        }
        catch (HttpRequestException exception)
        {
            logger.LogWarning(exception, "Falha ao contactar a API Gemini.");
            throw new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "Não foi possível falar com a IA agora. Tente novamente em instantes.");
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            throw new GeminiApiException(
                StatusCodes.Status429TooManyRequests,
                "O limite gratuito da IA foi atingido. Espere um pouco e tente de novo.");
        }

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Gemini respondeu {Status}: {Body}", (int)response.StatusCode, TrimForLog(body));
            throw new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A IA recusou o pedido. Tente um contexto mais curto ou gere de novo.");
        }

        string modelText;
        try
        {
            modelText = ExtractText(body);
        }
        catch (GeminiApiException)
        {
            throw;
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or KeyNotFoundException)
        {
            logger.LogWarning(exception, "Resposta Gemini sem texto utilizável.");
            throw new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A IA devolveu um formato inválido. Tente novamente.");
        }

        try
        {
            return GeneratedQuizSanitizer.Sanitize(modelText, count, kind == "mixed" ? null : kind);
        }
        catch (GeneratedQuizException exception)
        {
            throw new GeminiApiException(StatusCodes.Status502BadGateway, exception.Message);
        }
    }

    private static string BuildBody(string context, int count, string kind, string? difficulty)
    {
        var kindInstruction = kind switch
        {
            "multiple_choice" => "Gere somente questões de múltipla escolha, cada uma com 4 alternativas.",
            "true_false" => "Gere somente questões de verdadeiro ou falso, com as alternativas \"Verdadeiro\" e \"Falso\".",
            _ => "Misture múltipla escolha (4 alternativas) e verdadeiro ou falso (alternativas \"Verdadeiro\" e \"Falso\")."
        };
        var difficultyInstruction = difficulty?.Trim().ToLowerInvariant() switch
        {
            "iniciante" => "Nível: iniciante, linguagem direta.",
            "intermediario" => "Nível: intermediário.",
            "avancado" => "Nível: avançado, exigindo raciocínio.",
            _ => "Varie a dificuldade de forma moderada."
        };

        var prompt = $"""
            Você elabora questões de quiz em português do Brasil para estudantes.
            Use apenas o contexto abaixo. Não invente fatos que o contradigam.
            {kindInstruction}
            {difficultyInstruction}
            Quantidade: exatamente {count} questões.
            Cada questão tem exatamente uma alternativa correta.
            O enunciado deve ser autocontido. A explicação justifica a resposta correta em uma ou duas frases.
            Também escreva a pré-seção (o que o aluno lê antes de começar) e a pós-seção (a mensagem depois do resultado).
            Pré-seção: título curto, texto de abertura, de 2 a 4 objetivos de aprendizagem, de 2 a 4 dicas de estudo e um tempo estimado em minutos (1 a 180).
            Pós-seção: título e uma mensagem de encerramento que oriente a revisar os erros, sem inventar a nota.
            Não inclua imagens.
            Contexto:
            {context}
            """;

        var body = new
        {
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[] { new { text = prompt } }
                }
            },
            generationConfig = new
            {
                temperature = 0.6,
                maxOutputTokens = 8192,
                responseMimeType = "application/json",
                responseSchema = ResponseSchema()
            }
        };

        return JsonSerializer.Serialize(body, JsonOptions);
    }

    private static object ResponseSchema() => new
    {
        type = "object",
        properties = new
        {
            questions = new
            {
                type = "array",
                items = new
                {
                    type = "object",
                    properties = new
                    {
                        kind = new { type = "string", @enum = new[] { "multiple_choice", "true_false" } },
                        prompt = new { type = "string" },
                        explanation = new { type = "string" },
                        options = new
                        {
                            type = "array",
                            items = new
                            {
                                type = "object",
                                properties = new
                                {
                                    text = new { type = "string" },
                                    isCorrect = new { type = "boolean" }
                                },
                                required = new[] { "text", "isCorrect" }
                            }
                        }
                    },
                    required = new[] { "kind", "prompt", "explanation", "options" }
                }
            },
            prep = SectionSchema(includeLists: true),
            feedback = SectionSchema(includeLists: false)
        },
        required = new[] { "questions", "prep", "feedback" }
    };

    private static object SectionSchema(bool includeLists)
    {
        if (!includeLists)
        {
            return new
            {
                type = "object",
                properties = new
                {
                    title = new { type = "string" },
                    body = new { type = "string" }
                },
                required = new[] { "title", "body" }
            };
        }

        return new
        {
            type = "object",
            properties = new
            {
                title = new { type = "string" },
                body = new { type = "string" },
                objectives = new { type = "array", items = new { type = "string" } },
                estimatedMinutes = new { type = "integer" },
                tips = new { type = "array", items = new { type = "string" } }
            },
            required = new[] { "title", "body", "objectives", "estimatedMinutes", "tips" }
        };
    }

    private static string ExtractText(string body)
    {
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
        {
            var block = root.TryGetProperty("promptFeedback", out var feedback)
                ? feedback.ToString()
                : "";
            if (block.Contains("SAFETY", StringComparison.OrdinalIgnoreCase))
            {
                throw new GeminiApiException(
                    StatusCodes.Status400BadRequest,
                    "A IA recusou esse contexto. Reformule o assunto e tente de novo.");
            }

            throw new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A IA não devolveu questões. Tente novamente.");
        }

        var candidate = candidates[0];
        if (candidate.TryGetProperty("finishReason", out var reason)
            && reason.GetString() is "SAFETY")
        {
            throw new GeminiApiException(
                StatusCodes.Status400BadRequest,
                "A IA recusou esse contexto. Reformule o assunto e tente de novo.");
        }

        if (!candidate.TryGetProperty("content", out var content)
            || !content.TryGetProperty("parts", out var parts)
            || parts.GetArrayLength() == 0
            || !parts[0].TryGetProperty("text", out var text))
        {
            throw new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A IA devolveu um formato inválido. Tente novamente.");
        }

        return text.GetString() ?? "";
    }

    private static string TrimForLog(string body) =>
        body.Length <= 500 ? body : body[..500];
}
