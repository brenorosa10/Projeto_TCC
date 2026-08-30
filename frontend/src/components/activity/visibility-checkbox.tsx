import { Label } from "@/components/ui/label"

interface VisibilityCheckboxProps {
  id: string
  checked: boolean
  onChange: (isPublic: boolean) => void
}

export function VisibilityCheckbox({ id, checked, onChange }: VisibilityCheckboxProps) {
  return (
    <div className="surface-card space-y-2 p-4">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          id={id}
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <span className="font-medium">Tornar público</span>
          <span className="mt-1 block text-muted-foreground">
            Público: qualquer pessoa estuda na página inicial, mesmo sem login. Privado: só alunos
            das turmas vinculadas.
          </span>
        </span>
      </label>
      <Label className="sr-only" htmlFor={id}>
        Visibilidade
      </Label>
    </div>
  )
}
