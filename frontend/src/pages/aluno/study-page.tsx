import { AppShell } from "@/components/layout/app-shell"

export function AlunoStudyPage() {
  return (
    <AppShell title="Estudar">
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-semibold">Estudo assíncrono</h1>
        <p className="max-w-2xl text-muted-foreground">
          Em breve: quizzes off-line com feedback imediato (RN10) e flashcards com
          repetição espaçada Leitner (RN11).
        </p>
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          Nenhum material de revisão disponível ainda.
        </div>
      </div>
    </AppShell>
  )
}
