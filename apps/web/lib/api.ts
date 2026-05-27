// ============================================================
// API 客户端 —— Mock-First 双模式
// ------------------------------------------------------------
// USE_MOCK = true（默认）：走 mockData，2 秒模拟延迟
// USE_MOCK = false：走真实后端 BASE_URL
// 联调时只需切 USE_MOCK，所有页面代码不动 —— 这就是 Mock-First 的核心
// ============================================================

import axios from "axios"
import type {
  SendOtpResponse,
  LoginResponse,
  MeResponse,
  UploadVaultResponse,
  VaultListResponse,
  VaultDetailResponse,
  PlanListResponse,
  PlanDetailResponse,
  PlanStatusResponse,
  FlashcardListResponse,
  FlashcardUpdateResponse,
  QuestionListResponse,
  AnswerResponse,
  WrongQuestionListResponse,
  Vault,
  VaultStatus,
} from "./types"
import {
  mockUser,
  mockVaults,
  mockPlans,
  mockPlanDetail,
  mockFlashcards,
  mockQuestions,
  mockWrongQuestions,
} from "./mockData"
import { USE_MOCK, delay, makeMockToken } from "./mockMode"
import {
  detectSubject,
  generateFlashcards as engineGenerateFlashcards,
  generateFlashcardCards,
  generateQuestions as engineGenerateQuestions,
  getTopicForDay,
  getGoalForDay,
  type Personality,
  type FlashcardCard,
} from "./mockContentEngine"
import { getActivePersonality } from "./sandboxStore"
import type { AgentPersonality } from "./types"

// v2.2 mock 期：题目运行时缓存（让 answer 能找到动态生成的题）
const dynamicQuestionCache = new Map<string, {
  id: string
  content: string
  options: { A: string; B: string; C: string; D: string }
  correct: string
  explanation: string
  dayIndex: number
  type?: "single" | "multi" | "true-false-explain"
  reasonKeywords?: string[]
}>()

/**
 * v2.2.1 mock：基于 planId → 找 vault → 当前激活人格
 * 通过 mockContentEngine 动态生成跟资料 + 人格匹配的闪卡
 * 注意：闪卡 ID 包含 personality，不同沙箱的同位置闪卡 ID 不同
 */
function generateDynamicFlashcardsForPlan(planId: string) {
  const plan = mockPlans.find((p) => p.id === planId)
  if (!plan) return []
  const vault = mockVaultStore.find((v) => v.id === plan.vaultId)
  if (!vault) return []

  const personality: Personality =
    (getActivePersonality(vault.id) as Personality) || "student"

  const subject = detectSubject(vault.filename)
  const result: Array<{
    id: string
    planId: string
    personality: AgentPersonality
    front: string
    back: string
    dayIndex: number
    mastery: number
    createdAt: string
    card: FlashcardCard
  }> = []

  // 给前 3 天各生成 3-4 张
  for (let day = 1; day <= Math.min(plan.totalDays, 3); day++) {
    // 同时取结构化版本 + 文本版本（兼容老逻辑）
    const structured = generateFlashcardCards(subject, personality, day)
    const flat = engineGenerateFlashcards(subject, personality, day)
    structured.forEach((card, i) => {
      const flatItem = flat[i]
      result.push({
        id: `fc-${planId}-${personality}-${day}-${i}`,
        planId,
        personality,
        front: card.question, // 用结构化版本的 question
        back: flatItem?.back ?? card.answer.definition, // 兼容
        dayIndex: day,
        mastery: 0,
        createdAt: new Date().toISOString(),
        card,  // ← 结构化数据，前端用这个渲染
      })
    })
  }
  return result
}

function generateDynamicQuestionsForPlan(planId: string) {
  const plan = mockPlans.find((p) => p.id === planId)
  if (!plan) return []
  const vault = mockVaultStore.find((v) => v.id === plan.vaultId)
  if (!vault) return []

  const personality: Personality =
    (getActivePersonality(vault.id) as Personality) || "student"

  const subject = detectSubject(vault.filename)
  const result: Array<{
    id: string
    personality: AgentPersonality
    type: "single" | "multi" | "true-false-explain"
    content: string
    options: { A: string; B: string; C: string; D: string }
    correct: string
    explanation: string
    dayIndex: number
    reasonKeywords?: string[]
  }> = []

  for (let day = 1; day <= Math.min(plan.totalDays, 3); day++) {
    const qs = engineGenerateQuestions(subject, personality, day)
    qs.forEach((q, i) => {
      const item = {
        id: `q-${planId}-${personality}-${day}-${i}`,
        personality,
        type: q.type,
        content: q.content,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation,
        dayIndex: day,
        reasonKeywords: q.reasonKeywords,
      }
      dynamicQuestionCache.set(item.id, item)
      result.push(item)
    })
  }
  return result
}

// v2.2：BASE_URL 为空时走相对路径 ""，由 next.config.js 的 rewrites 代理到生产
// 这样可以绕开浏览器 CORS（生产服务器 CORS 只允许 EdgeOne 域名）
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ""

const http = axios.create({ baseURL: BASE_URL })

if (typeof window !== "undefined") {
  http.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
}

