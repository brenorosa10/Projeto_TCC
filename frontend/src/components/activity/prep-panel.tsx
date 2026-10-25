import { ArrowRight, Clock, Lightbulb, Rocket, Target } from "lucide-react"
import { MediaFrame } from "@/components/activity/media-frame"
import type { VideoKind } from "@/lib/types"
import { RichText } from "@/components/rich-text/rich-text"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Pre-section ("pré-seção"): the briefing a student reads before practising.
 */
export function PrepPanel({
  title,
  body,
  objectives,
  estimatedMinutes,
  tips,
  imageDataUrl,
  videoUrl,
  videoKind,
  disabled,
  actionLabel = "Começar",
  fallbackBody,
  itemCount,
  onContinue,
  className,
}: {
  title?: string | null
  body?: string | null
  objectives?: string[] | null
  estimatedMinutes?: number | null
  tips?: string[] | null
  imageDataUrl?: string | null
  videoUrl?: string | null
  videoKind?: VideoKind | string | null
  disabled?: boolean
  actionLabel?: string
  fallbackBody?: string
  itemCount?: number | null
  onContinue: () => void
  className?: string
}) {
  const cleanObjectives = (objectives ?? []).map((item) => item.trim()).filter(Boolean)
  const cleanTips = (tips ?? []).map((item) => item.trim()).filter(Boolean)

  return (
    <section className={cn("surface-card animate-enter overflow-hidden", className)}>
      <header className="relative overflow-hidden border-b border-border/70 bg-primary px-6 py-7 text-primary-foreground sm:px-8">
        <div className="pattern-grid absolute inset-0 opacity-[0.12]" aria-hidden />
        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            <Rocket className="h-3.5 w-3.5" />
            Antes de começar
          </span>
          <h2 className="font-display text-2xl font-semibold text-balance sm:text-3xl">
            {title?.trim() || "Prepare-se para a atividade"}
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {estimatedMinutes ? (
              <Chip icon={<Clock className="h-3.5 w-3.5" />}>cerca de {estimatedMinutes} min</Chip>
            ) : null}
            {itemCount ? <Chip>{itemCount} itens</Chip> : null}
            {cleanObjectives.length > 0 ? (
              <Chip icon={<Target className="h-3.5 w-3.5" />}>
                {cleanObjectives.length} objetivo{cleanObjectives.length > 1 ? "s" : ""}
              </Chip>
            ) : null}
          </div>
        </div>
      </header>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        {imageDataUrl || videoUrl ? (
          <MediaFrame
            imageDataUrl={imageDataUrl}
            videoUrl={videoUrl}
            videoKind={videoKind}
            alt="Mídia da pré-seção"
          />
        ) : null}

        <RichText
          value={body}
          fallback={
            fallbackBody ? <p className="text-muted-foreground text-pretty">{fallbackBody}</p> : null
          }
        />

        {cleanObjectives.length > 0 ? (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Target className="h-4 w-4 text-primary" />O que você vai aprender
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {cleanObjectives.map((item, index) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-secondary/40 px-3.5 py-3 text-sm"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {cleanTips.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-astro-amber/30 bg-astro-amber/8 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-astro-amber">
              <Lightbulb className="h-4 w-4" />
              Dicas
            </h3>
            <ul className="grid gap-1.5 text-sm text-foreground/85">
              {cleanTips.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-astro-amber" />
                  <span className="text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <footer className="flex justify-end border-t border-border/70 bg-muted/40 px-6 py-4 sm:px-8">
        <Button type="button" size="lg" disabled={disabled} onClick={onContinue} className="group">
          {actionLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </footer>
    </section>
  )
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-medium text-primary-foreground/90 ring-1 ring-inset ring-white/15">
      {icon}
      {children}
    </span>
  )
}
