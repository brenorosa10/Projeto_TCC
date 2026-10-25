import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileUp,
  ListChecks,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import {
  ContentBlockFields,
  blocksFromApi,
  type DraftBlock,
} from "@/components/activity/content-block-fields"
import { ItemImageField } from "@/components/activity/item-image-field"
import { OptionImageField } from "@/components/activity/option-image-field"
import { PrepFeedbackFields } from "@/components/activity/prep-feedback-fields"
import { QuestionPreview } from "@/components/activity/question-preview"
import { VisibilityCheckbox } from "@/components/activity/visibility-checkbox"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/ui/page-loader"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { activityEditorNav } from "@/lib/activity-editor-paths"
import { api } from "@/lib/api"
import { assertActivityPayloadFits } from "@/lib/compress-image"
import { isAcceptableImageUrl } from "@/lib/media-url"
import { cleanContentBlocks, flattenContentBlocks, QUESTION_DIFFICULTIES } from "@/lib/content-blocks"
import { findSection, ITEM_KIND_LABELS, QUIZ_ITEM_KINDS } from "@/lib/item-kinds"
import { ActivityCatalogFields } from "@/components/activity/activity-catalog-fields"
import { AiQuizGenerator } from "@/components/activity/ai-quiz-generator"
import { parseQuizCsv, type ImportedQuizQuestion } from "@/lib/quiz-csv-import"
import { cn } from "@/lib/utils"
import type {
  ActivityItem,
  CreateActivityItemRequest,
  CreateActivityRequest,
  AcceptedQuizGeneration,
  ItemKind,
} from "@/lib/types"

type DraftOption = {
  key: string
  id?: string
  text: string
  isCorrect: boolean
  imageUrl?: string
}
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
  imageDataUrl?: string
  imagePosition: "before" | "after"
  allowMultiple: boolean
  options: DraftOption[]
  correctTrue: boolean
  trueImageUrl?: string
  falseImageUrl?: string
  acceptedAnswers: string
  caseSensitive: boolean
  pairs: DraftPair[]
  orderEntries: DraftLine[]
  categories: DraftCategory[]
  categoryItems: DraftCategoryItem[]
  intro: DraftBlock[]
  promptBlocks: DraftBlock[]
  feedbackBlocks: DraftBlock[]
  feedbackMessages: string
  topics: string
  difficulty: string
  requireExplanation: boolean
  explanationMinLength: number
  explanationPrompt: string
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
    imagePosition: "after",
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
    intro: [],
    promptBlocks: [],
    feedbackBlocks: [],
    feedbackMessages: "",
    topics: "",
    difficulty: "",
    requireExplanation: false,
    explanationMinLength: 20,
    explanationPrompt: "Como você pensou sobre a resposta?",
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
    imageDataUrl: item.imageDataUrl ?? undefined,
    imagePosition: item.imagePosition === "before" ? "before" : "after",
    allowMultiple: Boolean(item.allowMultiple),
    options:
      item.options && item.options.length > 0
        ? item.options.map((option) => ({
            key: option.id,
            id: option.id,
            text: option.text,
            isCorrect: Boolean(option.isCorrect),
            imageUrl: option.imageUrl ?? undefined,
          }))
        : [newOption(true), newOption(), newOption(), newOption()],
    trueImageUrl: item.options?.find((option) => option.text.toLowerCase().startsWith("verdade"))
      ?.imageUrl ?? undefined,
    falseImageUrl: item.options?.find((option) => option.text.toLowerCase().startsWith("falso"))
      ?.imageUrl ?? undefined,
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
    intro: blocksFromApi(item.intro),
    promptBlocks: blocksFromApi(item.promptBlocks),
    feedbackBlocks: blocksFromApi(item.feedbackBlocks),
    feedbackMessages: (item.feedbackMessages ?? []).join("\n"),
    topics: (item.topics ?? []).join(", "),
    difficulty: item.difficulty ?? "",
    requireExplanation: Boolean(item.requireExplanation),
    explanationMinLength: item.explanationMinLength ?? 20,
    explanationPrompt: item.explanationPrompt ?? "Como você pensou sobre a resposta?",
  }
}

