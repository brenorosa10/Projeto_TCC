import { getAccessToken } from "@/lib/auth-token"
import type {
  Activity,
  ActivitySummary,
  ApiErrorBody,
  ClassRoom,
  CreateActivityRequest,
  CreateClassRequest,
  EnsureProfileRequest,
  JoinClassRequest,
  Profile,
  StudyAnswerFeedback,
  StudyFlashcardSession,
  StudyFlashcardSummary,
  StudyQuizSummary,
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
  listActivities: (classId: string) =>
    request<ActivitySummary[]>(`/api/classes/${classId}/activities`),
  listMyActivities: () => request<ActivitySummary[]>("/api/activities"),
  getActivity: (id: string) => request<Activity>(`/api/activities/${id}`),
  createActivity: (body: CreateActivityRequest) =>
    request<Activity>("/api/activities", {
      method: "POST",
      body: JSON.stringify(body),
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
