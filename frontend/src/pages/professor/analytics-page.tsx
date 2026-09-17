import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle, Users } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { api } from "@/lib/api"
import { liveSessionStatusLabel } from "@/lib/item-kinds"
import { cn } from "@/lib/utils"
import type { AnalyticsOverview, AnalyticsQuestion } from "@/lib/types"

export function ProfessorAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activityId = searchParams.get("activityId") ?? ""
  const sessionId = searchParams.get("sessionId") ?? ""
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getAnalytics(activityId || undefined, sessionId || undefined)
      .then(setData)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar analytics")
      )
      .finally(() => setLoading(false))
  }, [activityId, sessionId])

  function updateFilters(nextActivity: string, nextSession: string) {
    const params = new URLSearchParams()
    if (nextActivity) params.set("activityId", nextActivity)
    if (nextSession) params.set("sessionId", nextSession)
    setSearchParams(params)
  }

  const selectedActivity = activityId || data?.selectedActivityId || ""

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
                      {activity.title} ({activity.sessionCount} sessão(ões))
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

            {data.questions.length > 0 ? (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-semibold">Acertos por questão</h2>
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
                    <li key={session.id} className="surface-card space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{session.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {session.className} · PIN {session.pin} ·{" "}
                            {new Date(session.startedAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{liveSessionStatusLabel(session.status)}</Badge>
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to={`/professor/analytics?activityId=${session.activityId}&sessionId=${session.id}`}
                            >
                              Ver resultados
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {session.participants.length} participante(s)
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
          {question.correctCount} acerto(s) · {question.incorrectCount} erro(s) · {question.attempts}{" "}
          tentativa(s)
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
