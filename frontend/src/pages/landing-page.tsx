import { useState } from "react"
import { Navigate } from "react-router-dom"
import { GraduationCap, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types"

export function LandingPage() {
  const { session, profile, loading, signInWithGoogle } = useAuth()
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null)

  if (!loading && session && profile) {
    return (
      <Navigate
        to={profile.role === "professor" ? "/professor" : "/aluno"}
        replace
      />
    )
  }

  async function handleLogin(role: UserRole) {
    try {
      setPendingRole(role)
      await signInWithGoogle(role)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao iniciar login com Google"
      toast.error(message)
      setPendingRole(null)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-atmosphere">
      <div className="pattern-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="animate-soft-pulse pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-astro-mint/40 blur-3xl" />
      <div className="animate-soft-pulse pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-astro-sky/35 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 pb-16 pt-8">
        <nav className="animate-fade-up flex items-center justify-between">
          <span className="font-display text-2xl font-semibold tracking-tight text-primary">
            Astro
          </span>
          <span className="text-sm text-muted-foreground">Ambiente híbrido de aprendizagem</span>
        </nav>

        <section className="flex flex-1 flex-col justify-center py-16 md:py-20">
          <p className="animate-fade-up font-display text-6xl font-semibold tracking-tight text-primary sm:text-7xl md:text-8xl">
            Astro
          </p>
          <h1 className="animate-fade-up-delay mt-6 max-w-2xl font-display text-3xl font-medium leading-tight text-foreground sm:text-4xl">
            Quizzes ao vivo e estudo personalizado no mesmo lugar.
          </h1>
          <p className="animate-fade-up-delay-2 mt-4 max-w-xl text-lg text-muted-foreground">
            Professores criam turmas e sessões em tempo real. Alunos revisam com
            flashcards e quizzes com feedback imediato.
          </p>

          <div className="animate-fade-up-delay-2 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="min-w-[220px]"
              disabled={pendingRole !== null || loading}
              onClick={() => void handleLogin("professor")}
            >
              <GraduationCap />
              {pendingRole === "professor" ? "Redirecionando..." : "Entrar como Professor"}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="min-w-[220px]"
              disabled={pendingRole !== null || loading}
              onClick={() => void handleLogin("aluno")}
            >
              <Users />
              {pendingRole === "aluno" ? "Redirecionando..." : "Entrar como Aluno"}
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Login obrigatório com Google. O perfil escolhido fica fixo na primeira entrada.
          </p>
        </section>
      </div>
    </div>
  )
}
