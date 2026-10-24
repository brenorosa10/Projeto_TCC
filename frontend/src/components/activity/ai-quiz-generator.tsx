import { useState, type ReactNode } from "react"
import { Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { QUESTION_DIFFICULTIES } from "@/lib/content-blocks"
import { cn } from "@/lib/utils"
import type {
  AcceptedQuizGeneration,
  GeneratedFeedbackSection,
  GeneratedPrepSection,
  GeneratedQuizQuestion,
} from "@/lib/types"

type DraftOption = { key: string; text: string; isCorrect: boolean }
type ReviewQuestion = {
  key: string
  kind: "multiple_choice" | "true_false"
  prompt: string
  explanation: string
  options: DraftOption[]
}

type ReviewBundle = {
  questions: ReviewQuestion[]
  prep: GeneratedPrepSection
  feedback: GeneratedFeedbackSection
  applyPrep: boolean
  applyFeedback: boolean
}

const kinds = [
  { value: "mixed", label: "Mista" },
  { value: "multiple_choice", label: "Múltipla escolha" },
  { value: "true_false", label: "Verdadeiro ou falso" },
] as const

export function AiQuizGenerator({
  prepHasContent,
  feedbackHasContent,
  onAccept,
  className,
}: {
  prepHasContent: boolean
  feedbackHasContent: boolean
  onAccept: (result: AcceptedQuizGeneration) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [context, setContext] = useState("")
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState("")
  const [kind, setKind] = useState<(typeof kinds)[number]["value"]>("mixed")
  const [generating, setGenerating] = useState(false)
  const [review, setReview] = useState<ReviewBundle | null>(null)

  function resetReview() {
    setReview(null)
  }

  async function generate() {
    const topic = context.trim()
    if (topic.length < 10) {
      toast.error("Descreva o assunto com pelo menos algumas frases.")
      return
    }
    const quantity = Math.min(20, Math.max(1, Number(count) || 1))
    setCount(quantity)
    setGenerating(true)
    try {
      const response = await api.generateQuizQuestions({
        context: topic,
        count: quantity,
        difficulty: difficulty || undefined,
        kind: kind === "mixed" ? undefined : kind,
      })
      const questions = response.questions.map(toReview)
      if (questions.length === 0) {
        toast.error("A IA não devolveu questões válidas. Tente novamente.")
        return
      }
      setReview({
        questions,
        prep: {
          title: response.prep.title,
          body: response.prep.body,
          objectives: response.prep.objectives ?? [],
          estimatedMinutes: response.prep.estimatedMinutes,
          tips: response.prep.tips ?? [],
        },
        feedback: {
          title: response.feedback.title,
          body: response.feedback.body,
        },
        applyPrep: !prepHasContent,
        applyFeedback: !feedbackHasContent,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar as questões.")
    } finally {
      setGenerating(false)
    }
  }

  function updateQuestion(key: string, patch: Partial<ReviewQuestion>) {
    setReview((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question) =>
              question.key === key ? { ...question, ...patch } : question
            ),
          }
        : null
    )
  }

  function markCorrect(questionKey: string, optionKey: string) {
    setReview((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question) =>
              question.key === questionKey
                ? {
                    ...question,
                    options: question.options.map((option) => ({
                      ...option,
                      isCorrect: option.key === optionKey,
                    })),
                  }
                : question
            ),
          }
        : null
    )
  }

  function updateOption(questionKey: string, optionKey: string, text: string) {
    setReview((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question) =>
              question.key === questionKey
                ? {
                    ...question,
                    options: question.options.map((option) =>
                      option.key === optionKey ? { ...option, text } : option
                    ),
                  }
                : question
            ),
          }
        : null
    )
  }

  function removeQuestion(key: string) {
    setReview((current) =>
      current
        ? { ...current, questions: current.questions.filter((question) => question.key !== key) }
        : null
    )
  }

  function accept() {
    if (!review || review.questions.length === 0) {
      toast.error("Não há questões para adicionar.")
      return
    }
    const cleaned: GeneratedQuizQuestion[] = []
    for (const question of review.questions) {
      const prompt = question.prompt.trim()
      if (prompt.length < 8) {
        toast.error("Cada questão precisa de um enunciado.")
        return
      }
      const options = question.options
        .map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect }))
        .filter((option) => option.text.length > 0)
      if (question.kind === "true_false") {
        const correct = options.find((option) => option.isCorrect)
        if (!correct) {
          toast.error("Marque a resposta correta de cada questão.")
          return
        }
        cleaned.push({
          kind: "true_false",
          prompt,
          explanation: question.explanation.trim() || null,
          options: [
            { text: "Verdadeiro", isCorrect: correct.text.toLowerCase().startsWith("verd") },
            { text: "Falso", isCorrect: !correct.text.toLowerCase().startsWith("verd") },
          ],
        })
        continue
      }
      if (options.length < 2 || options.filter((option) => option.isCorrect).length !== 1) {
        toast.error("Cada múltipla escolha precisa de ao menos duas alternativas e uma correta.")
        return
      }
      cleaned.push({
        kind: "multiple_choice",
        prompt,
        explanation: question.explanation.trim() || null,
        options,
      })
    }
    const prep = review.applyPrep ? normalizePrep(review.prep) : null
    const feedback = review.applyFeedback ? normalizeFeedback(review.feedback) : null
    if (review.applyPrep && !prep) {
      toast.error("A pré-seção precisa de título e texto de abertura.")
      return
    }
    if (review.applyFeedback && !feedback) {
      toast.error("A pós-seção precisa de título e mensagem de encerramento.")
      return
    }
    onAccept({ questions: cleaned, prep, feedback })
    setOpen(false)
    setReview(null)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("h-12 w-full text-sm font-semibold sm:w-auto", className)}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-5 w-5" />
        Gerar perguntas com IA
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetReview()
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerar perguntas com IA</DialogTitle>
            <DialogDescription>
              Questões, pré-seção e pós-seção aparecem para revisão e só entram no quiz quando você
              confirmar. Nada é salvo sozinho.
            </DialogDescription>
          </DialogHeader>

          {review ? (
            <div className="space-y-4">
              <SectionReview
                title="Pré-seção"
                apply={review.applyPrep}
                occupied={prepHasContent}
                onApply={(applyPrep) => setReview({ ...review, applyPrep })}
              >
                <Label htmlFor="ai-prep-title">Título</Label>
                <Input
                  id="ai-prep-title"
                  value={review.prep.title}
                  onChange={(event) =>
                    setReview({ ...review, prep: { ...review.prep, title: event.target.value } })
                  }
                />
                <Label htmlFor="ai-prep-body">Texto de abertura</Label>
                <Textarea
                  id="ai-prep-body"
                  rows={4}
                  value={review.prep.body}
                  onChange={(event) =>
                    setReview({ ...review, prep: { ...review.prep, body: event.target.value } })
                  }
                />
                <Label htmlFor="ai-prep-objectives">Objetivos (um por linha)</Label>
                <Textarea
                  id="ai-prep-objectives"
                  rows={3}
                  value={review.prep.objectives.join("\n")}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      prep: { ...review.prep, objectives: splitLines(event.target.value) },
                    })
                  }
                />
                <Label htmlFor="ai-prep-tips">Dicas de estudo (uma por linha)</Label>
                <Textarea
                  id="ai-prep-tips"
                  rows={3}
                  value={review.prep.tips.join("\n")}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      prep: { ...review.prep, tips: splitLines(event.target.value) },
                    })
                  }
                />
                <Label htmlFor="ai-prep-minutes">Tempo estimado (minutos)</Label>
                <Input
                  id="ai-prep-minutes"
                  type="number"
                  min={1}
                  max={180}
                  value={review.prep.estimatedMinutes ?? ""}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      prep: {
                        ...review.prep,
                        estimatedMinutes: event.target.value ? Number(event.target.value) : null,
                      },
                    })
                  }
                />
              </SectionReview>
              <SectionReview
                title="Pós-seção"
                apply={review.applyFeedback}
                occupied={feedbackHasContent}
                onApply={(applyFeedback) => setReview({ ...review, applyFeedback })}
              >
                <Label htmlFor="ai-feedback-title">Título</Label>
                <Input
                  id="ai-feedback-title"
                  value={review.feedback.title}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      feedback: { ...review.feedback, title: event.target.value },
                    })
                  }
                />
                <Label htmlFor="ai-feedback-body">Mensagem de encerramento</Label>
                <Textarea
                  id="ai-feedback-body"
                  rows={4}
                  value={review.feedback.body}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      feedback: { ...review.feedback, body: event.target.value },
                    })
                  }
                />
              </SectionReview>
              {review.questions.map((question, index) => (
                <article key={question.key} className="space-y-2 rounded-xl border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      Questão {index + 1}
                      <span className="ml-1 font-normal text-muted-foreground">
                        · {question.kind === "true_false" ? "Verdadeiro ou falso" : "Múltipla escolha"}
                      </span>
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeQuestion(question.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                  <Label htmlFor={`ai-prompt-${question.key}`}>Enunciado</Label>
                  <Textarea
                    id={`ai-prompt-${question.key}`}
                    value={question.prompt}
                    onChange={(event) => updateQuestion(question.key, { prompt: event.target.value })}
                    rows={3}
                  />
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={option.key} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${question.key}`}
                          checked={option.isCorrect}
                          onChange={() => markCorrect(question.key, option.key)}
                          aria-label={`Marcar alternativa ${optionIndex + 1} como correta`}
                          className="h-4 w-4 accent-primary"
                        />
                        <Input
                          value={option.text}
                          onChange={(event) => updateOption(question.key, option.key, event.target.value)}
                          disabled={question.kind === "true_false"}
                          aria-label={`Alternativa ${optionIndex + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                  <Label htmlFor={`ai-explanation-${question.key}`}>Explicação</Label>
                  <Textarea
                    id={`ai-explanation-${question.key}`}
                    value={question.explanation}
                    onChange={(event) =>
                      updateQuestion(question.key, { explanation: event.target.value })
                    }
                    rows={2}
                  />
                </article>
              ))}
              {review.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma questão restante. Gere de novo ou feche.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-context">Contexto ou assunto</Label>
                <Textarea
                  id="ai-context"
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  rows={7}
                  maxLength={12000}
                  placeholder="Cole um trecho da aula ou descreva o tema. Ex.: características dos planetas rochosos do Sistema Solar."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="ai-count">Quantidade</Label>
                  <Input
                    id="ai-count"
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ai-kind">Tipo</Label>
                  <select
                    id="ai-kind"
                    value={kind}
                    onChange={(event) =>
                      setKind(event.target.value as (typeof kinds)[number]["value"])
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {kinds.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ai-difficulty">Dificuldade</Label>
                  <select
                    id="ai-difficulty"
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Variada</option>
                    {QUESTION_DIFFICULTIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {review ? (
              <Button type="button" variant="outline" disabled={generating} onClick={() => void generate()}>
                {generating ? "Gerando..." : "Gerar de novo"}
              </Button>
            ) : null}
            {review ? (
              <Button type="button" disabled={generating || review.questions.length === 0} onClick={accept}>
                Adicionar ao quiz
              </Button>
            ) : (
              <Button type="button" disabled={generating} onClick={() => void generate()}>
                {generating ? "Gerando..." : "Gerar questões"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SectionReview({
  title,
  apply,
  occupied,
  onApply,
  children,
}: {
  title: string
  apply: boolean
  occupied: boolean
  onApply: (value: boolean) => void
  children: ReactNode
}) {
  return (
    <section className="space-y-2 rounded-xl border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={apply}
            onChange={(event) => onApply(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {occupied ? "Substituir o conteúdo atual" : "Incluir no quiz"}
        </label>
      </div>
      {occupied ? (
        <p className="text-xs text-muted-foreground">
          Esta seção já tem texto. Sem a opção acima, o que está no quiz permanece. A imagem da
          pré-seção, se existir, não é trocada.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Desmarque para descartar esta sugestão.
        </p>
      )}
      {apply ? <div className="grid gap-2">{children}</div> : null}
    </section>
  )
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizePrep(prep: GeneratedPrepSection): GeneratedPrepSection | null {
  const title = prep.title.trim()
  const body = prep.body.trim()
  if (title.length < 2 || body.length < 10) return null
  const minutes = prep.estimatedMinutes
  return {
    title,
    body,
    objectives: prep.objectives.map((item) => item.trim()).filter(Boolean).slice(0, 8),
    tips: prep.tips.map((item) => item.trim()).filter(Boolean).slice(0, 8),
    estimatedMinutes: minutes && minutes >= 1 && minutes <= 180 ? Math.round(minutes) : null,
  }
}

function normalizeFeedback(feedback: GeneratedFeedbackSection): GeneratedFeedbackSection | null {
  const title = feedback.title.trim()
  const body = feedback.body.trim()
  if (title.length < 2 || body.length < 10) return null
  return { title, body }
}

function toReview(question: GeneratedQuizQuestion): ReviewQuestion {
  const kind = question.kind === "true_false" ? "true_false" : "multiple_choice"
  const options =
    kind === "true_false"
      ? [
          {
            key: crypto.randomUUID(),
            text: "Verdadeiro",
            isCorrect: question.options.some(
              (option) => option.isCorrect && option.text.toLowerCase().startsWith("verd")
            ),
          },
          {
            key: crypto.randomUUID(),
            text: "Falso",
            isCorrect: question.options.some(
              (option) => option.isCorrect && option.text.toLowerCase().startsWith("fals")
            ),
          },
        ]
      : question.options.map((option) => ({
          key: crypto.randomUUID(),
          text: option.text,
          isCorrect: option.isCorrect,
        }))
  if (!options.some((option) => option.isCorrect) && options[0]) {
    options[0] = { ...options[0], isCorrect: true }
  }
  return {
    key: crypto.randomUUID(),
    kind,
    prompt: question.prompt,
    explanation: question.explanation ?? "",
    options,
  }
}
