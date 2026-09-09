import type { ContentBlock, ContentBlockType } from "@/lib/types"

export const CONTENT_BLOCK_TYPES: { value: ContentBlockType; label: string }[] = [
  { value: "markdown", label: "Texto" },
  { value: "code", label: "Código" },
  { value: "question", label: "Pergunta" },
]

export const QUESTION_DIFFICULTIES = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
] as const

export function flattenContentBlocks(blocks?: ContentBlock[] | null): string {
  return (blocks ?? [])
    .map((block) => {
      const content = block.content.trim()
      if (!content) return ""
      if (block.type === "code") {
        const language = block.language?.trim() ?? ""
        return `\`\`\`${language}\n${content}\n\`\`\``
      }
      return content
    })
    .filter(Boolean)
    .join("\n\n")
}

export function hasContentBlocks(blocks?: ContentBlock[] | null) {
  return Boolean(blocks?.some((block) => block.content.trim()))
}

export function cleanContentBlocks(blocks?: ContentBlock[] | null): ContentBlock[] | undefined {
  const cleaned = (blocks ?? [])
    .map((block) => ({
      type: block.type,
      content: block.content.trim(),
      language: block.type === "code" ? block.language?.trim() || undefined : undefined,
    }))
    .filter((block) => block.content.length > 0)
  return cleaned.length > 0 ? cleaned : undefined
}
