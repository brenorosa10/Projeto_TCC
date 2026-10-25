import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"

interface DeleteActivityButtonProps {
  activityId: string
  title: string
  type: string
  onDeleted: () => void
  variant?: "destructive" | "outline"
  size?: "default" | "sm"
}

export function DeleteActivityButton({
  activityId,
  title,
  type,
  onDeleted,
  variant = "destructive",
  size = "sm",
}: DeleteActivityButtonProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const kind = type === "flashcards" ? "deck de flashcards" : "quiz"

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.deleteActivity(activityId)
      toast.success(`${kind === "quiz" ? "Quiz" : "Deck"} excluído.`)
      setOpen(false)
      onDeleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir atividade")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Excluir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {kind}?</DialogTitle>
            <DialogDescription>
              “{title}” será removido de forma permanente, inclusive tentativas e progresso de
              estudo associados. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
