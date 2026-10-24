import { useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AlternativeImage } from "@/components/activity/alternative-media"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { isAcceptableImageUrl, MAX_OPTION_IMAGE_BYTES } from "@/lib/media-url"

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export function OptionImageField({
  imageUrl,
  onChange,
  inputId,
}: {
  imageUrl?: string
  onChange: (imageUrl?: string) => void
  inputId: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlDraft, setUrlDraft] = useState("")

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Selecione um arquivo JPEG, PNG, WebP ou GIF.")
      return
    }
    if (file.size > MAX_OPTION_IMAGE_BYTES) {
      toast.error("A imagem deve ter no máximo 3 MB.")
      return
    }

    setUploading(true)
    try {
      const uploaded = await api.uploadOptionImage(file)
      onChange(uploaded.url)
      setUrlDraft("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem.")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function applyUrl() {
    const value = urlDraft.trim()
    if (!value) {
      toast.error("Cole um endereço http ou https.")
      return
    }
    if (!isAcceptableImageUrl(value)) {
      toast.error("A imagem por endereço precisa ser um link http ou https.")
      return
    }
    onChange(value)
    setUrlDraft("")
  }

  return (
    <div className="grid gap-2">
      {imageUrl ? <AlternativeImage imageUrl={imageUrl} className="max-h-40 bg-card" /> : null}
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Enviando..." : imageUrl ? "Trocar arquivo" : "Enviar imagem"}
        </Button>
        <div className="flex min-w-0 flex-1 gap-2">
          <Input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            onBlur={(event) => {
              const next = event.relatedTarget
              if (next instanceof HTMLElement && next.dataset.applyImageUrl === "true") return
              if (urlDraft.trim()) applyUrl()
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                applyUrl()
              }
            }}
            placeholder="ou cole um link http(s)"
            className="h-9 bg-card"
            inputMode="url"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            data-apply-image-url="true"
            onClick={applyUrl}
          >
            Usar link
          </Button>
        </div>
        {imageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onChange(undefined)}
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        ) : null}
      </div>
    </div>
  )
}
