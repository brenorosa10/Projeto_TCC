import { Plus, Trash2 } from "lucide-react"
import { RichTextEditor, CODE_LANGUAGES } from "@/components/rich-text/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CONTENT_BLOCK_TYPES } from "@/lib/content-blocks"
import type { ContentBlock, ContentBlockType } from "@/lib/types"

export type DraftBlock = ContentBlock & { key: string }

export function newDraftBlock(type: ContentBlockType = "markdown"): DraftBlock {
  return {
    key: crypto.randomUUID(),
    type,
    content: "",
    language: type === "code" ? "javascript" : undefined,
  }
}

export function blocksFromApi(blocks?: ContentBlock[] | null): DraftBlock[] {
  return (blocks ?? []).map((block) => ({
    key: crypto.randomUUID(),
    type: block.type,
    content: block.content,
    language: block.language ?? undefined,
  }))
}

export function ContentBlockFields({
  id,
  label,
  blocks,
  allowedTypes = ["markdown", "code", "question"],
  compact = false,
  onChange,
}: {
  id: string
  label: string
  blocks: DraftBlock[]
  allowedTypes?: ContentBlockType[]
  compact?: boolean
  onChange: (blocks: DraftBlock[]) => void
}) {
  const types = CONTENT_BLOCK_TYPES.filter((entry) => allowedTypes.includes(entry.value))

  function update(key: string, patch: Partial<DraftBlock>) {
    onChange(blocks.map((block) => (block.key === key ? { ...block, ...patch } : block)))
  }

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3"}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <Button
              key={type.value}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange([...blocks, newDraftBlock(type.value)])}
            >
              <Plus className="h-4 w-4" />
              {type.label}
            </Button>
          ))}
        </div>
      </div>

      {blocks.map((block, index) => (
        <div key={block.key} className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="sr-only" htmlFor={`${id}-type-${block.key}`}>
              Tipo do bloco {index + 1}
            </Label>
            <select
              id={`${id}-type-${block.key}`}
              className="flex h-9 rounded-lg border border-input bg-card px-2 text-sm"
              value={block.type}
              onChange={(event) => {
                const type = event.target.value as ContentBlockType
                update(block.key, {
                  type,
                  language: type === "code" ? block.language || "javascript" : undefined,
                })
              }}
            >
              {types.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {block.type === "code" ? (
              <select
                className="flex h-9 rounded-lg border border-input bg-card px-2 text-sm"
                value={block.language ?? ""}
                onChange={(event) => update(block.key, { language: event.target.value })}
                aria-label="Linguagem"
              >
                {CODE_LANGUAGES.map((language) => (
                  <option key={language.value || "none"} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">Bloco {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover bloco"
              onClick={() => onChange(blocks.filter((item) => item.key !== block.key))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {block.type === "code" ? (
            <Textarea
              value={block.content}
              onChange={(event) => update(block.key, { content: event.target.value })}
              rows={compact ? 5 : 8}
              className="font-mono text-sm"
              placeholder="Cole o trecho de código"
            />
          ) : (
            <RichTextEditor
              id={`${id}-${block.key}`}
              value={block.content}
              onChange={(content) => update(block.key, { content })}
              rows={block.type === "question" ? 2 : compact ? 3 : 5}
              compact={block.type === "question"}
              placeholder={
                block.type === "question"
                  ? "Qual alternativa descreve corretamente o que acontece?"
                  : "Texto em Markdown"
              }
            />
          )}
        </div>
      ))}
    </div>
  )
}
