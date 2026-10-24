import { useEffect, useState } from "react"
import { RichText } from "@/components/rich-text/rich-text"
import { resolveMediaUrl } from "@/lib/media-url"
import { cn } from "@/lib/utils"

export function AlternativeImage({
  imageUrl,
  alt = "Imagem da alternativa",
  className,
}: {
  imageUrl?: string | null
  alt?: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const src = resolveMediaUrl(imageUrl)

  useEffect(() => {
    setBroken(false)
  }, [src])

  if (!src) return null

  if (broken) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Imagem indisponível
      </p>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn(
        "max-h-36 w-full rounded-lg border border-border/70 bg-muted/20 object-contain sm:max-h-48",
        className
      )}
      onError={() => setBroken(true)}
    />
  )
}

export function AlternativeBody({
  text,
  imageUrl,
  textClassName,
}: {
  text?: string | null
  imageUrl?: string | null
  textClassName?: string
}) {
  const hasText = Boolean(text?.trim())
  if (!hasText && !imageUrl?.trim()) return null

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <AlternativeImage imageUrl={imageUrl} alt={hasText ? "" : "Imagem da alternativa"} />
      {hasText ? <RichText value={text} className={textClassName} /> : null}
    </div>
  )
}
