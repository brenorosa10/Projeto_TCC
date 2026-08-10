import { Link } from "react-router-dom"
import { BookOpenCheck, KeyRound, Radio } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

export function AlunoDashboardPage() {
  const { profile } = useAuth()

  return (
    <AppShell title="Painel do aluno">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Olá, {profile?.fullName?.split(" ")[0] ?? "aluno"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Entre em turmas, estude no seu ritmo e participe de sessões ao vivo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Button asChild className="h-auto flex-col items-start gap-2 p-5">
            <Link to="/aluno/entrar">
              <KeyRound className="h-5 w-5" />
              <span className="text-base font-semibold">Entrar em turma</span>
              <span className="text-xs font-normal text-primary-foreground/80">
                Use o código de 8 caracteres
              </span>
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-auto flex-col items-start gap-2 p-5">
            <Link to="/aluno/turmas">
              <BookOpenCheck className="h-5 w-5" />
              <span className="text-base font-semibold">Minhas turmas</span>
              <span className="text-xs font-normal text-secondary-foreground/70">
                Conteúdos e revisão
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col items-start gap-2 p-5">
            <Link to="/aluno/sessao">
              <Radio className="h-5 w-5" />
              <span className="text-base font-semibold">Sessão ao vivo</span>
              <span className="text-xs font-normal text-muted-foreground">
                Entrar com PIN de 6 dígitos
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
