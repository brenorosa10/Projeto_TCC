import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ACTIVITY_THEMES } from "@/lib/themes"

export function ActivityCatalogFields({
  themeId,
  descriptionId,
  theme,
  description,
  onTheme,
  onDescription,
}: {
  themeId: string
  descriptionId: string
  theme: string
  description: string
  onTheme: (value: string) => void
  onDescription: (value: string) => void
}) {
  const listId = `${themeId}-suggestions`

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor={themeId}>Tema</Label>
        <Input
          id={themeId}
          list={listId}
          value={theme}
          maxLength={40}
          placeholder="Ex: História"
          onChange={(event) => onTheme(event.target.value)}
        />
        <datalist id={listId}>
          {ACTIVITY_THEMES.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={descriptionId}>Descrição</Label>
        <Textarea
          id={descriptionId}
          value={description}
          maxLength={280}
          rows={3}
          placeholder="Um resumo curto para quem for escolher o que estudar."
          onChange={(event) => onDescription(event.target.value)}
        />
      </div>
    </div>
  )
}
