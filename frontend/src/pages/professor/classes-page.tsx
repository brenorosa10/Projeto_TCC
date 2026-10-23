import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import type { ClassRoom } from "@/lib/types"

const CLASS_NAME_MAX = 200

function classNameError(value: string) {
  const name = value.trim()
  if (!name) return "Informe o nome da turma."
  if (name.length < 2) return "O nome da turma deve ter pelo menos 2 caracteres."
  if (name.length > CLASS_NAME_MAX) return "O nome da turma deve ter no máximo 200 caracteres."
  return null
}

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
    const validation = classNameError(name)
    if (validation) {
      toast.error(validation)
      return
    }
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
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Nova turma</Button>
          </DialogTrigger>
          <DialogContent>
            <form noValidate onSubmit={(e) => void handleCreate(e)}>
              <DialogHeader>
                <DialogTitle>Criar turma</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 py-4">
                <Label htmlFor="class-name">Nome da turma</Label>
                <Input
                  id="class-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Biologia 2º ano"
                  maxLength={CLASS_NAME_MAX}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">{name.trim().length}/200</p>
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
        <PageLoader />
      ) : classes.length === 0 ? (
        <EmptyState
          title="Nenhuma turma ainda"
          description="Crie a primeira turma para gerar um código de acesso aos alunos."
        />
      ) : (
        <ul className="grid gap-3">
          {classes.map((item) => (
            <li key={item.id} className="surface-card flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between">
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
