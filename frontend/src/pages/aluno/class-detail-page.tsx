import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { BookOpen, SearchX } from "lucide-react"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { api } from "@/lib/api"
import { activityTypeLabel } from "@/lib/item-kinds"
import { activityCountLabel } from "@/lib/utils"
import type { ActivitySummary, ClassRoom } from "@/lib/types"

export function AlunoClassDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classroom, setClassroom] = useState<ClassRoom | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([api.getClass(id), api.listActivities(id)])
      .then(([classData, activityData]) => {
        setClassroom(classData)
        setActivities(activityData)
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar turma")
      )
      .finally(() => setLoading(false))
  }, [id])

  async function handleLeave() {
    if (!id) return
    setLeaving(true)
    try {
      await api.leaveClass(id)
      toast.success("Você saiu da turma.")
      setLeaveOpen(false)
      navigate("/aluno/turmas")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sair da turma")
    } finally {
      setLeaving(false)
    }
  }

  return (
    <AppShell title="Turma">
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
              <Link to="/aluno/turmas" className="hover:text-primary">
                Turmas
              </Link>{" "}
              / {classroom.name}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{classroom.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {classroom.professorName
                ? `Professor(a): ${classroom.professorName}`
                : `Código: ${classroom.code}`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild>
              <Link to="/aluno/estudar">Estudar (flashcards / quiz off-line)</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/aluno/sessao">Entrar em sessão ao vivo</Link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="sm:col-span-2"
              onClick={() => setLeaveOpen(true)}
            >
              Sair da turma
            </Button>
          </div>

          <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sair de {classroom.name}?</DialogTitle>
                <DialogDescription>
                  Você deixará de ver as atividades desta turma. Poderá entrar de novo depois com o
                  código de acesso.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={leaving}
                  onClick={() => void handleLeave()}
                >
                  {leaving ? "Saindo..." : "Sair da turma"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <section>
            <h2 className="font-display text-xl font-semibold">Atividades</h2>
            {activities.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nenhuma atividade ainda"
                description="O professor ainda não publicou quizzes ou flashcards nesta turma."
              />
            ) : (
              <ul className="mt-4 grid gap-3">
                {activities.map((item) => (
                  <li
                    key={item.id}
                    className="surface-card flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">{activityTypeLabel(item.type)}</Badge>
                        <span>{activityCountLabel(item.itemCount, item.type)}</span>
                      </div>
                    </div>
                    {item.type === "prova" ? (
                      <Button asChild size="sm">
                        <Link to="/aluno/sessao">Participar ao vivo</Link>
                      </Button>
                    ) : item.type === "quiz" ? (
                      <Button asChild size="sm">
                        <Link to={`/aluno/estudar/${item.id}`}>Estudar</Link>
                      </Button>
                    ) : item.type === "flashcards" ? (
                      <Button asChild size="sm">
                        <Link to={`/aluno/estudar/flashcards/${item.id}`}>Estudar</Link>
                      </Button>
                    ) : null}
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
