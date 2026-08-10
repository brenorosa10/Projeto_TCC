import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { RequireRole } from "@/components/auth/require-role"
import { AuthProvider } from "@/contexts/auth-context"
import { LandingPage } from "@/pages/landing-page"
import { AuthCallbackPage } from "@/pages/auth-callback-page"
import { ProfessorDashboardPage } from "@/pages/professor/dashboard-page"
import { ProfessorClassesPage } from "@/pages/professor/classes-page"
import { ProfessorClassDetailPage } from "@/pages/professor/class-detail-page"
import { ProfessorLivePage } from "@/pages/professor/live-page"
import { ProfessorAnalyticsPage } from "@/pages/professor/analytics-page"
import { AlunoDashboardPage } from "@/pages/aluno/dashboard-page"
import { AlunoJoinClassPage } from "@/pages/aluno/join-class-page"
import { AlunoClassesPage } from "@/pages/aluno/classes-page"
import { AlunoClassDetailPage } from "@/pages/aluno/class-detail-page"
import { AlunoStudyPage } from "@/pages/aluno/study-page"
import { AlunoLiveJoinPage } from "@/pages/aluno/live-join-page"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          <Route
            path="/professor"
            element={
              <RequireRole role="professor">
                <ProfessorDashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/professor/turmas"
            element={
              <RequireRole role="professor">
                <ProfessorClassesPage />
              </RequireRole>
            }
          />
          <Route
            path="/professor/turmas/:id"
            element={
              <RequireRole role="professor">
                <ProfessorClassDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="/professor/ao-vivo"
            element={
              <RequireRole role="professor">
                <ProfessorLivePage />
              </RequireRole>
            }
          />
          <Route
            path="/professor/analytics"
            element={
              <RequireRole role="professor">
                <ProfessorAnalyticsPage />
              </RequireRole>
            }
          />

          <Route
            path="/aluno"
            element={
              <RequireRole role="aluno">
                <AlunoDashboardPage />
              </RequireRole>
            }
          />
          <Route
            path="/aluno/entrar"
            element={
              <RequireRole role="aluno">
                <AlunoJoinClassPage />
              </RequireRole>
            }
          />
          <Route
            path="/aluno/turmas"
            element={
              <RequireRole role="aluno">
                <AlunoClassesPage />
              </RequireRole>
            }
          />
          <Route
            path="/aluno/turmas/:id"
            element={
              <RequireRole role="aluno">
                <AlunoClassDetailPage />
              </RequireRole>
            }
          />
          <Route
            path="/aluno/estudar"
            element={
              <RequireRole role="aluno">
                <AlunoStudyPage />
              </RequireRole>
            }
          />
          <Route
            path="/aluno/sessao"
            element={
              <RequireRole role="aluno">
                <AlunoLiveJoinPage />
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}