// ---------- 仅 mock 模式使用的本地状态 ----------
const mockVaultStore: Vault[] = [...mockVaults]
const mockSentOtps: Record<string, string> = {}

// ============================================================
// Auth
// ============================================================

export const authApi = {
  async sendOtp(email: string): Promise<SendOtpResponse> {
    if (USE_MOCK) {
      await delay()
      mockSentOtps[email] = "000000"
      console.log(`[Mock] 验证码已"发送"到 ${email} —— 任何 6 位数字都能通过`)
      return { success: true }
    }
    const res = await http.post<SendOtpResponse>("/api/auth/send-otp", { email })
    return res.data
  },

  async login(email: string, code: string): Promise<LoginResponse> {
    if (USE_MOCK) {
      await delay()
      if (!/^\d{6}$/.test(code)) {
        throw new Error("验证码必须是 6 位数字")
      }
      return {
        success: true,
        token: makeMockToken(),
        user: { ...mockUser, email },
      }
    }
    const res = await http.post<LoginResponse>("/api/auth/login", { email, code })
    return res.data
  },

  async me(): Promise<MeResponse> {
    if (USE_MOCK) {
      await delay(200)
      return { user: mockUser }
    }
    const res = await http.get<MeResponse>("/api/auth/me")
    return res.data
  },
}

// ============================================================
// Vault
// ============================================================

export const vaultApi = {
  async upload(file: File): Promise<UploadVaultResponse> {
    if (USE_MOCK) {
      await delay(800)
      const id = `vlt-${Date.now()}`
      const newVault: Vault = {
        id,
        filename: file.name,
        fileUrl: `mock://local/${file.name}`,
        status: "pending",
        errorMsg: null,
        createdAt: new Date().toISOString(),
      }
      mockVaultStore.unshift(newVault)
      // 模拟 AI 异步处理：3 秒后 processing → 8 秒后 done
      setTimeout(() => updateMockVaultStatus(id, "processing"), 3000)
      setTimeout(() => updateMockVaultStatus(id, "done"), 8000)
      return {
        success: true,
        vaultId: id,
        filename: file.name,
        fileUrl: newVault.fileUrl,
        status: "pending",
      }
    }
    const form = new FormData()
    form.append("file", file)
    const res = await http.post<UploadVaultResponse>("/api/vault/upload", form)
    return res.data
  },

  async list(): Promise<VaultListResponse> {
    if (USE_MOCK) {
      await delay()
      return { vaults: [...mockVaultStore] }
    }
    const res = await http.get<VaultListResponse>("/api/vault")
    return res.data
  },

  async get(id: string): Promise<VaultDetailResponse> {
    if (USE_MOCK) {
      await delay()
      const vault = mockVaultStore.find((v) => v.id === id)
      if (!vault) throw new Error("Vault 不存在")
      return { vault }
    }
    const res = await http.get<VaultDetailResponse>(`/api/vault/${id}`)
    return res.data
  },
}

function updateMockVaultStatus(id: string, status: VaultStatus): void {
  const v = mockVaultStore.find((x) => x.id === id)
  if (v) v.status = status
}

// ============================================================
// 学习计划
// ============================================================

export const planApi = {
  async list(): Promise<PlanListResponse> {
    if (USE_MOCK) {
      await delay()
      return { plans: [...mockPlans] }
    }
    const res = await http.get<PlanListResponse>("/api/plan")
    return res.data
  },

  async get(_id: string): Promise<PlanDetailResponse> {
    if (USE_MOCK) {
      await delay()
      // v2.2 mock：基于 planId 找对应 plan，days 主题用 mockContentEngine 拟真
      const p = mockPlans.find((x) => x.id === _id)
      if (p) {
        const v = mockVaultStore.find((x) => x.id === p.vaultId)
        const subject = detectSubject(v?.filename ?? "")
        return {
          plan: {
            ...p,
            planData: {
              title: p.title,
              totalDays: p.totalDays,
              days: Array.from({ length: p.totalDays }, (_, i) => ({
                day: i + 1,
                date: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
                topics: [getTopicForDay(subject, i + 1)],
                goals: [getGoalForDay(subject, i + 1)],
                estimatedMinutes: 60,
              })),
            },
          },
        }
      }
      return { plan: mockPlanDetail }
    }
    const res = await http.get<PlanDetailResponse>(`/api/plan/${_id}`)
    return res.data
  },

  async status(id: string): Promise<PlanStatusResponse> {
    if (USE_MOCK) {
      await delay(200)
      const vault = mockVaultStore.find((v) => v.id === id)
      let planFound = mockPlans.find((p) => p.vaultId === id)
      // v2.2：mock 模式下，已 done 但还没生成计划的 vault 自动给它生成一个 plan
      // 这样 /loading/[vaultId] 轮询到 done 时能拿到 planId
      if (vault?.status === "done" && !planFound) {
        planFound = {
          id: `pln-${id}`,
          title: `${vault.filename.replace(/\.[^.]+$/, "")} · 学习计划`,
          totalDays: 14,
          vaultId: id,
          createdAt: new Date().toISOString(),
        }
        mockPlans.unshift(planFound)
      }
      return {
        vaultId: id,
        planId: planFound?.id,
        status: vault?.status ?? "done",
        errorMsg: vault?.errorMsg ?? null,
      }
    }
    const res = await http.get<PlanStatusResponse>(`/api/plan/${id}/status`)
    return res.data
  },
}

