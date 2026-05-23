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
} from "./types"

// 开发时用 mockData，联调时改为真实后端地址
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

const http = axios.create({ baseURL: BASE_URL })

// 自动注入 token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// -------------------- Auth --------------------

export const authApi = {
  sendOtp: (email: string) =>
    http.post<SendOtpResponse>("/api/auth/send-otp", { email }),

  login: (email: string, code: string) =>
    http.post<LoginResponse>("/api/auth/login", { email, code }),

  me: () => http.get<MeResponse>("/api/auth/me"),
}

// -------------------- Vault --------------------

export const vaultApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return http.post<UploadVaultResponse>("/api/vault/upload", form)
  },

  list: () => http.get<VaultListResponse>("/api/vault"),

  get: (id: string) => http.get<VaultDetailResponse>(`/api/vault/${id}`),
}

// -------------------- 学习计划 --------------------

export const planApi = {
  list: () => http.get<PlanListResponse>("/api/plan"),

  get: (id: string) => http.get<PlanDetailResponse>(`/api/plan/${id}`),

  // 轮询 AI 处理进度（pending → processing → done/failed）
  // 传 planId 或 vaultId 均可
  status: (id: string) => http.get<PlanStatusResponse>(`/api/plan/${id}/status`),
}

// -------------------- 闪卡 --------------------

export const flashcardApi = {
  list: (planId: string) =>
    http.get<FlashcardListResponse>("/api/flashcard", { params: { planId } }),

  // mastery：0（未掌握）→ 5（完全掌握）
  updateMastery: (id: string, mastery: number) =>
    http.patch<FlashcardUpdateResponse>(`/api/flashcard/${id}`, { mastery }),
}

// -------------------- 题目 --------------------

export const questionApi = {
  // 随机返回 20 道题
  list: (planId: string) =>
    http.get<QuestionListResponse>("/api/question", { params: { planId } }),

  // userAnswer："A" | "B" | "C" | "D"
  answer: (questionId: string, userAnswer: string) =>
    http.post<AnswerResponse>("/api/answer", { questionId, userAnswer }),
}

// -------------------- 错题本 --------------------

export const wrongQuestionApi = {
  list: () => http.get<WrongQuestionListResponse>("/api/wrong-question"),
}
