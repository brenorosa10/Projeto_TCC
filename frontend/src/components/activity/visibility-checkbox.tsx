import { Globe } from "lucide-react"
import { Label } from "@/components/ui/label"

interface VisibilityCheckboxProps {
  id: string
  checked: boolean
  onChange: (isPublic: boolean) => void
}

export function VisibilityCheckbox({ id, checked, onChange }: VisibilityCheckboxProps) {
  return (
    <div className="flex h-12 items-center rounded-xl border border-border/70 bg-card px-3.5">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm whitespace-nowrap">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-primary)]"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <Globe className="h-4 w-4 text-primary" aria-hidden />
        <span className="font-medium">Tornar público</span>
      </label>
      <Label className="sr-only" htmlFor={id}>
        Visibilidade
      </Label>
    </div>
  )
}
