import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import type * as signalR from "@microsoft/signalr"
import { toast } from "sonner"
import {
  BarChart3,
  Check,
  Copy,
  Eye,
  MinusCircle,
  Play,
  Radio,
  SkipForward,
  Sparkles,
  Square,
  Trophy,
  Users,
  X,
} from "lucide-react"
import { ItemPrompt } from "@/components/activity/item-prompt"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
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
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<LiveSessionState | null>(null)
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null)
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const advancingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.listClasses(), api.listMyActivities()])
      .then(([classData, activityData]) => {
        if (cancelled) return
        setClasses(classData)
        setActivities(activityData.filter((item) => item.type === "quiz" || item.type === "prova"))
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar turmas e atividades")
      )
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    connectionRef.current = connection
  }, [connection])

  useEffect(() => {
    return () => {
      void connectionRef.current?.stop()
    }
  }, [])

  const linkedActivities = useMemo(
    () => activities.filter((item) => !classId || item.classIds?.includes(classId)),
    [activities, classId]
  )

  function handleClassId(value: string) {
    setClassId(value)
    setActivityId((current) => {
      if (!current) return current
      const stillValid = activities.some(
        (item) => item.id === current && (!value || item.classIds?.includes(value))
      )
      return stillValid ? current : ""
    })
  }

  async function handleCreate() {
    if (!classId || !activityId) {
      toast.error("Escolha a turma e a atividade.")
      return
    }
    const activity = activities.find((item) => item.id === activityId)
    if (activity && !activity.classIds?.includes(classId)) {
      toast.error("Vincule esta atividade à turma antes de iniciar ao vivo.")
      return
    }
    setCreating(true)
    try {
      await connectionRef.current?.stop()
      setConnection(null)
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
      connectionRef.current = hub
      setConnection(hub)
      setState(created)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a sessão")
    } finally {
      setCreating(false)
    }
  }

  async function resetSession() {
    advancingRef.current = false
    await connectionRef.current?.stop()
    connectionRef.current = null
    setConnection(null)
    setState(null)
    setBusy(false)
  }

  async function run(action: () => Promise<void>, fallback: string) {
    if (!connection || advancingRef.current) return
    advancingRef.current = true
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback)
    } finally {
      advancingRef.current = false
      setBusy(false)
    }
  }

  return (
    <AppShell title="Sessão ao vivo">
      {loading ? (
        <PageLoader className="mx-auto max-w-xl" rows={2} />
      ) : !state ? (
        <SetupForm
          classes={classes}
          activities={linkedActivities}
          classId={classId}
          activityId={activityId}
          creating={creating}
          onClassId={handleClassId}
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
          onReset={() => void resetSession()}
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
    <div className="mx-auto max-w-xl space-y-6 animate-fade-up">
      <section className="surface-card relative overflow-hidden px-6 py-7">
        <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-astro-violet/12 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-astro-violet">
            <Sparkles className="h-3.5 w-3.5" />
            Tempo real
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">
            Iniciar ao vivo
          </h1>
          <p className="text-muted-foreground text-pretty">
            Gere um PIN de 6 dígitos, aguarde os alunos na sala e avance as questões no seu ritmo.
          </p>
        </div>
      </section>

      <div className="surface-card space-y-5 p-5 sm:p-6">
        <div className="grid gap-2">
          <Label htmlFor="live-class">Turma</Label>
          <select
            id="live-class"
            className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:border-ring"
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
            className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:border-ring"
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
        {classes.length === 0 ? (
          <EmptyState
            title="Nenhuma turma ainda"
            description="Crie uma turma e vincule um quiz antes de iniciar uma sessão ao vivo."
          >
            <Button asChild>
              <Link to="/professor/turmas">Ir para turmas</Link>
            </Button>
          </EmptyState>
        ) : null}
        {classes.length > 0 && activities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Nenhum quiz vinculado a esta turma. Vincule uma atividade na página da turma.
          </p>
        ) : null}
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={creating || !classId || !activityId}
          onClick={onCreate}
        >
          <Radio className="h-4 w-4" />
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
  onReset,
}: {
  state: LiveSessionState
  busy: boolean
  onStart: () => void
  onAdvance: () => void
  onEnd: () => void
  onReset: () => void
}) {
  const isLastItem = state.itemIndex + 1 >= state.itemCount

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-up">
      <SessionHeader state={state} />

      {state.phase === "lobby" ? (
        <div className="space-y-5">
          <div className="surface-card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-astro-sky/20 text-astro-navy">
              <span className="absolute inset-0 animate-soft-pulse rounded-full bg-astro-sky/30" aria-hidden />
              <Radio className="relative h-6 w-6" />
            </span>
            <p className="font-display text-xl font-semibold">Sala aberta</p>
            <p className="max-w-md text-sm text-muted-foreground text-pretty">
              Projete o PIN para a turma. Os nomes aparecem aqui assim que os alunos entram.
            </p>
          </div>
          <ParticipantList participants={state.participants} />
          <ActionBar>
            <Button type="button" disabled={busy} onClick={onStart}>
              <Play className="h-4 w-4" />
              Começar
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onEnd}>
              <Square className="h-4 w-4" />
              Encerrar
            </Button>
          </ActionBar>
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
                      "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
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
                    <RichText value={option.text} className="min-w-0 flex-1" />
                    {option.isCorrect ? (
                      <Badge variant="success" className="shrink-0">
                        correta
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Os alunos estão respondendo esta questão.
              </p>
            )}
          </div>
          <ActionBar>
            <Button type="button" disabled={busy} onClick={onAdvance}>
              {state.mode === "quiz" ? (
                <>
                  <Eye className="h-4 w-4" />
                  Revelar respostas
                </>
              ) : isLastItem ? (
                <>
                  <Square className="h-4 w-4" />
                  Encerrar sessão
                </>
              ) : (
                <>
                  <SkipForward className="h-4 w-4" />
                  Próxima questão
                </>
              )}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onEnd}>
              Encerrar
            </Button>
          </ActionBar>
        </div>
      ) : null}

      {state.phase === "reveal" ? (
        <div className="space-y-5">
          <QuestionMeta state={state} />
          {state.reveal ? <RevealCard state={state} /> : null}
          {state.ranking ? <RankingList ranking={state.ranking} /> : null}
          <ActionBar>
            <Button type="button" disabled={busy} onClick={onAdvance}>
              {isLastItem ? (
                <>
                  <Square className="h-4 w-4" />
                  Encerrar sessão
                </>
              ) : (
                <>
                  <SkipForward className="h-4 w-4" />
                  Próxima questão
                </>
              )}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onEnd}>
              Encerrar agora
            </Button>
          </ActionBar>
        </div>
      ) : null}

      {state.phase === "ended" ? (
        <div className="space-y-5">
          <div className="surface-card relative overflow-hidden px-6 py-8 text-center">
            <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
            <div className="relative space-y-3">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/12 text-success">
                <Check className="h-7 w-7" />
              </span>
              <h2 className="font-display text-2xl font-semibold">Sessão encerrada</h2>
              <p className="mx-auto max-w-md text-muted-foreground text-pretty">
                Os nomes dos participantes e os acertos/erros foram salvos no analytics.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button asChild>
                  <Link to={`/professor/analytics?activityId=${state.activityId}&sessionId=${state.id}`}>
                    <BarChart3 className="h-4 w-4" />
                    Ver analytics
                  </Link>
                </Button>
                <Button type="button" variant="outline" onClick={onReset}>
                  Nova sessão
                </Button>
              </div>
            </div>
          </div>
          {state.mode === "quiz" && state.ranking ? <RankingList ranking={state.ranking} /> : null}
          <ParticipantList participants={state.participants} />
        </div>
      ) : null}
    </div>
  )
}

