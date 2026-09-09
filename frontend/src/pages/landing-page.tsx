import { useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { Code2, Flag, GraduationCap, Rocket, Users } from "lucide-react"
import { AuthMethodDialog } from "@/components/auth/auth-method-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import type { PublicActivitySummary, UserRole } from "@/lib/types"

export function LandingPage() {
  const { session, profile, loading } = useAuth()
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [publicActivities, setPublicActivities] = useState<PublicActivitySummary[]>([])
  const [publicLoading, setPublicLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .listPublicActivities()
      .then((items) => {
        if (!cancelled) setPublicActivities(items)
      })
      .catch(() => {
        if (!cancelled) setPublicActivities([])
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && session && profile) {
    return (
      <Navigate
        to={profile.role === "professor" ? "/professor" : "/aluno"}
        replace
      />
    )
  }

  const publicQuizzes = publicActivities.filter((item) => item.type === "quiz")
  const publicDecks = publicActivities.filter((item) => item.type === "flashcards")

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

        <section className="flex flex-1 flex-col justify-center py-14 md:py-16">
          <p className="animate-fade-up font-display text-6xl font-semibold tracking-tight text-primary sm:text-7xl md:text-8xl">
            Astro
          </p>
          <h1 className="animate-fade-up-delay mt-6 max-w-2xl font-display text-3xl font-medium leading-tight text-foreground text-balance sm:text-4xl">
            Quizzes ao vivo e estudo personalizado no mesmo lugar.
          </h1>
          <p className="animate-fade-up-delay-2 mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
            Professores criam turmas e sessões em tempo real. Alunos revisam com flashcards e
            quizzes com feedback imediato.
          </p>

          <ul className="animate-fade-up-delay-2 mt-8 grid gap-3 sm:grid-cols-3">
            <Highlight
              icon={<Rocket className="h-4 w-4" />}
              title="Pré-seção"
              text="Objetivos, tempo estimado e dicas antes de começar."
            />
            <Highlight
              icon={<Code2 className="h-4 w-4" />}
              title="Código formatado"
              text="Blocos de código com destaque de sintaxe nas questões."
            />
            <Highlight
              icon={<Flag className="h-4 w-4" />}
              title="Pós-seção"
              text="Placar, revisão item a item e explicações do professor."
            />
          </ul>

          <div className="animate-fade-up-delay-2 mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="min-w-[220px]"
              disabled={loading}
              onClick={() => setSelectedRole("professor")}
            >
              <GraduationCap />
              Entrar como Professor
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="min-w-[220px]"
              disabled={loading}
              onClick={() => setSelectedRole("aluno")}
            >
              <Users />
              Entrar como Aluno
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Escolha o perfil e depois entre com uma conta Astro (e-mail, senha e usuário) ou com o
            Google. O perfil fica fixo na primeira entrada.
          </p>
        </section>

        <section id="explorar" className="animate-fade-up-delay-2 pb-8">
          <h2 className="font-display text-2xl font-semibold">Estudo público</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Quizzes e flashcards abertos pela comunidade. Não precisa de conta para estudar.
          </p>

          {publicLoading ? (
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          ) : publicActivities.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Nenhum conteúdo público no momento. Quando um professor marcar um quiz ou deck como
              público, ele aparece aqui.
            </p>
          ) : (
            <div className="mt-8 grid gap-10 md:grid-cols-2">
              <PublicList
                title="Quizzes"
                empty="Nenhum quiz público."
                items={publicQuizzes}
                hrefFor={(id) => `/explorar/quiz/${id}`}
              />
              <PublicList
                title="Flashcards"
                empty="Nenhum deck público."
                items={publicDecks}
                hrefFor={(id) => `/explorar/flashcards/${id}`}
              />
            </div>
          )}
        </section>
      </div>

      <AuthMethodDialog role={selectedRole} onClose={() => setSelectedRole(null)} />
    </div>
  )
}

function PublicList({
  title,
  empty,
  items,
  hrefFor,
}: {
  title: string
  empty: string
  items: PublicActivitySummary[]
  hrefFor: (id: string) => string
}) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="surface-card flex flex-col gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-pretty">{item.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">Público</Badge>
                  <span>
                    {item.itemCount} {item.type === "flashcards" ? "cartão(ões)" : "questão(ões)"}
                    {item.professorName ? ` · ${item.professorName}` : null}
                  </span>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <Link to={hrefFor(item.id)}>Estudar</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Highlight({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <li className="surface-card flex flex-col gap-1.5 p-4">
      <span className="flex items-center gap-2 text-sm font-semibold text-primary">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </span>
        {title}
      </span>
      <span className="text-sm text-muted-foreground text-pretty">{text}</span>
    </li>
  )
}
