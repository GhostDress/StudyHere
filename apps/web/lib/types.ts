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

// v2.2.1：智能体人格（学习沙箱维度）
export type AgentPersonality = "student" | "cert" | "explorer" | "strict"

export interface PlanDay {
  day: number
  date: string
  estimatedMinutes: number
  topics?: string[]
  goals?: string[]
}

export interface StudyPlan {
  id: string
  title: string
  totalDays: number
  vaultId: string
  personality?: AgentPersonality  // v2.2.1 新增：每个 plan 属于一个人格沙箱
  createdAt: string
  planData?: { title?: string; totalDays?: number; days?: PlanDay[] }
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
  personality?: AgentPersonality  // v2.2.1 新增
  front: string
  back: string
  dayIndex: number
  mastery: number
  createdAt: string
  // v2.2.1：结构化卡片数据（含人格 + 学习理论），前端按 personality 渲染
  card?: import("./mockContentEngine").FlashcardCard
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

// v2.2.1：题型 —— 按人格教育学理论分化
//   single        : 单选（学生党/考证型用）
//   multi         : 多选（兴趣探索用 - 对应远距离迁移）
//   true-false-explain : 判断+理由（严苛教练用 - 对应生成效应）
export type QuestionType = "single" | "multi" | "true-false-explain"

export interface Question {
  id: string
  personality?: AgentPersonality  // v2.2.1 新增
  type?: QuestionType             // v2.2.1：默认 single 向后兼容
  content: string
  options: QuestionOptions
  /**
   * 正确答案：
   *   single             → "A" / "B" / "C" / "D"
   *   multi              → "A,B" / "B,C,D" 等逗号分隔
   *   true-false-explain → "T" / "F"（content 是一个陈述句）
   */
  correct: string
  explanation: string
  dayIndex: number
  /** 严苛教练判断题用：参考"理由"作答的关键词，用户输入后做轻量匹配 */
  reasonKeywords?: string[]
}

export interface QuestionListResponse {
  questions: Question[]
}

export interface AnswerResponse {
  isCorrect: boolean
  /** single: "A"; multi: "A,B,C"; tf-explain: "T"/"F" */
  correctAnswer: string
  explanation: string
  /** 严苛教练题：用户提交的理由是否包含足够关键词 */
  reasonScore?: number  // 0-1
}

// ---------- 错题本 ----------

export interface WrongQuestion {
  id: string
  userId: string
  questionId: string
  personality?: AgentPersonality  // v2.2.1 新增：错于哪个人格
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
