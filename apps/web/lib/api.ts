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

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

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
      return { plan: mockPlanDetail }
    }
    const res = await http.get<PlanDetailResponse>(`/api/plan/${_id}`)
    return res.data
  },

  async status(id: string): Promise<PlanStatusResponse> {
    if (USE_MOCK) {
      await delay(200)
      const vault = mockVaultStore.find((v) => v.id === id)
      const planFound = mockPlans.find((p) => p.vaultId === id)
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
  async list(_planId: string): Promise<QuestionListResponse> {
    if (USE_MOCK) {
      await delay()
      return { questions: [...mockQuestions] }
    }
    const res = await http.get<QuestionListResponse>("/api/question", {
      params: { planId: _planId },
    })
    return res.data
  },

  async answer(questionId: string, userAnswer: string): Promise<AnswerResponse> {
    if (USE_MOCK) {
      await delay(300)
      const q = mockQuestions.find((x) => x.id === questionId)
      if (!q) throw new Error("题目不存在")
      return {
        isCorrect: q.correct === userAnswer,
        correctAnswer: q.correct,
        explanation: q.explanation,
      }
    }
    const res = await http.post<AnswerResponse>("/api/answer", {
      questionId,
      userAnswer,
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
