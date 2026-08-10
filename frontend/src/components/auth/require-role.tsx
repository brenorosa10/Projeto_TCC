import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types"

export function RequireRole({
  role,
  children,
}: {
  role: UserRole
  children: ReactNode
}) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  if (!profile) {
    return <Navigate to="/auth/callback" replace />
  }

  if (profile.role !== role) {
    return (
      <Navigate
        to={profile.role === "professor" ? "/professor" : "/aluno"}
        replace
      />
    )
  }

  return <>{children}</>
}
