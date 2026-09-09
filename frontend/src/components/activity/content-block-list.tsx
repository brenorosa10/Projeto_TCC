import { RichText } from "@/components/rich-text/rich-text"
import { flattenContentBlocks, hasContentBlocks } from "@/lib/content-blocks"
import { cn } from "@/lib/utils"
import type { ContentBlock } from "@/lib/types"

export function ContentBlockList({
  blocks,
  className,
  questionClassName,
}: {
  blocks?: ContentBlock[] | null
  className?: string
  questionClassName?: string
}) {
  if (!hasContentBlocks(blocks)) return null

  return (
    <div className={cn("space-y-3", className)}>
      {(blocks ?? [])
        .filter((block) => block.content.trim())
        .map((block, index) => {
          if (block.type === "code") {
            return <RichText key={`${block.type}-${index}`} value={flattenContentBlocks([block])} />
          }
          if (block.type === "question") {
            return (
              <RichText
                key={`${block.type}-${index}`}
                value={block.content}
                className={cn(
                  "rich-text-prompt font-display text-xl font-semibold text-foreground sm:text-2xl",
                  questionClassName
                )}
              />
            )
          }
          return <RichText key={`${block.type}-${index}`} value={block.content} />
        })}
    </div>
  )
}
