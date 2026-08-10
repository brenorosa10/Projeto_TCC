import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types"

function isUserRole(value: string | null): value is UserRole {
  return value === "professor" || value === "aluno"
}

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session, loading, ensureProfile, refreshProfile, getIntendedRole, profile } =
    useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return

    async function complete() {
      if (!session) {
        setError("Sessão não encontrada. Tente entrar novamente.")
        return
      }

      const roleFromQuery = params.get("role")
      const intended = isUserRole(roleFromQuery)
        ? roleFromQuery
        : getIntendedRole()

      try {
        if (intended) {
          const ensured = await ensureProfile(intended)
          navigate(ensured.role === "professor" ? "/professor" : "/aluno", {
            replace: true,
          })
          return
        }

        const existing = profile ?? (await refreshProfile())
        if (existing) {
          navigate(existing.role === "professor" ? "/professor" : "/aluno", {
            replace: true,
          })
          return
        }

        setError("Não foi possível determinar o perfil. Volte e escolha Professor ou Aluno.")
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          toast.error(err.message)
          const existing = await refreshProfile().catch(() => null)
          if (existing) {
            navigate(existing.role === "professor" ? "/professor" : "/aluno", {
              replace: true,
            })
            return
          }
        }
        const message =
          err instanceof Error ? err.message : "Falha ao concluir autenticação"
        setError(message)
      }
    }

    void complete()
  }, [
    ensureProfile,
    getIntendedRole,
    loading,
    navigate,
    params,
    profile,
    refreshProfile,
    session,
  ])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hero-atmosphere px-6 text-center">
      <p className="font-display text-3xl font-semibold text-primary">Astro</p>
      {error ? (
        <>
          <p className="max-w-md text-destructive">{error}</p>
          <button
            className="text-sm text-primary underline"
            onClick={() => navigate("/", { replace: true })}
          >
            Voltar à página inicial
          </button>
        </>
      ) : (
        <p className="text-muted-foreground">Finalizando login com Google...</p>
      )}
    </div>
  )
}
