namespace Astro.Api.Services;

public class GeminiOptions
{
    public const string SectionName = "Gemini";

    public string ApiKey { get; set; } = "";

    public const string DefaultModel = "gemini-3.8-flash";

    /// <summary>Modelo Flash atual no AI Studio. Sobrescreva com GEMINI_MODEL / Gemini__Model.</summary>
    public string Model { get; set; } = DefaultModel;

    /// <summary>Opcional. Usado depois que as tentativas do modelo principal esgotam em 503 ou 429 curto.</summary>
    public string FallbackModel { get; set; } = "";
}
