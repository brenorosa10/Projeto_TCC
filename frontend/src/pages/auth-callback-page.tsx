import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import { getAuthErrorFromUrl } from "@/lib/auth-token"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types"

function isUserRole(value: string | null): value is UserRole {
  return value === "professor" || value === "aluno"
}

function googleAuthErrorMessage(authError: string) {
  switch (authError) {
    case "access_denied":
      return "Login com Google cancelado."
    case "invalid_client":
      return "O secret do Google na VPS está incorreto. Confira Auth__Google__ClientSecret no .env (deve começar com GOCSPX-, sem YOUR_)."
    case "redirect_uri":
      return "O Google recusou o endereço de retorno. No Cloud Console a URI tem que ser https://astroarq.online/signin-google."
    case "correlation":
      return "A sessão do Google expirou ou o navegador bloqueou o cookie. Feche a aba, abra https://astroarq.online e tente de novo."
    default:
      return "Não foi possível entrar com o Google. Tente novamente."
  }
}

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { session, loading, ensureProfile, refreshProfile, getIntendedRole, profile } =
    useAuth()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (loading) return
    if (started.current) return
    started.current = true

    async function complete() {
      const authError = getAuthErrorFromUrl()
      if (authError) {
        setError(googleAuthErrorMessage(authError))
        return
      }

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
