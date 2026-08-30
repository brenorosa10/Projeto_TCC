import { useId, useRef, useState, type ReactNode } from "react"
import {
  Bold,
  Braces,
  Code2,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pencil,
  Quote,
  Table,
} from "lucide-react"
import { RichText } from "@/components/rich-text/rich-text"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  insertCodeBlock,
  insertDivider,
  insertLink,
  insertTable,
  toggleLinePrefix,
  toggleWrap,
  type EditResult,
} from "@/components/rich-text/markdown-commands"

export const CODE_LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C / C++" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Terminal" },
  { value: "", label: "Sem linguagem" },
]

type RichTextEditorProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: ReactNode
  hint?: ReactNode
  rows?: number
  /** Hides the block-level tools (lists, quote, table, divider). */
  compact?: boolean
  disabled?: boolean
  className?: string
}

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  label,
  hint,
  rows = 6,
  compact = false,
  disabled,
  className,
}: RichTextEditorProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<"write" | "preview">("write")
  const [language, setLanguage] = useState("python")

  function run(command: (value: string, range: { start: number; end: number }) => EditResult) {
    const node = textareaRef.current
    if (!node) return
    const range = { start: node.selectionStart, end: node.selectionEnd }
    const result = command(value, range)
    onChange(result.value)
    requestAnimationFrame(() => {
      node.focus()
      node.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    if (key === "b") {
      event.preventDefault()
      run((text, range) => toggleWrap(text, range, "**", "texto em negrito"))
    } else if (key === "i") {
      event.preventDefault()
      run((text, range) => toggleWrap(text, range, "*", "texto em itálico"))
    } else if (key === "k") {
      event.preventDefault()
      run(insertLink)
    } else if (key === "e" && event.shiftKey) {
      event.preventDefault()
      run((text, range) => insertCodeBlock(text, range, language))
    } else if (key === "e") {
      event.preventDefault()
      run((text, range) => toggleWrap(text, range, "`", "código"))
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {label ? (
        <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-input bg-card transition-shadow focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25",
          disabled && "opacity-60"
        )}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/50 px-2 py-1.5">
          <ToolButton
            label="Negrito (Ctrl+B)"
            onClick={() => run((text, range) => toggleWrap(text, range, "**", "texto em negrito"))}
          >
            <Bold className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Itálico (Ctrl+I)"
            onClick={() => run((text, range) => toggleWrap(text, range, "*", "texto em itálico"))}
          >
            <Italic className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Código em linha (Ctrl+E)"
            onClick={() => run((text, range) => toggleWrap(text, range, "`", "código"))}
          >
            <Code2 className="h-4 w-4" />
          </ToolButton>

          <Divider />

          {!compact ? (
            <>
              <ToolButton
                label="Título"
                onClick={() => run((text, range) => toggleLinePrefix(text, range, "## "))}
              >
                <Heading2 className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="Lista com marcadores"
                onClick={() => run((text, range) => toggleLinePrefix(text, range, "- "))}
              >
                <List className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="Lista numerada"
                onClick={() =>
                  run((text, range) => toggleLinePrefix(text, range, "1. ", { ordered: true }))
                }
              >
                <ListOrdered className="h-4 w-4" />
              </ToolButton>
              <ToolButton
                label="Citação / destaque"
                onClick={() => run((text, range) => toggleLinePrefix(text, range, "> "))}
              >
                <Quote className="h-4 w-4" />
              </ToolButton>
              <ToolButton label="Tabela" onClick={() => run(insertTable)}>
                <Table className="h-4 w-4" />
              </ToolButton>
              <ToolButton label="Linha divisória" onClick={() => run(insertDivider)}>
                <Minus className="h-4 w-4" />
              </ToolButton>
              <Divider />
            </>
          ) : null}

          <ToolButton label="Link (Ctrl+K)" onClick={() => run(insertLink)}>
            <Link2 className="h-4 w-4" />
          </ToolButton>

          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-card px-1 py-0.5">
            <ToolButton
              label="Bloco de código (Ctrl+Shift+E)"
              onClick={() => run((text, range) => insertCodeBlock(text, range, language))}
            >
              <Braces className="h-4 w-4" />
            </ToolButton>
            <select
              aria-label="Linguagem do bloco de código"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-7 max-w-28 cursor-pointer rounded-md bg-transparent px-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground"
            >
              {CODE_LANGUAGES.map((option) => (
                <option key={option.value || "plain"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-card p-0.5 shadow-inner">
            <ModeButton active={mode === "write"} onClick={() => setMode("write")}>
              <Pencil className="h-3.5 w-3.5" />
              Escrever
            </ModeButton>
            <ModeButton active={mode === "preview"} onClick={() => setMode("preview")}>
              <Eye className="h-3.5 w-3.5" />
              Visualizar
            </ModeButton>
          </div>
        </div>

        {mode === "write" ? (
          <textarea
            id={textareaId}
            ref={textareaRef}
            rows={rows}
            value={value}
            disabled={disabled}
            spellCheck
            onKeyDown={handleKeyDown}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="block w-full resize-y bg-transparent px-3.5 py-3 text-base leading-relaxed outline-none placeholder:text-muted-foreground/70 md:text-sm"
          />
        ) : (
          <div className="min-h-[7rem] px-3.5 py-3">
            <RichText
              value={value}
              fallback={
                <p className="text-sm italic text-muted-foreground">Nada para pré-visualizar.</p>
              }
            />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {hint ?? (
          <>
            Use a barra de ferramentas para formatar. Aceita Markdown: <code>**negrito**</code>,{" "}
            <code>- listas</code> e blocos de código com destaque de sintaxe.
          </>
        )}
      </p>
    </div>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="h-8 w-8 text-muted-foreground hover:bg-card hover:text-primary"
    >
      {children}
    </Button>
  )
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
