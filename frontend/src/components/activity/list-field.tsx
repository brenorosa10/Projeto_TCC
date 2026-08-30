import { useId } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Edits a newline separated string (objectives, tips) as an ordered list of
 * individual fields, which is far easier than a free-form textarea.
 */
export function ListField({
  label,
  description,
  value,
  onChange,
  placeholder,
  addLabel = "Adicionar item",
  icon,
}: {
  label: string
  description?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  addLabel?: string
  icon?: React.ReactNode
}) {
  const groupId = useId()
  const entries = value.length > 0 ? value.split("\n") : []
  const items = entries.length > 0 ? entries : [""]

  function commit(next: string[]) {
    onChange(next.join("\n"))
  }

  function update(index: number, text: string) {
    commit(items.map((item, position) => (position === index ? text : item)))
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [removed] = next.splice(index, 1)
    next.splice(target, 0, removed)
    commit(next)
  }

  return (
    <fieldset className="grid gap-2">
      <legend className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {label}
      </legend>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <ul className="grid gap-2">
        {items.map((item, index) => (
          <li key={`${groupId}-${index}`} className="flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <Input
              value={item}
              onChange={(event) => update(index, event.target.value)}
              placeholder={placeholder}
            />
            <div className="flex shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Mover para cima"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Mover para baixo"
                disabled={index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Remover"
                onClick={() => commit(items.filter((_, position) => position !== index))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => commit([...items, ""])}
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </fieldset>
  )
}
