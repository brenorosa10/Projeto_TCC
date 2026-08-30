import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { ActivitySummary, ClassRoom } from "@/lib/types"

function typeLabel(type: string) {
  if (type === "quiz") return "Quiz"
  if (type === "flashcards") return "Flashcards"
  if (type === "prova") return "Prova"
  return type
}

export function AlunoClassDetailPage() {
  const { id } = useParams()
  const [classroom, setClassroom] = useState<ClassRoom | null>(null)
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <AppShell title="Turma">
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !classroom ? (
        <p className="text-muted-foreground">Turma não encontrada.</p>
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
          </div>

          <section>
            <h2 className="font-display text-xl font-semibold">Atividades</h2>
            {activities.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                O professor ainda não publicou quizzes ou flashcards nesta turma.
              </p>
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
                        <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                        <span>
                          {item.itemCount}{" "}
                          {item.type === "flashcards" ? "cartão(ões)" : "questão(ões)"}
                        </span>
                      </div>
                    </div>
                    {item.type === "quiz" ? (
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
