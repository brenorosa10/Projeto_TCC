import { useEffect, useState } from "react"
import { Timer } from "lucide-react"
import { cn } from "@/lib/utils"

export function QuestionCountdown({ endsAt }: { endsAt?: string | null }) {
  const endMs = endsAt ? Date.parse(endsAt) : Number.NaN
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!Number.isFinite(endMs)) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endMs])

  if (!Number.isFinite(endMs)) return null

  const remaining = Math.max(0, Math.ceil((endMs - now) / 1000))
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const urgent = remaining <= 10

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-sm font-semibold tabular-nums",
        remaining === 0
          ? "bg-destructive/10 text-destructive"
          : urgent
            ? "animate-countdown-urgent bg-destructive/10 text-destructive"
            : "bg-muted text-foreground"
      )}
      aria-live="polite"
    >
      <Timer className="h-3.5 w-3.5" aria-hidden />
      {remaining === 0 ? "Tempo esgotado" : `${minutes}:${seconds.toString().padStart(2, "0")}`}
    </span>
  )
}
