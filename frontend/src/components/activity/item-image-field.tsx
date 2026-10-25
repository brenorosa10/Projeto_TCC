import { useRef, useState } from "react"
import { ImagePlus, Trash2, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MediaFrame, parseVideoAddress } from "@/components/activity/media-frame"
import { compressImageFile } from "@/lib/compress-image"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ImagePosition, VideoKind } from "@/lib/types"

const MAX_VIDEO_BYTES = 50 * 1024 * 1024

export type ItemMediaValue = {
  imageDataUrl?: string
  videoUrl?: string
  videoKind?: VideoKind
}

interface ItemImageFieldProps {
  id: string
  imageDataUrl?: string
  videoUrl?: string
  videoKind?: VideoKind | string | null
  onChange: (value: ItemMediaValue) => void
  position?: ImagePosition | string
  onPositionChange?: (position: ImagePosition) => void
}

export function ItemImageField({
  id,
  imageDataUrl,
  videoUrl,
  videoKind,
  onChange,
  position = "after",
  onPositionChange,
}: ItemImageFieldProps) {
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<"image" | "video">(videoUrl ? "video" : "image")
  const [busy, setBusy] = useState(false)
  const [urlDraft, setUrlDraft] = useState("")

  const hasImage = Boolean(imageDataUrl)
  const hasVideo = Boolean(videoUrl)

  function selectMode(next: "image" | "video") {
    setMode(next)
    if (next === "image" && hasVideo) onChange({})
    if (next === "video" && hasImage) onChange({})
  }

  async function handleImage(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const compressed = await compressImageFile(file)
      onChange({ imageDataUrl: compressed })
      setMode("image")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao comprimir a imagem")
    } finally {
      setBusy(false)
      if (imageRef.current) imageRef.current.value = ""
    }
  }

  async function handleVideo(file: File | undefined) {
    if (!file) return
    const allowed = ["video/mp4", "video/webm", "video/quicktime"]
    if (file.type && !allowed.includes(file.type)) {
      toast.error("Selecione um vídeo MP4, WebM ou MOV.")
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("O vídeo deve ter no máximo 50 MB.")
      return
    }
    setBusy(true)
    try {
      const uploaded = await api.uploadOptionImage(file)
      onChange({ videoUrl: uploaded.url, videoKind: "file" })
      setUrlDraft("")
      setMode("video")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o vídeo.")
    } finally {
      setBusy(false)
      if (videoRef.current) videoRef.current.value = ""
    }
  }

  function applyUrl() {
    const parsed = parseVideoAddress(urlDraft)
    if (!parsed) {
      toast.error("O vídeo por endereço precisa ser um link http ou https.")
      return
    }
    onChange(parsed)
    setUrlDraft("")
    setMode("video")
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>Mídia</Label>
        <div className="inline-flex rounded-lg border border-border/70 bg-muted/40 p-0.5">
          <PositionButton active={mode === "image"} onClick={() => selectMode("image")}>
            Imagem
          </PositionButton>
          <PositionButton active={mode === "video"} onClick={() => selectMode("video")}>
            Vídeo
          </PositionButton>
        </div>
      </div>

      {mode === "image" && hasImage ? (
        <MediaFrame imageDataUrl={imageDataUrl} alt="Pré-visualização" />
      ) : null}
      {mode === "video" && hasVideo ? (
        <MediaFrame videoUrl={videoUrl} videoKind={videoKind} />
      ) : null}

      <input
        ref={imageRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        className="sr-only"
        onChange={(event) => void handleImage(event.target.files?.[0])}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="sr-only"
        onChange={(event) => void handleVideo(event.target.files?.[0])}
      />

      {mode === "image" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-48 flex-1 sm:flex-none"
            disabled={busy}
            onClick={() => imageRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
            {busy ? "Comprimindo..." : hasImage ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {hasImage ? (
            <Button type="button" variant="ghost" className="h-11" onClick={() => onChange({})}>
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              disabled={busy}
              onClick={() => videoRef.current?.click()}
            >
              <Video className="h-5 w-5" />
              {busy ? "Enviando..." : hasVideo ? "Trocar arquivo" : "Enviar vídeo"}
            </Button>
            <div className="flex min-w-0 flex-1 gap-2">
              <Input
                value={urlDraft}
                onChange={(event) => setUrlDraft(event.target.value)}
                onBlur={(event) => {
                  const next = event.relatedTarget
                  if (next instanceof HTMLElement && next.dataset.applyVideoUrl === "true") return
                  if (urlDraft.trim()) applyUrl()
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applyUrl()
                  }
                }}
                placeholder="YouTube, Vimeo ou link direto"
                className="h-11 bg-card"
                inputMode="url"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-11 shrink-0"
                data-apply-video-url="true"
                onClick={applyUrl}
              >
                Usar link
              </Button>
            </div>
            {hasVideo ? (
              <Button type="button" variant="ghost" className="h-11 shrink-0" onClick={() => onChange({})}>
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            MP4, WebM ou MOV até 50 MB. Links do YouTube e do Vimeo também funcionam.
          </p>
        </div>
      )}

      {onPositionChange ? (
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Posição da mídia</p>
          <div className="inline-flex w-fit rounded-lg border border-border/70 bg-muted/40 p-0.5">
            <PositionButton active={position !== "after"} onClick={() => onPositionChange("before")}>
              Antes do enunciado
            </PositionButton>
            <PositionButton active={position === "after"} onClick={() => onPositionChange("after")}>
              Depois do enunciado
            </PositionButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PositionButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
