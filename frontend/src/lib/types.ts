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
  | "ordering"
  | "cloze"
  | "categorize"
  | "flashcard"

export type SectionRole = "prep" | "practice" | "feedback"

export type StudySessionStatus = "prep" | "practice" | "feedback" | "completed"

export type ContentBlockType = "markdown" | "code" | "question"

export type QuestionDifficulty = "iniciante" | "intermediario" | "avancado"

export type ImagePosition = "before" | "after"

export interface ContentBlock {
  type: ContentBlockType | string
  content: string
  language?: string | null
}

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
  imageUrl?: string | null
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

export interface OrderEntry {
  id: string
  text: string
  position: number
}

export interface ClozeBlank {
  id: string
  position: number
  acceptedAnswers?: string[] | null
}

export interface CategoryBucket {
  id: string
  label: string
  position: number
}

export interface CategoryItem {
  id: string
  text: string
  categoryId?: string | null
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
  orderEntries?: OrderEntry[] | null
  clozeBlanks?: ClozeBlank[] | null
  categories?: CategoryBucket[] | null
  categoryItems?: CategoryItem[] | null
  intro?: ContentBlock[] | null
  promptBlocks?: ContentBlock[] | null
  feedbackBlocks?: ContentBlock[] | null
  feedbackMessages?: string[] | null
  topics?: string[] | null
  difficulty?: QuestionDifficulty | string | null
  challengeId?: string | null
  requireExplanation?: boolean | null
  explanationMinLength?: number | null
  explanationPrompt?: string | null
  imagePosition?: ImagePosition | string | null
}

export interface ActivitySection {
  id: string
  role: SectionRole
  title?: string | null
  body?: string | null
  feedbackTemplate?: string | null
  position: number
  itemIds: string[]
  objectives?: string[] | null
  estimatedMinutes?: number | null
  tips?: string[] | null
  imageDataUrl?: string | null
}

export interface Activity extends ActivitySummary {
  items: ActivityItem[]
  sections?: ActivitySection[]
}

export interface CreateQuestionOptionRequest {
  id?: string
  text: string
  isCorrect: boolean
  imageUrl?: string
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
  orderEntries?: CreateOrderEntryRequest[]
  clozeBlanks?: CreateClozeBlankRequest[]
  categories?: CreateCategoryRequest[]
  categoryItems?: CreateCategoryItemRequest[]
  front?: string
  back?: string
  imageDataUrl?: string
  intro?: ContentBlock[]
  promptBlocks?: ContentBlock[]
  feedbackBlocks?: ContentBlock[]
  feedbackMessages?: string[]
  topics?: string[]
  difficulty?: QuestionDifficulty | string
  challengeId?: string
  requireExplanation?: boolean
  explanationMinLength?: number
  explanationPrompt?: string
  imagePosition?: ImagePosition | string
}

export interface CreateOrderEntryRequest {
  id?: string
  text: string
}

export interface CreateClozeBlankRequest {
  id?: string
  acceptedAnswers?: string[]
}

export interface CreateCategoryRequest {
  id?: string
  label: string
}

export interface CreateCategoryItemRequest {
  id?: string
  text: string
  categoryId?: string
}

export interface CreateActivitySectionRequest {
  id?: string
  role: SectionRole
  title?: string
  body?: string
  feedbackTemplate?: string
  items?: CreateActivityItemRequest[]
  objectives?: string[]
  estimatedMinutes?: number
  tips?: string[]
  imageDataUrl?: string
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
  classIds?: string[]
  ownedByMe?: boolean
  completed?: boolean
  bestCorrect?: number | null
  bestTotal?: number | null
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
  orderedIds?: string[]
  clozeAnswers?: ClozeAnswerRequest[]
  categoryPlacements?: CategoryPlacementRequest[]
  responseTimeMs?: number
}

export interface ClozeAnswerRequest {
  blankId: string
  text: string
}

export interface CategoryPlacementRequest {
  itemId: string
  categoryId: string
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
  feedbackBlocks?: ContentBlock[] | null
  feedbackMessages?: string[] | null
}

