namespace Astro.Api.Services;

public class GeminiOptions
{
    public const string SectionName = "Gemini";

    public string ApiKey { get; set; } = "";

    /// <summary>Modelo atual da linha Flash no AI Studio. Sobrescreva com GEMINI_MODEL / Gemini__Model.</summary>
    public string Model { get; set; } = "gemini-2.5-flash";
}
