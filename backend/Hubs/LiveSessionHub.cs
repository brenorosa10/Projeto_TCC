using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Astro.Api.Hubs;

[Authorize]
public class LiveSessionHub : Hub
{
    public async Task JoinSession(string pin)
    {
        if (string.IsNullOrWhiteSpace(pin) || pin.Length != 6 || !pin.All(char.IsDigit))
        {
            throw new HubException("PIN inválido. Informe 6 dígitos.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(pin));
        await Clients.Caller.SendAsync("JoinedSession", pin);
    }

    public async Task AdvanceQuestion(string pin)
    {
        await Clients.Group(GroupName(pin)).SendAsync("QuestionAdvanced", new
        {
            pin,
            at = DateTimeOffset.UtcNow
        });
    }

    public async Task SubmitAnswer(string pin, Guid questionId, Guid? optionId)
    {
        await Clients.Caller.SendAsync("AnswerReceived", new
        {
            pin,
            questionId,
            optionId,
            at = DateTimeOffset.UtcNow
        });
    }

    private static string GroupName(string pin) => $"session:{pin}";
}
