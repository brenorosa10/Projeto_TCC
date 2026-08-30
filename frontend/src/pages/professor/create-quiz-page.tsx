import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { ItemImageField } from "@/components/activity/item-image-field"
import { PrepFeedbackFields } from "@/components/activity/prep-feedback-fields"
import { VisibilityCheckbox } from "@/components/activity/visibility-checkbox"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { assertActivityPayloadFits } from "@/lib/compress-image"
import { findSection, ITEM_KIND_LABELS, QUIZ_ITEM_KINDS } from "@/lib/item-kinds"
import { cn } from "@/lib/utils"
import type {
  ActivityItem,
  CreateActivityItemRequest,
  CreateActivityRequest,
  ItemKind,
} from "@/lib/types"

type DraftOption = { key: string; id?: string; text: string; isCorrect: boolean }
type DraftPair = { key: string; leftId?: string; rightId?: string; left: string; right: string }
type DraftLine = { key: string; id?: string; text: string }
type DraftCategory = { key: string; id?: string; label: string }
type DraftCategoryItem = { key: string; id?: string; text: string; categoryKey: string }
type DraftQuestion = {
  key: string
  id?: string
  kind: ItemKind
  prompt: string
  explanation: string
  timeLimitSeconds: number
  imageDataUrl?: string
  allowMultiple: boolean
  options: DraftOption[]
  correctTrue: boolean
  acceptedAnswers: string
  caseSensitive: boolean
  pairs: DraftPair[]
  orderEntries: DraftLine[]
  categories: DraftCategory[]
  categoryItems: DraftCategoryItem[]
}

function newLine(text = ""): DraftLine {
  return { key: crypto.randomUUID(), text }
}

function newCategory(label = ""): DraftCategory {
  return { key: crypto.randomUUID(), label }
}

function newCategoryItem(categoryKey: string): DraftCategoryItem {
  return { key: crypto.randomUUID(), text: "", categoryKey }
}

function lines(value: string | string[] | null | undefined) {
  const source = Array.isArray(value) ? value : value?.split("\n") ?? []
  return source.map((item) => item.trim()).filter(Boolean)
}

function newOption(isCorrect = false): DraftOption {
  return { key: crypto.randomUUID(), text: "", isCorrect }
}

function newPair(): DraftPair {
  return { key: crypto.randomUUID(), left: "", right: "" }
}

function newQuestion(kind: ItemKind = "multiple_choice"): DraftQuestion {
  const inner = newCategory("Interno")
  const outer = newCategory("Externo")
  return {
    key: crypto.randomUUID(),
    kind,
    prompt: "",
    explanation: "",
    timeLimitSeconds: 30,
    allowMultiple: false,
    options: [newOption(true), newOption(), newOption(), newOption()],
    correctTrue: true,
    acceptedAnswers: "",
    caseSensitive: false,
    pairs: [newPair(), newPair()],
    orderEntries: [newLine(), newLine(), newLine()],
    categories: kind === "categorize" ? [inner, outer] : [],
    categoryItems:
      kind === "categorize"
        ? [newCategoryItem(inner.key), newCategoryItem(inner.key), newCategoryItem(outer.key)]
        : [],
  }
}

function inferKind(item: ActivityItem): ItemKind {
  if (QUIZ_ITEM_KINDS.includes(item.kind as ItemKind) || item.kind === "flashcard") {
    return item.kind as ItemKind
  }
  if (item.orderEntries && item.orderEntries.length > 0) return "ordering"
  if (item.categories && item.categories.length > 0) return "categorize"
  if (item.clozeBlanks && item.clozeBlanks.length > 0) return "cloze"
  if (item.pairs && item.pairs.length > 0) return "matching"
  if (item.acceptedAnswers && item.acceptedAnswers.length > 0) return "short_answer"
  if (item.front || item.back) return "flashcard"
  return "multiple_choice"
}

