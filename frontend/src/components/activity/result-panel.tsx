import { useState, type ReactNode } from "react"
import { Check, ChevronDown, Sparkles, Trophy, X } from "lucide-react"
import { RichText } from "@/components/rich-text/rich-text"
import { cn } from "@/lib/utils"

export type ResultItem = {
  itemId: string
  kind?: string | null
  prompt?: string | null
  isCorrect?: boolean | null
  remembered?: boolean | null
  explanation?: string | null
}

/**
 * Post-section ("pós-seção"): closing screen with the score, the teacher's
 * message and the per-item review.
 */
export function ResultPanel({
  title,
  body,
  correctCount,
  total,
  items,
  summary,
  actions,
  itemLabel,
  className,
}: {
  title?: string | null
  body?: string | null
  correctCount?: number | null
  total?: number | null
  items?: ResultItem[] | null
  summary?: ReactNode
  actions?: ReactNode
  itemLabel?: (item: ResultItem) => string
  className?: string
}) {
  const hasScore = typeof correctCount === "number" && typeof total === "number" && total > 0
  const ratio = hasScore ? correctCount / total : 0
  const tone = !hasScore ? "neutral" : ratio >= 0.8 ? "great" : ratio >= 0.5 ? "good" : "review"
  const reviewItems = (items ?? []).filter((item) => !item.isCorrect)

  return (
    <section className={cn("surface-card animate-enter overflow-hidden", className)}>
      <header
        className={cn(
          "relative overflow-hidden border-b border-border/70 px-6 py-7 sm:px-8",
          tone === "great" && "bg-gradient-to-br from-emerald-600 to-teal-700 text-white",
          tone === "good" && "bg-gradient-to-br from-primary to-[#1b5a86] text-primary-foreground",
          tone === "review" && "bg-gradient-to-br from-astro-amber to-[#a85c17] text-white",
          tone === "neutral" && "bg-gradient-to-br from-primary to-[#1b5a86] text-primary-foreground"
        )}
      >
        <div className="pattern-grid absolute inset-0 opacity-[0.12]" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              {tone === "great" ? (
                <Trophy className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Depois da atividade
            </span>
            <h2 className="font-display text-2xl font-semibold text-balance sm:text-3xl">
              {title?.trim() || headline(tone)}
            </h2>
            <p className="max-w-lg text-sm text-white/85">{encouragement(tone)}</p>
          </div>
          {hasScore ? <ScoreRing correct={correctCount} total={total} /> : null}
        </div>
      </header>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <RichText value={body} />
        {summary}

        {items && items.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Revisão item a item
              </h3>
              {reviewItems.length > 0 ? (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                  {reviewItems.length} para revisar
                </span>
              ) : (
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  Tudo certo
                </span>
              )}
            </div>
            <ul className="grid gap-2">
              {items.map((item, index) => (
                <ResultRow
                  key={item.itemId}
                  index={index}
                  item={item}
                  label={itemLabel?.(item) ?? item.prompt ?? "Item"}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {actions ? (
        <footer className="flex flex-wrap gap-3 border-t border-border/70 bg-muted/40 px-6 py-4 sm:px-8">
          {actions}
        </footer>
      ) : null}
    </section>
  )
}

function ResultRow({
  index,
  item,
  label,
}: {
  index: number
  item: ResultItem
  label: string
}) {
  const [open, setOpen] = useState(false)
  const expandable = Boolean(item.explanation?.trim())

  return (
    <li
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        item.isCorrect ? "border-success/25 bg-success/5" : "border-destructive/25 bg-destructive/5"
      )}
    >
      <button
        type="button"
        onClick={() => expandable && setOpen((prev) => !prev)}
        aria-expanded={expandable ? open : undefined}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left",
          expandable ? "cursor-pointer" : "cursor-default"
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white",
            item.isCorrect ? "bg-success" : "bg-destructive"
          )}
          aria-hidden
        >
          {item.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-pretty">
            {index + 1}. {label}
          </p>
          <p
            className={cn(
              "mt-0.5 text-xs font-medium",
              item.isCorrect ? "text-success" : "text-destructive"
            )}
          >
            {item.isCorrect ? "Correto" : "Incorreto"}
            {item.remembered === true ? " · você lembrou" : null}
            {item.remembered === false ? " · você não lembrou" : null}
            {expandable ? (open ? " · ocultar explicação" : " · ver explicação") : null}
          </p>
        </div>
        {expandable ? (
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        ) : null}
      </button>
      {expandable && open ? (
        <div className="border-t border-border/60 bg-card px-4 py-3">
          <RichText value={item.explanation} className="text-sm" />
        </div>
      ) : null}
    </li>
  )
}

function ScoreRing({ correct, total }: { correct: number; total: number }) {
  const ratio = total > 0 ? correct / total : 0
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const percent = Math.round(ratio * 100)

  return (
    <div className="relative h-28 w-28 shrink-0 self-center sm:self-auto">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          className="text-white/20"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="text-white transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold leading-none">{percent}%</span>
        <span className="mt-1 text-[0.7rem] font-medium text-white/80">
          {correct} de {total}
        </span>
      </div>
    </div>
  )
}

function headline(tone: string) {
  if (tone === "great") return "Excelente trabalho!"
  if (tone === "review") return "Bom começo, vamos revisar"
  return "Como você foi"
}

function encouragement(tone: string) {
  if (tone === "great") return "Você dominou o conteúdo desta atividade. Continue assim!"
  if (tone === "good") return "Você está no caminho certo. Reveja os itens marcados e tente de novo."
  if (tone === "review")
    return "Sem problema: erros fazem parte do estudo. Releia as explicações abaixo e refaça a atividade."
  return "Confira o resumo da sua sessão."
}