function questionFromGenerated(generated: AcceptedQuizGeneration["questions"][number]): DraftQuestion {
  const kind = generated.kind === "true_false" ? "true_false" : "multiple_choice"
  const question = newQuestion(kind)
  const correctTrue = generated.options.some(
    (option) => option.isCorrect && option.text.toLowerCase().startsWith("verd")
  )
  return {
    ...question,
    kind,
    prompt: generated.prompt,
    explanation: generated.explanation ?? "",
    correctTrue: kind === "true_false" ? correctTrue : question.correctTrue,
    allowMultiple: false,
    options:
      kind === "multiple_choice"
        ? generated.options.map((option) => ({
            key: crypto.randomUUID(),
            text: option.text,
            isCorrect: option.isCorrect,
          }))
        : question.options,
  }
}

function questionFromCsv(imported: ImportedQuizQuestion): DraftQuestion {
  const question = newQuestion("multiple_choice")
  return {
    ...question,
    kind: imported.kind,
    prompt: imported.prompt,
    allowMultiple: imported.allowMultiple,
    options: imported.options.map((option) => ({
      key: crypto.randomUUID(),
      text: option.text,
      isCorrect: option.isCorrect,
    })),
    intro: blocksFromApi(imported.intro),
    promptBlocks: blocksFromApi(imported.promptBlocks),
    feedbackBlocks: blocksFromApi(imported.feedbackBlocks),
    feedbackMessages: imported.feedbackMessages,
    topics: imported.topics,
    difficulty: imported.difficulty,
    requireExplanation: imported.requireExplanation,
    explanationMinLength: imported.explanationMinLength,
    explanationPrompt: imported.explanationPrompt,
  }
}

function isBlankQuestion(question: DraftQuestion) {
  return (
    !question.prompt.trim() &&
    !question.topics.trim() &&
    !question.feedbackMessages.trim() &&
    question.intro.every((block) => !block.content.trim()) &&
    question.promptBlocks.every((block) => !block.content.trim()) &&
    question.feedbackBlocks.every((block) => !block.content.trim()) &&
    question.options.every((option) => !option.text.trim() && !option.imageUrl?.trim()) &&
    !question.trueImageUrl?.trim() &&
    !question.falseImageUrl?.trim()
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

function toItemPayload(question: DraftQuestion): CreateActivityItemRequest {
  const intro = cleanContentBlocks(question.intro)
  const promptBlocks = cleanContentBlocks(question.promptBlocks)
  const feedbackBlocks = cleanContentBlocks(question.feedbackBlocks)
  const feedbackMessages = question.feedbackMessages
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const topics = question.topics
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean)
  const supportsReflection = question.kind === "multiple_choice" || question.kind === "true_false"
  const base: CreateActivityItemRequest = {
    id: question.id,
    kind: question.kind,
    prompt:
      question.prompt.trim() ||
      flattenContentBlocks([...(question.intro ?? []), ...(question.promptBlocks ?? [])]) ||
      undefined,
    explanation:
      question.explanation.trim() ||
      flattenContentBlocks(question.feedbackBlocks) ||
      feedbackMessages.join("\n\n") ||
      undefined,
    imageDataUrl: question.imageDataUrl,
    imagePosition: question.imagePosition,
    intro,
    promptBlocks,
    feedbackBlocks,
    feedbackMessages: feedbackMessages.length > 0 ? feedbackMessages : undefined,
    topics: topics.length > 0 ? topics : undefined,
    difficulty: question.difficulty || undefined,
    requireExplanation: supportsReflection ? question.requireExplanation : undefined,
    explanationMinLength:
      supportsReflection && question.requireExplanation ? question.explanationMinLength || 20 : undefined,
    explanationPrompt:
      supportsReflection && question.requireExplanation
        ? question.explanationPrompt.trim() || "Como você pensou sobre a resposta?"
        : undefined,
  }

  if (question.kind === "true_false") {
    const verdadeiro = question.options.find((option) =>
      option.text.toLowerCase().startsWith("verdade")
    )
    const falso = question.options.find((option) => option.text.toLowerCase().startsWith("falso"))
    return {
      ...base,
      correctTrue: question.correctTrue,
      options: [
        {
          id: verdadeiro?.id,
          text: "Verdadeiro",
          isCorrect: question.correctTrue,
          imageUrl: question.trueImageUrl?.trim() || undefined,
        },
        {
          id: falso?.id,
          text: "Falso",
          isCorrect: !question.correctTrue,
          imageUrl: question.falseImageUrl?.trim() || undefined,
        },
      ],
    }
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
      imageUrl: option.imageUrl?.trim() || undefined,
    })),
  }
}

