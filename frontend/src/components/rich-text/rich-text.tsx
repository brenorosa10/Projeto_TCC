import { useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import rehypeHighlight from "rehype-highlight"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

type RichTextProps = {
  value?: string | null
  className?: string
  /** Rendered when `value` is empty. */
  fallback?: ReactNode
}

const remarkPlugins = [remarkGfm, remarkBreaks]
const rehypePlugins = [[rehypeHighlight, { detect: true, ignoreMissing: true }] as const]

/**
 * Renders teacher/student authored content written in Markdown, including
 * fenced code blocks with syntax highlighting.
 */
export function RichText({ value, className, fallback = null }: RichTextProps) {
  const text = value?.trim()
  if (!text) return <>{fallback}</>

  return (
    <div className={cn("rich-text", className)}>
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins as never}
        components={{
          pre: CodeBlock,
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  )
}

/** Single-line variant: keeps inline marks but drops block spacing. */
export function RichTextInline({ value, className, fallback = null }: RichTextProps) {
  return <RichText value={value} fallback={fallback} className={cn("rich-text-inline", className)} />
}

type PreProps = ComponentPropsWithoutRef<"pre"> & { node?: unknown }

function CodeBlock({ children, node, ...props }: PreProps) {
  const { language, source } = useMemo(() => readCodeNode(node), [node])
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — the code is still selectable */
    }
  }

  return (
    <figure className="code-block group not-prose my-4">
      <figcaption className="flex items-center justify-between gap-2 border-b border-[var(--color-code-border)] px-3 py-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-slate-400">
          <span className="flex gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-rose-400/70" />
            <span className="h-2 w-2 rounded-full bg-amber-400/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
          </span>
          {language ? <span className="ml-1">{language}</span> : null}
        </span>
        {source ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-sans text-[0.7rem] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Copiar código"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        ) : null}
      </figcaption>
      <pre {...props}>{children}</pre>
    </figure>
  )
}

type HastNode = {
  tagName?: string
  value?: string
  properties?: { className?: unknown }
  children?: HastNode[]
}

function readCodeNode(node: unknown): { language: string | null; source: string } {
  const code = (node as HastNode | undefined)?.children?.find((child) => child.tagName === "code")
  const classes = code?.properties?.className
  const list = Array.isArray(classes) ? classes.map(String) : []
  const languageClass = list.find((entry) => entry.startsWith("language-"))
  return {
    language: languageClass ? languageClass.replace("language-", "") : null,
    source: collectText(code).replace(/\n$/, ""),
  }
}

function collectText(node: HastNode | undefined): string {
  if (!node) return ""
  if (typeof node.value === "string") return node.value
  return (node.children ?? []).map(collectText).join("")
}
