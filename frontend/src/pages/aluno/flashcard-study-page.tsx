import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { StudyFlashcardCard, StudyFlashcardSession } from "@/lib/types"

export function AlunoFlashcardStudyPage() {
  const { activityId } = useParams()
  const [session, setSession] = useState<StudyFlashcardSession | null>(null)
  const [queue, setQueue] = useState<StudyFlashcardCard[]>([])
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!activityId) return
    api
      .getFlashcardSession(activityId)
      .then((data) => {
        setSession(data)
        setQueue(data.cards)
        setFinished(data.cards.length === 0)
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar flashcards")
      )
      .finally(() => setLoading(false))
  }, [activityId])

  const card = queue[0]

  async function review(remembered: boolean) {
    if (!activityId || !card || submitting) return
    setSubmitting(true)
    try {
      const result = await api.submitFlashcardReview(activityId, card.id, remembered)
      setReviewed((prev) => prev + 1)
      setFlipped(false)
      setQueue((prev) => {
        const rest = prev.slice(1)
        if (!remembered) {
          return [...rest, { ...card, boxLevel: result.boxLevel }]
        }
        return rest
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar revisão")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!loading && session && queue.length === 0 && reviewed > 0) {
      setFinished(true)
    }
  }, [loading, session, queue.length, reviewed])

  return (
    <AppShell title="Estudar flashcards">
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !session ? (
        <p className="text-muted-foreground">Deck não encontrado.</p>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to="/aluno/estudar" className="hover:text-primary">
                Estudar
              </Link>{" "}
              / {session.title}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{session.title}</h1>
            <p className="mt-2 text-muted-foreground">
              Acerto avança o cartão nas caixas 1 a 5; erro volta para a caixa 1.
            </p>
          </div>

          {finished || !card ? (
            <div className="space-y-4 rounded-lg border border-border p-6">
              <h2 className="font-display text-xl font-semibold">
                {reviewed > 0 ? "Sessão concluída" : "Nada para revisar agora"}
              </h2>
              <p className="text-muted-foreground">
                {reviewed > 0
                  ? `Você revisou ${reviewed} cartão(ões). Os demais voltam quando chegar a hora da caixa.`
                  : "Nenhum cartão está devido. Volte mais tarde para a repetição espaçada."}
              </p>
              <Button asChild variant="outline">
                <Link to="/aluno/estudar">Voltar à lista</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Cartão {reviewed + 1} · {queue.length} restante(s) nesta sessão · caixa {card.boxLevel}
              </p>

              <button
                type="button"
                onClick={() => setFlipped((prev) => !prev)}
                className="flex min-h-48 w-full flex-col items-center justify-center rounded-lg border border-border bg-background px-6 py-10 text-center"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {flipped ? "Verso" : "Frente"}
                </p>
                <p className="mt-3 font-display text-2xl font-semibold">
                  {flipped ? card.back : card.front}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  {flipped ? "Avalie se você lembrava" : "Toque para ver a resposta"}
                </p>
              </button>

              {flipped ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => void review(true)}
                  >
                    Lembrei
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => void review(false)}
                  >
                    Não lembrei
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="secondary" onClick={() => setFlipped(true)}>
                  Mostrar verso
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
