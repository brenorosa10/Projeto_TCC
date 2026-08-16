import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { Activity, ClassRoom } from "@/lib/types"

function typeLabel(type: string) {
  if (type === "quiz") return "Quiz"
  if (type === "flashcards") return "Flashcards"
  if (type === "prova") return "Prova"
  return type
}

export function ProfessorActivityDetailPage() {
  const { activityId } = useParams()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [savingLinks, setSavingLinks] = useState(false)

  useEffect(() => {
    if (!activityId) return
    Promise.all([api.getActivity(activityId), api.listClasses()])
      .then(([activityData, classData]) => {
        setActivity(activityData)
        setClasses(classData)
        setSelectedClassIds(activityData.classIds ?? [])
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar atividade")
      )
      .finally(() => setLoading(false))
  }, [activityId])

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    )
  }

  async function handleSaveLinks() {
    if (!activity) return
    setSavingLinks(true)
    try {
      const updated = await api.assignActivityClasses(activity.id, selectedClassIds)
      setActivity(updated)
      setSelectedClassIds(updated.classIds ?? [])
      toast.success("Vínculos com turmas atualizados.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao vincular turmas")
    } finally {
      setSavingLinks(false)
    }
  }

  async function handleImport() {
    if (!activity) return
    setImporting(true)
    try {
      const deck = await api.importFlashcards(activity.id)
      toast.success(
        `Deck "${deck.title}" com ${deck.itemCount} cartão(ões) a partir das respostas corretas.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao importar flashcards")
    } finally {
      setImporting(false)
    }
  }

  return (
    <AppShell title="Atividade">
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !activity ? (
        <p className="text-muted-foreground">Atividade não encontrada.</p>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/professor/atividades" className="hover:text-primary">
                Atividades
              </Link>{" "}
              / {activity.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold">{activity.title}</h1>
              <Badge variant="secondary">{typeLabel(activity.type)}</Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {activity.itemCount} {activity.type === "flashcards" ? "cartão(ões)" : "questão(ões)"}
            </p>
          </div>

          <section className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Turmas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O mesmo conteúdo pode aparecer em várias turmas. A aplicação ao vivo é feita depois,
                quando você iniciar a sessão.
              </p>
            </div>
            {classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você ainda não tem turmas. Crie uma turma para vincular esta atividade.
              </p>
            ) : (
              <ul className="grid gap-2">
                {classes.map((classroom) => (
                  <li key={classroom.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedClassIds.includes(classroom.id)}
                        onChange={() => toggleClass(classroom.id)}
                      />
                      {classroom.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {classes.length > 0 ? (
              <Button type="button" variant="outline" disabled={savingLinks} onClick={() => void handleSaveLinks()}>
                {savingLinks ? "Salvando..." : "Salvar vínculos"}
              </Button>
            ) : null}
          </section>

          {activity.type === "quiz" ? (
            <Button type="button" variant="secondary" disabled={importing} onClick={() => void handleImport()}>
              {importing ? "Importando..." : "Importar flashcards"}
            </Button>
          ) : null}

          <ul className="space-y-4">
            {activity.items.map((item, index) => (
              <li key={item.id} className="rounded-lg border border-border p-4">
                {activity.type === "flashcards" ? (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Cartão {index + 1}
                    </p>
                    <p className="mt-2 font-medium">{item.front}</p>
                    <p className="mt-1 text-muted-foreground">{item.back}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Questão {index + 1}
                      {item.timeLimitSeconds ? ` · ${item.timeLimitSeconds}s` : null}
                    </p>
                    <p className="mt-2 font-medium">{item.prompt}</p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {item.options?.map((option) => (
                        <li key={option.id} className={option.isCorrect ? "font-medium text-primary" : ""}>
                          {option.text}
                          {option.isCorrect ? " (correta)" : null}
                        </li>
                      ))}
                    </ul>
                    {item.explanation ? (
                      <p className="mt-3 text-sm text-muted-foreground">{item.explanation}</p>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  )
}