// ============================================================
// 闪卡
// ============================================================

export const flashcardApi = {
  async list(planId: string): Promise<FlashcardListResponse> {
    if (USE_MOCK) {
      await delay()
      // v2.2：基于 plan→vault.filename + 用户选的人格动态生成闪卡
      const dynamic = generateDynamicFlashcardsForPlan(planId)
      if (dynamic.length > 0) return { flashcards: dynamic }
      // 兜底：回到 hardcoded mock
      return { flashcards: mockFlashcards.filter((f) => f.planId === planId) }
    }
    const res = await http.get<FlashcardListResponse>("/api/flashcard", {
      params: { planId },
    })
    return res.data
  },

  async updateMastery(id: string, mastery: number): Promise<FlashcardUpdateResponse> {
    if (USE_MOCK) {
      await delay(200)
      const card = mockFlashcards.find((f) => f.id === id)
      if (!card) throw new Error("Flashcard 不存在")
      card.mastery = mastery
      return { flashcard: { ...card, mastery } }
    }
    const res = await http.patch<FlashcardUpdateResponse>(`/api/flashcard/${id}`, {
      mastery,
    })
    return res.data
  },
}

// ============================================================
// 题目
// ============================================================

export const questionApi = {
  /**
   * v2.2.1：scope 参数支持 3 档过滤
   *   - undefined / 'all'  : 全计划题目（默认）
   *   - 'today'            : 仅今日学过的 dayIndex
   *   - 'studied'          : 累计已学的所有 dayIndex
   *
   * todayDayIndexes / studiedDayIndexes 由前端从沙箱反推后传入
   */
  async list(
    _planId: string,
    options?: {
      scope?: "today" | "studied" | "all"
      dayIndexes?: number[]  // 若 scope=today/studied，传入要保留的 dayIndex
    },
  ): Promise<QuestionListResponse> {
    if (USE_MOCK) {
      await delay()
      const dynamic = generateDynamicQuestionsForPlan(_planId)
      let questions = dynamic.length > 0 ? dynamic : [...mockQuestions]

      // v2.2.1：按 scope 过滤
      if (options?.scope === "today" || options?.scope === "studied") {
        const allowDays = new Set(options.dayIndexes ?? [])
        if (allowDays.size > 0) {
          questions = questions.filter((q) => allowDays.has(q.dayIndex))
        } else {
          // 没有传 dayIndexes（用户还没学）→ 返回空，让 UI 提示
          questions = []
        }
      }

      return { questions }
    }
    const res = await http.get<QuestionListResponse>("/api/question", {
      params: { planId: _planId, scope: options?.scope },
    })
    return res.data
  },

  async answer(
    questionId: string,
    userAnswer: string,
    reason?: string,
  ): Promise<AnswerResponse> {
    if (USE_MOCK) {
      await delay(300)
      const dyn = dynamicQuestionCache.get(questionId)
      const q = (dyn ?? mockQuestions.find((x) => x.id === questionId)) as
        | { correct: string; explanation: string; reasonKeywords?: string[]; type?: string }
        | undefined
      if (!q) throw new Error("题目不存在")

      // v2.2.1：按题型评判
      let isCorrect = false
      let reasonScore: number | undefined

      if (q.type === "multi") {
        // 多选：选项集合完全相同才算对（顺序无关）
        const userSet = new Set(userAnswer.split(",").filter(Boolean))
        const correctSet = new Set(q.correct.split(",").filter(Boolean))
        isCorrect =
          userSet.size === correctSet.size &&
          Array.from(userSet).every((x) => correctSet.has(x))
      } else if (q.type === "true-false-explain") {
        // 判断+理由：T/F 答对 + 理由中含至少 1 个关键词
        const tfCorrect = q.correct === userAnswer
        const kws = q.reasonKeywords ?? []
        const hitCount = kws.filter((k) => reason?.includes(k)).length
        reasonScore = kws.length > 0 ? Math.min(hitCount / kws.length, 1) : 1
        // 严苛教练：T/F 对 + 理由含 ≥ 1 个关键词
        isCorrect = tfCorrect && hitCount >= 1
      } else {
        // single
        isCorrect = q.correct === userAnswer
      }

      return {
        isCorrect,
        correctAnswer: q.correct,
        explanation: q.explanation,
        reasonScore,
      }
    }
    const res = await http.post<AnswerResponse>("/api/answer", {
      questionId,
      userAnswer,
      reason,
    })
    return res.data
  },
}

// ============================================================
// 错题本
// ============================================================

export const wrongQuestionApi = {
  async list(): Promise<WrongQuestionListResponse> {
    if (USE_MOCK) {
      await delay()
      return { wrongQuestions: [...mockWrongQuestions] }
    }
    const res = await http.get<WrongQuestionListResponse>("/api/wrong-question")
    return res.data
  },
}
