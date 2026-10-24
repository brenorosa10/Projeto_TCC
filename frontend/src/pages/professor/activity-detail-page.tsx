import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Flag, Rocket } from "lucide-react"
import { AlternativeBody } from "@/components/activity/alternative-media"
import { ContentBlockList } from "@/components/activity/content-block-list"
import { PromptMedia } from "@/components/activity/question-preview"
import { DeleteActivityButton } from "@/components/activity/delete-activity-button"
import { RichText } from "@/components/rich-text/rich-text"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { api } from "@/lib/api"
import { hasContentBlocks } from "@/lib/content-blocks"
import { activityTypeLabel, findSection, hasSectionCopy, itemKindLabel } from "@/lib/item-kinds"
import { activityCountLabel, activityItemTotal, cn, plural } from "@/lib/utils"
import type { Activity, ActivityItem, ActivitySection, ClassRoom } from "@/lib/types"

export function ProfessorActivityDetailPage() {
  const { activityId } = useParams()
  const navigate = useNavigate()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importedDecks, setImportedDecks] = useState<Activity[]>([])
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
      setImportedDecks((prev) => [deck, ...prev.filter((item) => item.id !== deck.id)])
      toast.success(
        `Deck "${deck.title}" com ${plural(activityItemTotal(deck), "cartão", "cartões")} a partir das respostas corretas.`
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
        <PageLoader />
      ) : !activity ? (
        <EmptyState
          title="Atividade não encontrada"
          description="Ela pode ter sido removida ou o link está incorreto."
        />
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
              <Badge variant="secondary">{activityTypeLabel(activity.type)}</Badge>
              <Badge variant="outline">{activity.isPublic ? "Público" : "Privado"}</Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {activityCountLabel(activityItemTotal(activity), activity.type)}
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
              {activity.type === "quiz" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={importing}
                  onClick={() => void handleImport()}
                >
                  {importing ? "Importando..." : "Importar flashcards"}
                </Button>
              ) : null}
              {activity.type === "quiz" || activity.type === "prova" ? (
                <Button asChild>
                  <Link
                    to={
                      selectedClassIds[0]
                        ? `/professor/ao-vivo?classId=${selectedClassIds[0]}&activityId=${activity.id}`
                        : "/professor/ao-vivo"
                    }
                  >
                    Iniciar ao vivo
                  </Link>
                </Button>
              ) : null}
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

          {importedDecks.length > 0 ? (
            <section className="surface-card space-y-3 p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold">Decks importados</h2>
              <ul className="grid gap-2">
                {importedDecks.map((deck) => (
                  <li key={deck.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {deck.title} · {activityCountLabel(activityItemTotal(deck), "flashcards")}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/professor/atividades/${deck.id}`}>Abrir deck</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="surface-card space-y-4 p-4 sm:p-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Turmas</h2>
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

          <SectionCopy heading="Pré-seção" section={findSection(activity.sections, "prep")} />

          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold">
              {activity.type === "flashcards" ? "Cartões" : "Questões"}
            </h2>
            <ul className="space-y-3">
              {activity.items.map((item, index) => (
                <li key={item.id} className="surface-card p-4 sm:p-5">
                  <ActivityItemPreview item={item} index={index} activityType={activity.type} />
                </li>
              ))}
            </ul>
          </div>

          <SectionCopy heading="Pós-seção" section={findSection(activity.sections, "feedback")} />
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
  const isPrep = heading === "Pré-seção"
  return (
    <section className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-6">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            isPrep ? "bg-primary text-primary-foreground" : "bg-astro-amber/15 text-astro-amber"
          )}
        >
          {isPrep ? <Rocket className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
        </span>
        <h2 className="font-display text-lg font-semibold">{heading}</h2>
        {section?.estimatedMinutes ? (
          <Badge variant="outline" className="ml-auto">
            {section.estimatedMinutes} min
          </Badge>
        ) : null}
      </div>
      <div className="space-y-4 p-4 sm:p-6">
        {section?.title?.trim() ? (
          <p className="font-display text-base font-semibold">{section.title}</p>
        ) : null}
        {section?.imageDataUrl ? (
          <img
            src={section.imageDataUrl}
            alt={
              section.title?.trim()
                ? `Imagem da seção ${section.title}`
                : isPrep
                  ? "Imagem da pré-seção"
                  : "Imagem da pós-seção"
            }
            className="max-h-56 w-full rounded-lg border border-border object-contain bg-muted/30"
          />
        ) : null}
        <RichText value={section?.body} className="text-sm" />
        {section?.objectives?.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Objetivos
            </p>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {section.objectives.map((item, index) => (
                <li
                  key={item}
                  className="flex items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {section?.tips?.length ? (
          <div className="space-y-2 rounded-lg border border-astro-amber/30 bg-astro-amber/8 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-astro-amber">Dicas</p>
            <ul className="grid gap-1 text-sm">
              {section.tips.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-astro-amber" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
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
        {item.difficulty ? ` · ${item.difficulty}` : null}
        {item.requireExplanation ? " · reflexão" : null}
      </p>
      {item.topics && item.topics.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.topics.map((topic) => (
            <Badge key={topic} variant="outline" className="text-xs font-normal">
              {topic}
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="mt-2">
        <PromptMedia
          imageDataUrl={item.imageDataUrl}
          imagePosition={item.imagePosition}
          className="max-h-56"
        >
          {hasContentBlocks(item.intro) || hasContentBlocks(item.promptBlocks) ? (
            <div className="space-y-3">
              <ContentBlockList blocks={item.intro} className="text-muted-foreground" />
              <ContentBlockList blocks={item.promptBlocks} questionClassName="text-lg sm:text-xl" />
            </div>
          ) : (
            <RichText
              value={isCard ? item.front : item.prompt}
              className="rich-text-prompt font-medium"
            />
          )}
        </PromptMedia>
      </div>
      {isCard ? <RichText value={item.back} className="mt-2 text-sm" /> : null}
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
        <ul className="mt-3 grid gap-1.5 text-sm">
          {item.options.map((option, optionIndex) => (
            <li
              key={option.id}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2",
                option.isCorrect
                  ? "border-success/40 bg-success/6"
                  : "border-border/60 bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-bold",
                  option.isCorrect ? "bg-success text-white" : "bg-card text-muted-foreground"
                )}
              >
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <AlternativeBody text={option.text} imageUrl={option.imageUrl} textClassName="text-sm" />
            </li>
          ))}
        </ul>
      ) : null}
      {item.feedbackMessages && item.feedbackMessages.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {item.feedbackMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <ContentBlockList blocks={item.feedbackBlocks} className="mt-3" />
      {!hasContentBlocks(item.feedbackBlocks) &&
      !(item.feedbackMessages && item.feedbackMessages.length > 0) &&
      item.explanation ? (
        <div className="mt-3 rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Explicação
          </p>
          <RichText value={item.explanation} className="mt-1 text-sm" />
        </div>
      ) : null}
    </>
  )
}
