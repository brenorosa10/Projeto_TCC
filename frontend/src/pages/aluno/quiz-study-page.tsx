import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowDown, ArrowUp } from "lucide-react"
import { PrepPanel } from "@/components/activity/prep-panel"
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
        <p className="text-muted-foreground">Carregando...</p>
      ) : !study ? (
        <p className="text-muted-foreground">Quiz não encontrado.</p>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to={backHref} className="hover:text-primary">
                {isGuest ? "Início" : "Estudar"}
              </Link>{" "}
              / {study.activityTitle}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{study.activityTitle}</h1>
          </div>

          {study.status === "prep" ? (
            <PrepPanel
              title={study.currentSection?.title}
              body={study.currentSection?.body}
              objectives={study.currentSection?.objectives}
              estimatedMinutes={study.currentSection?.estimatedMinutes}
              tips={study.currentSection?.tips}
              imageDataUrl={study.currentSection?.imageDataUrl}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {step} de {study.progress.practiceTotal}
        </span>
        <Badge variant="outline">{itemKindLabel(item.kind)}</Badge>
        {item.timeLimitSeconds ? <span>{item.timeLimitSeconds}s</span> : null}
      </div>

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
                    "h-auto w-full rounded-md border px-4 py-3 text-sm",
                    isCorrect && "border-primary bg-primary/10",
                    isWrongPick && "border-destructive bg-destructive/10"
                  )}
                >
                  {option.text}
                  {isCorrect ? " (correta)" : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {feedback ? (
        <div className="space-y-3">
          <p className={feedback.isCorrect ? "font-medium text-primary" : "font-medium text-destructive"}>
            {feedbackLabel(item.kind, feedback.isCorrect, feedback.remembered)}
          </p>
          {feedback.back ? (
            <p className="rounded-md border border-border bg-muted/30 px-4 py-3">{feedback.back}</p>
          ) : null}
          {feedback.explanation ? (
            <p className="text-sm text-muted-foreground">{feedback.explanation}</p>
          ) : null}
          <Button type="button" disabled={busy} onClick={onAdvance}>
            {study.progress.answeredCount >= study.progress.practiceTotal
              ? "Ver resultado"
              : "Próxima"}
          </Button>
        </div>
      ) : (
        <ItemAnswerForm item={item} busy={busy} onSubmit={onSubmit} />
      )}
    </div>
  )
}

function ItemPrompt({ item }: { item: StudySessionItem }) {
  const title = item.kind === "flashcard" ? item.front : item.prompt
  return (
    <div className="space-y-3">
      <p className="font-display text-xl font-semibold">{title}</p>
      {item.imageDataUrl ? (
        <img
          src={item.imageDataUrl}
          alt=""
          className="max-h-64 w-full rounded-lg border border-border object-contain bg-muted/30"
        />
      ) : null}
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
          className="flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-border bg-background px-6 py-8 text-center"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {flipped ? "Verso" : "Frente"}
          </p>
          <p className="mt-3 font-display text-2xl font-semibold">
            {flipped ? item.back || "—" : item.front}
          </p>
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
        />
        <Button
          type="button"
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
              <p className="rounded-md border border-border px-3 py-2">{entry.text}</p>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              <li key={id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
                <span className="flex-1">{entry.text}</span>
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
                className="inline-flex h-9 w-40"
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
              className="min-h-32 space-y-2 rounded-lg border border-dashed border-border p-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const memberId = event.dataTransfer.getData("text/plain")
                if (memberId) setPlacements((prev) => ({ ...prev, [memberId]: category.id }))
              }}
            >
              <p className="font-medium">{category.text}</p>
              <ul className="grid gap-2">
                {members
                  .filter((member) => placements[member.id] === category.id)
                  .map((member) => (
                    <li
                      key={member.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", member.id)}
                      className="cursor-grab rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      {member.text}
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
                className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center"
              >
                <span className="flex-1 cursor-grab">{member.text}</span>
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
      <ul className="grid gap-2">
        {options.map((option) => {
          const selected = selectedIds.includes(option.id)
          return (
            <li key={option.id}>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => toggle(option.id)}
                className={cn(
                  "h-auto w-full justify-start whitespace-normal px-4 py-3 text-left",
                  selected && "border-primary"
                )}
              >
                {option.text}
              </Button>
            </li>
          )
        })}
      </ul>
      <Button
        type="button"
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
    <div className="space-y-4 rounded-lg border border-border p-6">
      <Badge variant="secondary">Resultados</Badge>
      <h2 className="font-display text-xl font-semibold">
        {feedback?.title?.trim() || "Como você foi"}
      </h2>
      {feedback?.body?.trim() ? (
        <p className="whitespace-pre-wrap text-muted-foreground">{feedback.body}</p>
      ) : null}
      <p className="text-muted-foreground">
        Você acertou{" "}
        <span className="font-medium text-foreground">{feedback?.correctCount ?? study.progress.correctCount}</span>{" "}
        de{" "}
        <span className="font-medium text-foreground">{feedback?.total ?? study.progress.practiceTotal}</span>{" "}
        itens.
      </p>
      {feedback?.items?.length ? (
        <ul className="space-y-3">
          {feedback.items.map((item, index) => (
            <li key={item.itemId} className="rounded-md border border-border px-4 py-3 text-sm">
              <p className="font-medium">
                {index + 1}. {item.prompt || itemKindLabel(item.kind)}
              </p>
              <p className={item.isCorrect ? "mt-1 text-primary" : "mt-1 text-destructive"}>
                {item.isCorrect ? "Correto" : "Incorreto"}
                {item.remembered === true ? " · lembrado" : null}
                {item.remembered === false ? " · não lembrado" : null}
              </p>
              {item.explanation ? (
                <p className="mt-1 text-muted-foreground">{item.explanation}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={onRestart}>
          Refazer
        </Button>
        <Button asChild variant="outline">
          <Link to={backHref}>Voltar à lista</Link>
        </Button>
      </div>
    </div>
  )
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
