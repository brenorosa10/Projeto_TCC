import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { RichText } from "@/components/rich-text/rich-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn, stripMarkdown } from "@/lib/utils"
import type { MatchingAnswerRequest, StudySessionItem, SubmitStudyAnswerRequest } from "@/lib/types"

export function ItemAnswerForm({
  item,
  busy,
  onSubmit,
  submitLabel = "Responder",
}: {
  item: StudySessionItem
  busy: boolean
  onSubmit: (payload: SubmitStudyAnswerRequest) => void
  submitLabel?: string
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
  const reflectionMin = item.explanationMinLength ?? 20
  const reflectionReady = !item.requireExplanation || textAnswer.trim().length >= reflectionMin

  function ReflectionField() {
    if (!item.requireExplanation) return null
    return (
      <div className="grid gap-2">
        <Label htmlFor={`reflection-${item.id}`}>
          {item.explanationPrompt || "Como você pensou sobre a resposta?"}
        </Label>
        <Textarea
          id={`reflection-${item.id}`}
          value={textAnswer}
          onChange={(event) => setTextAnswer(event.target.value)}
          minLength={reflectionMin}
          rows={4}
          placeholder="Explique o que pensou, indique sua confiança ou dúvidas..."
        />
        <p className="text-xs text-muted-foreground">
          {textAnswer.trim().length}/{reflectionMin} caracteres mínimos. Não entra na nota.
        </p>
      </div>
    )
  }

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
          {busy ? "Enviando..." : submitLabel}
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
                    {stripMarkdown(choice.text) || "Opção"}
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
          {busy ? "Enviando..." : submitLabel}
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
          {busy ? "Enviando..." : submitLabel}
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
          {busy ? "Enviando..." : submitLabel}
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
                      {stripMarkdown(category.text) || "Categoria"}
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
          {busy ? "Enviando..." : submitLabel}
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
      <ReflectionField />
      <Button
        type="button"
        size="lg"
        disabled={busy || selectedIds.length === 0 || !reflectionReady}
        onClick={() =>
          onSubmit({
            itemId: item.id,
            selectedOptionId: allowMultiple ? undefined : selectedIds[0],
            selectedOptionIds: allowMultiple ? selectedIds : undefined,
            textAnswer: item.requireExplanation ? textAnswer.trim() : undefined,
            responseTimeMs: elapsed(),
          })
        }
      >
        {busy ? "Enviando..." : submitLabel}
      </Button>
    </div>
  )
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
