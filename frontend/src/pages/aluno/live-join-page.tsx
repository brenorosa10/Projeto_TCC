import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type * as signalR from "@microsoft/signalr"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"
import { ItemAnswerForm } from "@/components/activity/item-answer-form"
import { ItemPrompt } from "@/components/activity/item-prompt"
import { LiveCountdown } from "@/components/activity/live-countdown"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichText } from "@/components/rich-text/rich-text"
import { api } from "@/lib/api"
import { createLiveHub, joinLiveAsStudent, liveSubmitAnswer } from "@/lib/live-hub"
import { cn } from "@/lib/utils"
import type { LiveSessionState, SubmitStudyAnswerRequest } from "@/lib/types"

export function AlunoLiveJoinPage() {
  const [pin, setPin] = useState("")
  const [joining, setJoining] = useState(false)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<LiveSessionState | null>(null)
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null)

  useEffect(() => {
    return () => {
      void connection?.stop()
    }
  }, [connection])

  async function handleJoin() {
    if (pin.length !== 6) {
      toast.error("Informe um PIN de 6 dígitos.")
      return
    }
    setJoining(true)
    try {
      const preview = await api.getLiveSessionByPin(pin)
      const hub = createLiveHub(setState)
      try {
        await joinLiveAsStudent(hub, pin)
      } catch (error) {
        await hub.stop()
        throw error
      }
      hub.onreconnected(() => {
        void joinLiveAsStudent(hub, pin).catch(() => undefined)
      })
      setConnection(hub)
      setState(preview)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar na sessão")
    } finally {
      setJoining(false)
    }
  }

  async function handleSubmit(payload: SubmitStudyAnswerRequest) {
    if (!connection) return
    setBusy(true)
    try {
      await liveSubmitAnswer(connection, payload)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a resposta")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Sessão ao vivo">
      {!state ? (
        <div className="mx-auto max-w-md space-y-6">
          <div>
            <h1 className="font-display text-3xl font-semibold">Entrar com PIN</h1>
            <p className="mt-2 text-muted-foreground">
              Digite o código de 6 dígitos que o professor mostrou na sala.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="live-pin">PIN</Label>
            <Input
              id="live-pin"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="839201"
              maxLength={6}
              className="font-mono tracking-widest"
            />
          </div>
          <Button type="button" disabled={joining} onClick={() => void handleJoin()}>
            {joining ? "Entrando..." : "Entrar na sessão"}
          </Button>
        </div>
      ) : (
        <StudentRoom state={state} busy={busy} onSubmit={(payload) => void handleSubmit(payload)} />
      )}
    </AppShell>
  )
}

function StudentRoom({
  state,
  busy,
  onSubmit,
}: {
  state: LiveSessionState
  busy: boolean
  onSubmit: (payload: SubmitStudyAnswerRequest) => void
}) {
  const hasAnswered = Boolean(state.personal?.hasAnswered)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {state.className} · PIN {state.pin}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">{state.activityTitle}</h1>
      </div>

      {state.phase === "lobby" ? (
        <div className="surface-card space-y-3 p-6">
          <p className="font-medium">Você está na sala.</p>
          <p className="text-sm text-muted-foreground">
            Aguarde o professor iniciar. {state.participants.length} participante(s) na lista.
          </p>
        </div>
      ) : null}

      {state.phase === "question" && state.currentItem ? (
        <div className="space-y-4">
          <div className="surface-card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <Badge variant="outline">
              Questão {state.itemIndex + 1} de {state.itemCount}
            </Badge>
            <LiveCountdown endsAt={state.questionEndsAt} active />
          </div>
          <div className="surface-card space-y-5 p-5 sm:p-6">
            <ItemPrompt item={state.currentItem} />
            {hasAnswered ? (
              <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
                Resposta enviada. Aguarde o restante da turma.
              </p>
            ) : (
              <ItemAnswerForm
                item={state.currentItem}
                busy={busy}
                onSubmit={onSubmit}
                submitLabel="Enviar"
              />
            )}
          </div>
        </div>
      ) : null}

      {state.phase === "reveal" ? (
        <div className="space-y-4">
          <div className="surface-card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <Badge variant="outline">
              Questão {state.itemIndex + 1} de {state.itemCount}
            </Badge>
            {state.reveal ? (
              <span className="text-muted-foreground">{state.reveal.accuracyPercent}% da sala acertou</span>
            ) : null}
          </div>
          {state.currentItem ? (
            <div className="surface-card space-y-4 p-5">
              <ItemPrompt item={state.currentItem} />
              <PersonalBanner personal={state.personal} />
              {state.currentItem.options?.length ? (
                <ul className="grid gap-2">
                  {state.currentItem.options.map((option) => (
                    <li
                      key={option.id}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm",
                        option.isCorrect
                          ? "border-success/40 bg-success/8"
                          : "border-border/70 bg-muted/30"
                      )}
                    >
                      <RichText value={option.text} className="text-sm" />
                    </li>
                  ))}
                </ul>
              ) : null}
              {state.reveal?.explanation ? (
                <RichText value={state.reveal.explanation} className="text-sm" />
              ) : null}
            </div>
          ) : null}
          {state.ranking ? (
            <ol className="surface-card grid gap-2 p-5 text-sm">
              <p className="font-display text-lg font-semibold">Ranking parcial</p>
              {state.ranking.slice(0, 8).map((entry, index) => (
                <li key={entry.studentId} className="flex justify-between">
                  <span>
                    {index + 1}. {entry.name}
                  </span>
                  <span className="text-muted-foreground">{entry.score} pts</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {state.phase === "ended" ? (
        <div className="surface-card space-y-4 p-6">
          <h2 className="font-display text-2xl font-semibold">Sessão encerrada</h2>
          {state.personal ? (
            <p className="text-muted-foreground">
              Você acertou {state.personal.correctCount} de {state.itemCount} e somou{" "}
              {state.personal.score} ponto(s).
            </p>
          ) : null}
          {state.mode === "quiz" && state.ranking ? (
            <ol className="grid gap-2 text-sm">
              {state.ranking.map((entry, index) => (
                <li key={entry.studentId} className="flex justify-between">
                  <span>
                    {index + 1}. {entry.name}
                  </span>
                  <span className="text-muted-foreground">{entry.score} pts</span>
                </li>
              ))}
            </ol>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/aluno">Voltar ao início</Link>
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PersonalBanner({ personal }: { personal?: LiveSessionState["personal"] }) {
  if (!personal?.hasAnswered || personal.isCorrect == null) return null
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        personal.isCorrect ? "border-success/30 bg-success/8" : "border-destructive/30 bg-destructive/8"
      )}
    >
      {personal.isCorrect ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
      )}
      <p className="font-medium">{personal.isCorrect ? "Você acertou." : "Você errou."}</p>
    </div>
  )
}
