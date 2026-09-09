import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { activityTypeLabel } from "@/lib/item-kinds"
import type { ActivitySummary, ClassRoom } from "@/lib/types"

export function ProfessorClassDetailPage() {
  const { id } = useParams()
  const [classroom, setClassroom] = useState<ClassRoom | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [library, setLibrary] = useState<ActivitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)

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
        <EmptyState title="Turma não encontrada" description="Ela pode ter sido removida ou o link está incorreto." />
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

          <div className="grid gap-3 sm:grid-cols-3">
            <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Vincular atividade</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular da biblioteca</DialogTitle>
                  <DialogDescription>
                    Use o mesmo quiz ou deck em várias turmas. Crie novos em Atividades.
                  </DialogDescription>
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
                          Vincular
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DialogContent>
            </Dialog>
            <Button asChild variant="outline">
              <Link to={`/professor/ao-vivo?classId=${id}`}>Iniciar ao vivo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/professor/analytics">Ver analytics</Link>
            </Button>
          </div>

          <section>
            <h2 className="font-display text-xl font-semibold">Atividades desta turma</h2>
            {activities.length === 0 ? (
              <EmptyState
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
                        <span>
                          {item.itemCount}{" "}
                          {item.type === "flashcards" ? "cartão(ões)" : "questão(ões)"}
                        </span>
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
