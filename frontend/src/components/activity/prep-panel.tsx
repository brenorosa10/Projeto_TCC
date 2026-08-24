import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function PrepPanel({
  title,
  body,
  objectives,
  estimatedMinutes,
  tips,
  imageDataUrl,
  disabled,
  actionLabel = "Começar",
  fallbackBody,
  onContinue,
}: {
  title?: string | null
  body?: string | null
  objectives?: string[] | null
  estimatedMinutes?: number | null
  tips?: string[] | null
  imageDataUrl?: string | null
  disabled?: boolean
  actionLabel?: string
  fallbackBody?: string
  onContinue: () => void
}) {
  const cleanObjectives = (objectives ?? []).map((item) => item.trim()).filter(Boolean)
  const cleanTips = (tips ?? []).map((item) => item.trim()).filter(Boolean)

  return (
    <div className="space-y-4 rounded-lg border border-border p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Preparação</Badge>
        {estimatedMinutes ? (
          <Badge variant="outline">cerca de {estimatedMinutes} min</Badge>
        ) : null}
      </div>
      <h2 className="font-display text-xl font-semibold">{title?.trim() || "Antes de começar"}</h2>
      {imageDataUrl ? (
        <img
          src={imageDataUrl}
          alt=""
          className="max-h-64 w-full rounded-lg border border-border bg-muted/30 object-contain"
        />
      ) : null}
      {body?.trim() ? (
        <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
      ) : fallbackBody ? (
        <p className="text-muted-foreground">{fallbackBody}</p>
      ) : null}
      {cleanObjectives.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Objetivos</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {cleanObjectives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {cleanTips.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Dicas</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {cleanTips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button type="button" disabled={disabled} onClick={onContinue}>
        {actionLabel}
      </Button>
    </div>
  )
}
