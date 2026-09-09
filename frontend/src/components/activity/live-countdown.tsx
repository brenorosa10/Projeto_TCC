import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function LiveCountdown({
  endsAt,
  active,
}: {
  endsAt?: string | null
  active?: boolean
}) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!active || !endsAt) {
      setRemaining(null)
      return
    }
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000)))
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [active, endsAt])

  if (remaining === null) return null
  return (
    <span className={cn("ml-auto font-mono text-sm font-semibold", remaining <= 5 && "text-destructive")}>
      {remaining}s
    </span>
  )
}
