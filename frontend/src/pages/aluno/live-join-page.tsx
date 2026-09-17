import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import type * as signalR from "@microsoft/signalr"
import { toast } from "sonner"
import { CheckCircle2, Hourglass, PartyPopper, Radio, Trophy, Users, XCircle } from "lucide-react"
import { ItemAnswerForm } from "@/components/activity/item-answer-form"
import { ItemPrompt } from "@/components/activity/item-prompt"
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
  const connectionRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    connectionRef.current = connection
  }, [connection])

  useEffect(() => {
    return () => {
      void connectionRef.current?.stop()
    }
  }, [])

  async function handleJoin() {
    if (pin.length !== 6) {
      toast.error("Informe um PIN de 6 dígitos.")
      return
    }
    setJoining(true)
    try {
      await connectionRef.current?.stop()
      setConnection(null)
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
      connectionRef.current = hub
      setConnection(hub)
      setState(preview)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar na sessão")
    } finally {
      setJoining(false)
    }
  }

  async function resetSession() {
    await connectionRef.current?.stop()
    connectionRef.current = null
    setConnection(null)
    setState(null)
    setBusy(false)
    setPin("")
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
        <JoinForm
          pin={pin}
          joining={joining}
          onPin={setPin}
          onJoin={() => void handleJoin()}
        />
      ) : (
        <StudentRoom
          state={state}
          busy={busy}
          onSubmit={(payload) => void handleSubmit(payload)}
          onReset={() => void resetSession()}
        />
      )}
    </AppShell>
  )
}

