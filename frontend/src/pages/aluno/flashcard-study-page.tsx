import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Check, Layers, RefreshCw, Sparkles } from "lucide-react"
import { FlashcardFace, FlashcardFlip } from "@/components/activity/flashcard-flip"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { EmptyState, PageLoader } from "@/components/ui/page-loader"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { PrepPanel } from "@/components/activity/prep-panel"
import { ResultPanel } from "@/components/activity/result-panel"
import { MediaFrame } from "@/components/activity/media-frame"
import { RichText } from "@/components/rich-text/rich-text"
import { findSection, hasSectionCopy } from "@/lib/item-kinds"
import { plural } from "@/lib/utils"
import type { ActivitySection, StudyFlashcardCard, StudyFlashcardSession } from "@/lib/types"

type Phase = "prep" | "cards" | "done"

export function AlunoFlashcardStudyPage() {
  const { activityId } = useParams()
  const location = useLocation()
  const { session: authSession, profile } = useAuth()
  const exploring = location.pathname.startsWith("/explorar")
  const isGuest = exploring || !authSession
  const backHref =
    authSession && exploring
      ? profile?.role === "professor"
        ? "/professor"
        : "/aluno"
      : isGuest
        ? "/"
        : "/aluno/estudar"
  const [session, setSession] = useState<StudyFlashcardSession | null>(null)
  const [prep, setPrep] = useState<ActivitySection | null>(null)
  const [feedback, setFeedback] = useState<ActivitySection | null>(null)
  const [queue, setQueue] = useState<StudyFlashcardCard[]>([])
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reviewedIds, setReviewedIds] = useState<string[]>([])
  const [repetitions, setRepetitions] = useState(0)
  const [phase, setPhase] = useState<Phase>("cards")

  useEffect(() => {
    if (!activityId) return
    let cancelled = false
    const activityLoader = isGuest ? api.getPublicActivity(activityId) : api.getActivity(activityId)
    const deckLoader = isGuest
      ? api.getPublicFlashcardSession(activityId)
      : api.getFlashcardSession(activityId)

    Promise.all([activityLoader, deckLoader])
      .then(([activity, data]) => {
        if (cancelled) return
        const prepSection = findSection(activity.sections, "prep")
        const feedbackSection = findSection(activity.sections, "feedback")
        setPrep(prepSection ?? null)
        setFeedback(feedbackSection ?? null)
        setSession(data)
        setQueue(data.cards)
        setReviewedIds([])
        setRepetitions(0)
        if (hasSectionCopy(prepSection) && data.cards.length > 0) {
          setPhase("prep")
        } else if (data.cards.length === 0) {
          setPhase("done")
        } else {
          setPhase("cards")
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        toast.error(error instanceof Error ? error.message : "Erro ao carregar flashcards")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activityId, isGuest])

  const card = queue[0]
  const distinctReviewed = reviewedIds.length
  const sessionCap = session ? Math.max(session.itemCount, session.dueCount) : 0
  const cardCap = session ? Math.min(sessionCap, Math.max(session.dueCount, distinctReviewed)) : 0
  const currentIsNew = Boolean(card && !reviewedIds.includes(card.id))
  const cardPosition = Math.min(cardCap || sessionCap, distinctReviewed + (currentIsNew ? 1 : 0))

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
      setReviewedIds((prev) => (prev.includes(card.id) ? prev : [...prev, card.id]))
      setRepetitions((prev) => prev + 1)
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
        <PageLoader />
      ) : !session ? (
        <EmptyState
          icon={Layers}
          title="Deck não encontrado"
          description="O deck pode ter sido removido ou o link está incorreto."
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to={backHref} className="transition-colors hover:text-primary">
                {isGuest ? "Início" : "Estudar"}
              </Link>{" "}
              / {session.title}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold text-balance">{session.title}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              Repetição espaçada: acertar avança o cartão nas caixas 1 a 5; errar volta para a caixa 1.
            </p>
          </div>

          {phase === "prep" ? (
            <PrepPanel
              title={prep?.title}
              body={prep?.body}
              objectives={prep?.objectives}
              estimatedMinutes={prep?.estimatedMinutes}
              tips={prep?.tips}
              imageDataUrl={prep?.imageDataUrl}
              videoUrl={prep?.videoUrl}
              videoKind={prep?.videoKind}
              itemCount={queue.length}
              actionLabel="Começar revisão"
              onContinue={() => setPhase("cards")}
            />
          ) : null}

          {phase === "done" || (phase === "cards" && !card) ? (
            <ResultPanel
              title={
                feedback?.title?.trim() ||
                (distinctReviewed > 0 ? "Sessão concluída" : "Nada para revisar agora")
              }
              body={feedback?.body}
              summary={
                <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3.5">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p className="text-sm text-foreground/85">
                    {distinctReviewed > 0
                      ? `Você revisou ${plural(distinctReviewed, "cartão", "cartões")}${
                          repetitions > distinctReviewed
                            ? `, em ${plural(repetitions, "repetição", "repetições")}`
                            : ""
                        }. Os demais voltam quando chegar a hora da caixa.`
                      : "Nenhum cartão está devido agora. Volte mais tarde para a repetição espaçada."}
                  </p>
                </div>
              }
              actions={
                <Button asChild variant="outline">
                  <Link to={backHref}>Voltar à lista</Link>
                </Button>
              }
            />
          ) : null}

          {phase === "cards" && card ? (
            <div className="space-y-5">
              <div className="surface-card flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="font-semibold">
                  Cartão {cardPosition}
                  {cardCap > 0 ? ` de ${cardCap}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {plural(queue.length, "restante", "restantes")}
                </span>
                {repetitions > distinctReviewed ? (
                  <span className="text-muted-foreground">
                    · {plural(repetitions, "repetição", "repetições")}
                  </span>
                ) : null}
                <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  Caixa {card.boxLevel}
                </span>
              </div>

              <FlashcardFlip
                key={card.id}
                flipped={flipped}
                onFlip={() => setFlipped((prev) => !prev)}
                front={
                  <FlashcardFace label="Frente" hint="Toque no cartão para ver a resposta">
                    <MediaFrame
                      imageDataUrl={card.imageDataUrl}
                      videoUrl={card.videoUrl}
                      videoKind={card.videoKind}
                      alt="Mídia da frente do cartão"
                      className="mb-4"
                    />
                    <RichText
                      value={card.front}
                      className="rich-text-prompt font-display text-2xl font-semibold sm:text-3xl"
                    />
                  </FlashcardFace>
                }
                back={
                  <FlashcardFace label="Verso" hint="Avalie se você lembrava">
                    <RichText
                      value={card.back}
                      className="rich-text-prompt font-display text-2xl font-semibold sm:text-3xl"
                    />
                  </FlashcardFace>
                }
              />

              {flipped ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    size="lg"
                    disabled={submitting}
                    onClick={() => void review(true)}
                  >
                    <Check className="h-4 w-4" />
                    Lembrei
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => void review(false)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Não lembrei
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setFlipped(true)}
                >
                  Virar cartão
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  )
}
