using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Astro.Api.Contracts;
using Astro.Api.Services;

namespace Astro.Api.Hubs;

[Authorize]
public class LiveSessionHub(
    LiveSessionService liveSessions) : Hub
{
    public const string SessionUpdatedEvent = "SessionUpdated";

    public async Task JoinAsHost(Guid sessionId)
    {
        var result = await liveSessions.JoinHostAsync(sessionId, Context.ConnectionId, Context.ConnectionAborted);
        ThrowIfFailed(result);
        Remember(result.State!.Id, host: true);
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(result.State.Id));
        await BroadcastAsync(result.State.Id);
    }

    public async Task JoinSession(string pin)
    {
        var result = await liveSessions.JoinStudentAsync(pin, Context.ConnectionId, Context.ConnectionAborted);
        ThrowIfFailed(result);
        Remember(result.State!.Id, host: false);
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(result.State.Id));
        await BroadcastAsync(result.State.Id);
    }

    public async Task Start()
    {
        var result = await liveSessions.StartAsync(RequireSessionId(), Context.ConnectionAborted);
        ThrowIfFailed(result);
        await BroadcastAsync(result.State!.Id);
    }

    public async Task Advance()
    {
        var result = await liveSessions.AdvanceAsync(RequireSessionId(), Context.ConnectionAborted);
        ThrowIfFailed(result);
        await BroadcastAsync(result.State!.Id);
    }

    public async Task End()
    {
        var result = await liveSessions.EndAsync(RequireSessionId(), Context.ConnectionAborted);
        ThrowIfFailed(result);
        await BroadcastAsync(result.State!.Id);
    }

    public async Task SubmitAnswer(SubmitStudyAnswerRequest request)
    {
        var result = await liveSessions.SubmitAnswerAsync(RequireSessionId(), request, Context.ConnectionAborted);
        ThrowIfFailed(result);
        await BroadcastAsync(result.State!.Id);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var result = await liveSessions.DisconnectAsync(Context.ConnectionId, CancellationToken.None);
        if (result?.State is not null)
        {
            await BroadcastAsync(result.State.Id);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public static async Task BroadcastAsync(
        IHubContext<LiveSessionHub> hub,
        LiveSessionService liveSessions,
        Guid sessionId,
        CancellationToken cancellationToken)
    {
        var states = await liveSessions.BuildConnectionStatesAsync(sessionId, cancellationToken);
        foreach (var (connectionId, state) in states)
        {
            await hub.Clients.Client(connectionId).SendAsync(SessionUpdatedEvent, state, cancellationToken);
        }
    }

    private async Task BroadcastAsync(Guid sessionId)
    {
        var states = await liveSessions.BuildConnectionStatesAsync(sessionId, Context.ConnectionAborted);
        foreach (var (connectionId, state) in states)
        {
            await Clients.Client(connectionId).SendAsync(SessionUpdatedEvent, state);
        }
    }

    private void Remember(Guid sessionId, bool host)
    {
        Context.Items["liveSessionId"] = sessionId;
        Context.Items["liveHost"] = host;
    }

    private Guid RequireSessionId()
    {
        if (Context.Items.TryGetValue("liveSessionId", out var value) && value is Guid sessionId)
        {
            return sessionId;
        }

        throw new HubException("Entre na sessão antes de enviar comandos.");
    }

    private static void ThrowIfFailed(LiveOperationResult result)
    {
        if (result.State is null)
        {
            throw new HubException(result.Error ?? "Não foi possível atualizar a sessão.");
        }
    }

    private static string GroupName(Guid sessionId) => $"live:{sessionId}";
}
