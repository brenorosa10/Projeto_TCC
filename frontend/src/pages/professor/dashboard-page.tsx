import { Link } from "react-router-dom"
import { BarChart3, BookOpen, Plus, Radio } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

export function ProfessorDashboardPage() {
  const { profile } = useAuth()

  return (
    <AppShell title="Painel do professor">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Olá, {profile?.fullName?.split(" ")[0] ?? "professor"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Crie turmas, prepare atividades e inicie sessões ao vivo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Button asChild className="h-auto flex-col items-start gap-2 p-5">
            <Link to="/professor/turmas">
              <BookOpen className="h-5 w-5" />
              <span className="text-base font-semibold">Minhas turmas</span>
              <span className="text-xs font-normal text-primary-foreground/80">
                Criar e gerenciar turmas
              </span>
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-auto flex-col items-start gap-2 p-5">
            <Link to="/professor/turmas">
              <Plus className="h-5 w-5" />
              <span className="text-base font-semibold">Nova atividade</span>
              <span className="text-xs font-normal text-secondary-foreground/70">
                Quiz, prova ou flashcards (em breve)
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-2 p-5">
            <Link to="/professor/ao-vivo">
              <Radio className="h-5 w-5" />
              <span className="text-base font-semibold">Iniciar ao vivo</span>
              <span className="text-xs font-normal text-muted-foreground">
                Sessão com PIN de 6 dígitos
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-2 p-5">
            <Link to="/professor/analytics">
              <BarChart3 className="h-5 w-5" />
              <span className="text-base font-semibold">Analytics</span>
              <span className="text-xs font-normal text-muted-foreground">
                Índice de erros por questão
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
