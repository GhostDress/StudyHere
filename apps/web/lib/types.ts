// ============================================================
// StudyHere 前端类型定义 — 与后端 API 响应结构一一对应
// ============================================================

// ---------- 通用 ----------

export interface ApiError {
  error: string
}

// ---------- 用户 ----------

// v2.3：登录主键由 email 切到 phone（短信验证码登录）。
// email 仍保留为可选（老用户 / SRS 邮件提醒用），新用户只有 phone。
export interface User {
  id: string
  phone: string | null
  email?: string | null
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

// v2.3：每个 Day 的信任链路字段（slice 2 引入）
// 后端 plan.service AI prompt 输出 sourcePages / extractedPoints / reasoning / sourceChunkIds
// 在后端真正回填这些字段前，前端走 mock 数据先把视觉做完
export interface PlanDay {
  day: number
  date: string
  topics: string[]
  goals: string[]
  estimatedMinutes: number

  // ---- v2.3 slice 2 信任链路字段（可选，等后端回填）----
  /** 这一天内容在原文里的页码范围（["P12-P18"] / [12, 13, 14]）；用于 PdfDrawer 跳页 */
  sourcePages?: number[]
  /** 这一天 AI 提炼的核心点列表，展示在"📖 源于原文"行下 */
  extractedPoints?: string[]
  /** AI 解释为什么这天这么拆，展示在"🧠 为什么这么拆"折叠区 */
  reasoning?: string
  /** RAG 串联用：本 Day 引用的 chunk id（v2.3 阶段 B，chunks 表上线后才回填）*/
  sourceChunkIds?: string[]
}

// v2.3 slice 2：plan.service 后端返回结构，与 schema.prisma StudyPlan.planData 对齐
export interface PlanData {
  title: string
  totalDays: number
  days: PlanDay[]
}

export interface StudyPlan {
  id: string
  title: string
  totalDays: number
  vaultId: string
  personality?: AgentPersonality  // v2.2.1 新增：每个 plan 属于一个人格沙箱
  createdAt: string
  planData?: PlanData
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

// ---------- v2.3 AI 对话（RAG）----------

/** RAG 检索命中的 chunk（前端用来渲染溯源面板） */
export interface ChatSource {
  id: string
  text: string
  pageStart: number
  pageEnd: number
  orderIndex: number
  similarity: number
}

/** AI 对话单次回答 */
export interface ChatAnswerResponse {
  answer: string
  sources: ChatSource[]
  /** true = 资料里没找到，answer 是兜底文案 */
  notFound: boolean
}

/** 前端对话消息（含用户问 + AI 答，本地状态用，不入后端） */
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  /** 仅 assistant 消息有，用户消息为 undefined */
  sources?: ChatSource[]
  notFound?: boolean
  /** 客户端时间戳，仅渲染用 */
  ts: number
}

// ---------- v2.3+ 计划合理性对话式校准（PlanAdvisor）----------
// 第 8 个 AI 调用点：用户对 plan 本身的元问题（漏点 / 顺序 / 个性化）
// AI 输出结构化 action，前端渲染"应用"按钮，一键调 regenerate

export type PlanAction =
  | {
      type: "regenerate_days"
      targetDays: number[]
      hint: string
      reason: string
    }
  | {
      type: "reorder"
      newOrder: number[]
      reason: string
    }
  | {
      type: "no_change"
      reason: string
    }
  | {
      type: "need_more_info"
      question: string
    }

export interface PlanAdviceResponse {
  answer: string
  action: PlanAction
}

/** 前端 PlanAdvisor 聊天消息（含 action 用于渲染"应用"按钮）*/
export interface PlanAdviceMessage {
  role: "user" | "assistant"
  content: string
  action?: PlanAction
  ts: number
  /** 应用 action 后的状态，控制按钮 disabled */
  appliedAt?: number
}
