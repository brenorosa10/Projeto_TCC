import { getAccessToken } from "@/lib/auth-token"
import type {
  Activity,
  ActivitySummary,
  ApiErrorBody,
  ClassRoom,
  CreateActivityRequest,
  CreateClassRequest,
  CreateStudySessionRequest,
  EnsureProfileRequest,
  JoinClassRequest,
  LoginRequest,
  Profile,
  RegisterRequest,
  AuthResponse,
  PublicActivitySummary,
  StudyAnswerFeedback,
  StudyFlashcardSession,
  StudyFlashcardSummary,
  StudyQuizSummary,
  StudySession,
  SubmitStudyAnswerRequest,
  FlashcardReviewFeedback,
} from "@/lib/types"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5080"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
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
      const body = (await response.json()) as ApiErrorBody & {
        errors?: Record<string, string[] | string>
      }
      const validation = body.errors
        ? Object.values(body.errors).flat().find((item) => typeof item === "string")
        : undefined
      message =
        (typeof validation === "string" ? validation : undefined) ??
        body.detail ??
        body.message ??
        body.title ??
        message
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
  register: (body: RegisterRequest) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: LoginRequest) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
  listActivities: (classId: string) =>
    request<ActivitySummary[]>(`/api/classes/${classId}/activities`),
  listMyActivities: () => request<ActivitySummary[]>("/api/activities"),
  getActivity: (id: string) => request<Activity>(`/api/activities/${id}`),
  createActivity: (body: CreateActivityRequest) =>
    request<Activity>("/api/activities", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateActivity: (id: string, body: CreateActivityRequest) =>
    request<Activity>(`/api/activities/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteActivity: (id: string) =>
    request<void>(`/api/activities/${id}`, {
      method: "DELETE",
    }),
  importFlashcards: (activityId: string) =>
    request<Activity>(`/api/activities/${activityId}/import-flashcards`, {
      method: "POST",
    }),
  assignActivityClasses: (activityId: string, classIds: string[]) =>
    request<Activity>(`/api/activities/${activityId}/classes`, {
      method: "PUT",
      body: JSON.stringify({ classIds }),
    }),
  linkActivityToClass: (classId: string, activityId: string) =>
    request<Activity>(`/api/classes/${classId}/activities/${activityId}`, {
      method: "POST",
    }),
  unlinkActivityFromClass: (classId: string, activityId: string) =>
    request<Activity>(`/api/classes/${classId}/activities/${activityId}`, {
      method: "DELETE",
    }),
  listPublicActivities: () => request<PublicActivitySummary[]>("/api/public/activities"),
  getPublicActivity: (id: string) => request<Activity>(`/api/public/activities/${id}`),
  submitPublicAnswer: (activityId: string, body: SubmitStudyAnswerRequest) =>
    request<StudyAnswerFeedback>(`/api/public/quizzes/${activityId}/answers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPublicFlashcardSession: (activityId: string) =>
    request<StudyFlashcardSession>(`/api/public/flashcards/${activityId}`),
  listStudyQuizzes: () => request<StudyQuizSummary[]>("/api/study/quizzes"),
  submitStudyAnswer: (activityId: string, body: SubmitStudyAnswerRequest) =>
    request<StudyAnswerFeedback>(`/api/study/quizzes/${activityId}/answers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listStudyFlashcards: () => request<StudyFlashcardSummary[]>("/api/study/flashcards"),
  getFlashcardSession: (activityId: string) =>
    request<StudyFlashcardSession>(`/api/study/flashcards/${activityId}`),
  submitFlashcardReview: (activityId: string, itemId: string, remembered: boolean) =>
    request<FlashcardReviewFeedback>(`/api/study/flashcards/${activityId}/reviews`, {
      method: "POST",
      body: JSON.stringify({ itemId, remembered }),
    }),
  createStudySession: (body: CreateStudySessionRequest) =>
    request<StudySession>("/api/study/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getStudySession: (sessionId: string) =>
    request<StudySession>(`/api/study/sessions/${sessionId}`),
  advanceStudySession: (sessionId: string) =>
    request<StudySession>(`/api/study/sessions/${sessionId}/advance`, {
      method: "POST",
    }),
  submitStudySessionAnswer: (sessionId: string, body: SubmitStudyAnswerRequest) =>
    request<StudySession>(`/api/study/sessions/${sessionId}/answers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  completeStudySession: (sessionId: string) =>
    request<StudySession>(`/api/study/sessions/${sessionId}/complete`, {
      method: "POST",
    }),
}

export function getApiBaseUrl() {
  return API_URL
}

export function startGoogleLogin() {
  const returnUrl = `${window.location.origin}/auth/callback`
  window.location.assign(
    `${API_URL}/api/auth/google?returnUrl=${encodeURIComponent(returnUrl)}`
  )
}
