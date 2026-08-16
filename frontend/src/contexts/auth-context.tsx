import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { api, ApiError, startGoogleLogin } from "@/lib/api"
import {
  clearAccessToken,
  consumeTokenFromUrl,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth-token"
import type { AuthSession, Profile, UserRole } from "@/lib/types"

const INTENDED_ROLE_KEY = "astro_intended_role"

interface AuthContextValue {
  session: AuthSession | null
  profile: Profile | null
  loading: boolean
  signInWithGoogle: (role: UserRole) => Promise<void>
  signInWithPassword: (login: string, password: string) => Promise<Profile>
  registerWithPassword: (
    input: { username: string; email: string; password: string; role: UserRole }
  ) => Promise<Profile>
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

function readInitialSession(): AuthSession | null {
  const token = consumeTokenFromUrl() ?? getAccessToken()
  if (!token) {
    return null
  }
  setAccessToken(token)
  return { accessToken: token }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readInitialSession)
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

    if (!session) {
      setLoading(false)
      return
    }

    refreshProfile()
      .catch(() => {
        if (mounted) setProfile(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [refreshProfile, session])

  const getIntendedRole = useCallback(() => {
    const stored = sessionStorage.getItem(INTENDED_ROLE_KEY)
    return isUserRole(stored) ? stored : null
  }, [])

  const clearIntendedRole = useCallback(() => {
    sessionStorage.removeItem(INTENDED_ROLE_KEY)
  }, [])

  const signInWithGoogle = useCallback(async (role: UserRole) => {
    sessionStorage.setItem(INTENDED_ROLE_KEY, role)
    startGoogleLogin()
  }, [])

  const applyAuthResponse = useCallback((accessToken: string, nextProfile: Profile) => {
    setAccessToken(accessToken)
    setSession({ accessToken })
    setProfile(nextProfile)
    clearIntendedRole()
    return nextProfile
  }, [clearIntendedRole])

  const signInWithPassword = useCallback(
    async (login: string, password: string) => {
      const result = await api.login({ login, password })
      return applyAuthResponse(result.accessToken, result.profile)
    },
    [applyAuthResponse]
  )

  const registerWithPassword = useCallback(
    async (input: { username: string; email: string; password: string; role: UserRole }) => {
      const result = await api.register(input)
      return applyAuthResponse(result.accessToken, result.profile)
    },
    [applyAuthResponse]
  )

  const signOut = useCallback(async () => {
    clearIntendedRole()
    clearAccessToken()
    setProfile(null)
    setSession(null)
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
      profile,
      loading,
      signInWithGoogle,
      signInWithPassword,
      registerWithPassword,
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
      signInWithPassword,
      registerWithPassword,
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
