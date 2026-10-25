import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import * as signalR from "@microsoft/signalr"
import { toast } from "sonner"
import { CheckCircle2, Hourglass, PartyPopper, Radio, Trophy, Users, XCircle } from "lucide-react"
import { AlternativeBody } from "@/components/activity/alternative-media"
import { CelebrationBurst } from "@/components/activity/celebration-burst"
import { VisualThemeFrame } from "@/components/activity/visual-theme"
import { ItemAnswerForm } from "@/components/activity/item-answer-form"
import { ItemPrompt } from "@/components/activity/item-prompt"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichText } from "@/components/rich-text/rich-text"
import { useAuth } from "@/contexts/auth-context"
import { createLiveHub, joinLiveAsStudent, liveSubmitAnswer } from "@/lib/live-hub"
import {
  clearStoredLiveJoin,
  presentedQuestionCount,
  readStoredLiveJoin,
  writeStoredLiveJoin,
} from "@/lib/live-session"
import { cn, plural } from "@/lib/utils"
import type { LiveSessionState, SubmitStudyAnswerRequest } from "@/lib/types"

export function AlunoLiveJoinPage() {
  const { profile } = useAuth()
  const [pin, setPin] = useState(() => readStoredLiveJoin()?.pin ?? "")
  const [joining, setJoining] = useState(() => readStoredLiveJoin() !== null)
  const [busy, setBusy] = useState(false)
  const [liveReady, setLiveReady] = useState(false)
  const [state, setState] = useState<LiveSessionState | null>(null)
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const queuedSubmit = useRef<SubmitStudyAnswerRequest | null>(null)
  const userIdRef = useRef(profile?.id)
  const autoJoinAttempted = useRef(false)
  userIdRef.current = profile?.id

  useEffect(() => {
    connectionRef.current = connection
  }, [connection])

  useEffect(() => {
    return () => {
      void connectionRef.current?.stop()
    }
  }, [])

  const join = useCallback(async (nextPin: string) => {
    if (nextPin.length !== 6) {
      toast.error("Informe um PIN de 6 dígitos.")
      return
    }
    setJoining(true)
    setLiveReady(false)
    try {
      await connectionRef.current?.stop()
      connectionRef.current = null
      setConnection(null)
      const hub = createLiveHub(setState)
      connectionRef.current = hub
      let joined: LiveSessionState
      try {
        joined = await joinLiveAsStudent(hub, nextPin)
      } catch (error) {
        connectionRef.current = null
        await hub.stop()
        throw error
      }
      hub.onreconnected(() => {
        void joinLiveAsStudent(hub, nextPin)
          .then((next) => {
            setState(next)
            if (next.phase === "ended") clearStoredLiveJoin()
          })
          .catch(() => undefined)
      })
      connectionRef.current = hub
      setConnection(hub)
      setState(joined)
      setLiveReady(true)
      setPin(nextPin)
      const userId = userIdRef.current
      if (userId && joined.phase !== "ended") {
        writeStoredLiveJoin({ pin: nextPin, userId })
      } else {
        clearStoredLiveJoin()
      }
    } catch (error) {
      clearStoredLiveJoin()
      setState(null)
      setConnection(null)
      setLiveReady(false)
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar na sessão")
    } finally {
      setJoining(false)
    }
  }, [])

  useEffect(() => {
    if (!profile || autoJoinAttempted.current) return
    const stored = readStoredLiveJoin()
    if (!stored) return
    autoJoinAttempted.current = true
    if (stored.userId !== profile.id) {
      clearStoredLiveJoin()
      setPin("")
      setJoining(false)
      return
    }
    setPin(stored.pin)
    void join(stored.pin)
  }, [join, profile])

  useEffect(() => {
    if (state?.phase === "ended") clearStoredLiveJoin()
  }, [state?.phase])

  async function resetSession() {
    clearStoredLiveJoin()
    await connectionRef.current?.stop()
    connectionRef.current = null
    setConnection(null)
    setState(null)
    setLiveReady(false)
    setBusy(false)
    queuedSubmit.current = null
    setPin("")
  }

  const handleSubmit = useCallback(async (payload: SubmitStudyAnswerRequest) => {
    const hub = connectionRef.current
    if (!hub || hub.state !== signalR.HubConnectionState.Connected) {
      queuedSubmit.current = payload
      return
    }
    queuedSubmit.current = null
    setBusy(true)
    try {
      await liveSubmitAnswer(hub, payload)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a resposta")
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!liveReady || !queuedSubmit.current) return
    const payload = queuedSubmit.current
    queuedSubmit.current = null
    void handleSubmit(payload)
  }, [handleSubmit, liveReady])

  return (
    <AppShell title="Sessão ao vivo">
      {!state ? (
        <JoinForm
          pin={pin}
          joining={joining}
          onPin={setPin}
          onJoin={() => void join(pin)}
        />
      ) : (
        <StudentRoom
          state={state}
          busy={busy}
          ready={liveReady}
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
  ready,
  onSubmit,
  onReset,
}: {
  state: LiveSessionState
  busy: boolean
  ready: boolean
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
            {plural(state.participants.length, "participante", "participantes")} na lista
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
          <VisualThemeFrame
            key={state.currentItem.id}
            theme={state.currentItem.visualTheme}
            className="surface-card animate-enter space-y-5 p-5 sm:p-6"
          >
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
                ready={ready}
                onSubmit={onSubmit}
                submitLabel="Enviar"
              />
            )}
          </VisualThemeFrame>
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
            <VisualThemeFrame
              key={`reveal-${state.currentItem.id}`}
              theme={state.currentItem.visualTheme}
              className="surface-card animate-enter space-y-4 p-5 sm:p-6"
            >
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
                          ? "animate-answer-glow border-success/40 bg-success/8"
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
                      <AlternativeBody
                        text={option.text}
                        imageUrl={option.imageUrl}
                        textClassName="text-sm"
                      />
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
            </VisualThemeFrame>
          ) : null}
          {state.ranking ? <Ranking entries={state.ranking.slice(0, 8)} title="Ranking parcial" /> : null}
        </div>
      ) : null}

      {state.phase === "ended" ? (
        <div className="space-y-5">
          <div className="surface-card relative overflow-hidden px-6 py-8 text-center">
            <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
            {isStrongFinish(state) ? <CelebrationBurst /> : null}
            <div className="relative space-y-4">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-astro-violet/12 text-astro-violet">
                <PartyPopper className="h-7 w-7" />
              </span>
              <h2 className="font-display text-2xl font-semibold">Sessão encerrada</h2>
              {state.personal ? (
                <EndedScore state={state} />
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
  const progress =
    state.itemCount > 0 && state.itemIndex >= 0
      ? ((state.itemIndex + 1) / state.itemCount) * 100
      : 0

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

      {state.phase !== "lobby" && !isEnded ? (
        <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </section>
  )
}

function EndedScore({ state }: { state: LiveSessionState }) {
  const presented = presentedQuestionCount(state)
  const answered = state.personal?.totalAnswered ?? 0
  const total = Math.max(presented, answered)
  const early = presented < state.itemCount
  if (!state.personal) return null

  return (
    <div className="mx-auto max-w-sm space-y-3">
      {total > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <ScoreTile label="Acertos" value={`${state.personal.correctCount}/${total}`} />
          <ScoreTile label="Pontos" value={String(state.personal.score)} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma questão foi apresentada.</p>
      )}
      {early && presented > 0 ? (
        <p className="text-sm text-muted-foreground">
          A sessão foi encerrada antes do fim.{" "}
          {presented === 1
            ? `Foi apresentada 1 de ${state.itemCount} questões.`
            : `Foram apresentadas ${presented} de ${state.itemCount} questões.`}
        </p>
      ) : null}
    </div>
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
              "animate-rank-in flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
              index === 0 ? "border-astro-amber/35 bg-astro-amber/8" : "border-border/70 bg-card"
            )}
            style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
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

function isStrongFinish(state: LiveSessionState) {
  const presented = presentedQuestionCount(state)
  const answered = state.personal?.totalAnswered ?? 0
  const total = Math.max(presented, answered)
  if (!state.personal || total <= 0) return false
  return state.personal.correctCount / total >= 0.8
}

function PersonalBanner({ personal }: { personal?: LiveSessionState["personal"] }) {
  if (!personal?.hasAnswered || personal.isCorrect == null) return null

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3.5",
        personal.isCorrect
          ? "animate-answer-glow border-success/30 bg-success/8"
          : "animate-shake border-destructive/30 bg-destructive/8"
      )}
    >
      {personal.isCorrect ? <CelebrationBurst /> : null}
      {personal.isCorrect ? (
        <CheckCircle2 className="relative h-6 w-6 shrink-0 animate-check-pop text-success" />
      ) : (
        <XCircle className="relative h-6 w-6 shrink-0 text-destructive" />
      )}
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold">
          {personal.isCorrect ? "Você acertou!" : "Você errou"}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className={cn(personal.isCorrect && "animate-score-bump inline-block font-semibold text-success")}>
            {plural(personal.correctCount, "acerto", "acertos")}
          </span>
          {" · "}
          <span className={cn(personal.isCorrect && "animate-score-bump inline-block font-semibold text-foreground")}>
            {plural(personal.score, "ponto", "pontos")}
          </span>{" "}
          até agora
        </p>
      </div>
    </div>
  )
}
