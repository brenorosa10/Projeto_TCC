import type { ReactNode } from "react"
import { Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { VISUAL_THEMES, normalizeVisualTheme, type VisualThemeId } from "@/lib/visual-themes"

export function VisualThemeFrame({
  theme,
  children,
  className,
}: {
  theme?: string | null
  children: ReactNode
  className?: string
}) {
  const id = normalizeVisualTheme(theme)
  return (
    <div
      data-visual-theme={id === "padrao" ? undefined : id}
      className={cn("visual-theme-frame", className)}
    >
      {children}
    </div>
  )
}

export function VisualThemePicker({
  value,
  onChange,
}: {
  value?: string | null
  onChange: (theme: VisualThemeId) => void
}) {
  const selected = normalizeVisualTheme(value)

  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-1.5 text-sm font-medium">
        <Palette className="h-4 w-4 text-primary" aria-hidden />
        Tema visual
      </legend>
      <div className="flex flex-wrap gap-2">
        {VISUAL_THEMES.map((theme) => {
          const active = theme.id === selected
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(theme.id)}
              className={cn(
                "option-press inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium",
                active
                  ? "border-primary bg-primary/8 text-foreground shadow-[var(--shadow-soft)]"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              <span className="flex" aria-hidden>
                {theme.swatches.map((color) => (
                  <span
                    key={color}
                    className="h-3.5 w-3.5 rounded-full border border-black/10 first:ml-0 -ml-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </span>
              {theme.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
