import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { ClassRoom } from "@/lib/types"

export function ProfessorClassDetailPage() {
  const { id } = useParams()
  const [classroom, setClassroom] = useState<ClassRoom | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api
      .getClass(id)
      .then(setClassroom)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar turma")
      )
      .finally(() => setLoading(false))
  }, [id])

  return (
    <AppShell title="Detalhe da turma">
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !classroom ? (
        <p className="text-muted-foreground">Turma não encontrada.</p>
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
            <Button asChild variant="secondary">
              <Link to="/professor/turmas">Nova atividade (em breve)</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/professor/ao-vivo">Iniciar ao vivo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/professor/analytics">Ver analytics</Link>
            </Button>
          </div>

          <section>
            <h2 className="font-display text-xl font-semibold">Atividades</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Quizzes, provas e flashcards aparecerão aqui nas próximas entregas.
            </p>
          </section>
        </div>
      )}
    </AppShell>
  )
}
