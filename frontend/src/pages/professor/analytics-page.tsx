import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle, Users } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { api } from "@/lib/api"
import { liveSessionStatusLabel } from "@/lib/item-kinds"
import { cn, plural } from "@/lib/utils"
import type { AnalyticsOverview, AnalyticsQuestion, AnalyticsSessionSummary } from "@/lib/types"

export function ProfessorAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activityId = searchParams.get("activityId") ?? ""
  const sessionId = searchParams.get("sessionId") ?? ""
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)
  const [confirmEnd, setConfirmEnd] = useState<AnalyticsSessionSummary | null>(null)
  const [ending, setEnding] = useState(false)
  const hasData = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (!hasData.current) setLoading(true)
    api
      .getAnalytics(activityId || undefined, sessionId || undefined)
      .then((next) => {
        if (cancelled) return
        hasData.current = true
        setData(next)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Erro ao carregar analytics")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activityId, sessionId])

  useEffect(() => {
    if (!sessionId || loading) return
    document.getElementById("resultados-sessao")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [sessionId, loading])

  function updateFilters(nextActivity: string, nextSession: string) {
    const params = new URLSearchParams()
    if (nextActivity) params.set("activityId", nextActivity)
    if (nextSession) params.set("sessionId", nextSession)
    setSearchParams(params)
  }

  const selectedActivity = activityId || data?.selectedActivityId || ""
  const selectedSession =
    data?.sessions.find((session) => session.id === sessionId) ??
    (data?.selectedSessionId === sessionId
      ? data.sessions.find((session) => session.id === data.selectedSessionId)
      : undefined) ??
    null
  const sessionResultsReady = Boolean(sessionId) && data?.selectedSessionId === sessionId
  const sessionAttempts = sessionResultsReady
    ? data!.questions.reduce((sum, question) => sum + question.attempts, 0)
    : 0
  const sessionCorrect = sessionResultsReady
    ? data!.questions.reduce((sum, question) => sum + question.correctCount, 0)
    : 0

  async function handleEndSession() {
    if (!confirmEnd) return
    setEnding(true)
    try {
      await api.endLiveSession(confirmEnd.id)
      toast.success("Sessão encerrada.")
      setConfirmEnd(null)
      const next = await api.getAnalytics(activityId || undefined, sessionId || undefined)
      setData(next)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível encerrar a sessão")
    } finally {
      setEnding(false)
    }
  }

  return (
    <AppShell title="Analytics">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Painel analítico</h1>
        </div>

        {loading ? (
          <PageLoader />
        ) : !data || data.activities.length === 0 ? (
          <EmptyState
            title="Sem dados ainda"
            description="Realize uma sessão ao vivo para gerar métricas de acerto por questão."
          >
            <Button asChild>
              <Link to="/professor/ao-vivo">Iniciar sessão</Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Atividade</span>
                <select
                  className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                  value={selectedActivity}
                  onChange={(event) => updateFilters(event.target.value, "")}
                >
                  <option value="">Todas</option>
                  {data.activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.title} ({plural(activity.sessionCount, "sessão", "sessões")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Sessão</span>
                <select
                  className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                  value={sessionId}
                  onChange={(event) => updateFilters(selectedActivity, event.target.value)}
                  disabled={!selectedActivity}
                >
                  <option value="">Todas as sessões (geral)</option>
                  {data.sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      PIN {session.pin} · {session.className} ·{" "}
                      {new Date(session.startedAt).toLocaleString("pt-BR")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedSession ? (
              <section id="resultados-sessao" className="surface-card space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Resultados da sessão</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedSession.title} · {selectedSession.className} · PIN {selectedSession.pin}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Início em {new Date(selectedSession.startedAt).toLocaleString("pt-BR")}
                      {selectedSession.endedAt
                        ? ` · Encerrada em ${new Date(selectedSession.endedAt).toLocaleString("pt-BR")}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{liveSessionStatusLabel(selectedSession.status)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {plural(selectedSession.participants.length, "participante", "participantes")}
                  {sessionResultsReady
                    ? ` · ${plural(sessionAttempts, "resposta", "respostas")} · ${plural(sessionCorrect, "acerto", "acertos")}`
                    : ""}
                </p>
                {selectedSession.participants.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {selectedSession.participants.map((participant, index) => (
                      <li
                        key={`${participant.studentId}-${index}`}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs"
                      >
                        {participant.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Ninguém entrou nesta sessão.</p>
                )}
                {sessionResultsReady && sessionAttempts === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    Nenhuma resposta registrada nesta sessão.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {selectedSession.status !== "ended" ? (
                    <>
                      <Button asChild size="sm">
                        <Link to={`/professor/ao-vivo?sessionId=${selectedSession.id}`}>
                          Retomar sessão
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmEnd(selectedSession)}
                      >
                        Encerrar sessão
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => updateFilters(selectedActivity, "")}
                  >
                    Ver todas as sessões
                  </Button>
                </div>
              </section>
            ) : null}

            {data.questions.length > 0 ? (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-semibold">
                  {selectedSession ? `Acertos da sessão PIN ${selectedSession.pin}` : "Acertos por questão"}
                </h2>
                <ul className="grid gap-3">
                  {data.questions.map((question, index) => (
                    <QuestionCard
                      key={question.itemId}
                      index={index}
                      question={question}
                      open={openQuestion === question.itemId}
                      onToggle={() =>
                        setOpenQuestion((current) =>
                          current === question.itemId ? null : question.itemId
                        )
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : selectedActivity ? (
              <p className="text-sm text-muted-foreground">
                Ainda não há respostas ao vivo nesta atividade.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma atividade para ver o percentual de acerto de cada questão.
              </p>
            )}

            {data.sessions.length > 0 ? (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-semibold">Sessões e participantes</h2>
                <ul className="grid gap-3">
                  {data.sessions.map((session) => (
                    <li
                      key={session.id}
                      className={cn(
                        "surface-card space-y-3 p-4",
                        session.id === sessionId && "ring-2 ring-primary"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{session.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.className} · PIN {session.pin} ·{" "}
                            {new Date(session.startedAt).toLocaleString("pt-BR")}
                          </p>
                          {session.id === sessionId ? (
                            <p className="mt-1 text-xs font-medium text-primary">
                              Exibindo os resultados desta sessão.
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{liveSessionStatusLabel(session.status)}</Badge>
                          {session.status !== "ended" ? (
                            <>
                              <Button asChild size="sm">
                                <Link to={`/professor/ao-vivo?sessionId=${session.id}`}>Retomar</Link>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirmEnd(session)}
                              >
                                Encerrar
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => updateFilters(session.activityId, session.id)}
                          >
                            Ver resultados
                          </Button>
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {plural(session.participants.length, "participante", "participantes")}
                      </p>
                      {session.participants.length > 0 ? (
                        <ul className="flex flex-wrap gap-1.5">
                          {session.participants.map((participant, index) => (
                            <li
                              key={`${participant.studentId}-${index}`}
                              className="rounded-full bg-muted px-2.5 py-1 text-xs"
                            >
                              {participant.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">Ninguém entrou nesta sessão.</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={confirmEnd !== null} onOpenChange={(open) => { if (!open) setConfirmEnd(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar sessão?</DialogTitle>
            <DialogDescription>
              {confirmEnd
                ? `A sala PIN ${confirmEnd.pin} (${confirmEnd.className}) será encerrada. Os alunos não poderão mais entrar.`
                : "A sessão será encerrada."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmEnd(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={ending} onClick={() => void handleEndSession()}>
              {ending ? "Encerrando..." : "Encerrar sessão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

function QuestionCard({
  index,
  question,
  open,
  onToggle,
}: {
  index: number
  question: AnalyticsQuestion
  open: boolean
  onToggle: () => void
}) {
  return (
    <li
      className={cn(
        "surface-card overflow-hidden",
        question.highError && "border-destructive/40"
      )}
    >
      <button type="button" onClick={onToggle} className="w-full space-y-3 p-4 text-left">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Questão {index + 1}
            </p>
            <p className="mt-1 font-medium">{question.prompt || "Questão"}</p>
          </div>
          <div className="flex items-center gap-2">
            {question.highError ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Erro {question.errorPercent}%
              </Badge>
            ) : (
              <Badge variant="outline">{question.accuracyPercent}% acerto</Badge>
            )}
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              question.highError ? "bg-destructive" : "bg-success"
            )}
            style={{ width: `${question.accuracyPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {plural(question.correctCount, "acerto", "acertos")} · {plural(question.incorrectCount, "erro", "erros")} ·{" "}
          {plural(question.attempts, "tentativa", "tentativas")}
        </p>
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-border/70 px-4 py-4 sm:grid-cols-2">
          <NameList title="Acertaram" names={question.correctNames} empty="Ninguém acertou." />
          <NameList title="Erraram" names={question.incorrectNames} empty="Ninguém errou." />
        </div>
      ) : null}
    </li>
  )
}

function NameList({
  title,
  names,
  empty,
}: {
  title: string
  names: string[]
  empty: string
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      {names.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {names.map((name, index) => (
            <li key={`${name}-${index}`} className="rounded-full bg-muted px-2.5 py-1 text-xs">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