function questionFromItem(item: ActivityItem): DraftQuestion {
  const kind = inferKind(item)
  const trueOption = item.options?.find((option) =>
    option.text.toLowerCase().startsWith("verdade")
  )
  const categories =
    item.categories && item.categories.length > 0
      ? item.categories.map((category) => ({
          key: category.id,
          id: category.id,
          label: category.label,
        }))
      : []
  return {
    key: item.id,
    id: item.id,
    kind,
    prompt: item.prompt ?? item.front ?? "",
    explanation: item.explanation ?? "",
    timeLimitSeconds: item.timeLimitSeconds ?? 30,
    imageDataUrl: item.imageDataUrl ?? undefined,
    allowMultiple: Boolean(item.allowMultiple),
    options:
      item.options && item.options.length > 0
        ? item.options.map((option) => ({
            key: option.id,
            id: option.id,
            text: option.text,
            isCorrect: Boolean(option.isCorrect),
          }))
        : [newOption(true), newOption(), newOption(), newOption()],
    correctTrue: trueOption ? Boolean(trueOption.isCorrect) : true,
    acceptedAnswers: (item.acceptedAnswers ?? []).join("\n"),
    caseSensitive: Boolean(item.caseSensitive),
    pairs:
      item.pairs && item.pairs.length > 0
        ? item.pairs.map((pair) => ({
            key: crypto.randomUUID(),
            leftId: pair.leftId,
            rightId: pair.rightId,
            left: pair.left,
            right: pair.right,
          }))
        : [newPair(), newPair()],
    orderEntries:
      item.orderEntries && item.orderEntries.length > 0
        ? item.orderEntries.map((entry) => ({ key: entry.id, id: entry.id, text: entry.text }))
        : [newLine(), newLine(), newLine()],
    categories,
    categoryItems:
      item.categoryItems?.map((member) => ({
        key: member.id,
        id: member.id,
        text: member.text,
        categoryKey: member.categoryId ?? categories[0]?.key ?? "",
      })) ?? [],
  }
}

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const next = index + delta
  if (next < 0 || next >= items.length) return items
  const copy = [...items]
  const [removed] = copy.splice(index, 1)
  copy.splice(next, 0, removed)
  return copy
}

function toItemPayload(question: DraftQuestion): CreateActivityItemRequest {
  const base: CreateActivityItemRequest = {
    id: question.id,
    kind: question.kind,
    prompt: question.prompt.trim(),
    explanation: question.explanation.trim() || undefined,
    timeLimitSeconds: question.timeLimitSeconds || 30,
    imageDataUrl: question.imageDataUrl,
  }

  if (question.kind === "true_false") {
    return { ...base, correctTrue: question.correctTrue }
  }
  if (question.kind === "short_answer") {
    return {
      ...base,
      acceptedAnswers: question.acceptedAnswers
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      caseSensitive: question.caseSensitive,
    }
  }
  if (question.kind === "matching") {
    return {
      ...base,
      pairs: question.pairs.map((pair) => ({
        leftId: pair.leftId,
        rightId: pair.rightId,
        left: pair.left.trim(),
        right: pair.right.trim(),
      })),
    }
  }
  if (question.kind === "ordering") {
    return {
      ...base,
      orderEntries: question.orderEntries.map((entry) => ({ id: entry.id, text: entry.text.trim() })),
    }
  }
  if (question.kind === "cloze") {
    return { ...base, caseSensitive: question.caseSensitive }
  }
  if (question.kind === "categorize") {
    return {
      ...base,
      categories: question.categories.map((category) => ({
        id: category.id ?? category.key,
        label: category.label.trim(),
      })),
      categoryItems: question.categoryItems.map((item) => {
        const category = question.categories.find((entry) => entry.key === item.categoryKey)
        return {
          id: item.id ?? item.key,
          text: item.text.trim(),
          categoryId: category?.id ?? category?.key,
        }
      }),
    }
  }
  return {
    ...base,
    allowMultiple: question.allowMultiple,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text.trim(),
      isCorrect: option.isCorrect,
    })),
  }
}

