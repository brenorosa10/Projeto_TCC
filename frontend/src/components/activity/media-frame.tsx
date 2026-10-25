import { useEffect, useState } from "react"
import { resolveMediaUrl } from "@/lib/media-url"
import { cn } from "@/lib/utils"
import type { VideoKind } from "@/lib/types"

export function youtubeEmbedId(value?: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, "")
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
    }
    if (!host.endsWith("youtube.com") && host !== "youtube-nocookie.com") return null
    const path = url.pathname.split("/").filter(Boolean)
    if (["embed", "shorts", "live"].includes(path[0] ?? "") && path[1]) {
      return /^[A-Za-z0-9_-]{11}$/.test(path[1]) ? path[1] : null
    }
    const id = url.searchParams.get("v")
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function vimeoEmbedId(value?: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^\d{6,12}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, "")
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null
    const parts = url.pathname.split("/").filter(Boolean)
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      if (/^\d{6,12}$/.test(parts[index])) return parts[index]
    }
    return null
  } catch {
    return null
  }
}

export function parseVideoAddress(value: string): { videoUrl: string; videoKind: VideoKind } | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 2000) return null
  if (/^\/api\/media\/[0-9a-f-]{36}$/i.test(trimmed)) {
    return { videoUrl: trimmed, videoKind: "file" }
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return { videoUrl: trimmed, videoKind: "youtube" }
  }
  if (/^\d{6,12}$/.test(trimmed)) {
    return { videoUrl: trimmed, videoKind: "vimeo" }
  }
  const youtube = youtubeEmbedId(trimmed)
  if (youtube && /youtube|youtu\.be/i.test(trimmed)) {
    return { videoUrl: trimmed, videoKind: "youtube" }
  }
  const vimeo = vimeoEmbedId(trimmed)
  if (vimeo && /vimeo/i.test(trimmed)) {
    return { videoUrl: trimmed, videoKind: "vimeo" }
  }
  try {
    const url = new URL(trimmed)
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return null
    }
    return { videoUrl: trimmed, videoKind: "file" }
  } catch {
    return null
  }
}

export function MediaFrame({
  imageDataUrl,
  videoUrl,
  videoKind,
  alt = "Imagem",
  className,
}: {
  imageDataUrl?: string | null
  videoUrl?: string | null
  videoKind?: VideoKind | string | null
  alt?: string
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const kind = videoKind?.trim()
  const youtube = kind === "youtube" ? youtubeEmbedId(videoUrl) : null
  const vimeo = kind === "vimeo" ? vimeoEmbedId(videoUrl) : null
  const fileSrc = kind === "file" ? resolveMediaUrl(videoUrl) : undefined

  useEffect(() => {
    setBroken(false)
  }, [imageDataUrl, videoUrl, videoKind])

  if (youtube) {
    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-xl border border-border bg-black", className)}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtube}`}
          title="Vídeo do YouTube"
          className="h-full w-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }

  if (vimeo) {
    return (
      <div className={cn("aspect-video w-full overflow-hidden rounded-xl border border-border bg-black", className)}>
        <iframe
          src={`https://player.vimeo.com/video/${vimeo}?dnt=1`}
          title="Vídeo do Vimeo"
          className="h-full w-full"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }

  if (fileSrc) {
    if (broken) return <Unavailable />
    return (
      <video
        key={fileSrc}
        src={fileSrc}
        controls
        playsInline
        preload="metadata"
        className={cn("max-h-72 w-full rounded-xl border border-border bg-black", className)}
        onError={() => setBroken(true)}
      />
    )
  }

  if (imageDataUrl) {
    if (broken) return <Unavailable label="Imagem indisponível" />
    return (
      <img
        src={imageDataUrl}
        alt={alt}
        className={cn("max-h-72 w-full rounded-xl border border-border bg-muted/30 object-contain", className)}
        onError={() => setBroken(true)}
      />
    )
  }

  if (kind) return <Unavailable />
  return null
}

function Unavailable({ label = "Vídeo indisponível" }: { label?: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
      {label}
    </p>
  )
}
