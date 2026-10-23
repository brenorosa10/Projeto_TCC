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

    public async Task<LiveSessionStateResponse> JoinAsHost(Guid sessionId)
    {
        var result = await liveSessions.JoinHostAsync(sessionId, Context.ConnectionId, Context.ConnectionAborted);
        ThrowIfFailed(result);
        Remember(result.State!.Id, host: true);
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(result.State.Id));
        // The host already receives this state as the invoke result. Sending it
        // again on the same connection blocks the invoke until that payload is written.
        await BroadcastAsync(result.State.Id, Context.ConnectionId);
        return result.State;
    }

    public async Task<LiveSessionStateResponse> JoinSession(string pin)
    {
        var result = await liveSessions.JoinStudentAsync(pin, Context.ConnectionId, Context.ConnectionAborted);
        ThrowIfFailed(result);
        Remember(result.State!.Id, host: false);
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(result.State.Id));
        await BroadcastAsync(result.State.Id);
        return result.State;
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
        await Task.WhenAll(states.Select(entry =>
            hub.Clients.Client(entry.ConnectionId).SendAsync(SessionUpdatedEvent, entry.State, cancellationToken)));
    }

    private async Task BroadcastAsync(Guid sessionId, string? excludeConnectionId = null)
    {
        var states = await liveSessions.BuildConnectionStatesAsync(sessionId, Context.ConnectionAborted);
        var sends = states
            .Where(entry => excludeConnectionId is null || entry.ConnectionId != excludeConnectionId)
            .Select(entry => Clients.Client(entry.ConnectionId).SendAsync(SessionUpdatedEvent, entry.State));
        await Task.WhenAll(sends);
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
