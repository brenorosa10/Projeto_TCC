import { useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { compressImageFile } from "@/lib/compress-image"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ImagePosition } from "@/lib/types"

interface ItemImageFieldProps {
  id: string
  imageDataUrl?: string
  onChange: (imageDataUrl?: string) => void
  position?: ImagePosition | string
  onPositionChange?: (position: ImagePosition) => void
}

export function ItemImageField({
  id,
  imageDataUrl,
  onChange,
  position = "after",
  onPositionChange,
}: ItemImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [compressing, setCompressing] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setCompressing(true)
    try {
      const compressed = await compressImageFile(file)
      onChange(compressed)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao comprimir a imagem")
    } finally {
      setCompressing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Imagem</Label>
      {imageDataUrl ? (
        <img
          src={imageDataUrl}
          alt="Pré-visualização"
          className="max-h-48 w-full rounded-md border border-border object-contain bg-muted/30"
        />
      ) : null}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-48 flex-1 sm:flex-none"
          disabled={compressing}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-5 w-5" />
          {compressing ? "Comprimindo..." : imageDataUrl ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {imageDataUrl ? (
          <Button type="button" variant="ghost" className="h-11" onClick={() => onChange(undefined)}>
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        ) : null}
      </div>
      {onPositionChange ? (
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Posição da imagem</p>
          <div className="inline-flex w-fit rounded-lg border border-border/70 bg-muted/40 p-0.5">
            <PositionButton
              active={position !== "after"}
              onClick={() => onPositionChange("before")}
            >
              Antes do enunciado
            </PositionButton>
            <PositionButton
              active={position === "after"}
              onClick={() => onPositionChange("after")}
            >
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