function SessionHeader({ state }: { state: LiveSessionState }) {
  const isEnded = state.phase === "ended"
  const progress = state.itemCount > 0 ? ((state.itemIndex + 1) / state.itemCount) * 100 : 0

  return (
    <section className="surface-card relative overflow-hidden px-5 py-5 sm:px-7 sm:py-6">
      <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-2">
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
            <span className="text-sm text-muted-foreground">{state.className}</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {state.activityTitle}
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {state.participants.length} participante(s) na sala
          </p>
        </div>
        <PinCard pin={state.pin} />
      </div>

      {state.phase !== "lobby" ? (
        <div className="relative mt-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Questão {state.itemIndex + 1} de {state.itemCount}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-astro-sky to-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function PinCard({ pin }: { pin: string }) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-astro-mint/15 to-transparent px-5 py-3 text-center shadow-[var(--shadow-soft)]">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        PIN
      </p>
      <p className="font-mono text-3xl font-semibold tracking-[0.28em] text-primary sm:text-4xl">
        {pin}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1 h-8"
        onClick={() => {
          void navigator.clipboard.writeText(pin).then(
            () => toast.success("PIN copiado."),
            () => toast.error("Não foi possível copiar o PIN.")
          )
        }}
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  )
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-card flex flex-wrap gap-2 p-3 sm:p-4">{children}</div>
  )
}

function QuestionMeta({ state }: { state: LiveSessionState }) {
  const { answeredCount, participantCount } = state.tally
  const percent = participantCount > 0 ? (answeredCount / participantCount) * 100 : 0

  return (
    <div className="surface-card space-y-3 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Users className="h-4 w-4 text-muted-foreground" />
          {answeredCount}/{participantCount} responderam
        </span>
        <span className="text-xs text-muted-foreground">
          {state.phase === "question"
            ? "A questão fica aberta até você avançar."
            : "Respostas reveladas para a turma."}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-astro-mint to-success transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function RevealCard({ state }: { state: LiveSessionState }) {
  const reveal = state.reveal
  if (!reveal) return null

  return (
    <div className="surface-card space-y-5 p-5 sm:p-6">
      {state.currentItem ? <ItemPrompt item={state.currentItem} /> : null}

      <div className="flex flex-wrap items-center gap-5">
        <AccuracyDonut percent={reveal.accuracyPercent} />
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
          <RevealStat
            icon={<Check className="h-4 w-4" />}
            label="Acertos"
            value={reveal.correctCount}
            tone="success"
          />
          <RevealStat
            icon={<X className="h-4 w-4" />}
            label="Erros"
            value={reveal.incorrectCount}
            tone="destructive"
          />
          <RevealStat
            icon={<MinusCircle className="h-4 w-4" />}
            label="Sem resposta"
            value={reveal.unansweredCount}
            tone="muted"
          />
        </div>
      </div>

      {reveal.explanation ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
          <RichText value={reveal.explanation} className="text-sm" />
        </div>
      ) : null}
    </div>
  )
}

function AccuracyDonut({ percent }: { percent: number }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-muted"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="text-success transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-semibold">{Math.round(clamped)}%</span>
        <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">acerto</span>
      </div>
    </div>
  )
}

function RevealStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: "success" | "destructive" | "muted"
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "success" && "border-success/30 bg-success/8",
        tone === "destructive" && "border-destructive/25 bg-destructive/8",
        tone === "muted" && "border-border/70 bg-muted/30"
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {icon}
        {label}
      </span>
      <p className="mt-0.5 font-display text-2xl font-semibold">{value}</p>
    </div>
  )
}

