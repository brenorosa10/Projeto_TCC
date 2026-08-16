export type UserRole = "professor" | "aluno"

export interface AuthSession {
  accessToken: string
}

export interface Profile {
  id: string
  email: string
  username: string | null
  fullName: string | null
  avatarUrl: string | null
  role: UserRole
  createdAt: string
}

export interface ClassRoom {
  id: string
  name: string
  code: string
  professorId: string
  professorName?: string | null
  createdAt: string
  studentCount?: number
}

export interface EnsureProfileRequest {
  role: UserRole
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  role: UserRole
}

export interface LoginRequest {
  login: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  profile: Profile
}

export interface CreateClassRequest {
  name: string
}

export interface JoinClassRequest {
  code: string
}

export type ActivityType = "quiz" | "prova" | "flashcards"

export interface ActivitySummary {
  id: string
  professorId: string
  title: string
  type: ActivityType
  createdAt: string
  itemCount: number
  sourceActivityId?: string | null
  classIds: string[]
  isPublic: boolean
}

export interface QuestionOption {
  id: string
  text: string
  isCorrect?: boolean | null
  position: number
}

export interface ActivityItem {
  id: string
  kind: string
  prompt?: string | null
  explanation?: string | null
  timeLimitSeconds?: number | null
  position: number
  options?: QuestionOption[] | null
  front?: string | null
  back?: string | null
  imageDataUrl?: string | null
}

export interface Activity extends ActivitySummary {
  items: ActivityItem[]
}

export interface CreateQuestionOptionRequest {
  id?: string
  text: string
  isCorrect: boolean
}

export interface CreateActivityItemRequest {
  id?: string
  prompt?: string
  explanation?: string
  timeLimitSeconds?: number
  options?: CreateQuestionOptionRequest[]
  front?: string
  back?: string
  imageDataUrl?: string
}

export interface CreateActivityRequest {
  title: string
  type: "quiz" | "flashcards"
  items: CreateActivityItemRequest[]
  isPublic?: boolean
}

export interface PublicActivitySummary {
  id: string
  title: string
  type: ActivityType
  itemCount: number
  createdAt: string
  professorName?: string | null
}

export interface StudyQuizSummary {
  id: string
  title: string
  itemCount: number
  classNames: string[]
  isPublic?: boolean
}

export interface SubmitStudyAnswerRequest {
  itemId: string
  selectedOptionId?: string | null
  responseTimeMs?: number
}

export interface StudyAnswerFeedback {
  itemId: string
  selectedOptionId?: string | null
  correctOptionId?: string | null
  isCorrect: boolean
  explanation?: string | null
}

export interface StudyFlashcardSummary {
  id: string
  title: string
  itemCount: number
  dueCount: number
  classNames: string[]
  isPublic?: boolean
}

export interface StudyFlashcardCard {
  id: string
  front: string
  back: string
  boxLevel: number
  imageDataUrl?: string | null
}

export interface StudyFlashcardSession {
  id: string
  title: string
  itemCount: number
  dueCount: number
  cards: StudyFlashcardCard[]
}

export interface FlashcardReviewFeedback {
  itemId: string
  remembered: boolean
  boxLevel: number
  nextReviewAt: string
}

export interface ApiErrorBody {
  title?: string
  detail?: string
  message?: string
}
