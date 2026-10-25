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
    internal const int MaxAttemptsPerModel = 3;
    internal static readonly TimeSpan MaxRetryWait = TimeSpan.FromSeconds(4);
    internal static readonly TimeSpan MaxShortRetry = TimeSpan.FromSeconds(2);

    internal Func<TimeSpan, CancellationToken, Task> WaitAsync { get; set; } = Task.Delay;
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

        var model = string.IsNullOrWhiteSpace(settings.Model) ? GeminiOptions.DefaultModel : settings.Model.Trim();
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

        var payload = BuildBody(context, count, kind, request.Difficulty);
        var (status, body) = await CallModelAsync(model, apiKey, payload, cancellationToken);
        var fallback = settings.FallbackModel?.Trim();
        if (!IsSuccess(status)
            && IsDemandFailure(status)
            && !string.IsNullOrWhiteSpace(fallback)
            && !string.Equals(fallback, model, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning(
                "Gemini esgotou as tentativas no modelo {Model}. Tentando o reserva {Fallback}.",
                model,
                fallback);
            model = fallback;
            (status, body) = await CallModelAsync(model, apiKey, payload, cancellationToken);
        }

        if (!IsSuccess(status))
        {
            throw MapHttpFailure(status, body, model);
        }

        string modelText;
        try
        {
            modelText = ExtractText(logger, body);
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
            Sugira também um tema curto em português (no máximo 40 caracteres), de preferência um destes: {string.Join(", ", ActivityThemes.Suggestions)}. Se nenhum servir, crie um rótulo curto. Não use "Geral" nem "Outros".
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
            feedback = SectionSchema(includeLists: false),
            theme = new { type = "string" }
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

    private static string ExtractText(ILogger logger, string body)
    {
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        var blockReason = ReadBlockReason(root);
        var finishReason = root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0
            && candidates[0].TryGetProperty("finishReason", out var reasonElement)
            ? reasonElement.GetString()
            : null;

        if (candidates.ValueKind != JsonValueKind.Array || candidates.GetArrayLength() == 0)
        {
            logger.LogError(
                "Gemini sem candidatos. finishReason={FinishReason} blockReason={BlockReason}",
                finishReason,
                blockReason);
            if (IsSafety(blockReason) || IsSafety(finishReason))
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
        if (IsSafety(finishReason) || IsSafety(blockReason))
        {
            logger.LogError(
                "Gemini bloqueou o conteúdo. finishReason={FinishReason} blockReason={BlockReason}",
                finishReason,
                blockReason);
            throw new GeminiApiException(
                StatusCodes.Status400BadRequest,
                "A IA recusou esse contexto. Reformule o assunto e tente de novo.");
        }

        if (string.Equals(finishReason, "MAX_TOKENS", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError("Gemini cortou a resposta. finishReason={FinishReason}", finishReason);
            throw new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A IA não terminou a resposta. Tente gerar menos questões.");
        }

        if (!candidate.TryGetProperty("content", out var content)
            || !content.TryGetProperty("parts", out var parts))
        {
            logger.LogError(
                "Gemini devolveu candidato sem texto. finishReason={FinishReason} blockReason={BlockReason}",
                finishReason,
                blockReason);
            throw new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A IA devolveu um formato inválido. Tente novamente.");
        }

        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var text) && !string.IsNullOrWhiteSpace(text.GetString()))
            {
                return text.GetString()!;
            }
        }

        logger.LogError(
            "Gemini devolveu candidato sem texto. finishReason={FinishReason} blockReason={BlockReason}",
            finishReason,
            blockReason);
        throw new GeminiApiException(
            StatusCodes.Status502BadGateway,
            "A IA devolveu um formato inválido. Tente novamente.");
    }

    private GeminiApiException MapHttpFailure(HttpStatusCode status, string body, string model)
    {
        var apiStatus = ReadErrorField(body, "status");
        var detail = SanitizeForLog(ReadErrorField(body, "message"));
        logger.LogError(
            "Gemini HTTP {Status} apiStatus={ApiStatus} detail={Detail}",
            (int)status,
            apiStatus,
            detail);

        if (status == HttpStatusCode.NotFound
            || string.Equals(apiStatus, "NOT_FOUND", StringComparison.OrdinalIgnoreCase))
        {
            return new GeminiApiException(
                StatusCodes.Status502BadGateway,
                $"O modelo de IA \"{model}\" não está disponível. No servidor, defina GEMINI_MODEL={GeminiOptions.DefaultModel} e recrie o backend.");
        }

        if (status == HttpStatusCode.TooManyRequests
            || string.Equals(apiStatus, "RESOURCE_EXHAUSTED", StringComparison.OrdinalIgnoreCase))
        {
            return new GeminiApiException(
                StatusCodes.Status429TooManyRequests,
                "O limite gratuito da IA foi atingido. Espere um pouco e tente de novo.");
        }

        if (status == HttpStatusCode.Forbidden || status == HttpStatusCode.Unauthorized)
        {
            return new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A chave da IA foi recusada pelo Google. Confira GEMINI_API_KEY no servidor.");
        }

        if (status == HttpStatusCode.ServiceUnavailable
            || string.Equals(apiStatus, "UNAVAILABLE", StringComparison.OrdinalIgnoreCase))
        {
            return new GeminiApiException(
                StatusCodes.Status503ServiceUnavailable,
                "O serviço de IA está sobrecarregado no momento. Tente novamente em alguns minutos.");
        }

        if ((int)status == 500)
        {
            return new GeminiApiException(
                StatusCodes.Status502BadGateway,
                "A IA está indisponível agora. Tente novamente em instantes.");
        }

        if (IsSafety(apiStatus) || IsSafety(detail))
        {
            return new GeminiApiException(
                StatusCodes.Status400BadRequest,
                "A IA recusou esse contexto. Reformule o assunto e tente de novo.");
        }

        return new GeminiApiException(
            StatusCodes.Status502BadGateway,
            "A IA não aceitou o pedido. Tente um contexto mais curto ou gere de novo.");
    }

    private async Task<(HttpStatusCode Status, string Body)> CallModelAsync(
        string model,
        string apiKey,
        string payload,
        CancellationToken cancellationToken)
    {
        var waited = TimeSpan.Zero;
        var status = HttpStatusCode.ServiceUnavailable;
        var body = "";
        for (var attempt = 1; attempt <= MaxAttemptsPerModel; attempt++)
        {
            try
            {
                using var message = new HttpRequestMessage(
                    HttpMethod.Post,
                    $"v1beta/models/{Uri.EscapeDataString(model)}:generateContent")
                {
                    Content = new StringContent(payload, Encoding.UTF8, "application/json")
                };
                message.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);
                using var response = await http.SendAsync(message, cancellationToken);
                body = await response.Content.ReadAsStringAsync(cancellationToken);
                status = response.StatusCode;
                if (IsSuccess(status)
                    || attempt == MaxAttemptsPerModel
                    || !TryGetRetryDelay(response, body, attempt, out var delay))
                {
                    return (status, body);
                }

                if (waited + delay > MaxRetryWait)
                {
                    return (status, body);
                }

                logger.LogWarning(
                    "Gemini HTTP {Status} no modelo {Model}. Nova tentativa {Next} de {Max}.",
                    (int)status,
                    model,
                    attempt + 1,
                    MaxAttemptsPerModel);
                await WaitAsync(delay, cancellationToken);
                waited += delay;
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
        }

        return (status, body);
    }

    internal static bool TryGetRetryDelay(HttpResponseMessage response, string body, int attempt, out TimeSpan delay)
    {
        delay = TimeSpan.Zero;
        if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
        {
            delay = Backoff(attempt);
            return true;
        }

        if (response.StatusCode != HttpStatusCode.TooManyRequests)
        {
            return false;
        }

        var hinted = ReadRetryAfter(response) ?? ReadRetryDelay(body);
        if (hinted is null || hinted > MaxShortRetry)
        {
            return false;
        }

        delay = hinted.Value;
        return true;
    }

    internal static TimeSpan Backoff(int attempt)
    {
        var multiplier = Math.Pow(2, Math.Max(0, attempt - 1));
        var jitterMs = Random.Shared.Next(0, 120);
        var milliseconds = Math.Min(2000, (int)(200 * multiplier) + jitterMs);
        return TimeSpan.FromMilliseconds(milliseconds);
    }

    private static TimeSpan? ReadRetryAfter(HttpResponseMessage response)
    {
        var header = response.Headers.RetryAfter;
        if (header?.Delta is TimeSpan delta)
        {
            return delta < TimeSpan.Zero ? TimeSpan.Zero : delta;
        }

        if (header?.Date is DateTimeOffset date)
        {
            var until = date - DateTimeOffset.UtcNow;
            return until < TimeSpan.Zero ? TimeSpan.Zero : until;
        }

        return null;
    }

    private static TimeSpan? ReadRetryDelay(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (!document.RootElement.TryGetProperty("error", out var error)
                || !error.TryGetProperty("details", out var details))
            {
                return null;
            }

            foreach (var detail in details.EnumerateArray())
            {
                if (!detail.TryGetProperty("retryDelay", out var retryDelay))
                {
                    continue;
                }

                var text = retryDelay.GetString();
                if (text is not null && text.EndsWith('s') && double.TryParse(
                        text[..^1],
                        System.Globalization.NumberStyles.Float,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out var seconds))
                {
                    return TimeSpan.FromSeconds(Math.Max(0, seconds));
                }
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static bool IsSuccess(HttpStatusCode status) => (int)status is >= 200 and < 300;

    private static bool IsDemandFailure(HttpStatusCode status) =>
        status is HttpStatusCode.ServiceUnavailable or HttpStatusCode.TooManyRequests;

    private static string? ReadBlockReason(JsonElement root)
    {
        if (!root.TryGetProperty("promptFeedback", out var feedback))
        {
            return null;
        }

        return feedback.TryGetProperty("blockReason", out var block) ? block.GetString() : null;
    }

    private static string? ReadErrorField(string body, string field)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("error", out var error)
                && error.TryGetProperty(field, out var value))
            {
                return value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    private static bool IsSafety(string? value) =>
        value?.Contains("SAFETY", StringComparison.OrdinalIgnoreCase) == true
        || value?.Contains("BLOCK", StringComparison.OrdinalIgnoreCase) == true;

    private static string SanitizeForLog(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        var text = value.Length <= 240 ? value : value[..240];
        return System.Text.RegularExpressions.Regex.Replace(text, @"AIza[0-9A-Za-z\-_]{10,}", "[redacted]");
    }
}
