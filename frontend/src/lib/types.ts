export type UserRole = "professor" | "aluno"

export interface Profile {
  id: string
  email: string
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

export interface CreateClassRequest {
  name: string
}

export interface JoinClassRequest {
  code: string
}

export interface ApiErrorBody {
  title?: string
  detail?: string
  message?: string
}
