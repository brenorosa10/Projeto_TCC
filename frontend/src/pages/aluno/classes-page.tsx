import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { GraduationCap, KeyRound, Users } from "lucide-react"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { api } from "@/lib/api"
import type { ClassRoom } from "@/lib/types"

export function AlunoClassesPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listClasses()
      .then(setClasses)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar turmas")
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell title="Minhas turmas">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Minhas turmas</h1>
        </div>
        <Button asChild>
          <Link to="/aluno/entrar">
            <KeyRound className="h-4 w-4" />
            Entrar com código
          </Link>
        </Button>
      </div>

      {loading ? (
        <PageLoader />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Você ainda não está em nenhuma turma"
          description="Use o código de 8 caracteres que o professor compartilhou."
        >
          <Button asChild>
            <Link to="/aluno/entrar">Entrar agora</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {classes.map((item) => (
            <li
              key={item.id}
              className="surface-card flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  to={`/aluno/turmas/${item.id}`}
                  className="inline-flex items-center gap-2 font-medium hover:text-primary"
                >
                  <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
                  {item.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  Código {item.code}
                  {item.professorName ? ` · Prof. ${item.professorName}` : null}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link to={`/aluno/turmas/${item.id}`}>Abrir</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
