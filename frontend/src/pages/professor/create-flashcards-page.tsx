import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { CreateActivityRequest } from "@/lib/types"

type DraftCard = { key: string; front: string; back: string }

function newCard(): DraftCard {
  return { key: crypto.randomUUID(), front: "", back: "" }
}

export function ProfessorCreateFlashcardsPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [cards, setCards] = useState<DraftCard[]>([newCard()])
  const [saving, setSaving] = useState(false)

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

    const payload: CreateActivityRequest = {
      title: title.trim(),
      type: "flashcards",
      items: cards.map((card) => ({
        front: card.front.trim(),
        back: card.back.trim(),
      })),
    }

    setSaving(true)
    try {
      const created = await api.createActivity(payload)
      toast.success("Deck de flashcards criado. Vincule-o às turmas quando quiser.")
      navigate(`/professor/atividades/${created.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar flashcards")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="Novos flashcards">
      <form className="space-y-8" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/professor/atividades" className="hover:text-primary">
              Atividades
            </Link>{" "}
            / Novos flashcards
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Criar flashcards</h1>
          <p className="mt-2 text-muted-foreground">
            Frente com o conceito ou pergunta; verso com a resposta.
          </p>
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

        <div className="space-y-6">
          {cards.map((card, index) => (
            <section key={card.key} className="space-y-4 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Cartão {index + 1}</h2>
                {cards.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCards((prev) => prev.filter((item) => item.key !== card.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`front-${card.key}`}>Frente</Label>
                  <Textarea
                    id={`front-${card.key}`}
                    value={card.front}
                    onChange={(event) => updateCard(card.key, { front: event.target.value })}
                    placeholder="Fotossíntese"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`back-${card.key}`}>Verso</Label>
                  <Textarea
                    id={`back-${card.key}`}
                    value={card.back}
                    onChange={(event) => updateCard(card.key, { back: event.target.value })}
                    placeholder="Conversão de luz em energia química"
                  />
                </div>
              </div>
            </section>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={() => setCards((prev) => [...prev, newCard()])}>
          <Plus className="h-4 w-4" />
          Novo cartão
        </Button>

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Criar flashcards"}
          </Button>
        </div>
      </form>
    </AppShell>
  )
}
