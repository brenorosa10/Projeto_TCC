import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { DeleteActivityButton } from "@/components/activity/delete-activity-button"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { api } from "@/lib/api"
import { activityCountLabel, cn, plural } from "@/lib/utils"
import type { ClassRoom, StudyFlashcardSummary, StudyQuizSummary } from "@/lib/types"

function classIdsOf(item: { classIds?: string[] }) {
  return item.classIds ?? []
}

function linkedToClass(
  item: { classIds?: string[]; classNames: string[] },
  classroom: ClassRoom
) {
  if (classIdsOf(item).includes(classroom.id)) return true
  if (classIdsOf(item).length === 0) return item.classNames.includes(classroom.name)
  return false
}

function isStandalone(
  item: { classIds?: string[]; classNames: string[]; ownedByMe?: boolean; isPublic?: boolean },
  enrolledIds: Set<string>,
  enrolledNames: Set<string>
) {
  if (classIdsOf(item).some((id) => enrolledIds.has(id))) return false
  if (item.classNames.some((name) => enrolledNames.has(name))) return false
  return Boolean(item.ownedByMe || item.isPublic || classIdsOf(item).length === 0)
}

export function AlunoStudyPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [quizzes, setQuizzes] = useState<StudyQuizSummary[]>([])
  const [decks, setDecks] = useState<StudyFlashcardSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [classData, quizData, deckData] = await Promise.all([
      api.listClasses(),
      api.listStudyQuizzes(),
      api.listStudyFlashcards(),
    ])
    setClasses(classData)
    setQuizzes(quizData)
    setDecks(deckData)
  }, [])

  useEffect(() => {
    load()
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar estudo")
      )
      .finally(() => setLoading(false))
  }, [load])

  const enrolledIds = new Set(classes.map((item) => item.id))
  const enrolledNames = new Set(classes.map((item) => item.name))
  const standaloneQuizzes = quizzes.filter((item) => isStandalone(item, enrolledIds, enrolledNames))
  const standaloneDecks = decks.filter((item) => isStandalone(item, enrolledIds, enrolledNames))
  const hasStandalone = standaloneQuizzes.length > 0 || standaloneDecks.length > 0

  return (
    <AppShell title="Estudar">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold">Estudo individual</h1>
          <p className="text-sm text-muted-foreground">
            Materiais das suas turmas e quizzes/flashcards avulsos para estudar no seu ritmo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/aluno/estudar/criar/quiz">Novo quiz avulso</Link>
          </Button>
          <Button asChild>
            <Link to="/aluno/estudar/criar/flashcards">Novo deck avulso</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-3">
          {classes.map((classroom, index) => {
            const classQuizzes = quizzes.filter((item) => linkedToClass(item, classroom))
            const classDecks = decks.filter((item) => linkedToClass(item, classroom))
            return (
              <StudyAccordion
                key={classroom.id}
                title={classroom.name}
                description={
                  classroom.professorName ? `Professor(a): ${classroom.professorName}` : undefined
                }
                counts={{ quizzes: classQuizzes.length, decks: classDecks.length }}
                defaultOpen={index === 0}
              >
                {classQuizzes.length === 0 && classDecks.length === 0 ? (
                  <EmptyState
                    title="Nada publicado nesta turma"
                    description="Quando o professor vincular quizzes ou flashcards, eles aparecem aqui."
                  />
                ) : (
                  <div className="space-y-6">
                    <StudyGroup
                      title="Quizzes"
                      empty="Nenhum quiz nesta turma."
                      quizzes={classQuizzes}
                    />
                    <StudyGroup
                      title="Flashcards"
                      empty="Nenhum deck nesta turma."
                      decks={classDecks}
                    />
                  </div>
                )}
              </StudyAccordion>
            )
          })}

          <StudyAccordion
            title="Avulsos"
            description="Seus materiais e conteúdos públicos, sem vínculo com turma."
            counts={{ quizzes: standaloneQuizzes.length, decks: standaloneDecks.length }}
            defaultOpen={classes.length === 0}
          >
            {!hasStandalone ? (
              <EmptyState
                title="Nenhum material avulso ainda"
                description="Crie um quiz ou um deck de flashcards para estudar mesmo sem estar em uma turma."
              />
            ) : (
              <div className="space-y-6">
                <StudyGroup
                  title="Quizzes"
                  empty="Nenhum quiz avulso."
                  quizzes={standaloneQuizzes}
                  allowManage
                  onChanged={() => void load()}
                />
                <StudyGroup
                  title="Flashcards"
                  empty="Nenhum deck avulso."
                  decks={standaloneDecks}
                  allowManage
                  onChanged={() => void load()}
                />
              </div>
            )}
          </StudyAccordion>
        </div>
      )}
    </AppShell>
  )
}