export interface StudyFlashcardSummary {
  id: string
  title: string
  itemCount: number
  dueCount: number
  classNames: string[]
  isPublic?: boolean
  classIds?: string[]
  ownedByMe?: boolean
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
  objectives?: string[] | null
  estimatedMinutes?: number | null
  tips?: string[] | null
  imageDataUrl?: string | null
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
  orderItems?: MatchingEntry[] | null
  categories?: MatchingEntry[] | null
  categoryItems?: MatchingEntry[] | null
  clozeBlanks?: MatchingEntry[] | null
  intro?: ContentBlock[] | null
  promptBlocks?: ContentBlock[] | null
  topics?: string[] | null
  difficulty?: QuestionDifficulty | string | null
  requireExplanation?: boolean | null
  explanationMinLength?: number | null
  explanationPrompt?: string | null
  imagePosition?: ImagePosition | string | null
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
  studentAnswer?: string | null
  correctAnswer?: string | null
  studentAnswerImageUrls?: string[] | null
  correctAnswerImageUrls?: string[] | null
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
  prepSection?: StudySessionSectionView | null
}

export interface CreateStudySessionRequest {
  activityId: string
  forceNew?: boolean
}

export type LiveSessionStatus = "lobby" | "running" | "ended"
export type LiveSessionPhase = "lobby" | "question" | "reveal" | "ended"
export type LiveSessionMode = "quiz" | "prova"

export interface LiveParticipant {
  studentId: string
  name: string
  joinedAt: string
  isConnected: boolean
}

export interface LiveRankingEntry {
  studentId: string
  name: string
  score: number
  correctCount: number
}

export interface LiveAnswerTally {
  answeredCount: number
  participantCount: number
}

export interface LivePersonalResult {
  hasAnswered: boolean
  isCorrect?: boolean | null
  score: number
  correctCount: number
  totalAnswered: number
}

export interface LiveQuestionReveal {
  itemId: string
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  accuracyPercent: number
  correctOptionIds?: string[] | null
  explanation?: string | null
  feedbackBlocks?: ContentBlock[] | null
  feedbackMessages?: string[] | null
}

export interface LiveSessionState {
  id: string
  activityId: string
  classId: string
  activityTitle: string
  className: string
  pin: string
  status: LiveSessionStatus | string
  phase: LiveSessionPhase | string
  mode: LiveSessionMode | string
  itemIndex: number
  itemCount: number
  presentedCount: number
  questionStartedAt?: string | null
  timeLimitSeconds?: number | null
  questionEndsAt?: string | null
  currentItem?: StudySessionItem | null
  tally: LiveAnswerTally
  participants: LiveParticipant[]
  ranking?: LiveRankingEntry[] | null
  reveal?: LiveQuestionReveal | null
  personal?: LivePersonalResult | null
  showAnswerKey: boolean
}

export interface CreateLiveSessionRequest {
  activityId: string
  classId: string
}

export interface AnalyticsActivitySummary {
  id: string
  title: string
  type: string
  sessionCount: number
  participantCount: number
}

export interface AnalyticsSessionSummary {
  id: string
  activityId: string
  pin: string
  className: string
  title: string
  mode: string
  status: string
  startedAt: string
  endedAt?: string | null
  participants: LiveParticipant[]
}

export interface AnalyticsQuestion {
  itemId: string
  prompt: string
  kind: string
  attempts: number
  correctCount: number
  incorrectCount: number
  accuracyPercent: number
  errorPercent: number
  highError: boolean
  correctNames: string[]
  incorrectNames: string[]
}

export interface AnalyticsOverview {
  activities: AnalyticsActivitySummary[]
  selectedActivityId?: string | null
  selectedSessionId?: string | null
  sessions: AnalyticsSessionSummary[]
  questions: AnalyticsQuestion[]
}

export interface ApiErrorBody {
  title?: string
  detail?: string
  message?: string
}
