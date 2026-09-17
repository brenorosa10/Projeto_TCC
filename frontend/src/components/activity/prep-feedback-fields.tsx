import { useState } from "react"
import { Eye, Flag, Lightbulb, Rocket, Target } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { ItemImageField } from "@/components/activity/item-image-field"
import { ListField } from "@/components/activity/list-field"
import { PrepPanel } from "@/components/activity/prep-panel"
import { ResultPanel } from "@/components/activity/result-panel"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

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
  prepMinutes?: string
  prepTips: string
  prepImageDataUrl?: string
  feedbackTitle: string
  feedbackBody: string
  onPrepTitle: (value: string) => void
  onPrepBody: (value: string) => void
  onPrepObjectives: (value: string) => void
  onPrepMinutes?: (value: string) => void
  onPrepTips: (value: string) => void
  onPrepImageDataUrl: (value?: string) => void
  onFeedbackTitle: (value: string) => void
  onFeedbackBody: (value: string) => void
}) {
  const [tab, setTab] = useState<"prep" | "feedback">("prep")
  const [preview, setPreview] = useState(false)

  return (
    <section className="surface-card overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="font-display text-base font-semibold">Pré e pós-seção</h2>
        </div>
        <Button
          type="button"
          variant={preview ? "default" : "outline"}
          size="sm"
          onClick={() => setPreview((value) => !value)}
        >
          <Eye className="h-4 w-4" />
          {preview ? "Voltar à edição" : "Ver como aluno"}
        </Button>
      </header>

      <div className="flex gap-1 border-b border-border/70 bg-card px-2 pt-2 sm:px-4">
        <TabButton
          active={tab === "prep"}
          onClick={() => setTab("prep")}
          icon={<Rocket className="h-4 w-4" />}
          title="Pré-seção"
        />
        <TabButton
          active={tab === "feedback"}
          onClick={() => setTab("feedback")}
          icon={<Flag className="h-4 w-4" />}
          title="Pós-seção"
        />
      </div>

      <div className="p-3 sm:p-4">
        {preview ? (
          tab === "prep" ? (
            <PrepPanel
              title={prepTitle}
              body={prepBody}
              objectives={lines(prepObjectives)}
              estimatedMinutes={Number(prepMinutes) || undefined}
              tips={lines(prepTips)}
              imageDataUrl={prepImageDataUrl}
              fallbackBody="Comece as questões quando estiver pronto."
              actionLabel="Começar"
              onContinue={() => setTab("feedback")}
            />
          ) : (
            <ResultPanel
              title={feedbackTitle}
              body={feedbackBody}
              correctCount={7}
              total={10}
            />
          )
        ) : tab === "prep" ? (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prep-title">Título da pré-seção</Label>
              <Input
                id="prep-title"
                value={prepTitle}
                onChange={(event) => onPrepTitle(event.target.value)}
                placeholder="Ex: Revise os planetas interiores"
              />
            </div>

            <RichTextEditor
              id="prep-body"
              label="Texto de abertura"
              value={prepBody}
              onChange={onPrepBody}
              rows={4}
              placeholder="Explique o contexto da atividade."
            />

            <ListField
              label="Objetivos de aprendizagem"
              icon={<Target className="h-4 w-4 text-primary" />}
              value={prepObjectives}
              onChange={onPrepObjectives}
              placeholder="Identificar os planetas interiores"
              addLabel="Objetivo"
            />
            <Separator />
            <ListField
              label="Dicas de estudo"
              icon={<Lightbulb className="h-4 w-4 text-astro-amber" />}
              value={prepTips}
              onChange={onPrepTips}
              placeholder="Leia o enunciado até o fim antes de responder"
              addLabel="Dica"
            />

            {onPrepMinutes ? (
              <div className="grid gap-2">
                <Label htmlFor="prep-minutes">Tempo estimado</Label>
                <div className="relative max-w-40">
                  <Input
                    id="prep-minutes"
                    type="number"
                    min={1}
                    max={180}
                    value={prepMinutes}
                    onChange={(event) => onPrepMinutes(event.target.value)}
                    placeholder="8"
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    min
                  </span>
                </div>
              </div>
            ) : null}

            <ItemImageField
              id="prep-image"
              imageDataUrl={prepImageDataUrl}
              onChange={onPrepImageDataUrl}
            />
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="feedback-title">Título da pós-seção</Label>
              <Input
                id="feedback-title"
                value={feedbackTitle}
                onChange={(event) => onFeedbackTitle(event.target.value)}
                placeholder="Resultados"
              />
            </div>
            <RichTextEditor
              id="feedback-body"
              label="Mensagem de encerramento"
              value={feedbackBody}
              onChange={onFeedbackBody}
              rows={4}
              placeholder={"Parabéns por concluir!\n\n- Reveja os itens em vermelho\n- Refaça a atividade amanhã"}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-t-lg border-b-2 px-3 py-2.5 text-left transition-colors sm:flex-none sm:px-4",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
      </span>
    </button>
  )
}
