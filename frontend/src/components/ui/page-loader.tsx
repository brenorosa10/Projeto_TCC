import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function PageLoader({
  className,
  rows = 3,
}: {
  className?: string
  rows?: number
}) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-live="polite"
      aria-label="Carregando"
    >
      <div className="skeleton h-9 w-2/3 max-w-md rounded-lg" />
      <div className="skeleton h-4 w-full max-w-xl rounded-md" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton h-24 w-full rounded-xl" />
      ))}
      <span className="sr-only">Carregando conteúdo...</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string
  description?: string
  children?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
      {Icon ? (
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      ) : null}
      <p className="font-display text-xl font-semibold">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground text-pretty">{description}</p>
      ) : null}
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}
