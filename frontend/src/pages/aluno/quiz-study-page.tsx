import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, XCircle } from "lucide-react"
import { ContentBlockList } from "@/components/activity/content-block-list"
import { ItemAnswerForm } from "@/components/activity/item-answer-form"
import { ItemPrompt } from "@/components/activity/item-prompt"
import { PrepPanel } from "@/components/activity/prep-panel"
import { ResultPanel } from "@/components/activity/result-panel"
import { RichText } from "@/components/rich-text/rich-text"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { hasContentBlocks } from "@/lib/content-blocks"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { itemKindLabel } from "@/lib/item-kinds"
import { cn, stripMarkdown } from "@/lib/utils"
import type { StudySession, SubmitStudyAnswerRequest } from "@/lib/types"

export function AlunoQuizStudyPage() {
  const { activityId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { session: authSession } = useAuth()
  const isGuest = location.pathname.startsWith("/explorar") || !authSession
  const backHref = isGuest ? "/" : "/aluno/estudar"
  const [study, setStudy] = useState<StudySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [viewingPrep, setViewingPrep] = useState(false)
  const [cachedPrep, setCachedPrep] = useState<StudySession["currentSection"]>(null)

  useEffect(() => {
    if (!activityId) return
    let cancelled = false
    api
      .createStudySession({ activityId })
      .then((session) => {
        if (cancelled) return
        if (session.activityType === "flashcards") {
          navigate(
            isGuest
              ? `/explorar/flashcards/${activityId}`
              : `/aluno/estudar/flashcards/${activityId}`,
            { replace: true }
          )
          return
        }
        setStudy(session)
        setViewingPrep(false)
        if (session.status === "prep" && session.currentSection) {
          setCachedPrep(session.currentSection)
        } else {
          setCachedPrep(session.prepSection ?? null)
        }
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao iniciar o estudo")
      )
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activityId, isGuest, navigate])

  async function apply(action: () => Promise<StudySession>) {
    setBusy(true)
    try {
      const next = await action()
      setStudy(next)
      if (next.status === "prep" && next.currentSection) {
        setCachedPrep(next.currentSection)
      } else if (next.prepSection) {
        setCachedPrep(next.prepSection)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar")
    } finally {
      setBusy(false)
    }
  }

  async function restart() {
    if (!activityId) return
    setViewingPrep(false)
    await apply(() => api.createStudySession({ activityId, forceNew: true }))
  }

  const prepSection =
    study?.status === "prep" ? study.currentSection : study?.prepSection ?? cachedPrep
  const canReviewPrep = Boolean(prepSection) && study?.status !== "prep"
  const showingPrep = study?.status === "prep" || (viewingPrep && canReviewPrep)

  return (
    <AppShell title="Estudar quiz">
      {loading ? (
        <PageLoader />
      ) : !study ? (
        <EmptyState
          title="Quiz não encontrado"
          description="A atividade pode ter sido removida ou o link está incorreto."
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to={backHref} className="transition-colors hover:text-primary">
                {isGuest ? "Início" : "Estudar"}
              </Link>{" "}
              / {study.activityTitle}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-balance">
              {study.activityTitle}
            </h1>
            <StudyStepper
              status={study.status}
              viewingPrep={showingPrep && study.status !== "prep"}
              canOpenPrep={canReviewPrep}
              onOpenPrep={() => setViewingPrep(true)}
              onClosePrep={() => setViewingPrep(false)}
            />
          </div>

          {showingPrep ? (
            <PrepPanel
              title={prepSection?.title}
              body={prepSection?.body}
              objectives={prepSection?.objectives}
              estimatedMinutes={prepSection?.estimatedMinutes}
              tips={prepSection?.tips}
              imageDataUrl={prepSection?.imageDataUrl}
              itemCount={study.progress.practiceTotal}
              disabled={busy}
              actionLabel={
                study.status === "prep"
                  ? "Começar"
                  : study.status === "practice"
                    ? "Voltar às questões"
                    : "Voltar ao resultado"
              }
              fallbackBody="Revise o que você já sabe e, quando estiver pronto, comece as questões."
              onContinue={() => {
                if (study.status === "prep") {
                  void apply(() => api.advanceStudySession(study.id))
                  return
                }
                setViewingPrep(false)
              }}
            />
          ) : null}

          {study.status === "practice" && study.currentItem && !showingPrep ? (
            <PracticeView
              study={study}
              busy={busy}
              canReviewPrep={canReviewPrep}
              onReviewPrep={() => setViewingPrep(true)}
              onSubmit={(payload) =>
                void apply(() => api.submitStudySessionAnswer(study.id, payload))
              }
              onAdvance={() => void apply(() => api.advanceStudySession(study.id))}
            />
          ) : null}

          {(study.status === "feedback" || study.status === "completed") && !showingPrep ? (
            <FeedbackView
              study={study}
              backHref={backHref}
              busy={busy}
              canReviewPrep={canReviewPrep}
              onReviewPrep={() => setViewingPrep(true)}
              onRestart={() => void restart()}
            />
          ) : null}
        </div>
      )}
    </AppShell>
  )
}

function PracticeView({
  study,
  busy,
  canReviewPrep,
  onReviewPrep,
  onSubmit,
  onAdvance,
}: {
  study: StudySession
  busy: boolean
  canReviewPrep: boolean
  onReviewPrep: () => void
  onSubmit: (payload: SubmitStudyAnswerRequest) => void
  onAdvance: () => void
}) {
  const item = study.currentItem
  const feedback = study.currentItemFeedback
  if (!item) return null

  const step = Math.min(study.progress.answeredCount + (feedback ? 0 : 1), study.progress.practiceTotal)
  const progress = study.progress.practiceTotal
    ? (study.progress.answeredCount / study.progress.practiceTotal) * 100
    : 0

  return (
    <div className="space-y-5">
      <div className="surface-card space-y-3 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="font-semibold text-foreground">
            Questão {step}
            <span className="font-normal text-muted-foreground"> de {study.progress.practiceTotal}</span>
          </span>
          <Badge variant="outline">{itemKindLabel(item.kind)}</Badge>
          {item.difficulty ? (
            <Badge variant="outline" className="capitalize">
              {item.difficulty}
            </Badge>
          ) : null}
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {study.progress.correctCount} acerto(s)
          </span>
        </div>
        {canReviewPrep ? (
          <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8" onClick={onReviewPrep}>
            <ArrowLeft className="h-4 w-4" />
            Voltar à pré-seção
          </Button>
        ) : null}
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div key={item.id} className="surface-card animate-enter space-y-6 px-5 py-6 sm:px-7 sm:py-7">
        <ItemPrompt item={item} />

        {feedback && item.options && item.options.length > 0 ? (
          <ul className="grid gap-2">
            {item.options.map((option) => {
              const selected =
                feedback.selectedOptionId === option.id ||
                Boolean(feedback.selectedOptionIds?.includes(option.id))
              const isCorrect =
                feedback.correctOptionId === option.id ||
                Boolean(feedback.correctOptionIds?.includes(option.id))
              const isWrongPick = selected && !isCorrect

              return (
                <li key={option.id}>
                  <div
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm",
                      isCorrect && "border-success/40 bg-success/8",
                      isWrongPick && "border-destructive/40 bg-destructive/8",
                      !isCorrect && !isWrongPick && "border-border/70 bg-muted/30 opacity-70"
                    )}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success" />
                    ) : isWrongPick ? (
                      <XCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-destructive" />
                    ) : (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                    )}
                    <RichText value={option.text} className="min-w-0 flex-1 text-sm" />
                    {selected ? (
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        sua escolha
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {feedback ? (
          <div className="space-y-4">
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3.5",
                feedback.isCorrect
                  ? "border-success/30 bg-success/8"
                  : "border-destructive/30 bg-destructive/8"
              )}
            >
              {feedback.isCorrect ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 space-y-2">
                <p
                  className={cn(
                    "font-medium",
                    feedback.isCorrect ? "text-success" : "text-destructive"
                  )}
                >
                  {feedbackLabel(item.kind, feedback.isCorrect, feedback.remembered)}
                </p>
                {feedback.back ? <RichText value={feedback.back} className="text-sm" /> : null}
                {feedback.textAnswer ? (
                  <div className="rounded-lg border border-border/60 bg-card/70 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Sua reflexão
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{feedback.textAnswer}</p>
                  </div>
                ) : null}
                {feedback.feedbackMessages && feedback.feedbackMessages.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {feedback.feedbackMessages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
                <ContentBlockList blocks={feedback.feedbackBlocks} />
                {!hasContentBlocks(feedback.feedbackBlocks) &&
                !(feedback.feedbackMessages && feedback.feedbackMessages.length > 0) &&
                feedback.explanation ? (
                  <RichText value={feedback.explanation} className="text-sm" />
                ) : null}
              </div>
            </div>
            <Button type="button" size="lg" disabled={busy} onClick={onAdvance} className="group">
              {study.progress.answeredCount >= study.progress.practiceTotal
                ? "Ver resultado"
                : "Próxima questão"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        ) : (
          <ItemAnswerForm item={item} busy={busy} onSubmit={onSubmit} />
        )}
      </div>
    </div>
  )
}

function StudyStepper({
  status,
  viewingPrep,
  canOpenPrep,
  onOpenPrep,
  onClosePrep,
}: {
  status: string
  viewingPrep: boolean
  canOpenPrep: boolean
  onOpenPrep: () => void
  onClosePrep: () => void
}) {
  const steps = [
    { key: "prep", label: "Pré-seção" },
    { key: "practice", label: "Questões" },
    { key: "feedback", label: "Pós-seção" },
  ]
  const sessionIndex = status === "prep" ? 0 : status === "practice" ? 1 : 2
  const activeIndex = viewingPrep ? 0 : sessionIndex

  return (
    <ol className="mt-4 flex items-center gap-2 text-xs font-medium">
      {steps.map((step, index) => {
        const canSelectPrep = step.key === "prep" && canOpenPrep && !viewingPrep
        const canSelectPractice = step.key === "practice" && viewingPrep && sessionIndex === 1
        const canSelectFeedback = step.key === "feedback" && viewingPrep && sessionIndex === 2
        const interactive = canSelectPrep || canSelectPractice || canSelectFeedback

        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!interactive}
              onClick={
                canSelectPrep ? onOpenPrep : canSelectPractice || canSelectFeedback ? onClosePrep : undefined
              }
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors",
                index === activeIndex
                  ? "bg-primary text-primary-foreground"
                  : index < sessionIndex
                    ? "bg-success/12 text-success"
                    : "bg-muted text-muted-foreground",
                interactive && "cursor-pointer hover:opacity-90",
                !interactive && "cursor-default"
              )}
            >
              {index < sessionIndex && !viewingPrep ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[0.6rem]">
                  {index + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  index < sessionIndex ? "bg-success/40" : "bg-border"
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function FeedbackView({
  study,
  backHref,
  busy,
  canReviewPrep,
  onReviewPrep,
  onRestart,
}: {
  study: StudySession
  backHref: string
  busy: boolean
  canReviewPrep?: boolean
  onReviewPrep?: () => void
  onRestart: () => void
}) {
  const feedback = study.feedback
  return (
    <ResultPanel
      title={feedback?.title}
      body={feedback?.body}
      correctCount={feedback?.correctCount ?? study.progress.correctCount}
      total={feedback?.total ?? study.progress.practiceTotal}
      items={feedback?.items ?? []}
      itemLabel={(item) => stripMarkdown(item.prompt) || itemKindLabel(item.kind)}
      actions={
        <>
          <Button type="button" disabled={busy} onClick={onRestart}>
            <RotateCcw className="h-4 w-4" />
            Refazer atividade
          </Button>
          {canReviewPrep && onReviewPrep ? (
            <Button type="button" variant="outline" onClick={onReviewPrep}>
              <ArrowLeft className="h-4 w-4" />
              Ver pré-seção
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to={backHref}>Voltar à lista</Link>
          </Button>
        </>
      }
    />
  )
}

function feedbackLabel(kind: string, isCorrect: boolean, remembered?: boolean | null) {
  if (kind === "flashcard") {
    return remembered ? "Você marcou que lembrou." : "Você marcou que não lembrou."
  }
  return isCorrect ? "Você acertou." : "Resposta incorreta."
}
