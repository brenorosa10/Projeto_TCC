import { useRef, useState } from "react"
import { ImagePlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { compressImageFile } from "@/lib/compress-image"
import { toast } from "sonner"

interface ItemImageFieldProps {
  id: string
  imageDataUrl?: string
  onChange: (imageDataUrl?: string) => void
}

export function ItemImageField({ id, imageDataUrl, onChange }: ItemImageFieldProps) {
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
      <Label htmlFor={id}>Imagem (opcional)</Label>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG ou WebP. A foto é comprimida no navegador para caber no limite de 16 MB do
        MongoDB.
      </p>
      {imageDataUrl ? (
        <img
          src={imageDataUrl}
          alt="Pré-visualização"
          className="max-h-48 w-full rounded-md border border-border object-contain bg-muted/30"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={compressing}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          {compressing ? "Comprimindo..." : imageDataUrl ? "Trocar imagem" : "Enviar imagem"}
        </Button>
        {imageDataUrl ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        ) : null}
      </div>
    </div>
  )
}
