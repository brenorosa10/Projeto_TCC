import { useEffect, useState } from "react"
import * as signalR from "@microsoft/signalr"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getApiBaseUrl } from "@/lib/api"
import { supabase } from "@/lib/supabase"

export function AlunoLiveJoinPage() {
  const [pin, setPin] = useState("")
  const [status, setStatus] = useState("Desconectado")
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null)

  useEffect(() => {
    return () => {
      void connection?.stop()
    }
  }, [connection])

  async function join() {
    if (pin.length !== 6) {
      toast.error("Informe um PIN de 6 dígitos.")
      return
    }

    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
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

    hub.on("QuestionAdvanced", () => {
      toast.message("Professor avançou a questão")
    })

    try {
      await hub.start()
      await hub.invoke("JoinSession", pin)
      setConnection(hub)
      setStatus("Na sala")
      toast.success(`Entrou na sessão ${pin}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao entrar na sessão")
    }
  }

  return (
    <AppShell title="Sessão ao vivo">
      <div className="max-w-md space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Entrar com PIN</h1>
          <p className="mt-2 text-muted-foreground">
            Stub do participante ao vivo via SignalR.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="live-pin">PIN</Label>
          <Input
            id="live-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="839201"
            maxLength={6}
            className="font-mono tracking-widest"
          />
        </div>
        <Button onClick={() => void join()}>Entrar na sessão</Button>
        <p className="text-sm text-muted-foreground">Status: {status}</p>
      </div>
    </AppShell>
  )
}
