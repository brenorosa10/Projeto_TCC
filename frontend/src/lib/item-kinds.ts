import type { ItemKind, SectionRole } from "@/lib/types"

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  multiple_choice: "Múltipla escolha",
  true_false: "Verdadeiro ou falso",
  short_answer: "Resposta curta",
  matching: "Associação",
  ordering: "Ordenação",
  cloze: "Preencher lacuna",
  categorize: "Arrastar para categorias",
  flashcard: "Flashcard",
}

export const QUIZ_ITEM_KINDS: ItemKind[] = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "matching",
  "ordering",
  "cloze",
  "categorize",
]

export function itemKindLabel(kind: string | null | undefined): string {
  if (!kind) return "Questão"
  return ITEM_KIND_LABELS[kind as ItemKind] ?? kind
}

export function activityTypeLabel(type: string | null | undefined): string {
  if (type === "quiz") return "Quiz"
  if (type === "flashcards") return "Flashcards"
  if (type === "prova") return "Prova"
  return type?.trim() || "Atividade"
}

export function liveSessionStatusLabel(status: string | null | undefined): string {
  if (status === "lobby") return "Aguardando"
  if (status === "running") return "Em andamento"
  if (status === "ended") return "Encerrada"
  return status?.trim() || "Sessão"
}

export function findSection<T extends { role: SectionRole }>(
  sections: T[] | null | undefined,
  role: SectionRole
): T | undefined {
  return sections?.find((section) => section.role === role)
}

export function hasSectionCopy(
  section:
    | {
        title?: string | null
        body?: string | null
        objectives?: string[] | null
        tips?: string[] | null
        estimatedMinutes?: number | null
        imageDataUrl?: string | null
      }
    | null
    | undefined
) {
  const title = section?.title?.trim() ?? ""
  const body = section?.body?.trim() ?? ""
  if (body) return true
  if (section?.objectives?.some((item) => item.trim()) || section?.tips?.some((item) => item.trim())) {
    return true
  }
  if (section?.estimatedMinutes || section?.imageDataUrl) return true
  if (!title) return false
  return title !== "Resultados" && title !== "Antes de começar"
}
