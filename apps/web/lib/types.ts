// ============================================================
// StudyHere 前端类型定义 — 与后端 API 响应结构一一对应
// ============================================================

// ---------- 通用 ----------

export interface ApiError {
  error: string
}

// ---------- 用户 ----------

export interface User {
  id: string
  email: string
  name: string
  createdAt?: string
}

// ---------- Auth ----------

export interface SendOtpResponse {
  success: boolean
}

export interface LoginResponse {
  success: boolean
  token: string
  user: User
}

export interface MeResponse {
  user: User
}

// ---------- Vault（文件库）----------

export type VaultStatus = "pending" | "processing" | "done" | "failed"

export interface Vault {
  id: string
  filename: string
  fileUrl: string
  status: VaultStatus
  errorMsg: string | null
  createdAt: string
}

export interface UploadVaultResponse {
  success: boolean
  vaultId: string
  filename: string
  fileUrl: string
  status: VaultStatus
}

export interface VaultListResponse {
  vaults: Vault[]
}

export interface VaultDetailResponse {
  vault: Vault
}

// ---------- 学习计划 ----------

export interface StudyPlan {
  id: string
  title: string
  totalDays: number
  vaultId: string
  createdAt: string
  planData?: unknown
}

export interface PlanListResponse {
  plans: StudyPlan[]
}

export interface PlanDetailResponse {
  plan: StudyPlan
}

export interface PlanStatusResponse {
  planId?: string
  vaultId?: string
  status: VaultStatus
  errorMsg: string | null
}

// ---------- 闪卡 ----------

export interface Flashcard {
  id: string
  planId: string
  front: string
  back: string
  dayIndex: number
  mastery: number
  createdAt: string
}

export interface FlashcardListResponse {
  flashcards: Flashcard[]
}

export interface FlashcardUpdateResponse {
  flashcard: Flashcard
}

// ---------- 题目 ----------

export interface QuestionOptions {
  A: string
  B: string
  C: string
  D: string
}

export type AnswerKey = "A" | "B" | "C" | "D"

export interface Question {
  id: string
  content: string
  options: QuestionOptions
  correct: AnswerKey
  explanation: string
  dayIndex: number
}

export interface QuestionListResponse {
  questions: Question[]
}

export interface AnswerResponse {
  isCorrect: boolean
  correctAnswer: AnswerKey
  explanation: string
}

// ---------- 错题本 ----------

export interface WrongQuestion {
  id: string
  userId: string
  questionId: string
  wrongCount: number
  lastWrongAt: string
  question: {
    id: string
    content: string
    options: QuestionOptions
    correct: string
    explanation: string
  }
}

export interface WrongQuestionListResponse {
  wrongQuestions: WrongQuestion[]
}
