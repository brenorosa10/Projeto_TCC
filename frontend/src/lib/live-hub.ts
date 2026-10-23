import * as signalR from "@microsoft/signalr"
import { getApiBaseUrl } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-token"
import type { LiveSessionState, SubmitStudyAnswerRequest } from "@/lib/types"

export function createLiveHub(onState: (state: LiveSessionState) => void) {
  const token = getAccessToken()
  if (!token) {
    throw new Error("Faça login novamente.")
  }

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${getApiBaseUrl()}/hubs/live`, {
      accessTokenFactory: () => getAccessToken() ?? token,
    })
    .withAutomaticReconnect()
    .build()

  connection.on("SessionUpdated", (state: LiveSessionState) => {
    onState(state)
  })

  return connection
}

export async function startLiveHub(connection: signalR.HubConnection) {
  if (connection.state === signalR.HubConnectionState.Disconnected) {
    await connection.start()
  }
}

export async function joinLiveAsHost(connection: signalR.HubConnection, sessionId: string) {
  await startLiveHub(connection)
  await connection.invoke("JoinAsHost", sessionId)
}

export async function joinLiveAsStudent(connection: signalR.HubConnection, pin: string) {
  await startLiveHub(connection)
  return connection.invoke<LiveSessionState>("JoinSession", pin)
}

export async function liveStart(connection: signalR.HubConnection) {
  await connection.invoke("Start")
}

export async function liveAdvance(connection: signalR.HubConnection) {
  await connection.invoke("Advance")
}

export async function liveEnd(connection: signalR.HubConnection) {
  await connection.invoke("End")
}

export async function liveSubmitAnswer(
  connection: signalR.HubConnection,
  payload: SubmitStudyAnswerRequest
) {
  await connection.invoke("SubmitAnswer", payload)
}