function RankingList({ ranking }: { ranking: LiveSessionState["ranking"] }) {
  if (!ranking?.length) return null

  return (
    <section className="surface-card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Trophy className="h-4 w-4 text-astro-amber" />
        Ranking
      </h2>
      <ol className="mt-3 grid gap-2">
        {ranking.map((entry, index) => (
          <li
            key={entry.studentId}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
              index === 0
                ? "border-astro-amber/35 bg-astro-amber/8"
                : "border-border/70 bg-card"
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
            <span className="shrink-0 text-right text-xs text-muted-foreground">
              <span className="font-mono text-sm font-semibold text-foreground">{entry.score}</span>{" "}
              pts · {entry.correctCount} acerto(s)
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
        <Users className="h-4 w-4 text-muted-foreground" />
        Participantes ({participants.length})
      </h2>
      {participants.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Aguardando alunos com o PIN.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {participants.map((participant) => (
            <li
              key={participant.studentId}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm animate-pop-in"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-astro-sky/20 text-xs font-bold text-astro-navy">
                {initials(participant.name)}
              </span>
              <span className="min-w-0 flex-1 truncate">{participant.name}</span>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1.5 text-xs font-medium",
                  participant.isConnected ? "text-success" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    participant.isConnected ? "bg-success" : "bg-muted-foreground"
                  )}
                  aria-hidden
                />
                {participant.isConnected ? "conectado" : "saiu"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
