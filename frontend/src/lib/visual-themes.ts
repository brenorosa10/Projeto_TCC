export const VISUAL_THEMES = [
  { id: "padrao", label: "Padrão", swatches: ["#f4f7f9", "#12395c", "#9ff5ea"] },
  { id: "espaco", label: "Espaço", swatches: ["#0f1728", "#7ee0d6", "#6d5ce7"] },
  { id: "oceano", label: "Oceano", swatches: ["#e5f6fb", "#0e7490", "#67e8f9"] },
  { id: "floresta", label: "Floresta", swatches: ["#e7f3e4", "#1f6b3a", "#c8f07a"] },
  { id: "por-do-sol", label: "Pôr do sol", swatches: ["#fff1e6", "#c2410c", "#fdba74"] },
  { id: "neon", label: "Neon", swatches: ["#14081f", "#f25cff", "#39f3c4"] },
  { id: "ambar", label: "Âmbar", swatches: ["#fff8e8", "#b45309", "#fbbf24"] },
  { id: "lavanda", label: "Lavanda", swatches: ["#f4f0ff", "#6d28d9", "#ddd4f5"] },
  { id: "gelo", label: "Gelo", swatches: ["#eef6f8", "#0f5f73", "#d7eef4"] },
] as const

export type VisualThemeId = (typeof VISUAL_THEMES)[number]["id"]

export function normalizeVisualTheme(value?: string | null): VisualThemeId {
  const match = VISUAL_THEMES.find((theme) => theme.id === value)
  return match?.id ?? "padrao"
}

export function visualThemeLabel(value?: string | null) {
  const id = normalizeVisualTheme(value)
  return VISUAL_THEMES.find((theme) => theme.id === id)?.label ?? "Padrão"
}
