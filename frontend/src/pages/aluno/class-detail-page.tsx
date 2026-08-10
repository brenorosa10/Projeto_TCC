import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { ClassRoom } from "@/lib/types"

export function AlunoClassDetailPage() {
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
        </div>
      )}
    </AppShell>
  )
}
