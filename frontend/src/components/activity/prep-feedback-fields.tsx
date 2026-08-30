import { useState } from "react"
import { Clock, Eye, Flag, Lightbulb, Rocket, Target } from "lucide-react"
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
  const [tab, setTab] = useState<"prep" | "feedback">("prep")
  const [preview, setPreview] = useState(false)

  return (
    <section className="surface-card overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-border/70 bg-muted/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="font-display text-lg font-semibold">Estrutura da atividade</h2>
          <p className="text-sm text-muted-foreground">
            O que o aluno vê antes de praticar e o que ele encontra ao terminar.
          </p>
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
          subtitle="Antes de começar"
        />
        <TabButton
          active={tab === "feedback"}
          onClick={() => setTab("feedback")}
          icon={<Flag className="h-4 w-4" />}
          title="Pós-seção"
          subtitle="Depois de terminar"
        />
      </div>

      <div className="p-4 sm:p-6">
        {preview ? (
          tab === "prep" ? (
            <PrepPanel
              title={prepTitle}
              body={prepBody}
              objectives={lines(prepObjectives)}
              estimatedMinutes={Number(prepMinutes) || undefined}
              tips={lines(prepTips)}
              imageDataUrl={prepImageDataUrl}
              fallbackBody="Revise o que você já sabe e, quando estiver pronto, comece as questões."
              actionLabel="Começar"
              onContinue={() => setTab("feedback")}
            />
          ) : (
            <ResultPanel
              title={feedbackTitle}
              body={feedbackBody}
              correctCount={7}
              total={10}
              summary={
                <p className="text-sm text-muted-foreground">
                  Pré-visualização com dados de exemplo. O resumo real usa o desempenho do aluno.
                </p>
              }
            />
          )
        ) : tab === "prep" ? (
          <div className="grid gap-5">
            <div className="grid gap-2">
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
              rows={7}
              placeholder={"Explique o contexto da atividade.\n\nVocê pode usar títulos, listas, tabelas e blocos de código."}
              hint="Dica: use o botão de bloco de código para colar trechos de programação com destaque de sintaxe."
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <ListField
                label="Objetivos de aprendizagem"
                description="Aparecem como uma checklist numerada para o aluno."
                icon={<Target className="h-4 w-4 text-primary" />}
                value={prepObjectives}
                onChange={onPrepObjectives}
                placeholder="Identificar os planetas interiores"
                addLabel="Objetivo"
              />
              <ListField
                label="Dicas de estudo"
                description="Mostradas em destaque, logo antes do botão de começar."
                icon={<Lightbulb className="h-4 w-4 text-astro-amber" />}
                value={prepTips}
                onChange={onPrepTips}
                placeholder="Leia o enunciado até o fim antes de responder"
                addLabel="Dica"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-[12rem_1fr] sm:items-start">
              <div className="grid gap-2">
                <Label htmlFor="prep-minutes" className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Tempo estimado
                </Label>
                <div className="relative">
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
              <ItemImageField
                id="prep-image"
                imageDataUrl={prepImageDataUrl}
                onChange={onPrepImageDataUrl}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <div className="rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
              O placar de acertos e a revisão item a item são montados automaticamente. Use os campos
              abaixo para a mensagem de encerramento.
            </div>
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
              rows={7}
              placeholder={"Parabéns por concluir!\n\n- Reveja os itens em vermelho\n- Refaça a atividade amanhã"}
              hint="Você pode incluir links de leitura, listas de revisão e exemplos de código comentados."
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
  subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
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
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}
