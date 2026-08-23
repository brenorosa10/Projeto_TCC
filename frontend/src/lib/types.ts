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

export type ItemKind =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "matching"
  | "flashcard"

export type SectionRole = "prep" | "practice" | "feedback"

export type StudySessionStatus = "prep" | "practice" | "feedback" | "completed"

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

export interface MatchingPair {
  leftId: string
  rightId: string
  left: string
  right: string
}

export interface MatchingEntry {
  id: string
  text: string
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
  sectionId?: string | null
  allowMultiple?: boolean | null
  acceptedAnswers?: string[] | null
  caseSensitive?: boolean | null
  pairs?: MatchingPair[] | null
}

export interface ActivitySection {
  id: string
  role: SectionRole
  title?: string | null
  body?: string | null
  feedbackTemplate?: string | null
  position: number
  itemIds: string[]
}

export interface Activity extends ActivitySummary {
  items: ActivityItem[]
  sections?: ActivitySection[]
}

export interface CreateQuestionOptionRequest {
  id?: string
  text: string
  isCorrect: boolean
}

export interface CreateMatchingPairRequest {
  leftId?: string
  rightId?: string
  left: string
  right: string
}

export interface CreateActivityItemRequest {
  id?: string
  kind?: ItemKind
  prompt?: string
  explanation?: string
  timeLimitSeconds?: number
  options?: CreateQuestionOptionRequest[]
  allowMultiple?: boolean
  acceptedAnswers?: string[]
  caseSensitive?: boolean
  correctTrue?: boolean
  pairs?: CreateMatchingPairRequest[]
  front?: string
  back?: string
  imageDataUrl?: string
}

export interface CreateActivitySectionRequest {
  id?: string
  role: SectionRole
  title?: string
  body?: string
  feedbackTemplate?: string
  items?: CreateActivityItemRequest[]
}

export interface CreateActivityRequest {
  title: string
  type: "quiz" | "flashcards"
  items?: CreateActivityItemRequest[]
  isPublic?: boolean
  sections?: CreateActivitySectionRequest[]
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

export interface MatchingAnswerRequest {
  leftId: string
  rightId: string
}

export interface SubmitStudyAnswerRequest {
  itemId: string
  selectedOptionId?: string | null
  selectedOptionIds?: string[]
  textAnswer?: string
  remembered?: boolean
  pairs?: MatchingAnswerRequest[]
  responseTimeMs?: number
}

export interface StudyAnswerFeedback {
  itemId: string
  selectedOptionId?: string | null
  correctOptionId?: string | null
  isCorrect: boolean
  explanation?: string | null
  kind?: string | null
  selectedOptionIds?: string[] | null
  correctOptionIds?: string[] | null
  textAnswer?: string | null
  remembered?: boolean | null
  back?: string | null
  score?: number | null
  boxLevel?: number | null
  nextReviewAt?: string | null
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

export interface StudySessionProgress {
  answeredCount: number
  practiceTotal: number
  correctCount: number
}

export interface StudySessionSectionView {
  id: string
  role: SectionRole
  title?: string | null
  body?: string | null
  feedbackTemplate?: string | null
}

export interface StudySessionItem {
  id: string
  kind: ItemKind | string
  prompt?: string | null
  timeLimitSeconds?: number | null
  options?: QuestionOption[] | null
  front?: string | null
  back?: string | null
  imageDataUrl?: string | null
  allowMultiple?: boolean | null
  left?: MatchingEntry[] | null
  right?: MatchingEntry[] | null
}

export interface StudySessionFeedbackItem {
  itemId: string
  kind: string
  prompt?: string | null
  isCorrect?: boolean | null
  explanation?: string | null
  selectedOptionId?: string | null
  correctOptionId?: string | null
  textAnswer?: string | null
  remembered?: boolean | null
  score?: number | null
}

export interface StudySessionFeedback {
  template: string
  title?: string | null
  body?: string | null
  total: number
  correctCount: number
  incorrectCount: number
  items: StudySessionFeedbackItem[]
}

export interface StudySession {
  id: string
  activityId: string
  activityTitle: string
  activityType: ActivityType | string
  status: StudySessionStatus
  sectionIndex: number
  sectionCount: number
  currentSection?: StudySessionSectionView | null
  currentItem?: StudySessionItem | null
  currentItemFeedback?: StudyAnswerFeedback | null
  progress: StudySessionProgress
  feedback?: StudySessionFeedback | null
}

export interface CreateStudySessionRequest {
  activityId: string
  forceNew?: boolean
}

export interface ApiErrorBody {
  title?: string
  detail?: string
  message?: string
}
