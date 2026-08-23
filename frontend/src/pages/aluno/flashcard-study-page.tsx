import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { findSection, hasSectionCopy } from "@/lib/item-kinds"
import type { ActivitySection, StudyFlashcardCard, StudyFlashcardSession } from "@/lib/types"

type Phase = "prep" | "cards" | "done"

export function AlunoFlashcardStudyPage() {
  const { activityId } = useParams()
  const location = useLocation()
  const { session: authSession } = useAuth()
  const isGuest = location.pathname.startsWith("/explorar") || !authSession
  const backHref = isGuest ? "/" : "/aluno/estudar"
  const [session, setSession] = useState<StudyFlashcardSession | null>(null)
  const [prep, setPrep] = useState<ActivitySection | null>(null)
  const [feedback, setFeedback] = useState<ActivitySection | null>(null)
  const [queue, setQueue] = useState<StudyFlashcardCard[]>([])
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [phase, setPhase] = useState<Phase>("cards")

  useEffect(() => {
    if (!activityId) return
    const activityLoader = isGuest ? api.getPublicActivity(activityId) : api.getActivity(activityId)
    const deckLoader = isGuest
      ? api.getPublicFlashcardSession(activityId)
      : api.getFlashcardSession(activityId)

    Promise.all([activityLoader, deckLoader])
      .then(([activity, data]) => {
        const prepSection = findSection(activity.sections, "prep")
        const feedbackSection = findSection(activity.sections, "feedback")
        setPrep(prepSection ?? null)
        setFeedback(feedbackSection ?? null)
        setSession(data)
        setQueue(data.cards)
        if (hasSectionCopy(prepSection) && data.cards.length > 0) {
          setPhase("prep")
        } else if (data.cards.length === 0) {
          setPhase("done")
        } else {
          setPhase("cards")
        }
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar flashcards")
      )
      .finally(() => setLoading(false))
  }, [activityId, isGuest])

  const card = queue[0]

  async function review(remembered: boolean) {
    if (!activityId || !card || submitting) return
    setSubmitting(true)
    try {
      if (!isGuest) {
        const result = await api.submitFlashcardReview(activityId, card.id, remembered)
        setQueue((prev) => {
          const rest = prev.slice(1)
          return remembered ? rest : [...rest, { ...card, boxLevel: result.boxLevel }]
        })
      } else {
        setQueue((prev) => {
          const rest = prev.slice(1)
          return remembered ? rest : [...rest, card]
        })
      }
      setReviewed((prev) => prev + 1)
      setFlipped(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar revisão")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!loading && session && phase === "cards" && queue.length === 0) {
      setPhase("done")
    }
  }, [loading, session, phase, queue.length])

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
              <Link to={backHref} className="hover:text-primary">
                {isGuest ? "Início" : "Estudar"}
              </Link>{" "}
              / {session.title}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{session.title}</h1>
            <p className="mt-2 text-muted-foreground">
              Acerto avança o cartão nas caixas 1 a 5; erro volta para a caixa 1.
            </p>
          </div>

          {phase === "prep" ? (
            <div className="space-y-4 rounded-lg border border-border p-6">
              <Badge variant="secondary">Preparação</Badge>
              <h2 className="font-display text-xl font-semibold">
                {prep?.title?.trim() || "Antes de começar"}
              </h2>
              {prep?.body?.trim() ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{prep.body}</p>
              ) : null}
              <Button type="button" onClick={() => setPhase("cards")}>
                Começar revisão
              </Button>
            </div>
          ) : null}

          {phase === "done" || (phase === "cards" && !card) ? (
            <div className="space-y-4 rounded-lg border border-border p-6">
              <Badge variant="secondary">Resultados</Badge>
              <h2 className="font-display text-xl font-semibold">
                {feedback?.title?.trim() || (reviewed > 0 ? "Sessão concluída" : "Nada para revisar agora")}
              </h2>
              {feedback?.body?.trim() ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{feedback.body}</p>
              ) : null}
              <p className="text-muted-foreground">
                {reviewed > 0
                  ? `Você revisou ${reviewed} cartão(ões). Os demais voltam quando chegar a hora da caixa.`
                  : "Nenhum cartão está devido. Volte mais tarde para a repetição espaçada."}
              </p>
              <Button asChild variant="outline">
                <Link to={backHref}>Voltar à lista</Link>
              </Button>
            </div>
          ) : null}

          {phase === "cards" && card ? (
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
                {!flipped && card.imageDataUrl ? (
                  <img
                    src={card.imageDataUrl}
                    alt=""
                    className="mt-3 max-h-56 w-full rounded-md object-contain"
                  />
                ) : null}
                <p className="mt-3 font-display text-2xl font-semibold">
                  {flipped ? card.back : card.front}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  {flipped ? "Avalie se você lembrava" : "Toque para ver a resposta"}
                </p>
              </button>

              {flipped ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" disabled={submitting} onClick={() => void review(true)}>
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
          ) : null}
        </div>
      )}
    </AppShell>
  )
}
