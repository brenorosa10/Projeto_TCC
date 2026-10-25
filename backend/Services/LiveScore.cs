using Astro.Api.Domain;

namespace Astro.Api.Services;

/// <summary>
/// Pontuação sem tempo: acerto vale pontos fixos; erro vale zero.
/// O tempo de resposta continua gravado só como métrica.
/// </summary>
internal static class LiveScore
{
    public const int QuizPoints = 1000;
    public const int ProvaPoints = 1;

    public static int ForAnswer(string mode, bool isCorrect)
    {
        if (!isCorrect)
        {
            return 0;
        }

        return mode == ActivityTypes.Prova ? ProvaPoints : QuizPoints;
    }
}