function SaveQuizBar({
  saving,
  isEditing,
  onSave,
}: {
  saving: boolean
  isEditing: boolean
  onSave: () => void
}) {
  return (
    <div className="mt-4 border-t border-border/70 pt-4">
      <Button type="button" disabled={saving} onClick={onSave} className="h-12 w-full text-lg sm:w-auto">
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar quiz"}
      </Button>
    </div>
  )
}

export function ProfessorCreateQuizPage() {
  const { activityId } = useParams()
  const isEditing = Boolean(activityId)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const nav = activityEditorNav(profile?.role)
  const [title, setTitle] = useState("")
  const [theme, setTheme] = useState("")
  const [description, setDescription] = useState("")
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
  const [editorTab, setEditorTab] = useState<"geral" | "questoes">("geral")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questionPanel, setQuestionPanel] = useState<"pergunta" | "conteudo" | "feedback">("pergunta")
  const [previewQuestion, setPreviewQuestion] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!activityId) return
    api
      .getActivity(activityId)
      .then((activity) => {
        if (activity.type !== "quiz") {
          toast.error("Esta atividade não é um quiz.")
          navigate(nav.fallback(activity), { replace: true })
          return
        }
        setTitle(activity.title)
        setTheme(activity.theme ?? "")
        setDescription(activity.description ?? "")
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
        navigate(nav.home)
      })
      .finally(() => setLoading(false))
  }, [activityId, navigate, profile?.role])

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function patchOption(questionKey: string, optionKey: string, patch: Partial<DraftOption>) {
    setQuestions((prev) =>
      prev.map((item) =>
        item.key === questionKey
          ? {
              ...item,
              options: item.options.map((option) =>
                option.key === optionKey ? { ...option, ...patch } : option
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

  function goToQuestion(index: number, panel: "pergunta" | "conteudo" | "feedback" = "pergunta") {
    setEditorTab("questoes")
    setQuestionIndex(index)
    setQuestionPanel(panel)
  }

  function addQuestion() {
    const next = newQuestion()
    setQuestions((prev) => [...prev, next])
    setEditorTab("questoes")
    setQuestionIndex(questions.length)
    setQuestionPanel("pergunta")
  }

  function removeActiveQuestion() {
    if (questions.length <= 1) return
    const index = Math.min(questionIndex, questions.length - 1)
    setQuestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
    setQuestionIndex(Math.max(0, index - 1))
  }

  function appendGenerated(generated: AcceptedQuizGeneration) {
    const mapped = generated.questions.map(questionFromGenerated)
    const replaceBlank = questions.length === 1 && isBlankQuestion(questions[0])
    setQuestions(replaceBlank ? mapped : [...questions, ...mapped])
    if (generated.prep) {
      setPrepTitle(generated.prep.title)
      setPrepBody(generated.prep.body)
      setPrepObjectives(generated.prep.objectives.join("\n"))
      setPrepMinutes(generated.prep.estimatedMinutes ? String(generated.prep.estimatedMinutes) : "")
      setPrepTips(generated.prep.tips.join("\n"))
    }
    if (generated.feedback) {
      setFeedbackTitle(generated.feedback.title)
      setFeedbackBody(generated.feedback.body)
    }
    if (generated.theme && !theme.trim()) {
      setTheme(generated.theme)
    }
    setEditorTab("questoes")
    setQuestionIndex(replaceBlank ? 0 : questions.length)
    setQuestionPanel("pergunta")
    const sections = [
      generated.prep ? "pré-seção" : null,
      generated.feedback ? "pós-seção" : null,
    ].filter(Boolean)
    const sectionNote =
      sections.length > 0 ? ` ${sections.join(" e ")} atualizada${sections.length > 1 ? "s" : ""}.` : ""
    toast.success(
      (mapped.length === 1 ? "1 questão adicionada." : `${mapped.length} questões adicionadas.`) +
        sectionNote +
        " Revise e salve o quiz quando quiser."
    )
  }

  async function importCsvFile(file: File) {
    try {
      const imported = parseQuizCsv(await file.text())
      if (imported.length === 0) {
        toast.error("Nenhuma questão compatível encontrada no CSV.")
        return
      }
      const mapped = imported.map(questionFromCsv)
      setQuestions((current) =>
        current.length === 1 && isBlankQuestion(current[0]) ? mapped : [...current, ...mapped]
      )
      if (!title.trim() && imported[0]?.title) {
        setTitle(imported[0].title)
      }
      setEditorTab("questoes")
      setQuestionIndex(0)
      setQuestionPanel("pergunta")
      toast.success(
        mapped.length === 1 ? "1 questão importada." : `${mapped.length} questões importadas.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar o CSV.")
    }
  }

  function buildPayload(): CreateActivityRequest | null {
    if (!title.trim()) {
      toast.error("Informe o título do quiz.")
      setEditorTab("geral")
      return null
    }

    for (const [index, question] of questions.entries()) {
      const n = index + 1
      const hasPrompt =
        question.prompt.trim() ||
        question.intro.some((block) => block.content.trim()) ||
        question.promptBlocks.some((block) => block.content.trim())
      if (question.kind !== "flashcard" && !hasPrompt) {
        toast.error(`A questão ${n} precisa de um enunciado ou de blocos de conteúdo.`)
        goToQuestion(index)
        return null
      }
      if (
        (question.kind === "multiple_choice" || question.kind === "true_false") &&
        question.requireExplanation &&
        (question.explanationMinLength < 1 || question.explanationMinLength > 2000)
      ) {
        toast.error(`O mínimo da reflexão da questão ${n} deve ficar entre 1 e 2000 caracteres.`)
        goToQuestion(index, "feedback")
        return null
      }
      if (question.kind === "multiple_choice") {
        for (const [optionIndex, option] of question.options.entries()) {
          const letter = String.fromCharCode(65 + optionIndex)
          if (!option.text.trim() && !option.imageUrl?.trim()) {
            toast.error(`A alternativa ${letter} da questão ${n} precisa de texto ou imagem.`)
            goToQuestion(index)
            return null
          }
          if (option.imageUrl?.trim() && !isAcceptableImageUrl(option.imageUrl)) {
            toast.error(
              `A imagem da alternativa ${letter} da questão ${n} precisa ser um link http ou https.`
            )
            goToQuestion(index)
            return null
          }
        }
        const correctCount = question.options.filter((option) => option.isCorrect).length
        if (question.allowMultiple ? correctCount < 1 : correctCount !== 1) {
          toast.error(
            question.allowMultiple
              ? `Marque ao menos uma alternativa correta na questão ${n}.`
              : `Marque exatamente uma alternativa correta na questão ${n}.`
          )
          goToQuestion(index)
          return null
        }
      }
      if (question.kind === "true_false") {
        for (const [label, imageUrl] of [
          ["Verdadeiro", question.trueImageUrl],
          ["Falso", question.falseImageUrl],
        ] as const) {
          if (imageUrl?.trim() && !isAcceptableImageUrl(imageUrl)) {
            toast.error(`A imagem de "${label}" na questão ${n} precisa ser um link http ou https.`)
            goToQuestion(index)
            return null
          }
        }
      }
      if (question.kind === "short_answer") {
        const answers = question.acceptedAnswers
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
        if (answers.length === 0) {
          toast.error(`Informe ao menos uma resposta aceita na questão ${n}.`)
          goToQuestion(index)
          return null
        }
      }
      if (question.kind === "matching") {
        if (question.pairs.length < 2) {
          toast.error(`A questão ${n} precisa de pelo menos dois pares.`)
          goToQuestion(index)
          return null
        }
        if (question.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) {
          toast.error(`Preencha os dois lados de cada par na questão ${n}.`)
          goToQuestion(index)
          return null
        }
      }
      if (question.kind === "ordering") {
        if (question.orderEntries.length < 3 || question.orderEntries.some((entry) => !entry.text.trim())) {
          toast.error(`A questão ${n} precisa de pelo menos três itens preenchidos, na ordem correta.`)
          goToQuestion(index)
          return null
        }
      }
      if (question.kind === "cloze" && !/\{\{[^}]+\}\}/.test(question.prompt)) {
        toast.error(`A questão ${n} precisa de lacunas no formato {{resposta}}.`)
        goToQuestion(index)
        return null
      }
      if (question.kind === "categorize") {
        if (question.categories.length < 2 || question.categories.some((category) => !category.label.trim())) {
          toast.error(`A questão ${n} precisa de pelo menos duas categorias nomeadas.`)
          goToQuestion(index)
          return null
        }
        if (question.categoryItems.length < 3 || question.categoryItems.some((item) => !item.text.trim())) {
          toast.error(`A questão ${n} precisa de pelo menos três itens classificados.`)
          goToQuestion(index)
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
      isPublic: nav.student ? false : isPublic,
      theme: theme.trim() || undefined,
      description: description.trim() || undefined,
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

  async function saveQuiz() {
    const payload = buildPayload()
    if (!payload) return

    setSaving(true)
    try {
      const quiz =
        isEditing && activityId
          ? await api.updateActivity(activityId, payload)
          : await api.createActivity(payload)
      toast.success(
        isEditing
          ? "Quiz atualizado."
          : nav.student
            ? "Quiz avulso criado. Você já pode estudá-lo."
            : "Quiz criado. Vincule-o às turmas quando quiser."
      )
      navigate(nav.afterSave(quiz.id, "quiz"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar quiz")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title={isEditing ? "Editar quiz" : "Novo quiz"}>
      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to={nav.home} className="hover:text-primary">
                {nav.homeLabel}
              </Link>
              {isEditing && activityId && !nav.student ? (
                <>
                  {" "}
                  /{" "}
                  <Link to={nav.detail(activityId)} className="hover:text-primary">
                    Detalhe
                  </Link>
                </>
              ) : null}{" "}
              / {isEditing ? "Editar quiz" : nav.student ? "Novo quiz avulso" : "Novo quiz"}
            </p>
            <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold">
              <ListChecks className="h-6 w-6 text-primary" aria-hidden />
              {isEditing ? "Editar quiz" : nav.student ? "Criar quiz avulso" : "Criar quiz"}
            </h1>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void importCsvFile(file)
              }}
            />
          </div>

          <nav className="grid gap-2 sm:grid-cols-2" aria-label="Etapas do quiz">
            <button
              type="button"
              onClick={() => setEditorTab("geral")}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                editorTab === "geral"
                  ? "border-primary bg-primary/8 shadow-[var(--shadow-soft)]"
                  : "border-border/70 bg-card hover:border-primary/40"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  editorTab === "geral"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">1. Atividade</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEditorTab("questoes")}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                editorTab === "questoes"
                  ? "border-primary bg-primary/8 shadow-[var(--shadow-soft)]"
                  : "border-border/70 bg-card hover:border-primary/40"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  editorTab === "questoes"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <ListChecks className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  2. Questões
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    ({questions.length})
                  </span>
                </span>
              </span>
            </button>
          </nav>

          {editorTab === "geral" ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <Label htmlFor="quiz-title">Título</Label>
                  <Input
                    id="quiz-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ex: Sistema Solar"
                    className="h-12 text-lg"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AiQuizGenerator
                    prepHasContent={Boolean(
                      prepTitle.trim() ||
                        prepBody.trim() ||
                        prepObjectives.trim() ||
                        prepMinutes.trim() ||
                        prepTips.trim() ||
                        prepImageDataUrl
                    )}
                    feedbackHasContent={Boolean(
                      feedbackBody.trim() ||
                        (feedbackTitle.trim() && feedbackTitle.trim().toLowerCase() !== "resultados")
                    )}
                    onAccept={appendGenerated}
                  />
                  {!nav.student ? (
                    <VisibilityCheckbox id="quiz-public" checked={isPublic} onChange={setIsPublic} />
                  ) : null}
                </div>
              </div>

              <ActivityCatalogFields
                themeId="quiz-theme"
                descriptionId="quiz-description"
                theme={theme}
                description={description}
                onTheme={setTheme}
                onDescription={setDescription}
              />

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
              <SaveQuizBar saving={saving} isEditing={isEditing} onSave={() => void saveQuiz()} />
            </div>
          ) : (
            <QuestionCarousel
              questions={questions}
              activeIndex={Math.min(questionIndex, questions.length - 1)}
              onSelect={setQuestionIndex}
              onAdd={addQuestion}
              onImportCsv={() => csvInputRef.current?.click()}
              onRemove={removeActiveQuestion}
              onReorder={(delta) => {
                const index = Math.min(questionIndex, questions.length - 1)
                const next = index + delta
                if (next < 0 || next >= questions.length) return
                setQuestions((prev) => moveItem(prev, index, delta))
                setQuestionIndex(next)
              }}
            />
          )}

          {editorTab === "questoes" ? (
          <>
          <section className="surface-card overflow-hidden">
            {(() => {
              const index = Math.min(questionIndex, questions.length - 1)
              const question = questions[index]
              if (!question) return null
              return (
                <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 sm:px-4">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {index + 1}
                    </span>
                    Questão {index + 1}
                    <span className="text-sm font-normal text-muted-foreground">
                      · {ITEM_KIND_LABELS[question.kind]}
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-1">
                    <div className="inline-flex rounded-lg bg-card p-0.5">
                      {(
                        [
                          ["pergunta", "Pergunta"],
                          ["conteudo", "Conteúdo"],
                          ["feedback", "Gabarito"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setQuestionPanel(key)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                            questionPanel === key
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant={previewQuestion ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => setPreviewQuestion((value) => !value)}
                    >
                      <Eye className="h-4 w-4" />
                      {previewQuestion ? "Editar" : "Visualizar"}
                    </Button>
                    {questions.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-destructive"
                        onClick={removeActiveQuestion}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div key={question.key} className="animate-enter space-y-3 p-3 sm:p-4">
                {previewQuestion ? (
                  <QuestionPreview
                    kind={question.kind}
                    prompt={question.prompt}
                    intro={question.intro}
                    promptBlocks={question.promptBlocks}
                    imageDataUrl={question.imageDataUrl}
                    imagePosition={question.imagePosition}
                    topics={question.topics
                      .split(",")
                      .map((topic) => topic.trim())
                      .filter(Boolean)}
                    difficulty={question.difficulty}
                    options={
                      question.kind === "multiple_choice" || question.kind === "true_false"
                        ? question.kind === "true_false"
                          ? [
                              {
                                key: "true",
                                text: "Verdadeiro",
                                isCorrect: question.correctTrue,
                                imageUrl: question.trueImageUrl,
                              },
                              {
                                key: "false",
                                text: "Falso",
                                isCorrect: !question.correctTrue,
                                imageUrl: question.falseImageUrl,
                              },
                            ]
                          : question.options
                        : undefined
                    }
                    allowMultiple={question.allowMultiple}
                    requireExplanation={question.requireExplanation}
                    explanationPrompt={question.explanationPrompt}
                  />
                ) : (
                <>
                {questionPanel === "pergunta" ? (
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
                ) : null}

                {questionPanel === "conteudo" ? (
                <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`topics-${question.key}`}>Tópicos</Label>
                    <Input
                      id={`topics-${question.key}`}
                      value={question.topics}
                      onChange={(event) => updateQuestion(question.key, { topics: event.target.value })}
                      placeholder="HTML, CSS, seletores"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`difficulty-${question.key}`}>Dificuldade</Label>
                    <select
                      id={`difficulty-${question.key}`}
                      className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                      value={question.difficulty}
                      onChange={(event) =>
                        updateQuestion(question.key, { difficulty: event.target.value })
                      }
                    >
                      <option value="">Não informar</option>
                      {QUESTION_DIFFICULTIES.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <ContentBlockFields
                  id={`intro-${question.key}`}
                  label="Introdução"
                  blocks={question.intro}
                  allowedTypes={["markdown"]}
                  compact
                  onChange={(intro) => updateQuestion(question.key, { intro })}
                />

                <ContentBlockFields
                  id={`prompt-blocks-${question.key}`}
                  label="Enunciado em blocos"
                  blocks={question.promptBlocks}
                  compact
                  onChange={(promptBlocks) => updateQuestion(question.key, { promptBlocks })}
                />

                <ItemImageField
                  id={`image-${question.key}`}
                  imageDataUrl={question.imageDataUrl}
                  onChange={(imageDataUrl) => updateQuestion(question.key, { imageDataUrl })}
                  position={question.imagePosition}
                  onPositionChange={(imagePosition) => updateQuestion(question.key, { imagePosition })}
                />
                </>
                ) : null}

                {questionPanel === "pergunta" && question.kind === "cloze" ? (
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
                  </div>
                ) : questionPanel === "pergunta" &&
                  !question.promptBlocks.some((block) => block.content.trim()) ? (
                  <RichTextEditor
                    id={`prompt-${question.key}`}
                    label="Enunciado"
                    value={question.prompt}
                    onChange={(prompt) => updateQuestion(question.key, { prompt })}
                    rows={3}
                    placeholder={"Qual é a saída do programa abaixo?\n\n```python\nprint(sum(range(5)))\n```"}
                  />
                ) : null}

                {questionPanel === "pergunta" && question.kind === "multiple_choice" ? (
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
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={option.key}
                        className={cn(
                          "grid gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                          option.isCorrect
                            ? "border-success/40 bg-success/6"
                            : "border-border/70 bg-muted/25"
                        )}
                      >
                        <div className="flex items-center gap-2">
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
                              patchOption(question.key, option.key, { text: event.target.value })
                            }
                            className="border-transparent bg-card"
                            placeholder={`Alternativa ${String.fromCharCode(65 + optionIndex)} (texto ou imagem)`}
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
                        <OptionImageField
                          inputId={`option-image-${option.key}`}
                          imageUrl={option.imageUrl}
                          onChange={(imageUrl) => patchOption(question.key, option.key, { imageUrl })}
                        />
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

                {questionPanel === "pergunta" && question.kind === "true_false" ? (
                  <fieldset className="grid gap-3">
                    <legend className="text-sm font-medium">Resposta correta</legend>
                    <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`tf-${question.key}`}
                          checked={question.correctTrue}
                          onChange={() => updateQuestion(question.key, { correctTrue: true })}
                        />
                        Verdadeiro
                      </label>
                      <OptionImageField
                        inputId={`true-image-${question.key}`}
                        imageUrl={question.trueImageUrl}
                        onChange={(trueImageUrl) => updateQuestion(question.key, { trueImageUrl })}
                      />
                    </div>
                    <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/25 px-2.5 py-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`tf-${question.key}`}
                          checked={!question.correctTrue}
                          onChange={() => updateQuestion(question.key, { correctTrue: false })}
                        />
                        Falso
                      </label>
                      <OptionImageField
                        inputId={`false-image-${question.key}`}
                        imageUrl={question.falseImageUrl}
                        onChange={(falseImageUrl) => updateQuestion(question.key, { falseImageUrl })}
                      />
                    </div>
                  </fieldset>
                ) : null}

                {questionPanel === "pergunta" && question.kind === "short_answer" ? (
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

                {questionPanel === "pergunta" && question.kind === "matching" ? (
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

                {questionPanel === "pergunta" && question.kind === "ordering" ? (
                  <div className="grid gap-3">
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

                {questionPanel === "pergunta" && question.kind === "cloze" ? (
                  <div className="grid gap-3">
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

                {questionPanel === "pergunta" && question.kind === "categorize" ? (
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

                {questionPanel === "feedback" &&
                (question.kind === "multiple_choice" || question.kind === "true_false") ? (
                  <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                        checked={question.requireExplanation}
                        onChange={(event) =>
                          updateQuestion(question.key, { requireExplanation: event.target.checked })
                        }
                      />
                      <span>
                        <span className="font-medium">Pedir reflexão escrita</span>
                      </span>
                    </label>
                    {question.requireExplanation ? (
                      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                        <div className="grid gap-2">
                          <Label htmlFor={`expl-prompt-${question.key}`}>Pergunta da reflexão</Label>
                          <Input
                            id={`expl-prompt-${question.key}`}
                            value={question.explanationPrompt}
                            onChange={(event) =>
                              updateQuestion(question.key, { explanationPrompt: event.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`expl-min-${question.key}`}>Mínimo</Label>
                          <Input
                            id={`expl-min-${question.key}`}
                            type="number"
                            min={1}
                            max={2000}
                            value={question.explanationMinLength}
                            onChange={(event) =>
                              updateQuestion(question.key, {
                                explanationMinLength: Number(event.target.value) || 20,
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {questionPanel === "feedback" ? (
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`fb-msg-${question.key}`}>Mensagens de gabarito (uma por linha)</Label>
                    <Textarea
                      id={`fb-msg-${question.key}`}
                      value={question.feedbackMessages}
                      onChange={(event) =>
                        updateQuestion(question.key, { feedbackMessages: event.target.value })
                      }
                      placeholder={"Resposta correta: C.\nO fetch envia uma requisição HTTP e o navegador atualiza o DOM."}
                      rows={2}
                    />
                  </div>
                  <ContentBlockFields
                    id={`feedback-blocks-${question.key}`}
                    label="Feedback após o envio"
                    blocks={question.feedbackBlocks}
                    allowedTypes={["markdown", "code"]}
                    compact
                    onChange={(feedbackBlocks) => updateQuestion(question.key, { feedbackBlocks })}
                  />
                  {question.feedbackMessages.trim() ||
                  question.feedbackBlocks.some((block) => block.content.trim()) ? null : (
                    <RichTextEditor
                      id={`expl-${question.key}`}
                      label="Explicação da resposta (opcional)"
                      value={question.explanation}
                      onChange={(explanation) => updateQuestion(question.key, { explanation })}
                      rows={2}
                      compact
                      placeholder="Explique por que essa é a resposta correta."
                    />
                  )}
                </div>
                ) : null}
                </>
                )}

                <div className="flex items-center justify-between border-t border-border/70 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => setQuestionIndex(index - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {index + 1} / {questions.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index >= questions.length - 1}
                    onClick={() => setQuestionIndex(index + 1)}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                </div>
                </>
              )
            })()}
          </section>
          <SaveQuizBar saving={saving} isEditing={isEditing} onSave={() => void saveQuiz()} />
          </>
          ) : null}
        </div>
      )}
    </AppShell>
  )
}

function QuestionCarousel({
  questions,
  activeIndex,
  onSelect,
  onAdd,
  onImportCsv,
  onRemove,
  onReorder,
}: {
  questions: DraftQuestion[]
  activeIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  onImportCsv: () => void
  onRemove: () => void
  onReorder: (delta: number) => void
}) {
  return (
    <div className="surface-card space-y-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={activeIndex === 0}
          onClick={() => onSelect(activeIndex - 1)}
          aria-label="Questão anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
          {questions.map((question, index) => (
            <button
              key={question.key}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                index === activeIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {index + 1}
              <span className="hidden max-w-24 truncate sm:inline">
                {ITEM_KIND_LABELS[question.kind]}
              </span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={activeIndex >= questions.length - 1}
          onClick={() => onSelect(activeIndex + 1)}
          aria-label="Próxima questão"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <Button
          type="button"
          className="h-11 w-full text-sm font-semibold"
          onClick={onAdd}
        >
          <Plus className="h-5 w-5" />
          Nova questão
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full text-sm font-semibold"
          onClick={onImportCsv}
        >
          <FileUp className="h-5 w-5" />
          Importar CSV
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          disabled={activeIndex === 0}
          onClick={() => onReorder(-1)}
        >
          <ArrowUp className="h-4 w-4" />
          Subir
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          disabled={activeIndex >= questions.length - 1}
          onClick={() => onReorder(1)}
        >
          <ArrowDown className="h-4 w-4" />
          Descer
        </Button>
        {questions.length > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        ) : null}
      </div>
    </div>
  )
}
