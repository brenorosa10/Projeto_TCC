import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import type * as signalR from "@microsoft/signalr"
import { toast } from "sonner"
import { BarChart3, Radio, Users } from "lucide-react"
import { ItemPrompt } from "@/components/activity/item-prompt"
import { LiveCountdown } from "@/components/activity/live-countdown"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RichText } from "@/components/rich-text/rich-text"
import { api } from "@/lib/api"
import {
  createLiveHub,
  joinLiveAsHost,
  liveAdvance,
  liveEnd,
  liveStart,
} from "@/lib/live-hub"
import { cn } from "@/lib/utils"
import type { ActivitySummary, ClassRoom, LiveSessionState } from "@/lib/types"

export function ProfessorLivePage() {
  const [searchParams] = useSearchParams()
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "")
  const [activityId, setActivityId] = useState(searchParams.get("activityId") ?? "")
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<LiveSessionState | null>(null)
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null)
  const autoAdvanceKey = useRef<string | null>(null)

  useEffect(() => {
    Promise.all([api.listClasses(), api.listMyActivities()])
      .then(([classData, activityData]) => {
        setClasses(classData)
        setActivities(activityData.filter((item) => item.type === "quiz" || item.type === "prova"))
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar turmas e atividades")
      )
  }, [])

  useEffect(() => {
    return () => {
      void connection?.stop()
    }
  }, [connection])

  useEffect(() => {
    if (!state || state.phase !== "question" || !state.questionEndsAt || !connection) return
    const key = `${state.id}:${state.itemIndex}:${state.questionEndsAt}`
    if (autoAdvanceKey.current === key) return
    autoAdvanceKey.current = key
    const delay = new Date(state.questionEndsAt).getTime() - Date.now() + 250
    const timer = window.setTimeout(() => {
      void liveAdvance(connection).catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Não foi possível avançar")
      })
    }, Math.max(0, delay))
    return () => window.clearTimeout(timer)
  }, [connection, state])

  const linkedActivities = useMemo(
    () => activities.filter((item) => !classId || item.classIds?.includes(classId)),
    [activities, classId]
  )

  async function handleCreate() {
    if (!classId || !activityId) {
      toast.error("Escolha a turma e a atividade.")
      return
    }
    setCreating(true)
    try {
      const created = await api.createLiveSession({ classId, activityId })
      const hub = createLiveHub(setState)
      try {
        await joinLiveAsHost(hub, created.id)
      } catch (error) {
        await hub.stop()
        await api.endLiveSession(created.id).catch(() => undefined)
        throw error
      }
      hub.onreconnected(() => {
        void joinLiveAsHost(hub, created.id).catch(() => undefined)
      })
      setConnection(hub)
      setState(created)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a sessão")
    } finally {
      setCreating(false)
    }
  }

  async function run(action: () => Promise<void>, fallback: string) {
    if (!connection) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Sessão ao vivo">
      {!state ? (
        <SetupForm
          classes={classes}
          activities={linkedActivities}
          classId={classId}
          activityId={activityId}
          creating={creating}
          onClassId={setClassId}
          onActivityId={setActivityId}
          onCreate={() => void handleCreate()}
        />
      ) : (
        <HostRoom
          state={state}
          busy={busy}
          onStart={() => void run(() => liveStart(connection!), "Não foi possível iniciar")}
          onAdvance={() => void run(() => liveAdvance(connection!), "Não foi possível avançar")}
          onEnd={() => void run(() => liveEnd(connection!), "Não foi possível encerrar")}
        />
      )}
    </AppShell>
  )
}

function SetupForm({
  classes,
  activities,
  classId,
  activityId,
  creating,
  onClassId,
  onActivityId,
  onCreate,
}: {
  classes: ClassRoom[]
  activities: ActivitySummary[]
  classId: string
  activityId: string
  creating: boolean
  onClassId: (value: string) => void
  onActivityId: (value: string) => void
  onCreate: () => void
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Iniciar ao vivo</h1>
        <p className="mt-2 text-muted-foreground">
          Gere um PIN de 6 dígitos, aguarde os alunos na sala e avance as questões em sincronia.
        </p>
      </div>
      <div className="surface-card space-y-4 p-5">
        <div className="grid gap-2">
          <Label htmlFor="live-class">Turma</Label>
          <select
            id="live-class"
            className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            value={classId}
            onChange={(event) => onClassId(event.target.value)}
          >
            <option value="">Selecione...</option>
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="live-activity">Quiz ou prova</Label>
          <select
            id="live-activity"
            className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            value={activityId}
            onChange={(event) => onActivityId(event.target.value)}
          >
            <option value="">Selecione...</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.title} ({activity.type === "prova" ? "Prova" : "Quiz"})
              </option>
            ))}
          </select>
        </div>
        <Button type="button" disabled={creating || !classId || !activityId} onClick={onCreate}>
          {creating ? "Criando sala..." : "Criar sala"}
        </Button>
      </div>
    </div>
  )
}

