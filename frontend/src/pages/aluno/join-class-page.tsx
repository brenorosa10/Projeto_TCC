import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

export function AlunoJoinClassPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      toast.error("Informe o código da turma.")
      return
    }
    if (normalized.length !== 8) {
      toast.error("O código deve ter 8 caracteres.")
      return
    }

    setLoading(true)
    try {
      const classroom = await api.joinClass({ code: normalized })
      toast.success(`Você entrou em ${classroom.name}`)
      navigate(`/aluno/turmas/${classroom.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar na turma")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="Entrar em turma">
      <form onSubmit={(e) => void handleJoin(e)} className="max-w-md space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Ingressar com código</h1>
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Código da turma</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: X7B9K2M4"
            maxLength={8}
            className="font-mono tracking-widest uppercase"
          />
        </div>
        <Button type="submit" disabled={loading || code.trim().length === 0}>
          {loading ? "Entrando..." : "Entrar na turma"}
        </Button>
      </form>
    </AppShell>
  )
}
