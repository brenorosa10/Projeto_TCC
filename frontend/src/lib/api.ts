import { supabase } from "@/lib/supabase"
import type {
  ApiErrorBody,
  ClassRoom,
  CreateClassRequest,
  EnsureProfileRequest,
  JoinClassRequest,
  Profile,
} from "@/lib/types"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5080"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = `Erro ${response.status}`
    try {
      const body = (await response.json()) as ApiErrorBody
      message = body.detail ?? body.message ?? body.title ?? message
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const api = {
  ensureProfile: (body: EnsureProfileRequest) =>
    request<Profile>("/api/profiles/ensure", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMe: () => request<Profile>("/api/profiles/me"),
  listClasses: () => request<ClassRoom[]>("/api/classes"),
  getClass: (id: string) => request<ClassRoom>(`/api/classes/${id}`),
  createClass: (body: CreateClassRequest) =>
    request<ClassRoom>("/api/classes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  joinClass: (body: JoinClassRequest) =>
    request<ClassRoom>("/api/classes/join", {
      method: "POST",
      body: JSON.stringify(body),
    }),
}

export function getApiBaseUrl() {
  return API_URL
}
