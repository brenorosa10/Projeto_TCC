import type { ItemKind, SectionRole } from "@/lib/types"

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  multiple_choice: "Múltipla escolha",
  true_false: "Verdadeiro ou falso",
  short_answer: "Resposta curta",
  matching: "Associação",
  flashcard: "Flashcard",
}

export const QUIZ_ITEM_KINDS: ItemKind[] = [
  "multiple_choice",
  "true_false",
  "short_answer",
  "matching",
]

export function itemKindLabel(kind: string | null | undefined): string {
  if (!kind) return "Questão"
  return ITEM_KIND_LABELS[kind as ItemKind] ?? kind
}

export function findSection<T extends { role: SectionRole }>(
  sections: T[] | null | undefined,
  role: SectionRole
): T | undefined {
  return sections?.find((section) => section.role === role)
}

export function hasSectionCopy(section: { title?: string | null; body?: string | null } | null | undefined) {
  const title = section?.title?.trim() ?? ""
  const body = section?.body?.trim() ?? ""
  if (body) return true
  if (!title) return false
  return title !== "Resultados" && title !== "Antes de começar"
}
