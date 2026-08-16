import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { ItemImageField } from "@/components/activity/item-image-field"
import { VisibilityCheckbox } from "@/components/activity/visibility-checkbox"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { assertActivityPayloadFits } from "@/lib/compress-image"
import type { CreateActivityRequest } from "@/lib/types"

type DraftOption = { key: string; id?: string; text: string; isCorrect: boolean }
type DraftQuestion = {
  key: string
  id?: string
  prompt: string
  explanation: string
  timeLimitSeconds: number
  options: DraftOption[]
  imageDataUrl?: string
}

function newOption(isCorrect = false): DraftOption {
  return { key: crypto.randomUUID(), text: "", isCorrect }
}

function newQuestion(): DraftQuestion {
  return {
    key: crypto.randomUUID(),
    prompt: "",
    explanation: "",
    timeLimitSeconds: 30,
    options: [newOption(true), newOption(), newOption(), newOption()],
  }
}

export function ProfessorCreateQuizPage() {
  const { activityId } = useParams()
  const isEditing = Boolean(activityId)
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!activityId) return
    api
      .getActivity(activityId)
      .then((activity) => {
        if (activity.type !== "quiz") {
          toast.error("Esta atividade não é um quiz.")
          navigate(`/professor/atividades/${activity.id}`, { replace: true })
          return
        }
        setTitle(activity.title)
        setIsPublic(Boolean(activity.isPublic))
        setQuestions(
          activity.items.map((item) => ({
            key: item.id,
            id: item.id,
            prompt: item.prompt ?? "",
            explanation: item.explanation ?? "",
            timeLimitSeconds: item.timeLimitSeconds ?? 30,
            imageDataUrl: item.imageDataUrl ?? undefined,
            options:
              item.options && item.options.length > 0
                ? item.options.map((option) => ({
                    key: option.id,
                    id: option.id,
                    text: option.text,
                    isCorrect: Boolean(option.isCorrect),
                  }))
                : [newOption(true), newOption()],
          }))
        )
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar quiz")
        navigate("/professor/atividades")
      })
      .finally(() => setLoading(false))
  }, [activityId, navigate])

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function updateOption(questionKey: string, optionKey: string, text: string) {
    setQuestions((prev) =>
      prev.map((item) =>
        item.key === questionKey
          ? {
              ...item,
              options: item.options.map((option) =>
                option.key === optionKey ? { ...option, text } : option
              ),
            }
          : item
      )
    )
  }

  function markCorrect(questionKey: string, optionKey: string) {
    setQuestions((prev) =>
      prev.map((item) =>
        item.key === questionKey
          ? {
              ...item,
              options: item.options.map((option) => ({
                ...option,
                isCorrect: option.key === optionKey,
              })),
            }
          : item
      )
    )
  }

  function addOption(questionKey: string) {
    setQuestions((prev) =>
      prev.map((item) =>
        item.key === questionKey && item.options.length < 5
          ? { ...item, options: [...item.options, newOption()] }
          : item
      )
    )
  }

  function removeOption(questionKey: string, optionKey: string) {
    setQuestions((prev) =>
      prev.map((item) => {
        if (item.key !== questionKey || item.options.length <= 2) return item
        const options = item.options.filter((option) => option.key !== optionKey)
        if (!options.some((option) => option.isCorrect)) {
          options[0] = { ...options[0], isCorrect: true }
        }
        return { ...item, options }
      })
    )
  }

  function buildPayload(): CreateActivityRequest | null {
    if (!title.trim()) {
      toast.error("Informe o título do quiz.")
      return null
    }

    for (const [index, question] of questions.entries()) {
      if (!question.prompt.trim()) {
        toast.error(`A questão ${index + 1} precisa de um enunciado.`)
        return null
      }
      if (question.options.some((option) => !option.text.trim())) {
        toast.error(`Preencha todas as alternativas da questão ${index + 1}.`)
        return null
      }
      if (question.options.filter((option) => option.isCorrect).length !== 1) {
        toast.error(`Marque exatamente uma alternativa correta na questão ${index + 1}.`)
        return null
      }
    }

    try {
      assertActivityPayloadFits(questions.map((question) => question.imageDataUrl))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Imagens grandes demais.")
      return null
    }

    return {
      title: title.trim(),
      type: "quiz",
      isPublic,
      items: questions.map((question) => ({
        id: question.id,
        prompt: question.prompt.trim(),
        explanation: question.explanation.trim() || undefined,
        timeLimitSeconds: question.timeLimitSeconds || 30,
        imageDataUrl: question.imageDataUrl,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text.trim(),
          isCorrect: option.isCorrect,
        })),
      })),
    }
  }

  async function saveQuiz(importCards: boolean) {
    const payload = buildPayload()
    if (!payload) return

    setSaving(true)
    try {
      const quiz = isEditing && activityId
        ? await api.updateActivity(activityId, payload)
        : await api.createActivity(payload)
      if (importCards) {
        const deck = await api.importFlashcards(quiz.id)
        toast.success(
          isEditing
            ? `Quiz atualizado. ${deck.itemCount} flashcard(s) sincronizados a partir das respostas corretas.`
            : `Quiz criado. ${deck.itemCount} flashcard(s) importados a partir das respostas corretas.`
        )
      } else {
        toast.success(
          isEditing
            ? "Quiz atualizado."
            : "Quiz criado. Vincule-o às turmas quando quiser."
        )
      }
      navigate(`/professor/atividades/${quiz.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar quiz")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title={isEditing ? "Editar quiz" : "Novo quiz"}>
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
      <div className="space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/professor/atividades" className="hover:text-primary">
              Atividades
            </Link>
            {isEditing && activityId ? (
              <>
                {" "}
                /{" "}
                <Link to={`/professor/atividades/${activityId}`} className="hover:text-primary">
                  Detalhe
                </Link>
              </>
            ) : null}{" "}
            / {isEditing ? "Editar quiz" : "Novo quiz"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            {isEditing ? "Editar quiz" : "Criar quiz"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            2 a 5 alternativas por questão, com exatamente uma resposta correta. O mesmo quiz
            pode ser vinculado a várias turmas depois; a sessão ao vivo é iniciada à parte.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="quiz-title">Título</Label>
          <Input
            id="quiz-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Sistema Solar"
            required
          />
        </div>

        <VisibilityCheckbox id="quiz-public" checked={isPublic} onChange={setIsPublic} />

        <div className="space-y-6">
          {questions.map((question, index) => (
            <section key={question.key} className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Questão {index + 1}</h2>
                {questions.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setQuestions((prev) => prev.filter((item) => item.key !== question.key))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`prompt-${question.key}`}>Enunciado</Label>
                <Textarea
                  id={`prompt-${question.key}`}
                  value={question.prompt}
                  onChange={(event) => updateQuestion(question.key, { prompt: event.target.value })}
                  placeholder="Qual o maior planeta do Sistema Solar?"
                />
              </div>

              <ItemImageField
                id={`image-${question.key}`}
                imageDataUrl={question.imageDataUrl}
                onChange={(imageDataUrl) => updateQuestion(question.key, { imageDataUrl })}
              />

              <div className="grid gap-3">
                {question.options.map((option, optionIndex) => (
                  <div key={option.key} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${question.key}`}
                      checked={option.isCorrect}
                      onChange={() => markCorrect(question.key, option.key)}
                      aria-label={`Marcar alternativa ${optionIndex + 1} como correta`}
                    />
                    <Input
                      value={option.text}
                      onChange={(event) =>
                        updateOption(question.key, option.key, event.target.value)
                      }
                      placeholder={`Alternativa ${optionIndex + 1}`}
                    />
                    {question.options.length > 2 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover alternativa"
                        onClick={() => removeOption(question.key, option.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {question.options.length < 5 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => addOption(question.key)}>
                    <Plus className="h-4 w-4" />
                    Alternativa
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`time-${question.key}`}>Tempo (segundos)</Label>
                  <Input
                    id={`time-${question.key}`}
                    type="number"
                    min={5}
                    max={300}
                    value={question.timeLimitSeconds}
                    onChange={(event) =>
                      updateQuestion(question.key, {
                        timeLimitSeconds: Number(event.target.value) || 30,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`expl-${question.key}`}>Explicação (opcional)</Label>
                  <Input
                    id={`expl-${question.key}`}
                    value={question.explanation}
                    onChange={(event) =>
                      updateQuestion(question.key, { explanation: event.target.value })
                    }
                    placeholder="Aparece no gabarito"
                  />
                </div>
              </div>
            </section>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={() => setQuestions((prev) => [...prev, newQuestion()])}>
          <Plus className="h-4 w-4" />
          Nova questão
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" disabled={saving} onClick={() => void saveQuiz(false)}>
            {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar quiz"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void saveQuiz(true)}
          >
            {isEditing ? "Salvar e sincronizar flashcards" : "Importar flashcards"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Importar flashcards cria (ou atualiza) um deck em que a frente é o enunciado, o verso é a
          alternativa correta e a imagem da questão é copiada.
        </p>
      </div>
      )}
    </AppShell>
  )
}
