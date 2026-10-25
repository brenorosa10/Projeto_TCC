import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  BarChart3,
  Layers,
  Link2,
  Pencil,
  Radio,
  SearchX,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
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
import { activityTypeLabel } from "@/lib/item-kinds"
import { activityCountLabel } from "@/lib/utils"
import type { ActivitySummary, ClassRoom } from "@/lib/types"

const CLASS_NAME_MAX = 200

function classNameError(value: string) {
  const name = value.trim()
  if (!name) return "Informe o nome da turma."
  if (name.length < 2) return "O nome da turma deve ter pelo menos 2 caracteres."
  if (name.length > CLASS_NAME_MAX) return "O nome da turma deve ter no máximo 200 caracteres."
  return null
}

export function ProfessorClassDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classroom, setClassroom] = useState<ClassRoom | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [library, setLibrary] = useState<ActivitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    if (!id) return
    const [classData, activityData, libraryData] = await Promise.all([
      api.getClass(id),
      api.listActivities(id),
      api.listMyActivities(),
    ])
    setClassroom(classData)
    setActivities(activityData)
    setLibrary(libraryData)
  }

  useEffect(() => {
    if (!id) return
    load()
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar turma")
      )
      .finally(() => setLoading(false))
  }, [id])

  const linkedIds = new Set(activities.map((item) => item.id))
  const available = library.filter((item) => !linkedIds.has(item.id))

  async function handleLink(activityId: string) {
    if (!id) return
    setLinkingId(activityId)
    try {
      await api.linkActivityToClass(id, activityId)
      await load()
      toast.success("Atividade vinculada a esta turma.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao vincular atividade")
    } finally {
      setLinkingId(null)
    }
  }

  function openEdit() {
    if (!classroom) return
    setEditName(classroom.name)
    setEditOpen(true)
  }

  async function handleRename(event: React.FormEvent) {
    event.preventDefault()
    if (!id) return
    const validation = classNameError(editName)
    if (validation) {
      setNameError(validation)
      toast.error(validation)
      return
    }
    setNameError(null)
    setSavingName(true)
    try {
      const updated = await api.updateClass(id, { name: editName.trim() })
      setClassroom(updated)
      setEditOpen(false)
      toast.success("Nome da turma atualizado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao renomear turma")
    } finally {
      setSavingName(false)
    }
  }

  async function handleDelete() {
    if (!id || !classroom) return
    setDeleting(true)
    try {
      await api.deleteClass(id)
      toast.success(`Turma "${classroom.name}" excluída.`)
      navigate("/professor/turmas", { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir turma")
    } finally {
      setDeleting(false)
    }
  }

  async function handleUnlink(activityId: string) {
    if (!id) return
    try {
      await api.unlinkActivityFromClass(id, activityId)
      await load()
      toast.success("Atividade desvinculada desta turma.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao desvincular")
    }
  }

  return (
    <AppShell title="Detalhe da turma">
      {loading ? (
        <PageLoader />
      ) : !classroom ? (
        <EmptyState
          icon={SearchX}
          title="Turma não encontrada"
          description="Ela pode ter sido removida ou o link está incorreto."
        />
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/professor/turmas" className="hover:text-primary">
                Turmas
              </Link>{" "}
              / {classroom.name}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{classroom.name}</h1>
            <p className="mt-2 text-muted-foreground">
              Código de acesso:{" "}
              <span className="font-mono text-lg font-semibold tracking-widest text-foreground">
                {classroom.code}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Link2 className="h-4 w-4" />
                  Vincular atividade
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular da biblioteca</DialogTitle>
                </DialogHeader>
                {available.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Não há atividades disponíveis.{" "}
                    <Link to="/professor/atividades" className="text-primary hover:underline">
                      Ir para a biblioteca
                    </Link>
                  </p>
                ) : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {available.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{activityTypeLabel(item.type)}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={linkingId === item.id}
                          onClick={() => void handleLink(item.id)}
                        >
                          <Link2 className="h-4 w-4" />
                          Vincular
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DialogContent>
            </Dialog>
            <Button asChild variant="outline">
              <Link to={`/professor/ao-vivo?classId=${id}`}>
                <Radio className="h-4 w-4" />
                Iniciar ao vivo
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/professor/analytics">
                <BarChart3 className="h-4 w-4" />
                Ver analytics
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={openEdit}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          </div>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <form noValidate onSubmit={(event) => void handleRename(event)}>
                <DialogHeader>
                  <DialogTitle>Editar turma</DialogTitle>
                  <DialogDescription>O código de acesso permanece o mesmo.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 py-4">
                  <Label htmlFor="edit-class-name">Nome da turma</Label>
                  <Input
                    id="edit-class-name"
                    value={editName}
                    onChange={(event) => {
                      setEditName(event.target.value)
                      if (nameError) setNameError(null)
                    }}
                    maxLength={CLASS_NAME_MAX}
                    autoComplete="off"
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={nameError ? "edit-class-name-error" : undefined}
                  />
                  {nameError ? (
                    <p id="edit-class-name-error" className="text-sm text-destructive" role="alert">
                      {nameError}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{editName.trim().length}/200</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={savingName}>
                    {savingName ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir turma?</DialogTitle>
                <DialogDescription>
                  “{classroom.name}” será removida. Os alunos perdem o acesso e o código deixa de
                  funcionar. As atividades da biblioteca são mantidas, apenas desvinculadas. Sessões
                  ao vivo em andamento desta turma serão encerradas.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? "Excluindo..." : "Excluir turma"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <section>
            <h2 className="font-display text-xl font-semibold">Atividades desta turma</h2>
            {activities.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="Nenhuma atividade vinculada"
                description="Crie na biblioteca e vincule aqui para os alunos estudarem."
              />
            ) : (
              <ul className="mt-4 grid gap-3">
                {activities.map((item) => (
                  <li
                    key={item.id}
                    className="surface-card flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        to={`/professor/atividades/${item.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {item.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">{activityTypeLabel(item.type)}</Badge>
                        <span>{activityCountLabel(item.itemCount, item.type)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/professor/atividades/${item.id}`}>Abrir</Link>
                      </Button>
                      {item.type !== "flashcards" ? (
                        <Button asChild size="sm">
                          <Link to={`/professor/ao-vivo?classId=${id}&activityId=${item.id}`}>
                            Ao vivo
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleUnlink(item.id)}
                      >
                        Desvincular
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
