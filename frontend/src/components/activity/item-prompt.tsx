import { ContentBlockList } from "@/components/activity/content-block-list"
import { PromptMedia } from "@/components/activity/question-preview"
import { Badge } from "@/components/ui/badge"
import { RichText } from "@/components/rich-text/rich-text"
import { hasContentBlocks } from "@/lib/content-blocks"
import type { StudySessionItem } from "@/lib/types"

export function ItemPrompt({ item }: { item: StudySessionItem }) {
  const title = item.kind === "flashcard" ? item.front : item.prompt
  const hasBlocks = hasContentBlocks(item.intro) || hasContentBlocks(item.promptBlocks)
  return (
    <div className="space-y-3">
      {item.topics && item.topics.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.topics.map((topic) => (
            <Badge key={topic} variant="outline" className="text-xs font-normal">
              {topic}
            </Badge>
          ))}
        </div>
      ) : null}
      <PromptMedia
        imageDataUrl={item.imageDataUrl}
        videoUrl={item.videoUrl}
        videoKind={item.videoKind}
        imagePosition={item.imagePosition}
      >
        {hasBlocks ? (
          <>
            <ContentBlockList blocks={item.intro} className="text-muted-foreground" />
            <ContentBlockList blocks={item.promptBlocks} />
          </>
        ) : (
          <RichText
            value={title}
            className="rich-text-prompt font-display text-xl font-semibold text-foreground sm:text-2xl"
          />
        )}
      </PromptMedia>
    </div>
  )
}
