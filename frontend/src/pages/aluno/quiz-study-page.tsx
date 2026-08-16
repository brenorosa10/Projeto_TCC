import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Activity, ActivityItem, StudyAnswerFeedback } from "@/lib/types"

export function AlunoQuizStudyPage() {
  const { activityId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const isGuest = location.pathname.startsWith("/explorar") || !session
  const [quiz, setQuiz] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<StudyAnswerFeedback | null>(null)
  const [results, setResults] = useState<StudyAnswerFeedback[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [finished, setFinished] = useState(false)
  const startedAtRef = useRef(Date.now())
  const submittingRef = useRef(false)

  const questions = quiz?.items ?? []
  const question: ActivityItem | undefined = questions[index]

  useEffect(() => {
    if (!activityId) return
    const load = isGuest ? api.getPublicActivity(activityId) : api.getActivity(activityId)
    load
      .then((activity) => {
        if (activity.type === "flashcards") {
          navigate(
            isGuest
              ? `/explorar/flashcards/${activityId}`
              : `/aluno/estudar/flashcards/${activityId}`,
            { replace: true }
          )
          return
        }
        if (activity.type !== "quiz") {
          toast.error("Esta atividade não é um quiz.")
          navigate(isGuest ? "/" : "/aluno/estudar")
          return
        }
        setQuiz(activity)
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "Erro ao carregar quiz")
      )
      .finally(() => setLoading(false))
  }, [activityId, isGuest, navigate])

  async function submitAnswer(optionId: string) {
    if (!activityId || !question || submittingRef.current || feedback) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const payload = {
        itemId: question.id,
        selectedOptionId: optionId,
        responseTimeMs: Date.now() - startedAtRef.current,
      }
      const response = isGuest
        ? await api.submitPublicAnswer(activityId, payload)
        : await api.submitStudyAnswer(activityId, payload)
      setFeedback(response)
      setResults((prev) => [...prev, response])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar resposta")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function goNext() {
    if (index + 1 >= questions.length) {
      setFinished(true)
      return
    }
    setIndex((prev) => prev + 1)
    setSelectedOptionId(null)
    setFeedback(null)
    startedAtRef.current = Date.now()
  }

  function restart() {
    submittingRef.current = false
    setIndex(0)
    setSelectedOptionId(null)
    setFeedback(null)
    setResults([])
    setFinished(false)
    startedAtRef.current = Date.now()
  }

  const correctCount = results.filter((item) => item.isCorrect).length

  return (
    <AppShell title="Estudar quiz">
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !quiz || questions.length === 0 ? (
        <p className="text-muted-foreground">Quiz não encontrado.</p>
      ) : (
        <div className="space-y-8">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link to={isGuest ? "/" : "/aluno/estudar"} className="hover:text-primary">
                {isGuest ? "Início" : "Estudar"}
              </Link>{" "}
              / {quiz.title}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{quiz.title}</h1>
          </div>

          {finished ? (
            <div className="space-y-4 rounded-lg border border-border p-6">
              <h2 className="font-display text-xl font-semibold">Resultado</h2>
              <p className="text-muted-foreground">
                Você acertou <span className="font-medium text-foreground">{correctCount}</span> de{" "}
                <span className="font-medium text-foreground">{questions.length}</span> questões.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={restart}>
                  Refazer
                </Button>
                <Button asChild variant="outline">
                  <Link to={isGuest ? "/" : "/aluno/estudar"}>Voltar à lista</Link>
                </Button>
              </div>
            </div>
          ) : question ? (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Questão {index + 1} de {questions.length}
              </p>

              <p className="font-display text-xl font-semibold">{question.prompt}</p>
              {question.imageDataUrl ? (
                <img
                  src={question.imageDataUrl}
                  alt=""
                  className="max-h-64 w-full rounded-lg border border-border object-contain bg-muted/30"
                />
              ) : null}

              <ul className="grid gap-2">
                {question.options?.map((option) => {
                  const isSelected = selectedOptionId === option.id
                  const isCorrect = feedback?.correctOptionId === option.id
                  const isWrongPick =
                    Boolean(feedback) && isSelected && !feedback?.isCorrect

                  return (
                    <li key={option.id}>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={Boolean(feedback) || submitting}
                        onClick={() => setSelectedOptionId(option.id)}
                        className={cn(
                          "h-auto w-full justify-start whitespace-normal px-4 py-3 text-left",
                          isSelected && !feedback && "border-primary",
                          isCorrect && "border-primary bg-primary/10 text-foreground",
                          isWrongPick && "border-destructive bg-destructive/10"
                        )}
                      >
                        {option.text}
                        {feedback && isCorrect ? " (correta)" : null}
                      </Button>
                    </li>
                  )
                })}
              </ul>

              {feedback ? (
                <div className="space-y-3">
                  <p className={feedback.isCorrect ? "font-medium text-primary" : "font-medium text-destructive"}>
                    {feedback.isCorrect ? "Você acertou." : "Resposta incorreta."}
                  </p>
                  {feedback.explanation ? (
                    <p className="text-sm text-muted-foreground">{feedback.explanation}</p>
                  ) : null}
                  <Button type="button" onClick={goNext}>
                    {index + 1 >= questions.length ? "Ver resultado" : "Próxima"}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  disabled={!selectedOptionId || submitting}
                  onClick={() => selectedOptionId && void submitAnswer(selectedOptionId)}
                >
                  {submitting ? "Enviando..." : "Responder"}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  )
}
