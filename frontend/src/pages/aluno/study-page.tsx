import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { StudyFlashcardSummary, StudyQuizSummary } from "@/lib/types"

export function AlunoStudyPage() {
  const [quizzes, setQuizzes] = useState<StudyQuizSummary[]>([])
  const [decks, setDecks] = useState<StudyFlashcardSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.listStudyQuizzes(), api.listStudyFlashcards()])
      .then(([quizData, deckData]) => {
        setQuizzes(quizData)
        setDecks(deckData)
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar estudo")
      )
      .finally(() => setLoading(false))
  }, [])

  const empty = quizzes.length === 0 && decks.length === 0

  return (
    <AppShell title="Estudar">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-3xl font-semibold">Estudo off-line</h1>
        <p className="max-w-2xl text-muted-foreground">
          Quizzes com feedback imediato e flashcards com repetição espaçada (Leitner, caixas 1 a 5).
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : empty ? (
        <p className="text-muted-foreground">
          Nenhum quiz ou deck vinculado às suas turmas ainda.
        </p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-xl font-semibold">Quizzes</h2>
            {quizzes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum quiz disponível.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {quizzes.map((quiz) => (
                  <li
                    key={quiz.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{quiz.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">Quiz</Badge>
                        <span>
                          {quiz.itemCount} questão(ões)
                          {quiz.classNames.length > 0 ? ` · ${quiz.classNames.join(", ")}` : null}
                        </span>
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link to={`/aluno/estudar/${quiz.id}`}>Estudar</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold">Flashcards</h2>
            {decks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhum deck disponível.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {decks.map((deck) => (
                  <li
                    key={deck.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{deck.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">Flashcards</Badge>
                        <span>
                          {deck.dueCount} para revisar agora · {deck.itemCount} cartão(ões)
                          {deck.classNames.length > 0 ? ` · ${deck.classNames.join(", ")}` : null}
                        </span>
                      </div>
                    </div>
                    <Button asChild size="sm">
                      <Link to={`/aluno/estudar/flashcards/${deck.id}`}>Estudar</Link>
                    </Button>
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
