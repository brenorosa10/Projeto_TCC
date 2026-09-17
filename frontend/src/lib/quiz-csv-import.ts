import type { ContentBlock, ContentBlockType, ItemKind } from "@/lib/types"

export type ImportedQuizQuestion = {
  title: string
  topics: string
  difficulty: string
  kind: ItemKind
  prompt: string
  intro: ContentBlock[]
  promptBlocks: ContentBlock[]
  options: { text: string; isCorrect: boolean }[]
  allowMultiple: boolean
  feedbackMessages: string
  feedbackBlocks: ContentBlock[]
  requireExplanation: boolean
  explanationMinLength: number
  explanationPrompt: string
}

type CsvBlock = {
  type?: string
  language?: string
  content?: string
}

type CsvChoiceOption = {
  id?: string
  label?: string
  text?: string
}

type CsvField = {
  id?: string
  type?: string
  label?: string
  required?: boolean
  min_length?: number
  placeholder?: string
  correct_option_id?: string
  correct_option_ids?: string[]
  options?: CsvChoiceOption[]
}

type CsvChallenge = {
  title?: string
  topics?: string[] | string
  difficulty?: string
  intro?: CsvBlock[]
  prompt?: CsvBlock[]
  response?: { type?: string; fields?: CsvField[] }
}

type CsvFixture = {
  title?: string
  topics?: string[] | string
  difficulty?: string
  challenge?: CsvChallenge
  feedback?: {
    messages?: string[]
    after_submission?: CsvBlock[]
  }
  intro?: CsvBlock[]
  prompt?: CsvBlock[]
  response?: CsvChallenge["response"]
}

const ALLOWED_DIFFICULTIES = new Set(["iniciante", "intermediario", "avancado"])
const ALLOWED_BLOCK_TYPES = new Set<ContentBlockType>(["markdown", "code", "question"])

export function parseQuizCsv(text: string): ImportedQuizQuestion[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""))
  if (rows.length < 2) return []

  const header = rows[0].map((cell) => cell.trim().toLowerCase())
  const jsonIndex = header.findIndex((name) =>
    ["fixture_json", "challenge_json", "json"].includes(name)
  )
  if (jsonIndex < 0) {
    throw new Error("O CSV precisa da coluna fixture_json.")
  }

  const col = (name: string) => header.indexOf(name)
  const imported = new Map<string, ImportedQuizQuestion>()

  rows.slice(1).forEach((row, index) => {
    if (!row.some((cell) => cell.trim())) return
    const active = (row[col("active")] ?? "true").trim().toLowerCase()
    if (active === "false" || active === "0" || active === "não" || active === "nao") return

    const rawJson = row[jsonIndex]?.trim()
    if (!rawJson) return

    let fixture: CsvFixture
    try {
      fixture = JSON.parse(rawJson) as CsvFixture
    } catch {
      throw new Error(`JSON inválido na linha ${index + 2}.`)
    }

    const question = mapFixture(fixture, {
      title: row[col("title")] ?? "",
      topics: row[col("topics")] ?? "",
      difficulty: row[col("difficulty")] ?? "",
    })
    if (!question) return

    const key =
      row[col("fixture_id")]?.trim() ||
      String(index)
    imported.set(key, question)
  })

  return [...imported.values()]
}

function mapFixture(
  fixture: CsvFixture,
  fallback: { title: string; topics: string; difficulty: string }
): ImportedQuizQuestion | null {
  const challenge = fixture.challenge ?? fixture
  const fields = challenge.response?.fields ?? []
  const choice = fields.find(
    (field) => field.type === "single_choice" || field.type === "multiple_choice"
  )
  if (!choice?.options?.length) return null

  const correctIds = new Set(
    [
      choice.correct_option_id,
      ...(choice.correct_option_ids ?? []),
    ]
      .filter(Boolean)
      .map((id) => String(id).toLowerCase())
  )
  const options = choice.options
    .map((option) => ({
      text: (option.label ?? option.text ?? "").trim(),
      isCorrect: correctIds.has(String(option.id ?? "").toLowerCase()),
    }))
    .filter((option) => option.text)
  if (options.length < 2) return null
  if (!options.some((option) => option.isCorrect)) {
    options[0] = { ...options[0], isCorrect: true }
  }

  const reflection = fields.find((field) => field.type === "open_text")
  const intro = toBlocks(challenge.intro ?? fixture.intro)
  const promptBlocks = toBlocks(challenge.prompt ?? fixture.prompt)
  const questionBlock = promptBlocks.find((block) => block.type === "question")
  const remainingPrompt = promptBlocks.filter((block) => block.type !== "question")
  const feedback = fixture.feedback

  const topics = joinTopics(challenge.topics) || fallback.topics.trim()
  const difficulty = normalizeDifficulty(challenge.difficulty || fallback.difficulty)

  return {
    title: (challenge.title || fallback.title).trim(),
    topics,
    difficulty,
    kind: "multiple_choice",
    prompt: questionBlock?.content.trim() ?? "",
    intro,
    promptBlocks: remainingPrompt,
    options,
    allowMultiple: choice.type === "multiple_choice",
    feedbackMessages: (feedback?.messages ?? []).map((item) => item.trim()).filter(Boolean).join("\n"),
    feedbackBlocks: toBlocks(feedback?.after_submission),
    requireExplanation: Boolean(reflection?.required),
    explanationMinLength: Number(reflection?.min_length) || 20,
    explanationPrompt:
      reflection?.label?.trim() || reflection?.placeholder?.trim() || "Como você pensou sobre a resposta?",
  }
}

function toBlocks(blocks?: CsvBlock[] | null): ContentBlock[] {
  return (blocks ?? [])
    .map((block) => {
      const type = ALLOWED_BLOCK_TYPES.has(block.type as ContentBlockType)
        ? (block.type as ContentBlockType)
        : "markdown"
      return {
        type,
        content: (block.content ?? "").trim(),
        language: type === "code" ? block.language?.trim() || undefined : undefined,
      }
    })
    .filter((block) => block.content.length > 0)
}

function joinTopics(topics?: string[] | string) {
  if (Array.isArray(topics)) return topics.map((item) => item.trim()).filter(Boolean).join(", ")
  return (topics ?? "").trim()
}

function normalizeDifficulty(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  if (normalized === "intermediario") return "intermediario"
  if (normalized === "avancado") return "avancado"
  if (ALLOWED_DIFFICULTIES.has(normalized)) return normalized
  return "iniciante"
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
        continue
      }
      if (char === '"') {
        quoted = false
        continue
      }
      field += char
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ",") {
      row.push(field)
      field = ""
      continue
    }
    if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      continue
    }
    if (char === "\r") continue
    field += char
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
