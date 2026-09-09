import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { DeleteActivityButton } from "@/components/activity/delete-activity-button"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { ActivitySummary } from "@/lib/types"

function typeLabel(type: string) {
  if (type === "quiz") return "Quiz"
  if (type === "flashcards") return "Flashcards"
  if (type === "prova") return "Prova"
  return type
}

export function ProfessorActivitiesPage() {
  const [activities, setActivities] = useState<ActivitySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [importingId, setImportingId] = useState<string | null>(null)

  async function handleImport(activity: ActivitySummary) {
    setImportingId(activity.id)
    try {
      const deck = await api.importFlashcards(activity.id)
      toast.success(
        `Deck "${deck.title}" com ${deck.itemCount} cartão(ões) a partir das respostas corretas.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao importar flashcards")
    } finally {
      setImportingId(null)
    }
  }

  useEffect(() => {
    api
      .listMyActivities()
      .then(setActivities)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar atividades")
      )
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell title="Atividades">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Minhas atividades</h1>
          <p className="mt-2 text-muted-foreground">
            Quizzes e flashcards ficam na sua biblioteca e podem ser vinculados a várias turmas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/professor/quiz/novo">Novo quiz</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/professor/flashcards/novo">Novos flashcards</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : activities.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma atividade ainda. Crie um quiz ou um deck.</p>
      ) : (
        <ul className="grid gap-3">
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
                  <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                  <Badge variant="outline">{item.isPublic ? "Público" : "Privado"}</Badge>
                  <span>
                    {item.itemCount} {item.type === "flashcards" ? "cartão(ões)" : "questão(ões)"}
                  </span>
                  <span>
                    {item.classIds.length === 0
                      ? "Sem turma"
                      : `${item.classIds.length} turma(s)`}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={
                      item.type === "flashcards"
                        ? `/professor/flashcards/${item.id}/editar`
                        : `/professor/quiz/${item.id}/editar`
                    }
                  >
                    Editar
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/professor/atividades/${item.id}`}>Abrir</Link>
                </Button>
                {item.type === "quiz" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={importingId === item.id}
                    onClick={() => void handleImport(item)}
                  >
                    {importingId === item.id ? "Importando..." : "Importar flashcards"}
                  </Button>
                ) : null}
                <DeleteActivityButton
                  activityId={item.id}
                  title={item.title}
                  type={item.type}
                  onDeleted={() =>
                    setActivities((prev) => prev.filter((activity) => activity.id !== item.id))
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
