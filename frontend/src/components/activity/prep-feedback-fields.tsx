import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function PrepFeedbackFields({
  prepTitle,
  prepBody,
  feedbackTitle,
  feedbackBody,
  onPrepTitle,
  onPrepBody,
  onFeedbackTitle,
  onFeedbackBody,
}: {
  prepTitle: string
  prepBody: string
  feedbackTitle: string
  feedbackBody: string
  onPrepTitle: (value: string) => void
  onPrepBody: (value: string) => void
  onFeedbackTitle: (value: string) => void
  onFeedbackBody: (value: string) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="font-display text-lg font-semibold">Antes de começar</h2>
        <p className="text-sm text-muted-foreground">
          Texto opcional de preparação. Se ficar vazio, o aluno vai direto para os itens.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="prep-title">Título</Label>
          <Input
            id="prep-title"
            value={prepTitle}
            onChange={(event) => onPrepTitle(event.target.value)}
            placeholder="Ex: Revise os planetas interiores"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="prep-body">Texto</Label>
          <Textarea
            id="prep-body"
            value={prepBody}
            onChange={(event) => onPrepBody(event.target.value)}
            placeholder="Contexto, dica ou objetivo da atividade"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="font-display text-lg font-semibold">Depois (feedback)</h2>
        <p className="text-sm text-muted-foreground">
          Mensagem ao terminar. O resumo de acertos é montado automaticamente.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="feedback-title">Título</Label>
          <Input
            id="feedback-title"
            value={feedbackTitle}
            onChange={(event) => onFeedbackTitle(event.target.value)}
            placeholder="Resultados"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="feedback-body">Texto</Label>
          <Textarea
            id="feedback-body"
            value={feedbackBody}
            onChange={(event) => onFeedbackBody(event.target.value)}
            placeholder="Parabéns, revise os itens marcados em vermelho..."
          />
        </div>
      </section>
    </div>
  )
}