function JoinForm({
  pin,
  joining,
  onPin,
  onJoin,
}: {
  pin: string
  joining: boolean
  onPin: (value: string) => void
  onJoin: () => void
}) {
  return (
    <form
      className="mx-auto max-w-md space-y-6 animate-fade-up"
      onSubmit={(event) => {
        event.preventDefault()
        onJoin()
      }}
    >
      <section className="surface-card relative overflow-hidden px-6 py-8 text-center">
        <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative space-y-3">
          <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-astro-sky/20 text-astro-navy">
            <span className="absolute inset-0 animate-soft-pulse rounded-full bg-astro-sky/30" aria-hidden />
            <Radio className="relative h-6 w-6" />
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Entrar com PIN</h1>
        </div>
      </section>

      <div className="surface-card space-y-4 p-5 sm:p-6">
        <div className="space-y-2">
          <Label htmlFor="live-pin">PIN da sala</Label>
          <Input
            id="live-pin"
            value={pin}
            onChange={(event) => onPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="839201"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="h-16 text-center font-mono text-3xl font-semibold tracking-[0.35em]"
          />
        </div>
        <Button type="submit" className="w-full" disabled={joining || pin.length !== 6}>
          {joining ? "Entrando..." : "Entrar na sessão"}
        </Button>
      </div>
    </form>
  )
}

function StudentRoom({
  state,
  busy,
  onSubmit,
  onReset,
}: {
  state: LiveSessionState
  busy: boolean
  onSubmit: (payload: SubmitStudyAnswerRequest) => void
  onReset: () => void
}) {
  const hasAnswered = Boolean(state.personal?.hasAnswered)

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
      <StudentHeader state={state} />

      {state.phase === "lobby" ? (
        <div className="surface-card flex flex-col items-center gap-3 px-6 py-12 text-center">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-astro-mint/30 text-astro-navy">
            <span className="absolute inset-0 animate-soft-pulse rounded-full bg-astro-mint/40" aria-hidden />
            <Hourglass className="relative h-6 w-6" />
          </span>
          <p className="font-display text-xl font-semibold">Você está na sala</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {state.participants.length} participante(s) na lista
          </span>
        </div>
      ) : null}

      {state.phase === "question" && state.currentItem ? (
        <div className="space-y-4">
          <div className="surface-card flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5">
            <Badge variant="outline">
              Questão {state.itemIndex + 1} de {state.itemCount}
            </Badge>
          </div>
          <div className="surface-card space-y-5 p-5 sm:p-6">
            <ItemPrompt item={state.currentItem} />
            {hasAnswered ? (
              <div className="flex items-center gap-3 rounded-xl border border-astro-sky/30 bg-astro-sky/8 px-4 py-3.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-astro-navy" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Resposta enviada</p>
                </div>
              </div>
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
          <div className="surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
            <Badge variant="outline">
              Questão {state.itemIndex + 1} de {state.itemCount}
            </Badge>
            {state.reveal ? (
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-success">{state.reveal.accuracyPercent}%</span>{" "}
                da sala acertou
              </span>
            ) : null}
          </div>
          {state.currentItem ? (
            <div className="surface-card space-y-4 p-5 sm:p-6">
              <PersonalBanner personal={state.personal} />
              <ItemPrompt item={state.currentItem} />
              {state.currentItem.options?.length ? (
                <ul className="grid gap-2">
                  {state.currentItem.options.map((option, index) => (
                    <li
                      key={option.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
                        option.isCorrect
                          ? "border-success/40 bg-success/8"
                          : "border-border/70 bg-muted/30"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          option.isCorrect
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <RichText value={option.text} className="min-w-0 flex-1 text-sm" />
                      {option.isCorrect ? (
                        <Badge variant="success" className="shrink-0">
                          correta
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {state.reveal?.explanation ? (
                <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                  <RichText value={state.reveal.explanation} className="text-sm" />
                </div>
              ) : null}
            </div>
          ) : null}
          {state.ranking ? <Ranking entries={state.ranking.slice(0, 8)} title="Ranking parcial" /> : null}
        </div>
      ) : null}

      {state.phase === "ended" ? (
        <div className="space-y-5">
          <div className="surface-card relative overflow-hidden px-6 py-8 text-center">
            <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
            <div className="relative space-y-4">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-astro-violet/12 text-astro-violet">
                <PartyPopper className="h-7 w-7" />
              </span>
              <h2 className="font-display text-2xl font-semibold">Sessão encerrada</h2>
              {state.personal ? (
                <div className="mx-auto grid max-w-sm gap-2 sm:grid-cols-2">
                  <ScoreTile
                    label="Acertos"
                    value={`${state.personal.correctCount}/${state.itemCount}`}
                  />
                  <ScoreTile label="Pontos" value={String(state.personal.score)} />
                </div>
              ) : null}
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button type="button" onClick={onReset}>
                  Entrar em outra sessão
                </Button>
                <Button asChild variant="outline">
                  <Link to="/aluno">Voltar ao início</Link>
                </Button>
              </div>
            </div>
          </div>
          {state.mode === "quiz" && state.ranking ? (
            <Ranking entries={state.ranking} title="Ranking final" />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function StudentHeader({ state }: { state: LiveSessionState }) {
  const isEnded = state.phase === "ended"
  const progress = state.itemCount > 0 ? ((state.itemIndex + 1) / state.itemCount) * 100 : 0

  return (
    <section className="surface-card relative overflow-hidden px-5 py-5 sm:px-6">
      <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
              isEnded ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isEnded ? "bg-muted-foreground" : "animate-soft-pulse bg-destructive"
              )}
              aria-hidden
            />
            {isEnded ? "Encerrada" : "Ao vivo"}
          </span>
          <Badge variant={state.mode === "prova" ? "warning" : "aluno"}>
            {state.mode === "prova" ? "Prova" : "Quiz"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {state.className} · PIN <span className="font-mono">{state.pin}</span>
          </span>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {state.activityTitle}
        </h1>
      </div>

      {state.phase !== "lobby" ? (
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-astro-sky to-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </section>
  )
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-semibold">{value}</p>
    </div>
  )
}

function Ranking({
  entries,
  title,
}: {
  entries: NonNullable<LiveSessionState["ranking"]>
  title: string
}) {
  if (!entries.length) return null

  return (
    <section className="surface-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Trophy className="h-4 w-4 text-astro-amber" />
        {title}
      </h2>
      <ol className="mt-3 grid gap-2">
        {entries.map((entry, index) => (
          <li
            key={entry.studentId}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
              index === 0 ? "border-astro-amber/35 bg-astro-amber/8" : "border-border/70 bg-card"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                index === 0 && "bg-astro-amber/20 text-astro-amber",
                index === 1 && "bg-astro-sky/25 text-astro-navy",
                index === 2 && "bg-astro-violet/12 text-astro-violet",
                index > 2 && "bg-muted text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              <span className="font-mono text-sm font-semibold text-foreground">{entry.score}</span>{" "}
              pts
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function PersonalBanner({ personal }: { personal?: LiveSessionState["personal"] }) {
  if (!personal?.hasAnswered || personal.isCorrect == null) return null

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3.5 animate-pop-in",
        personal.isCorrect
          ? "border-success/30 bg-success/8"
          : "border-destructive/30 bg-destructive/8"
      )}
    >
      {personal.isCorrect ? (
        <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
      ) : (
        <XCircle className="h-6 w-6 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold">
          {personal.isCorrect ? "Você acertou!" : "Você errou"}
        </p>
        <p className="text-xs text-muted-foreground">
          {personal.correctCount} acerto(s) · {personal.score} ponto(s) até agora
        </p>
      </div>
    </div>
  )
}