function StudyAccordion({
  title,
  description,
  counts,
  defaultOpen,
  children,
}: {
  title: string
  description?: string
  counts: { quizzes: number; decks: number }
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  const total = counts.quizzes + counts.decks

  return (
    <details
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open
        if (next !== open) setOpen(next)
      }}
      className="surface-card group overflow-hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {total === 0
              ? "Nenhum material"
              : `${counts.quizzes} quiz(zes) · ${counts.decks} deck(s)`}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </summary>
      <div className="space-y-4 border-t border-border/70 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </details>
  )
}

function StudyGroup({
  title,
  empty,
  quizzes,
  decks,
  allowManage,
  onChanged,
}: {
  title: string
  empty: string
  quizzes?: StudyQuizSummary[]
  decks?: StudyFlashcardSummary[]
  allowManage?: boolean
  onChanged?: () => void
}) {
  const quizItems = quizzes ?? []
  const deckItems = decks ?? []
  if (quizItems.length === 0 && deckItems.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="mt-3 grid gap-3">
        {quizItems.map((quiz) => (
          <StudyRow
            key={quiz.id}
            title={quiz.title}
            badges={
              <>
                <Badge variant="secondary">Quiz</Badge>
                {quiz.ownedByMe ? <Badge variant="outline">Seu</Badge> : null}
                {quiz.isPublic ? <Badge variant="outline">Público</Badge> : null}
                {quiz.completed ? (
                  <Badge variant="success">
                    Concluído
                    {typeof quiz.bestCorrect === "number" && typeof quiz.bestTotal === "number"
                      ? ` · melhor ${quiz.bestCorrect}/${quiz.bestTotal}`
                      : ""}
                  </Badge>
                ) : null}
              </>
            }
            meta={activityCountLabel(quiz.itemCount, "quiz")}
            href={`/aluno/estudar/${quiz.id}`}
            editHref={
              allowManage && quiz.ownedByMe ? `/aluno/estudar/criar/quiz/${quiz.id}` : undefined
            }
            manage={
              allowManage && quiz.ownedByMe ? (
                <DeleteActivityButton
                  activityId={quiz.id}
                  title={quiz.title}
                  type="quiz"
                  onDeleted={() => onChanged?.()}
                />
              ) : null
            }
          />
        ))}
        {deckItems.map((deck) => (
          <StudyRow
            key={deck.id}
            title={deck.title}
            badges={
              <>
                <Badge variant="secondary">Flashcards</Badge>
                {deck.ownedByMe ? <Badge variant="outline">Seu</Badge> : null}
                {deck.isPublic ? <Badge variant="outline">Público</Badge> : null}
              </>
            }
            meta={`${plural(deck.dueCount, "cartão para revisar agora", "cartões para revisar agora")} · ${activityCountLabel(deck.itemCount, "flashcards")}`}
            href={`/aluno/estudar/flashcards/${deck.id}`}
            editHref={
              allowManage && deck.ownedByMe
                ? `/aluno/estudar/criar/flashcards/${deck.id}`
                : undefined
            }
            manage={
              allowManage && deck.ownedByMe ? (
                <DeleteActivityButton
                  activityId={deck.id}
                  title={deck.title}
                  type="flashcards"
                  onDeleted={() => onChanged?.()}
                />
              ) : null
            }
          />
        ))}
      </ul>
    </div>
  )
}

function StudyRow({
  title,
  badges,
  meta,
  href,
  editHref,
  manage,
}: {
  title: string
  badges: ReactNode
  meta: string
  href: string
  editHref?: string
  manage?: ReactNode
}) {
  return (
    <li className="surface-card flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {badges}
          <span>{meta}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editHref ? (
          <Button asChild size="sm" variant="outline">
            <Link to={editHref}>Editar</Link>
          </Button>
        ) : null}
        {manage}
        <Button asChild size="sm">
          <Link to={href}>Estudar</Link>
        </Button>
      </div>
    </li>
  )
}
