import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function FlashcardFlip({
  flipped,
  onFlip,
  front,
  back,
  className,
}: {
  flipped: boolean
  onFlip: () => void
  front: ReactNode
  back: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flashcard-scene", className)}>
      <button
        type="button"
        aria-pressed={flipped}
        aria-label={flipped ? "Virar para a frente" : "Virar para o verso"}
        onClick={onFlip}
        className="block w-full text-left"
      >
        <div className={cn("flashcard-inner", flipped && "is-flipped")}>
          <div className="flashcard-face">{front}</div>
          <div className="flashcard-face flashcard-back">{back}</div>
        </div>
      </button>
    </div>
  )
}

export function FlashcardFace({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint: string
}) {
  return (
    <div className="flex h-full min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-[var(--shadow-soft)]">
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="mt-4 w-full">{children}</div>
      <span className="mt-5 text-sm text-muted-foreground">{hint}</span>
    </div>
  )
}
