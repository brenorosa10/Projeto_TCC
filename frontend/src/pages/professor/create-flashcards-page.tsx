import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { ItemImageField } from "@/components/activity/item-image-field"
import { PrepFeedbackFields } from "@/components/activity/prep-feedback-fields"
import { VisibilityCheckbox } from "@/components/activity/visibility-checkbox"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { PageLoader } from "@/components/ui/page-loader"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { api } from "@/lib/api"
import { assertActivityPayloadFits } from "@/lib/compress-image"
import { findSection } from "@/lib/item-kinds"
import type { CreateActivityRequest } from "@/lib/types"

type DraftCard = { key: string; id?: string; front: string; back: string; imageDataUrl?: string }

function newCard(): DraftCard {
  return { key: crypto.randomUUID(), front: "", back: "" }
}

export function ProfessorCreateFlashcardsPage() {
  const { activityId } = useParams()
  const isEditing = Boolean(activityId)
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [prepId, setPrepId] = useState<string>()
  const [practiceId, setPracticeId] = useState<string>()
  const [feedbackId, setFeedbackId] = useState<string>()
  const [prepTitle, setPrepTitle] = useState("")
  const [prepBody, setPrepBody] = useState("")
  const [prepObjectives, setPrepObjectives] = useState("")
  const [prepMinutes, setPrepMinutes] = useState("")
  const [prepTips, setPrepTips] = useState("")
  const [prepImageDataUrl, setPrepImageDataUrl] = useState<string>()
  const [feedbackTitle, setFeedbackTitle] = useState("Resultados")
  const [feedbackBody, setFeedbackBody] = useState("")
  const [cards, setCards] = useState<DraftCard[]>([newCard()])
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!activityId) return
    api
      .getActivity(activityId)
      .then((activity) => {
        if (activity.type !== "flashcards") {
          toast.error("Esta atividade não é um deck de flashcards.")
          navigate(`/professor/atividades/${activity.id}`, { replace: true })
          return
        }
        setTitle(activity.title)
        setIsPublic(Boolean(activity.isPublic))
        const prep = findSection(activity.sections, "prep")
        const practice = findSection(activity.sections, "practice")
        const feedback = findSection(activity.sections, "feedback")
        setPrepId(prep?.id)
        setPracticeId(practice?.id)
        setFeedbackId(feedback?.id)
        setPrepTitle(prep?.title ?? "")
        setPrepBody(prep?.body ?? "")
        setPrepObjectives((prep?.objectives ?? []).join("\n"))
        setPrepMinutes(prep?.estimatedMinutes ? String(prep.estimatedMinutes) : "")
        setPrepTips((prep?.tips ?? []).join("\n"))
        setPrepImageDataUrl(prep?.imageDataUrl ?? undefined)
        setFeedbackTitle(feedback?.title ?? "Resultados")
        setFeedbackBody(feedback?.body ?? "")
        setCards(
          activity.items.map((item) => ({
            key: item.id,
            id: item.id,
            front: item.front ?? "",
            back: item.back ?? "",
            imageDataUrl: item.imageDataUrl ?? undefined,
          }))
        )
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar flashcards")
        navigate("/professor/atividades")
      })
      .finally(() => setLoading(false))
  }, [activityId, navigate])

  function updateCard(key: string, patch: Partial<DraftCard>) {
    setCards((prev) => prev.map((card) => (card.key === key ? { ...card, ...patch } : card)))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!title.trim()) {
      toast.error("Informe o título do deck.")
      return
    }

    for (const [index, card] of cards.entries()) {
      if (!card.front.trim() || !card.back.trim()) {
        toast.error(`Preencha frente e verso do cartão ${index + 1}.`)
        return
      }
    }

    try {
      assertActivityPayloadFits([
        prepImageDataUrl,
        ...cards.map((card) => card.imageDataUrl),
      ])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Imagens grandes demais.")
      return
    }

    const payload: CreateActivityRequest = {
      title: title.trim(),
      type: "flashcards",
      isPublic,
      sections: [
        {
          id: prepId,
          role: "prep",
          title: prepTitle.trim() || undefined,
          body: prepBody.trim() || undefined,
          objectives: prepObjectives.split("\n").map((line) => line.trim()).filter(Boolean),
          estimatedMinutes: Number(prepMinutes) || undefined,
          tips: prepTips.split("\n").map((line) => line.trim()).filter(Boolean),
          imageDataUrl: prepImageDataUrl,
        },
        {
          id: practiceId,
          role: "practice",
          items: cards.map((card) => ({
            id: card.id,
            kind: "flashcard",
            front: card.front.trim(),
            back: card.back.trim(),
            imageDataUrl: card.imageDataUrl,
          })),
        },
        {
          id: feedbackId,
          role: "feedback",
          title: feedbackTitle.trim() || "Resultados",
          body: feedbackBody.trim() || undefined,
          feedbackTemplate: "score_summary",
        },
      ],
    }

    setSaving(true)
    try {
      const saved = isEditing && activityId
        ? await api.updateActivity(activityId, payload)
        : await api.createActivity(payload)
      toast.success(
        isEditing
          ? "Deck atualizado."
          : "Deck de flashcards criado. Vincule-o às turmas quando quiser."
      )
      navigate(`/professor/atividades/${saved.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar flashcards")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title={isEditing ? "Editar flashcards" : "Novos flashcards"}>
      {loading ? (
        <PageLoader />
      ) : (
      <form className="space-y-8" onSubmit={(event) => void handleSubmit(event)}>
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
            / {isEditing ? "Editar flashcards" : "Novos flashcards"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            {isEditing ? "Editar flashcards" : "Criar flashcards"}
          </h1>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="deck-title">Título</Label>
          <Input
            id="deck-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Vocabulário — capítulo 2"
            required
          />
        </div>

        <VisibilityCheckbox id="deck-public" checked={isPublic} onChange={setIsPublic} />

        <PrepFeedbackFields
          prepTitle={prepTitle}
          prepBody={prepBody}
          prepObjectives={prepObjectives}
          prepMinutes={prepMinutes}
          prepTips={prepTips}
          prepImageDataUrl={prepImageDataUrl}
          feedbackTitle={feedbackTitle}
          feedbackBody={feedbackBody}
          onPrepTitle={setPrepTitle}
          onPrepBody={setPrepBody}
          onPrepObjectives={setPrepObjectives}
          onPrepMinutes={setPrepMinutes}
          onPrepTips={setPrepTips}
          onPrepImageDataUrl={setPrepImageDataUrl}
          onFeedbackTitle={setFeedbackTitle}
          onFeedbackBody={setFeedbackBody}
        />

        <div className="space-y-6">
          {cards.map((card, index) => (
            <section key={card.key} className="surface-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:px-6">
                <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                    {index + 1}
                  </span>
                  Cartão {index + 1}
                </h2>
                {cards.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setCards((prev) => prev.filter((item) => item.key !== card.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                ) : null}
              </div>
              <div className="space-y-5 p-4 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-2">
                  <RichTextEditor
                    id={`front-${card.key}`}
                    label="Frente"
                    value={card.front}
                    onChange={(front) => updateCard(card.key, { front })}
                    rows={4}
                    compact
                    placeholder="Fotossíntese"
                  />
                  <RichTextEditor
                    id={`back-${card.key}`}
                    label="Verso"
                    value={card.back}
                    onChange={(back) => updateCard(card.key, { back })}
                    rows={4}
                    compact
                    placeholder="Conversão de luz em energia química"
                  />
                </div>
                <ItemImageField
                  id={`image-${card.key}`}
                  imageDataUrl={card.imageDataUrl}
                  onChange={(imageDataUrl) => updateCard(card.key, { imageDataUrl })}
                />
              </div>
            </section>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full border-dashed"
          onClick={() => setCards((prev) => [...prev, newCard()])}
        >
          <Plus className="h-4 w-4" />
          Novo cartão
        </Button>

        <div className="sticky bottom-4 z-10">
          <div className="surface-raised flex flex-wrap items-center gap-3 p-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar flashcards"}
            </Button>
          </div>
        </div>
      </form>
      )}
    </AppShell>
  )
}