function HostRoom({
  state,
  busy,
  onStart,
  onAdvance,
  onEnd,
}: {
  state: LiveSessionState
  busy: boolean
  onStart: () => void
  onAdvance: () => void
  onEnd: () => void
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {state.className} · {state.mode === "prova" ? "Prova" : "Quiz"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">{state.activityTitle}</h1>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/8 px-5 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">PIN</p>
          <p className="font-mono text-3xl font-semibold tracking-[0.3em]">{state.pin}</p>
        </div>
      </div>

      {state.phase === "lobby" ? (
        <div className="space-y-5">
          <ParticipantList participants={state.participants} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={onStart}>
              Começar
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onEnd}>
              Encerrar
            </Button>
          </div>
        </div>
      ) : null}

      {state.phase === "question" && state.currentItem ? (
        <div className="space-y-5">
          <QuestionMeta state={state} />
          <div className="surface-card space-y-5 p-5 sm:p-6">
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
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <RichText value={option.text} className="min-w-0 flex-1" />
                    {option.isCorrect ? (
                      <span className="text-xs font-medium text-success">correta</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Os alunos estão respondendo esta questão.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={onAdvance}>
              {state.mode === "quiz"
                ? "Revelar respostas"
                : state.itemIndex + 1 >= state.itemCount
                  ? "Encerrar sessão"
                  : "Próxima questão"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onEnd}>
              Encerrar
            </Button>
          </div>
        </div>
      ) : null}

      {state.phase === "reveal" ? (
        <div className="space-y-5">
          <QuestionMeta state={state} />
          {state.reveal ? <RevealCard state={state} /> : null}
          {state.ranking ? <RankingList ranking={state.ranking} /> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={onAdvance}>
              {state.itemIndex + 1 >= state.itemCount ? "Encerrar sessão" : "Próxima questão"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onEnd}>
              Encerrar agora
            </Button>
          </div>
        </div>
      ) : null}

      {state.phase === "ended" ? (
        <div className="space-y-5">
          <div className="surface-card space-y-3 p-5">
            <h2 className="font-display text-2xl font-semibold">Sessão encerrada</h2>
            <p className="text-muted-foreground">
              Os nomes dos participantes e os acertos/erros foram salvos no analytics.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={`/professor/analytics?activityId=${state.activityId}&sessionId=${state.id}`}>
                  <BarChart3 className="h-4 w-4" />
                  Ver analytics
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/professor/ao-vivo">Nova sessão</Link>
              </Button>
            </div>
          </div>
          <ParticipantList participants={state.participants} />
          {state.mode === "quiz" && state.ranking ? <RankingList ranking={state.ranking} /> : null}
        </div>
      ) : null}
    </div>
  )
}

function QuestionMeta({ state }: { state: LiveSessionState }) {
  return (
    <div className="surface-card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <Badge variant="outline">
        Questão {state.itemIndex + 1} de {state.itemCount}
      </Badge>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Users className="h-4 w-4" />
        {state.tally.answeredCount}/{state.tally.participantCount} responderam
      </span>
      <LiveCountdown endsAt={state.questionEndsAt} active={state.phase === "question"} />
    </div>
  )
}

function RevealCard({ state }: { state: LiveSessionState }) {
  const reveal = state.reveal
  if (!reveal) return null
  return (
    <div className="surface-card space-y-3 p-5">
      {state.currentItem ? <ItemPrompt item={state.currentItem} /> : null}
      <p className="text-sm">
        <span className="font-semibold text-success">{reveal.accuracyPercent}% de acerto</span>
        <span className="text-muted-foreground">
          {" "}
          · {reveal.correctCount} acertos, {reveal.incorrectCount} erros, {reveal.unansweredCount}{" "}
          sem resposta
        </span>
      </p>
      {reveal.explanation ? <RichText value={reveal.explanation} className="text-sm" /> : null}
    </div>
  )
}

function RankingList({ ranking }: { ranking: LiveSessionState["ranking"] }) {
  if (!ranking?.length) return null
  return (
    <section className="surface-card p-5">
      <h2 className="font-display text-lg font-semibold">Ranking</h2>
      <ol className="mt-3 grid gap-2">
        {ranking.map((entry, index) => (
          <li
            key={entry.studentId}
            className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm"
          >
            <span>
              <span className="mr-2 font-semibold text-muted-foreground">{index + 1}.</span>
              {entry.name}
            </span>
            <span className="text-muted-foreground">
              {entry.score} pts · {entry.correctCount} acerto(s)
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ParticipantList({ participants }: { participants: LiveSessionState["participants"] }) {
  return (
    <section className="surface-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Radio className="h-4 w-4" />
        Participantes ({participants.length})
      </h2>
      {participants.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aguardando alunos com o PIN.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {participants.map((participant) => (
            <li
              key={participant.studentId}
              className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm"
            >
              <span>{participant.name}</span>
              <span className={participant.isConnected ? "text-success" : "text-muted-foreground"}>
                {participant.isConnected ? "online" : "saiu"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

