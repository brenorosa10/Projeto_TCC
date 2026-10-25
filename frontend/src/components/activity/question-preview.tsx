import type { ReactNode } from "react"
import { ContentBlockList } from "@/components/activity/content-block-list"
import { RichText } from "@/components/rich-text/rich-text"
import { Badge } from "@/components/ui/badge"
import { hasContentBlocks } from "@/lib/content-blocks"
import { ITEM_KIND_LABELS } from "@/lib/item-kinds"
import { cn } from "@/lib/utils"
import { AlternativeBody } from "@/components/activity/alternative-media"
import { MediaFrame } from "@/components/activity/media-frame"
import type { ContentBlock, ImagePosition, ItemKind, VideoKind } from "@/lib/types"

export function PromptMedia({
  imageDataUrl,
  videoUrl,
  videoKind,
  imagePosition = "after",
  children,
  className,
}: {
  imageDataUrl?: string | null
  videoUrl?: string | null
  videoKind?: VideoKind | string | null
  imagePosition?: ImagePosition | string | null
  children: ReactNode
  className?: string
}) {
  const media =
    imageDataUrl || videoUrl ? (
      <MediaFrame
        imageDataUrl={imageDataUrl}
        videoUrl={videoUrl}
        videoKind={videoKind}
        alt="Mídia da questão"
        className={className}
      />
    ) : null
  const before = imagePosition === "before"

  return (
    <div className="space-y-3">
      {before ? media : null}
      {children}
      {!before ? media : null}
    </div>
  )
}

export function QuestionPreview({
  kind,
  prompt,
  intro,
  promptBlocks,
  imageDataUrl,
  videoUrl,
  videoKind,
  imagePosition,
  topics,
  difficulty,
  options,
  allowMultiple,
  requireExplanation,
  explanationPrompt,
}: {
  kind: ItemKind | string
  prompt?: string | null
  intro?: ContentBlock[] | null
  promptBlocks?: ContentBlock[] | null
  imageDataUrl?: string | null
  videoUrl?: string | null
  videoKind?: VideoKind | string | null
  imagePosition?: ImagePosition | string | null
  topics?: string[]
  difficulty?: string | null
  options?: { key: string; text: string; isCorrect?: boolean; imageUrl?: string }[]
  allowMultiple?: boolean
  requireExplanation?: boolean
  explanationPrompt?: string
}) {
  const hasBlocks = hasContentBlocks(intro) || hasContentBlocks(promptBlocks)

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{ITEM_KIND_LABELS[kind as ItemKind] ?? kind}</Badge>
        {difficulty ? (
          <Badge variant="outline" className="capitalize">
            {difficulty}
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">Pré-visualização do aluno</span>
      </div>
      {topics && topics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((topic) => (
            <Badge key={topic} variant="outline" className="text-xs font-normal">
              {topic}
            </Badge>
          ))}
        </div>
      ) : null}
      <PromptMedia
        imageDataUrl={imageDataUrl}
        videoUrl={videoUrl}
        videoKind={videoKind}
        imagePosition={imagePosition}
      >
        {hasBlocks ? (
          <>
            <ContentBlockList blocks={intro} className="text-muted-foreground" />
            <ContentBlockList blocks={promptBlocks} />
          </>
        ) : (
          <RichText
            value={prompt}
            fallback={<p className="text-sm italic text-muted-foreground">Sem enunciado ainda.</p>}
            className="rich-text-prompt font-display text-xl font-semibold"
          />
        )}
      </PromptMedia>
      {options && options.length > 0 ? (
        <ul className="grid gap-2">
          {options.map((option, index) => (
            <li
              key={option.key}
              className="flex items-start gap-3 rounded-xl border border-border/80 bg-card px-4 py-3"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold",
                  allowMultiple ? "rounded-md bg-muted" : "rounded-full bg-muted"
                )}
              >
                {String.fromCharCode(65 + index)}
              </span>
              {option.text.trim() || option.imageUrl ? (
                <AlternativeBody text={option.text} imageUrl={option.imageUrl} textClassName="text-sm" />
              ) : (
                <span className="text-sm text-muted-foreground">Alternativa vazia</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {requireExplanation ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          {explanationPrompt || "Como você pensou sobre a resposta?"}
        </div>
      ) : null}
    </div>
  )
}
