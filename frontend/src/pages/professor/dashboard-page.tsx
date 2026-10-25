import { Link } from "react-router-dom"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Layers,
  Plus,
  Radio,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { PublicCatalog } from "@/components/public/public-catalog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

const actions: Array<{
  to: string
  icon: LucideIcon
  title: string
  description: string
  tone: "primary" | "sky" | "violet" | "amber"
}> = [
  {
    to: "/professor/turmas",
    icon: BookOpen,
    title: "Minhas turmas",
    description: "Crie turmas e acompanhe quem entrou pelo código de acesso.",
    tone: "primary",
  },
  {
    to: "/professor/atividades",
    icon: Layers,
    title: "Atividades",
    description: "Monte quizzes e flashcards reutilizáveis em várias turmas.",
    tone: "sky",
  },
  {
    to: "/professor/ao-vivo",
    icon: Radio,
    title: "Iniciar ao vivo",
    description: "Aplique uma atividade em tempo real com PIN de 6 dígitos.",
    tone: "violet",
  },
  {
    to: "/professor/analytics",
    icon: BarChart3,
    title: "Analytics",
    description: "Veja o índice de erros por questão e ajuste o plano de aula.",
    tone: "amber",
  },
]

export function ProfessorDashboardPage() {
  const { profile } = useAuth()

  return (
    <AppShell title="Painel do professor">
      <div className="space-y-8">
        <section className="surface-card relative overflow-hidden px-6 py-8 sm:px-8">
          <div className="pattern-grid absolute inset-0 opacity-40" aria-hidden />
          <div className="relative max-w-2xl space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Painel do professor
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Olá, {profile?.fullName?.split(" ")[0] ?? "professor"}
            </h1>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild>
                <Link to="/professor/quiz/novo">
                  <Plus className="h-4 w-4" />
                  Criar quiz
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/professor/flashcards/novo">
                  <Layers className="h-4 w-4" />
                  Criar flashcards
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {actions.map((action) => (
            <ActionCard key={action.to} {...action} />
          ))}
        </div>

        <PublicCatalog
          audience="professor"
          heading="Quizzes públicos"
          lead="Veja o que outros professores abriram para a comunidade e jogue direto daqui."
        />
      </div>
    </AppShell>
  )
}

function ActionCard({
  to,
  icon: Icon,
  title,
  description,
  tone,
}: {
  to: string
  icon: LucideIcon
  title: string
  description: string
  tone: "primary" | "sky" | "violet" | "amber"
}) {
  return (
    <Link
      to={to}
      className="surface-card group flex items-start gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "sky" && "bg-astro-sky/20 text-astro-navy",
          tone === "violet" && "bg-astro-violet/12 text-astro-violet",
          tone === "amber" && "bg-astro-amber/12 text-astro-amber"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  )
}
