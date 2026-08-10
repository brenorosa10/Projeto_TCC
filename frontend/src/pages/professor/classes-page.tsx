import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import type { ClassRoom } from "@/lib/types"

export function ProfessorClassesPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await api.listClasses()
      setClasses(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar turmas")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const created = await api.createClass({ name: name.trim() })
      setClasses((prev) => [created, ...prev])
      setName("")
      setOpen(false)
      toast.success(`Turma criada. Código: ${created.code}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar turma")
    } finally {
      setCreating(false)
    }
  }

  return (
    <AppShell title="Turmas">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Minhas turmas</h1>
          <p className="mt-2 text-muted-foreground">
            Cada turma gera um código único de 8 caracteres para os alunos.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nova turma</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={(e) => void handleCreate(e)}>
              <DialogHeader>
                <DialogTitle>Criar turma</DialogTitle>
                <DialogDescription>
                  Informe um nome. O código de acesso será gerado automaticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-4">
                <Label htmlFor="class-name">Nome da turma</Label>
                <Input
                  id="class-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Biologia 2º ano"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando turmas...</p>
      ) : classes.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma turma ainda. Crie a primeira.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {classes.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  to={`/professor/turmas/${item.id}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Código{" "}
                  <span className="font-mono font-semibold tracking-wider text-foreground">
                    {item.code}
                  </span>
                  {typeof item.studentCount === "number"
                    ? ` · ${item.studentCount} aluno(s)`
                    : null}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/professor/turmas/${item.id}`}>Abrir</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
