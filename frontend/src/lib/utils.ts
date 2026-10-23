import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function activityItemTotal(activity: {
  items?: readonly unknown[] | null
  itemCount?: number | null
  sections?: readonly { role?: string | null; itemIds?: readonly unknown[] | null }[] | null
}) {
  const fromItems = activity.items?.length ?? 0
  const fromCount = typeof activity.itemCount === "number" ? activity.itemCount : 0
  const fromSections = (activity.sections ?? [])
    .filter((section) => section.role === "practice")
    .reduce((sum, section) => sum + (section.itemIds?.length ?? 0), 0)
  return Math.max(fromItems, fromCount, fromSections)
}

export function activityCountLabel(count: number, type?: string | null) {
  if (type === "flashcards") return plural(count, "cartão", "cartões")
  return plural(count, "questão", "questões")
}

/** Plain-text preview of authored markdown, for compact labels and selects. */
export function stripMarkdown(value?: string | null) {
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
