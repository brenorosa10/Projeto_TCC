import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { DeleteActivityButton } from "@/components/activity/delete-activity-button"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { findSection, hasSectionCopy, itemKindLabel } from "@/lib/item-kinds"
import type { Activity, ActivityItem, ActivitySection, ClassRoom } from "@/lib/types"

function typeLabel(type: string) {
  if (type === "quiz") return "Quiz"
  if (type === "flashcards") return "Flashcards"
  if (type === "prova") return "Prova"
  return type
}

export function ProfessorActivityDetailPage() {
  const { activityId } = useParams()
  const navigate = useNavigate()
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
              <Badge variant="outline">{activity.isPublic ? "Público" : "Privado"}</Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {activity.itemCount} {activity.type === "flashcards" ? "cartão(ões)" : "questão(ões)"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link
                  to={
                    activity.type === "flashcards"
                      ? `/professor/flashcards/${activity.id}/editar`
                      : `/professor/quiz/${activity.id}/editar`
                  }
                >
                  Editar
                </Link>
              </Button>
              <DeleteActivityButton
                activityId={activity.id}
                title={activity.title}
                type={activity.type}
                variant="destructive"
                size="default"
                onDeleted={() => navigate("/professor/atividades")}
              />
            </div>
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

          <SectionCopy
            heading="Preparação"
            section={findSection(activity.sections, "prep")}
          />

          <ul className="space-y-4">
            {activity.items.map((item, index) => (
              <li key={item.id} className="rounded-lg border border-border p-4">
                <ActivityItemPreview item={item} index={index} activityType={activity.type} />
              </li>
            ))}
          </ul>

          <SectionCopy
            heading="Feedback"
            section={findSection(activity.sections, "feedback")}
          />
        </div>
      )}
    </AppShell>
  )
}

function SectionCopy({
  heading,
  section,
}: {
  heading: string
  section: ActivitySection | undefined
}) {
  if (!hasSectionCopy(section)) return null
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="font-display text-lg font-semibold">{heading}</h2>
      {section?.estimatedMinutes ? (
        <p className="text-sm text-muted-foreground">Tempo estimado: {section.estimatedMinutes} min</p>
      ) : null}
      {section?.title?.trim() ? <p className="font-medium">{section.title}</p> : null}
      {section?.imageDataUrl ? (
        <img
          src={section.imageDataUrl}
          alt=""
          className="max-h-56 w-full rounded-md border border-border object-contain bg-muted/30"
        />
      ) : null}
      {section?.body?.trim() ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{section.body}</p>
      ) : null}
      {section?.objectives?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {section.objectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section?.tips?.length ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">Dicas</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {section.tips.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function ActivityItemPreview({
  item,
  index,
  activityType,
}: {
  item: ActivityItem
  index: number
  activityType: string
}) {
  const isCard = activityType === "flashcards" || item.kind === "flashcard"
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {isCard ? `Cartão ${index + 1}` : `Questão ${index + 1}`}
        {item.kind ? ` · ${itemKindLabel(item.kind)}` : null}
        {item.timeLimitSeconds && !isCard ? ` · ${item.timeLimitSeconds}s` : null}
      </p>
      <p className="mt-2 font-medium">{isCard ? item.front : item.prompt}</p>
      {item.imageDataUrl ? (
        <img
          src={item.imageDataUrl}
          alt=""
          className="mt-3 max-h-56 w-full rounded-md border border-border object-contain bg-muted/30"
        />
      ) : null}
      {isCard ? <p className="mt-1 text-muted-foreground">{item.back}</p> : null}
      {item.kind === "short_answer" && item.acceptedAnswers?.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Aceitas: {item.acceptedAnswers.join(" · ")}
        </p>
      ) : null}
      {item.kind === "matching" && item.pairs?.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {item.pairs.map((pair) => (
            <li key={`${pair.leftId}-${pair.rightId}`}>
              {pair.left} → {pair.right}
            </li>
          ))}
        </ul>
      ) : null}
      {item.kind === "ordering" && item.orderEntries?.length ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {item.orderEntries.map((entry) => (
            <li key={entry.id}>{entry.text}</li>
          ))}
        </ol>
      ) : null}
      {item.kind === "cloze" && item.clozeBlanks?.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Lacunas: {item.clozeBlanks.map((blank) => (blank.acceptedAnswers ?? []).join("/")).join(" · ")}
        </p>
      ) : null}
      {item.kind === "categorize" && item.categories?.length ? (
        <ul className="mt-3 space-y-1 text-sm">
          {item.categories.map((category) => (
            <li key={category.id}>
              <span className="font-medium">{category.label}:</span>{" "}
              {(item.categoryItems ?? [])
                .filter((member) => member.categoryId === category.id)
                .map((member) => member.text)
                .join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
      {item.options && item.options.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {item.options.map((option) => (
            <li key={option.id} className={option.isCorrect ? "font-medium text-primary" : ""}>
              {option.text}
              {option.isCorrect ? " (correta)" : null}
            </li>
          ))}
        </ul>
      ) : null}
      {item.explanation ? (
        <p className="mt-3 text-sm text-muted-foreground">{item.explanation}</p>
      ) : null}
    </>
  )
}
