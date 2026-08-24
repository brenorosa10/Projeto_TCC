import { ItemImageField } from "@/components/activity/item-image-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function PrepFeedbackFields({
  prepTitle,
  prepBody,
  prepObjectives,
  prepMinutes,
  prepTips,
  prepImageDataUrl,
  feedbackTitle,
  feedbackBody,
  onPrepTitle,
  onPrepBody,
  onPrepObjectives,
  onPrepMinutes,
  onPrepTips,
  onPrepImageDataUrl,
  onFeedbackTitle,
  onFeedbackBody,
}: {
  prepTitle: string
  prepBody: string
  prepObjectives: string
  prepMinutes: string
  prepTips: string
  prepImageDataUrl?: string
  feedbackTitle: string
  feedbackBody: string
  onPrepTitle: (value: string) => void
  onPrepBody: (value: string) => void
  onPrepObjectives: (value: string) => void
  onPrepMinutes: (value: string) => void
  onPrepTips: (value: string) => void
  onPrepImageDataUrl: (value?: string) => void
  onFeedbackTitle: (value: string) => void
  onFeedbackBody: (value: string) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="font-display text-lg font-semibold">Antes de começar</h2>
        <p className="text-sm text-muted-foreground">
          Contexto da atividade. Se tudo ficar vazio, o aluno vai direto para os itens.
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
        <div className="grid gap-2">
          <Label htmlFor="prep-objectives">Objetivos (um por linha)</Label>
          <Textarea
            id="prep-objectives"
            value={prepObjectives}
            onChange={(event) => onPrepObjectives(event.target.value)}
            placeholder={"Identificar os planetas interiores\nComparar tamanhos relativos"}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="prep-minutes">Tempo estimado (minutos)</Label>
          <Input
            id="prep-minutes"
            type="number"
            min={1}
            max={180}
            value={prepMinutes}
            onChange={(event) => onPrepMinutes(event.target.value)}
            placeholder="8"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="prep-tips">Dicas (uma por linha)</Label>
          <Textarea
            id="prep-tips"
            value={prepTips}
            onChange={(event) => onPrepTips(event.target.value)}
            placeholder="Leia o enunciado até o fim antes de responder"
          />
        </div>
        <ItemImageField id="prep-image" imageDataUrl={prepImageDataUrl} onChange={onPrepImageDataUrl} />
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