export function ProfessorCreateQuizPage() {
  const { activityId } = useParams()
  const isEditing = Boolean(activityId)
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [prepId, setPrepId] = useState<string>()
  const [practiceId, setPracticeId] = useState<string>()
  const [feedbackId, setFeedbackId] = useState<string>()
  const [prepTitle, setPrepTitle] = useState("")
  const [prepBody, setPrepBody] = useState("")
  const [prepObjectives, setPrepObjectives] = useState("")
  const [prepMinutes, setPrepMinutes] = useState("")
  const [prepTips, setPrepTips] = useState("")
  const [prepImageDataUrl, setPrepImageDataUrl] = useState<string>()
  const [feedbackTitle, setFeedbackTitle] = useState("Resultados")
  const [feedbackBody, setFeedbackBody] = useState("")
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!activityId) return
    api
      .getActivity(activityId)
      .then((activity) => {
        if (activity.type !== "quiz") {
          toast.error("Esta atividade não é um quiz.")
          navigate(`/professor/atividades/${activity.id}`, { replace: true })
          return
        }
        setTitle(activity.title)
        setIsPublic(Boolean(activity.isPublic))
        const prep = findSection(activity.sections, "prep")
        const practice = findSection(activity.sections, "practice")
        const feedback = findSection(activity.sections, "feedback")
        setPrepId(prep?.id)
        setPracticeId(practice?.id)
        setFeedbackId(feedback?.id)
        setPrepTitle(prep?.title ?? "")
        setPrepBody(prep?.body ?? "")
        setPrepObjectives((prep?.objectives ?? []).join("\n"))
        setPrepMinutes(prep?.estimatedMinutes ? String(prep.estimatedMinutes) : "")
        setPrepTips((prep?.tips ?? []).join("\n"))
        setPrepImageDataUrl(prep?.imageDataUrl ?? undefined)
        setFeedbackTitle(feedback?.title ?? "Resultados")
        setFeedbackBody(feedback?.body ?? "")
        setQuestions(
          activity.items.length > 0 ? activity.items.map(questionFromItem) : [newQuestion()]
        )
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar quiz")
        navigate("/professor/atividades")
      })
      .finally(() => setLoading(false))
  }, [activityId, navigate])

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function updateOption(questionKey: string, optionKey: string, text: string) {
    setQuestions((prev) =>
      prev.map((item) =>
        item.key === questionKey
          ? {
              ...item,
              options: item.options.map((option) =>
                option.key === optionKey ? { ...option, text } : option
              ),
            }
          : item
      )
    )
  }

  function markCorrect(questionKey: string, optionKey: string, allowMultiple: boolean) {
    setQuestions((prev) =>
      prev.map((item) => {
        if (item.key !== questionKey) return item
        return {
          ...item,
          options: item.options.map((option) => {
            if (allowMultiple) {
              return option.key === optionKey ? { ...option, isCorrect: !option.isCorrect } : option
            }
            return { ...option, isCorrect: option.key === optionKey }
          }),
        }
      })
    )
  }

  function addOption(questionKey: string) {
    setQuestions((prev) =>
      prev.map((item) =>
        item.key === questionKey && item.options.length < 6
          ? { ...item, options: [...item.options, newOption()] }
          : item
      )
    )
  }

  function removeOption(questionKey: string, optionKey: string) {
    setQuestions((prev) =>
      prev.map((item) => {
        if (item.key !== questionKey || item.options.length <= 2) return item
        const options = item.options.filter((option) => option.key !== optionKey)
        if (!options.some((option) => option.isCorrect)) {
          options[0] = { ...options[0], isCorrect: true }
        }
        return { ...item, options }
      })
    )
  }

  function buildPayload(): CreateActivityRequest | null {
    if (!title.trim()) {
      toast.error("Informe o título do quiz.")
      return null
    }

    for (const [index, question] of questions.entries()) {
      const n = index + 1
      if (question.kind !== "flashcard" && !question.prompt.trim()) {
        toast.error(`A questão ${n} precisa de um enunciado.`)
        return null
      }
      if (question.kind === "multiple_choice") {
        if (question.options.some((option) => !option.text.trim())) {
          toast.error(`Preencha todas as alternativas da questão ${n}.`)
          return null
        }
        const correctCount = question.options.filter((option) => option.isCorrect).length
        if (question.allowMultiple ? correctCount < 1 : correctCount !== 1) {
          toast.error(
            question.allowMultiple
              ? `Marque ao menos uma alternativa correta na questão ${n}.`
              : `Marque exatamente uma alternativa correta na questão ${n}.`
          )
          return null
        }
      }
      if (question.kind === "short_answer") {
        const answers = question.acceptedAnswers
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
        if (answers.length === 0) {
          toast.error(`Informe ao menos uma resposta aceita na questão ${n}.`)
          return null
        }
      }
      if (question.kind === "matching") {
        if (question.pairs.length < 2) {
          toast.error(`A questão ${n} precisa de pelo menos dois pares.`)
          return null
        }
        if (question.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) {
          toast.error(`Preencha os dois lados de cada par na questão ${n}.`)
          return null
        }
      }
      if (question.kind === "ordering") {
        if (question.orderEntries.length < 3 || question.orderEntries.some((entry) => !entry.text.trim())) {
          toast.error(`A questão ${n} precisa de pelo menos três itens preenchidos, na ordem correta.`)
          return null
        }
      }
      if (question.kind === "cloze" && !/\{\{[^}]+\}\}/.test(question.prompt)) {
        toast.error(`A questão ${n} precisa de lacunas no formato {{resposta}}.`)
        return null
      }
      if (question.kind === "categorize") {
        if (question.categories.length < 2 || question.categories.some((category) => !category.label.trim())) {
          toast.error(`A questão ${n} precisa de pelo menos duas categorias nomeadas.`)
          return null
        }
        if (question.categoryItems.length < 3 || question.categoryItems.some((item) => !item.text.trim())) {
          toast.error(`A questão ${n} precisa de pelo menos três itens classificados.`)
          return null
        }
      }
    }

    try {
      assertActivityPayloadFits([
        prepImageDataUrl,
        ...questions.map((question) => question.imageDataUrl),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Imagens grandes demais.")
      return null
    }

    return {
      title: title.trim(),
      type: "quiz",
      isPublic,
      sections: [
        {
          id: prepId,
          role: "prep",
          title: prepTitle.trim() || undefined,
          body: prepBody.trim() || undefined,
          objectives: lines(prepObjectives),
          estimatedMinutes: Number(prepMinutes) || undefined,
          tips: lines(prepTips),
          imageDataUrl: prepImageDataUrl,
        },
        {
          id: practiceId,
          role: "practice",
          items: questions.map(toItemPayload),
        },
        {
          id: feedbackId,
          role: "feedback",
          title: feedbackTitle.trim() || "Resultados",
          body: feedbackBody.trim() || undefined,
          feedbackTemplate: "score_summary",
        },
      ],
    }
  }

  async function saveQuiz(importCards: boolean) {
    const payload = buildPayload()
    if (!payload) return

    setSaving(true)
    try {
      const quiz =
        isEditing && activityId
          ? await api.updateActivity(activityId, payload)
          : await api.createActivity(payload)
      if (importCards) {
        const deck = await api.importFlashcards(quiz.id)
        toast.success(
          isEditing
            ? `Quiz atualizado. ${deck.itemCount} flashcard(s) sincronizados a partir das respostas corretas.`
            : `Quiz criado. ${deck.itemCount} flashcard(s) importados a partir das respostas corretas.`
        )
      } else {
        toast.success(isEditing ? "Quiz atualizado." : "Quiz criado. Vincule-o às turmas quando quiser.")
      }
      navigate(`/professor/atividades/${quiz.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar quiz")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title={isEditing ? "Editar quiz" : "Novo quiz"}>
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/professor/atividades" className="hover:text-primary">
                Atividades
              </Link>
              {isEditing && activityId ? (
                <>
                  {" "}
                  /{" "}
                  <Link to={`/professor/atividades/${activityId}`} className="hover:text-primary">
                    Detalhe
                  </Link>
                </>
              ) : null}{" "}
              / {isEditing ? "Editar quiz" : "Novo quiz"}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">
              {isEditing ? "Editar quiz" : "Criar quiz"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              Combine múltipla escolha, V/F, resposta curta, associação, ordenação, lacunas e
              categorias. A preparação e o feedback aparecem no estudo do aluno.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quiz-title">Título</Label>
            <Input
              id="quiz-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Sistema Solar"
              required
            />
          </div>

          <VisibilityCheckbox id="quiz-public" checked={isPublic} onChange={setIsPublic} />

          <PrepFeedbackFields
            prepTitle={prepTitle}
            prepBody={prepBody}
            prepObjectives={prepObjectives}
            prepMinutes={prepMinutes}
            prepTips={prepTips}
            prepImageDataUrl={prepImageDataUrl}
            feedbackTitle={feedbackTitle}
            feedbackBody={feedbackBody}
            onPrepTitle={setPrepTitle}
            onPrepBody={setPrepBody}
            onPrepObjectives={setPrepObjectives}
            onPrepMinutes={setPrepMinutes}
            onPrepTips={setPrepTips}
            onPrepImageDataUrl={setPrepImageDataUrl}
            onFeedbackTitle={setFeedbackTitle}
            onFeedbackBody={setFeedbackBody}
          />

          <div className="space-y-6">
            {questions.map((question, index) => (
              <section key={question.key} className="surface-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-6">
                  <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                      {index + 1}
                    </span>
                    Questão {index + 1}
                  </h2>
                  {questions.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setQuestions((prev) => prev.filter((item) => item.key !== question.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-5 p-4 sm:p-6">
                <div className="grid gap-2 sm:max-w-xs">
                  <Label htmlFor={`kind-${question.key}`}>Tipo</Label>
                  <select
                    id={`kind-${question.key}`}
                    className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                    value={question.kind}
                    onChange={(event) => {
                      const kind = event.target.value as ItemKind
                      updateQuestion(
                        question.key,
                        kind === "categorize" && question.categories.length === 0
                          ? {
                              kind,
                              ...(() => {
                                const next = newQuestion("categorize")
                                return {
                                  categories: next.categories,
                                  categoryItems: next.categoryItems,
                                }
                              })(),
                            }
                          : { kind }
                      )
                    }}
                  >
                    {QUIZ_ITEM_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {ITEM_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </div>

                {question.kind === "cloze" ? (
                  <div className="grid gap-2">
                    <Label htmlFor={`prompt-${question.key}`}>Enunciado</Label>
                    <Textarea
                      id={`prompt-${question.key}`}
                      value={question.prompt}
                      onChange={(event) =>
                        updateQuestion(question.key, { prompt: event.target.value })
                      }
                      placeholder="Júpiter é o {{maior}} planeta do {{Sistema Solar}}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lacunas usam texto simples para que o aluno digite a resposta.
                    </p>
                  </div>
                ) : (
                  <RichTextEditor
                    id={`prompt-${question.key}`}
                    label="Enunciado"
                    value={question.prompt}
                    onChange={(prompt) => updateQuestion(question.key, { prompt })}
                    rows={4}
                    placeholder={"Qual é a saída do programa abaixo?\n\n```python\nprint(sum(range(5)))\n```"}
                    hint="Você pode inserir blocos de código, listas e destaques no enunciado."
                  />
                )}

                <ItemImageField
                  id={`image-${question.key}`}
                  imageDataUrl={question.imageDataUrl}
                  onChange={(imageDataUrl) => updateQuestion(question.key, { imageDataUrl })}
                />

                {question.kind === "multiple_choice" ? (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">Alternativas</p>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--color-primary)]"
                          checked={question.allowMultiple}
                          onChange={(event) =>
                            updateQuestion(question.key, { allowMultiple: event.target.checked })
                          }
                        />
                        Permitir várias corretas
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Marque a alternativa correta à esquerda. Use crases para código:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono">`for i in x`</code>.
                    </p>
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={option.key}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                          option.isCorrect
                            ? "border-success/40 bg-success/6"
                            : "border-border/70 bg-muted/25"
                        )}
                      >
                        <input
                          type={question.allowMultiple ? "checkbox" : "radio"}
                          name={`correct-${question.key}`}
                          className="h-4 w-4 accent-[var(--color-success)]"
                          checked={option.isCorrect}
                          onChange={() =>
                            markCorrect(question.key, option.key, question.allowMultiple)
                          }
                          aria-label={`Marcar alternativa ${optionIndex + 1} como correta`}
                        />
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-muted-foreground">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <Input
                          value={option.text}
                          onChange={(event) =>
                            updateOption(question.key, option.key, event.target.value)
                          }
                          className="border-transparent bg-card"
                          placeholder={`Alternativa ${String.fromCharCode(65 + optionIndex)}`}
                        />
                        {question.options.length > 2 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remover alternativa"
                            onClick={() => removeOption(question.key, option.key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {question.options.length < 6 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addOption(question.key)}
                      >
                        <Plus className="h-4 w-4" />
                        Alternativa
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {question.kind === "true_false" ? (
                  <fieldset className="grid gap-2">
                    <legend className="text-sm font-medium">Resposta correta</legend>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`tf-${question.key}`}
                        checked={question.correctTrue}
                        onChange={() => updateQuestion(question.key, { correctTrue: true })}
                      />
                      Verdadeiro
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`tf-${question.key}`}
                        checked={!question.correctTrue}
                        onChange={() => updateQuestion(question.key, { correctTrue: false })}
                      />
                      Falso
                    </label>
                  </fieldset>
                ) : null}

                {question.kind === "short_answer" ? (
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor={`answers-${question.key}`}>
                        Respostas aceitas (uma por linha)
                      </Label>
                      <Textarea
                        id={`answers-${question.key}`}
                        value={question.acceptedAnswers}
                        onChange={(event) =>
                          updateQuestion(question.key, { acceptedAnswers: event.target.value })
                        }
                        placeholder={"Marte\nPlaneta Vermelho"}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={question.caseSensitive}
                        onChange={(event) =>
                          updateQuestion(question.key, { caseSensitive: event.target.checked })
                        }
                      />
                      Diferenciar maiúsculas e minúsculas
                    </label>
                  </div>
                ) : null}

                {question.kind === "matching" ? (
                  <div className="grid gap-3">
                    {question.pairs.map((pair, pairIndex) => (
                      <div key={pair.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <Input
                          value={pair.left}
                          onChange={(event) =>
                            updateQuestion(question.key, {
                              pairs: question.pairs.map((item) =>
                                item.key === pair.key ? { ...item, left: event.target.value } : item
                              ),
                            })
                          }
                          placeholder={`Esquerda ${pairIndex + 1}`}
                        />
                        <Input
                          value={pair.right}
                          onChange={(event) =>
                            updateQuestion(question.key, {
                              pairs: question.pairs.map((item) =>
                                item.key === pair.key ? { ...item, right: event.target.value } : item
                              ),
                            })
                          }
                          placeholder={`Direita ${pairIndex + 1}`}
                        />
                        {question.pairs.length > 2 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remover par"
                            onClick={() =>
                              updateQuestion(question.key, {
                                pairs: question.pairs.filter((item) => item.key !== pair.key),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuestion(question.key, { pairs: [...question.pairs, newPair()] })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Par
                    </Button>
                  </div>
                ) : null}

                {question.kind === "ordering" ? (
                  <div className="grid gap-3">
                    <p className="text-sm text-muted-foreground">
                      Liste os itens na ordem correta. O aluno verá a lista embaralhada.
                    </p>
                    {question.orderEntries.map((entry, entryIndex) => (
                      <div key={entry.key} className="flex items-center gap-2">
                        <span className="w-6 text-sm text-muted-foreground">{entryIndex + 1}.</span>
                        <Input
                          value={entry.text}
                          onChange={(event) =>
                            updateQuestion(question.key, {
                              orderEntries: question.orderEntries.map((item) =>
                                item.key === entry.key ? { ...item, text: event.target.value } : item
                              ),
                            })
                          }
                          placeholder={`Item ${entryIndex + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Subir"
                          disabled={entryIndex === 0}
                          onClick={() =>
                            updateQuestion(question.key, {
                              orderEntries: moveItem(question.orderEntries, entryIndex, -1),
                            })
                          }
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Descer"
                          disabled={entryIndex === question.orderEntries.length - 1}
                          onClick={() =>
                            updateQuestion(question.key, {
                              orderEntries: moveItem(question.orderEntries, entryIndex, 1),
                            })
                          }
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        {question.orderEntries.length > 3 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remover item"
                            onClick={() =>
                              updateQuestion(question.key, {
                                orderEntries: question.orderEntries.filter((item) => item.key !== entry.key),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuestion(question.key, {
                          orderEntries: [...question.orderEntries, newLine()],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Item
                    </Button>
                  </div>
                ) : null}

                {question.kind === "cloze" ? (
                  <div className="grid gap-3">
                    <p className="text-sm text-muted-foreground">
                      Marque cada lacuna com chaves duplas. Alternativas: {"{{Terra|planeta Terra}}"}.
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={question.caseSensitive}
                        onChange={(event) =>
                          updateQuestion(question.key, { caseSensitive: event.target.checked })
                        }
                      />
                      Diferenciar maiúsculas e minúsculas
                    </label>
                  </div>
                ) : null}

                {question.kind === "categorize" ? (
                  <div className="grid gap-4">
                    <div className="grid gap-3">
                      <p className="text-sm font-medium">Categorias</p>
                      {question.categories.map((category, categoryIndex) => (
                        <div key={category.key} className="flex items-center gap-2">
                          <Input
                            value={category.label}
                            onChange={(event) =>
                              updateQuestion(question.key, {
                                categories: question.categories.map((item) =>
                                  item.key === category.key ? { ...item, label: event.target.value } : item
                                ),
                              })
                            }
                            placeholder={`Categoria ${categoryIndex + 1}`}
                          />
                          {question.categories.length > 2 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remover categoria"
                              onClick={() =>
                                updateQuestion(question.key, {
                                  categories: question.categories.filter((item) => item.key !== category.key),
                                  categoryItems: question.categoryItems.map((item) =>
                                    item.categoryKey === category.key
                                      ? { ...item, categoryKey: question.categories.find((c) => c.key !== category.key)?.key ?? "" }
                                      : item
                                  ),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateQuestion(question.key, {
                            categories: [...question.categories, newCategory()],
                          })
                        }
                      >
                        <Plus className="h-4 w-4" />
                        Categoria
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      <p className="text-sm font-medium">Itens</p>
                      {question.categoryItems.map((item, itemIndex) => (
                        <div key={item.key} className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                          <Input
                            value={item.text}
                            onChange={(event) =>
                              updateQuestion(question.key, {
                                categoryItems: question.categoryItems.map((member) =>
                                  member.key === item.key ? { ...member, text: event.target.value } : member
                                ),
                              })
                            }
                            placeholder={`Item ${itemIndex + 1}`}
                          />
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={item.categoryKey}
                            onChange={(event) =>
                              updateQuestion(question.key, {
                                categoryItems: question.categoryItems.map((member) =>
                                  member.key === item.key
                                    ? { ...member, categoryKey: event.target.value }
                                    : member
                                ),
                              })
                            }
                          >
                            {question.categories.map((category) => (
                              <option key={category.key} value={category.key}>
                                {category.label.trim() || "Sem nome"}
                              </option>
                            ))}
                          </select>
                          {question.categoryItems.length > 3 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Remover item"
                              onClick={() =>
                                updateQuestion(question.key, {
                                  categoryItems: question.categoryItems.filter((member) => member.key !== item.key),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span />
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateQuestion(question.key, {
                            categoryItems: [
                              ...question.categoryItems,
                              newCategoryItem(question.categories[0]?.key ?? ""),
                            ],
                          })
                        }
                      >
                        <Plus className="h-4 w-4" />
                        Item
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 border-t border-border/70 pt-4">
                  <div className="grid max-w-56 gap-2">
                    <Label htmlFor={`time-${question.key}`}>Tempo sugerido (segundos)</Label>
                    <Input
                      id={`time-${question.key}`}
                      type="number"
                      min={5}
                      max={300}
                      value={question.timeLimitSeconds}
                      onChange={(event) =>
                        updateQuestion(question.key, {
                          timeLimitSeconds: Number(event.target.value) || 30,
                        })
                      }
                    />
                  </div>
                  <RichTextEditor
                    id={`expl-${question.key}`}
                    label="Explicação da resposta (opcional)"
                    value={question.explanation}
                    onChange={(explanation) => updateQuestion(question.key, { explanation })}
                    rows={3}
                    compact
                    placeholder="Explique por que essa é a resposta correta. Use `código` quando fizer sentido."
                    hint="Aparece no gabarito e na revisão item a item da pós-seção."
                  />
                </div>
                </div>
              </section>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full border-dashed"
            onClick={() => setQuestions((prev) => [...prev, newQuestion()])}
          >
            <Plus className="h-4 w-4" />
            Nova questão
          </Button>

          <div className="sticky bottom-4 z-10">
            <div className="surface-raised flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" disabled={saving} onClick={() => void saveQuiz(false)}>
                  {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar quiz"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => void saveQuiz(true)}
                >
                  {isEditing ? "Salvar e sincronizar flashcards" : "Importar flashcards"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground sm:ml-auto sm:max-w-xs">
                Importar flashcards usa questões de múltipla escolha ou V/F com alternativa correta.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
