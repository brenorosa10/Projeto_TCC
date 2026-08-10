import { AppShell } from "@/components/layout/app-shell"

export function ProfessorAnalyticsPage() {
  return (
    <AppShell title="Analytics">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-semibold">Painel analítico</h1>
        <p className="max-w-2xl text-muted-foreground">
          Em breve: percentual de erro consolidado por questão (RN12) e destaque
          visual para questões com taxa de erro superior a 50% (RN13).
        </p>
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          Sem dados ainda. Realize sessões ou quizzes para gerar métricas.
        </div>
      </div>
    </AppShell>
  )
}
