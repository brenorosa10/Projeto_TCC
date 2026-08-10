import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { api, ApiError } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import type { Profile, UserRole } from "@/lib/types"

const INTENDED_ROLE_KEY = "astro_intended_role"

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signInWithGoogle: (role: UserRole) => Promise<void>
  signOut: () => Promise<void>
  ensureProfile: (role?: UserRole) => Promise<Profile>
  refreshProfile: () => Promise<Profile | null>
  getIntendedRole: () => UserRole | null
  clearIntendedRole: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isUserRole(value: string | null | undefined): value is UserRole {
  return value === "professor" || value === "aluno"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    try {
      const me = await api.getMe()
      setProfile(me)
      return me
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setProfile(null)
        return null
      }
      throw error
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) {
        refreshProfile()
          .catch(() => setProfile(null))
          .finally(() => {
            if (mounted) setLoading(false)
          })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [refreshProfile])

  const getIntendedRole = useCallback(() => {
    const stored = sessionStorage.getItem(INTENDED_ROLE_KEY)
    return isUserRole(stored) ? stored : null
  }, [])

  const clearIntendedRole = useCallback(() => {
    sessionStorage.removeItem(INTENDED_ROLE_KEY)
  }, [])

  const signInWithGoogle = useCallback(async (role: UserRole) => {
    sessionStorage.setItem(INTENDED_ROLE_KEY, role)
    const redirectTo = `${window.location.origin}/auth/callback?role=${role}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    clearIntendedRole()
    setProfile(null)
    await supabase.auth.signOut()
  }, [clearIntendedRole])

  const ensureProfile = useCallback(
    async (role?: UserRole) => {
      const intended = role ?? getIntendedRole()
      if (!intended) {
        throw new Error("Perfil pretendido não informado.")
      }
      const ensured = await api.ensureProfile({ role: intended })
      setProfile(ensured)
      clearIntendedRole()
      return ensured
    },
    [clearIntendedRole, getIntendedRole]
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithGoogle,
      signOut,
      ensureProfile,
      refreshProfile,
      getIntendedRole,
      clearIntendedRole,
    }),
    [
      session,
      profile,
      loading,
      signInWithGoogle,
      signOut,
      ensureProfile,
      refreshProfile,
      getIntendedRole,
      clearIntendedRole,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider")
  }
  return ctx
}
