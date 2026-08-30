import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
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
          <p className="mt-2 text-muted-foreground">
            Turmas em que você já ingressou com código.
          </p>
        </div>
        <Button asChild>
          <Link to="/aluno/entrar">Entrar com código</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : classes.length === 0 ? (
        <p className="text-muted-foreground">
          Você ainda não está em nenhuma turma.{" "}
          <Link to="/aluno/entrar" className="text-primary underline">
            Entrar agora
          </Link>
        </p>
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
                  className="font-medium hover:text-primary"
                >
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
