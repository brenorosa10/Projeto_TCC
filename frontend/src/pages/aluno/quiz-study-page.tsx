import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, RotateCcw, XCircle } from "lucide-react"
import { PrepPanel } from "@/components/activity/prep-panel"
import { ResultPanel } from "@/components/activity/result-panel"
import { RichText } from "@/components/rich-text/rich-text"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { itemKindLabel } from "@/lib/item-kinds"
import { cn } from "@/lib/utils"
import type {
  MatchingAnswerRequest,
  StudySession,
  StudySessionItem,
  SubmitStudyAnswerRequest,
} from "@/lib/types"

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
      setStudy(await action())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar")
    } finally {
      setBusy(false)
    }
  }

  async function restart() {
    if (!activityId) return
    await apply(() => api.createStudySession({ activityId, forceNew: true }))
  }

  return (
    <AppShell title="Estudar quiz">
      {loading ? (
        <StudySkeleton />
      ) : !study ? (
        <p className="text-muted-foreground">Quiz não encontrado.</p>
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
            <StudyStepper status={study.status} />
          </div>

          {study.status === "prep" ? (
            <PrepPanel
              title={study.currentSection?.title}
              body={study.currentSection?.body}
              objectives={study.currentSection?.objectives}
              estimatedMinutes={study.currentSection?.estimatedMinutes}
              tips={study.currentSection?.tips}
              imageDataUrl={study.currentSection?.imageDataUrl}
              itemCount={study.progress.practiceTotal}
              disabled={busy}
              fallbackBody="Revise o que você já sabe e, quando estiver pronto, comece as questões."
              onContinue={() => void apply(() => api.advanceStudySession(study.id))}
            />
          ) : null}

          {study.status === "practice" && study.currentItem ? (
            <PracticeView
              study={study}
              busy={busy}
              onSubmit={(payload) =>
                void apply(() => api.submitStudySessionAnswer(study.id, payload))
              }
              onAdvance={() => void apply(() => api.advanceStudySession(study.id))}
            />
          ) : null}

          {study.status === "feedback" || study.status === "completed" ? (
            <FeedbackView
              study={study}
              backHref={backHref}
              busy={busy}
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
  onSubmit,
  onAdvance,
}: {
  study: StudySession
  busy: boolean
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
          {item.timeLimitSeconds ? (
            <span className="text-xs text-muted-foreground">sugestão: {item.timeLimitSeconds}s</span>
          ) : null}
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {study.progress.correctCount} acerto(s)
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-astro-sky to-primary transition-[width] duration-500 ease-out"
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
                {feedback.explanation ? (
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

function ItemPrompt({ item }: { item: StudySessionItem }) {
  const title = item.kind === "flashcard" ? item.front : item.prompt
  return (
    <div className="space-y-3">
      <RichText
        value={title}
        className="rich-text-prompt font-display text-xl font-semibold text-foreground sm:text-2xl"
      />
      {item.imageDataUrl ? (
        <img
          src={item.imageDataUrl}
          alt=""
          className="max-h-72 w-full rounded-xl border border-border object-contain bg-muted/30"
        />
      ) : null}
    </div>
  )
}

function StudyStepper({ status }: { status: string }) {
  const steps = [
    { key: "prep", label: "Pré-seção" },
    { key: "practice", label: "Questões" },
    { key: "feedback", label: "Pós-seção" },
  ]
  const activeIndex =
    status === "prep" ? 0 : status === "practice" ? 1 : 2

  return (
    <ol className="mt-4 flex items-center gap-2 text-xs font-medium">
      {steps.map((step, index) => (
        <li key={step.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors",
              index === activeIndex
                ? "bg-primary text-primary-foreground"
                : index < activeIndex
                  ? "bg-success/12 text-success"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {index < activeIndex ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[0.6rem]">
                {index + 1}
              </span>
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </span>
          {index < steps.length - 1 ? (
            <span
              className={cn(
                "h-px flex-1",
                index < activeIndex ? "bg-success/40" : "bg-border"
              )}
            />
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function StudySkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="skeleton h-9 w-2/3 rounded-lg" />
      <div className="skeleton h-10 w-full rounded-lg" />
      <div className="skeleton h-64 w-full rounded-xl" />
    </div>
  )
}

function ItemAnswerForm({
  item,
  busy,
  onSubmit,
}: {
  item: StudySessionItem
  busy: boolean
  onSubmit: (payload: SubmitStudyAnswerRequest) => void
}) {
  const startedAtRef = useRef(Date.now())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [textAnswer, setTextAnswer] = useState("")
  const [pairs, setPairs] = useState<Record<string, string>>({})
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [clozeAnswers, setClozeAnswers] = useState<Record<string, string>>({})
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    startedAtRef.current = Date.now()
    setSelectedIds([])
    setTextAnswer("")
    setPairs({})
    setOrderIds((item.orderItems ?? []).map((entry) => entry.id))
    setClozeAnswers({})
    setPlacements({})
    setFlipped(false)
  }, [item.id, item.orderItems])

  const elapsed = () => Date.now() - startedAtRef.current

  if (item.kind === "flashcard") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setFlipped((prev) => !prev)}
          className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-border bg-gradient-to-b from-card to-secondary/30 px-6 py-8 text-center shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {flipped ? "Verso" : "Frente"}
          </p>
          <RichText
            value={flipped ? item.back || "—" : item.front}
            className="rich-text-prompt mt-3 font-display text-2xl font-semibold"
          />
        </button>
        {flipped ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                onSubmit({ itemId: item.id, remembered: true, responseTimeMs: elapsed() })
              }
            >
              Lembrei
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                onSubmit({ itemId: item.id, remembered: false, responseTimeMs: elapsed() })
              }
            >
              Não lembrei
            </Button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setFlipped(true)}>
            Mostrar verso
          </Button>
        )}
      </div>
    )
  }

  if (item.kind === "short_answer") {
    return (
      <div className="space-y-3">
        <Label htmlFor={`answer-${item.id}`}>Sua resposta</Label>
        <Input
          id={`answer-${item.id}`}
          value={textAnswer}
          onChange={(event) => setTextAnswer(event.target.value)}
          placeholder="Digite a resposta"
          className="h-12 text-base"
        />
        <Button
          type="button"
          size="lg"
          disabled={busy || !textAnswer.trim()}
          onClick={() =>
            onSubmit({
              itemId: item.id,
              textAnswer: textAnswer.trim(),
              responseTimeMs: elapsed(),
            })
          }
        >
          {busy ? "Enviando..." : "Responder"}
        </Button>
      </div>
    )
  }

  if (item.kind === "matching") {
    const left = item.left ?? []
    const right = item.right ?? []
    const complete = left.length > 0 && left.every((entry) => pairs[entry.id])
    const payload: MatchingAnswerRequest[] = left
      .filter((entry) => pairs[entry.id])
      .map((entry) => ({ leftId: entry.id, rightId: pairs[entry.id] }))

    return (
      <div className="space-y-4">
        <ul className="grid gap-3">
          {left.map((entry) => (
            <li key={entry.id} className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-center">
              <div className="rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2.5">
                <RichText value={entry.text} className="text-sm" />
              </div>
              <select
                className="flex h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:border-ring"
                value={pairs[entry.id] ?? ""}
                onChange={(event) =>
                  setPairs((prev) => ({ ...prev, [entry.id]: event.target.value }))
                }
              >
                <option value="">Associar...</option>
                {right.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.text}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          disabled={busy || !complete}
          onClick={() => onSubmit({ itemId: item.id, pairs: payload, responseTimeMs: elapsed() })}
        >
          {busy ? "Enviando..." : "Responder"}
        </Button>
      </div>
    )
  }

  if (item.kind === "ordering") {
    const entries = item.orderItems ?? []
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Coloque os itens na ordem correta.</p>
        <ul className="grid gap-2">
          {orderIds.map((id, index) => {
            const entry = entries.find((item) => item.id === id)
            if (!entry) return null
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-xl border border-border/80 bg-card px-3 py-2.5 shadow-[var(--shadow-soft)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <RichText value={entry.text} className="min-w-0 flex-1 text-sm" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Subir"
                  disabled={index === 0}
                  onClick={() => setOrderIds((prev) => moveItem(prev, index, -1))}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Descer"
                  disabled={index === orderIds.length - 1}
                  onClick={() => setOrderIds((prev) => moveItem(prev, index, 1))}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </li>
            )
          })}
        </ul>
        <Button
          type="button"
          disabled={busy || orderIds.length === 0}
          onClick={() => onSubmit({ itemId: item.id, orderedIds: orderIds, responseTimeMs: elapsed() })}
        >
          {busy ? "Enviando..." : "Responder"}
        </Button>
      </div>
    )
  }

  if (item.kind === "cloze") {
    const blanks = item.clozeBlanks ?? []
    const segments = splitCloze(item.prompt ?? "", blanks)
    const complete = blanks.every((blank) => clozeAnswers[blank.id]?.trim())
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-2 text-lg leading-loose">
          {segments.map((segment, index) =>
            segment.type === "text" ? (
              <span key={index}>{segment.value}</span>
            ) : (
              <Input
                key={segment.id}
                value={clozeAnswers[segment.id] ?? ""}
                onChange={(event) =>
                  setClozeAnswers((prev) => ({ ...prev, [segment.id]: event.target.value }))
                }
                className="inline-flex h-9 w-40 rounded-lg border-b-2 border-primary/50 bg-accent/20 text-center font-medium"
                aria-label={`Lacuna ${index + 1}`}
              />
            )
          )}
        </div>
        <Button
          type="button"
          disabled={busy || !complete}
          onClick={() =>
            onSubmit({
              itemId: item.id,
              clozeAnswers: blanks.map((blank) => ({
                blankId: blank.id,
                text: clozeAnswers[blank.id]?.trim() ?? "",
              })),
              responseTimeMs: elapsed(),
            })
          }
        >
          {busy ? "Enviando..." : "Responder"}
        </Button>
      </div>
    )
  }

  if (item.kind === "categorize") {
    const categories = item.categories ?? []
    const members = item.categoryItems ?? []
    const complete = members.length > 0 && members.every((member) => placements[member.id])
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Arraste cada item para uma categoria, ou escolha no menu.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="min-h-32 space-y-2 rounded-xl border-2 border-dashed border-border bg-muted/25 p-3 transition-colors hover:border-primary/50"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const memberId = event.dataTransfer.getData("text/plain")
                if (memberId) setPlacements((prev) => ({ ...prev, [memberId]: category.id }))
              }}
            >
              <p className="text-sm font-semibold text-primary">{category.text}</p>
              <ul className="grid gap-2">
                {members
                  .filter((member) => placements[member.id] === category.id)
                  .map((member) => (
                    <li
                      key={member.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", member.id)}
                      className="cursor-grab rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-[var(--shadow-soft)] active:cursor-grabbing"
                    >
                      <RichText value={member.text} className="text-sm" />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <ul className="grid gap-2">
          {members
            .filter((member) => !placements[member.id])
            .map((member) => (
              <li
                key={member.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", member.id)}
                className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card px-3 py-2.5 sm:flex-row sm:items-center"
              >
                <RichText value={member.text} className="min-w-0 flex-1 cursor-grab text-sm" />
                <select
                  className="flex h-10 rounded-lg border border-input bg-card px-3 py-2 text-sm"
                  value=""
                  onChange={(event) =>
                    setPlacements((prev) => ({ ...prev, [member.id]: event.target.value }))
                  }
                >
                  <option value="">Categorizar...</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.text}
                    </option>
                  ))}
                </select>
              </li>
            ))}
        </ul>
        <Button
          type="button"
          disabled={busy || !complete}
          onClick={() =>
            onSubmit({
              itemId: item.id,
              categoryPlacements: members.map((member) => ({
                itemId: member.id,
                categoryId: placements[member.id],
              })),
              responseTimeMs: elapsed(),
            })
          }
        >
          {busy ? "Enviando..." : "Responder"}
        </Button>
      </div>
    )
  }

  const allowMultiple = Boolean(item.allowMultiple)
  const options = item.options ?? []

  function toggle(optionId: string) {
    setSelectedIds((prev) => {
      if (allowMultiple) {
        return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      }
      return [optionId]
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {allowMultiple ? "Selecione todas as alternativas corretas." : "Escolha uma alternativa."}
      </p>
      <ul className="grid gap-2.5">
        {options.map((option, index) => {
          const selected = selectedIds.includes(option.id)
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={selected}
                onClick={() => toggle(option.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-all",
                  "hover:border-primary/60 hover:shadow-[var(--shadow-soft)] disabled:pointer-events-none disabled:opacity-60",
                  selected
                    ? "border-primary bg-primary/6 shadow-[var(--shadow-soft)]"
                    : "border-border/80"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold transition-colors",
                    allowMultiple ? "rounded-md" : "rounded-full",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <RichText value={option.text} className="min-w-0 flex-1" />
              </button>
            </li>
          )
        })}
      </ul>
      <Button
        type="button"
        size="lg"
        disabled={busy || selectedIds.length === 0}
        onClick={() =>
          onSubmit({
            itemId: item.id,
            selectedOptionId: allowMultiple ? undefined : selectedIds[0],
            selectedOptionIds: allowMultiple ? selectedIds : undefined,
            responseTimeMs: elapsed(),
          })
        }
      >
        {busy ? "Enviando..." : "Responder"}
      </Button>
    </div>
  )
}

function FeedbackView({
  study,
  backHref,
  busy,
  onRestart,
}: {
  study: StudySession
  backHref: string
  busy: boolean
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
          <Button asChild variant="outline">
            <Link to={backHref}>Voltar à lista</Link>
          </Button>
        </>
      }
    />
  )
}

/** Plain-text preview of an authored prompt, for compact list rows. */
function stripMarkdown(value?: string | null) {
  return (value ?? "")
    .replace(/```[\s\S]*?```/g, " [código] ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function feedbackLabel(kind: string, isCorrect: boolean, remembered?: boolean | null) {
  if (kind === "flashcard") {
    return remembered ? "Você marcou que lembrou." : "Você marcou que não lembrou."
  }
  return isCorrect ? "Você acertou." : "Resposta incorreta."
}

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const next = index + delta
  if (next < 0 || next >= items.length) return items
  const copy = [...items]
  const [removed] = copy.splice(index, 1)
  copy.splice(next, 0, removed)
  return copy
}

function splitCloze(prompt: string, blanks: { id: string }[]) {
  const segments: Array<{ type: "text"; value: string } | { type: "blank"; id: string }> = []
  const regex = /\{\{([^}]+)\}\}/g
  let lastIndex = 0
  let blankIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: prompt.slice(lastIndex, match.index) })
    }
    const id = blanks[blankIndex]?.id ?? match[1]
    segments.push({ type: "blank", id })
    blankIndex += 1
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < prompt.length) {
    segments.push({ type: "text", value: prompt.slice(lastIndex) })
  }
  return segments
}
