import { useEffect, useState } from "react"
import * as signalR from "@microsoft/signalr"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getApiBaseUrl } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-token"

export function ProfessorLivePage() {
  const [pin, setPin] = useState("")
  const [connectionState, setConnectionState] = useState("Desconectado")
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null)

  useEffect(() => {
    return () => {
      void connection?.stop()
    }
  }, [connection])

  async function connect() {
    const sessionPin = pin.trim() || String(Math.floor(100000 + Math.random() * 900000))
    setPin(sessionPin)

    const token = getAccessToken()
    if (!token) {
      toast.error("Faça login novamente.")
      return
    }

    const hub = new signalR.HubConnectionBuilder()
      .withUrl(`${getApiBaseUrl()}/hubs/live`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .build()

    hub.onreconnecting(() => setConnectionState("Reconectando..."))
    hub.onreconnected(() => setConnectionState("Conectado"))
    hub.onclose(() => setConnectionState("Desconectado"))

    try {
      await hub.start()
      await hub.invoke("JoinSession", sessionPin)
      setConnection(hub)
      setConnectionState("Conectado")
      toast.success(`Sala ${sessionPin} pronta (stub SignalR)`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao conectar no hub")
    }
  }

  async function advance() {
    if (!connection || !pin) return
    try {
      await connection.invoke("AdvanceQuestion", pin)
      toast.message("Comando Avançar enviado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao avançar")
    }
  }

  return (
    <AppShell title="Sessão ao vivo">
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Iniciar ao vivo</h1>
          <p className="mt-2 text-muted-foreground">
            Stub da sessão síncrona (RN06–RN09). Gere um PIN e conecte via SignalR.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pin">PIN da sessão (6 dígitos)</Label>
          <Input
            id="pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Deixe vazio para gerar"
            maxLength={6}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void connect()}>Conectar sala</Button>
          <Button variant="outline" disabled={connectionState !== "Conectado"} onClick={() => void advance()}>
            Avançar questão
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">Status: {connectionState}</p>
      </div>
    </AppShell>
  )
}
