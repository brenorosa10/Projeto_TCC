using Astro.Api.Contracts;

namespace Astro.Api.Services;

public static class LiveHostAnswerPolicy
{
    public static bool ShowsAnswers(bool? stored) => stored ?? true;

    /// <summary>
    /// Keeps class totals on the projected screen and removes anything that names the correct alternative.
    /// Student payloads are left unchanged.
    /// </summary>
    public static LiveQuestionRevealResponse? SanitizeReveal(
        LiveQuestionRevealResponse? reveal,
        bool isHost,
        bool showHostAnswers)
    {
        if (reveal is null || !isHost || showHostAnswers)
        {
            return reveal;
        }

        return reveal with
        {
            CorrectOptionIds = null,
            Explanation = null,
            FeedbackBlocks = null,
            FeedbackMessages = null
        };
    }
}
