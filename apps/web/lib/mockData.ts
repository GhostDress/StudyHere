// ============================================================
// StudyHere Mock 数据 — 联调前供 B 前端开发使用
// 结构与真实 API 响应完全一致
// ============================================================
// 使用方式：
//   import { mockUser, mockVaults, ... } from "@/lib/mockData"
// 联调时只需把组件里的 mockXxx 替换为 api.ts 里对应的请求即可

import type {
  User,
  Vault,
  StudyPlan,
  Flashcard,
  Question,
  WrongQuestion,
} from "./types"

// ---------- 用户 ----------

export const mockUser: User = {
  id: "usr-001",
  email: "alice@example.com",
  name: "alice",
  createdAt: "2026-05-20T08:00:00.000Z",
}

// ---------- Vault（文件库）----------

export const mockVaults: Vault[] = [
  {
    id: "vlt-001",
    filename: "高等数学上册.pdf",
    fileUrl: "https://rcpwlkdofuymxyrkrcms.supabase.co/storage/v1/object/public/user-files/usr-001/1716192000000-高等数学上册.pdf",
    status: "done",
    errorMsg: null,
    createdAt: "2026-05-20T09:00:00.000Z",
  },
  {
    id: "vlt-002",
    filename: "线性代数复习资料.docx",
    fileUrl: "https://rcpwlkdofuymxyrkrcms.supabase.co/storage/v1/object/public/user-files/usr-001/1716278400000-线性代数复习资料.docx",
    status: "processing",
    errorMsg: null,
    createdAt: "2026-05-21T09:00:00.000Z",
  },
  {
    id: "vlt-003",
    filename: "概率论笔记.pdf",
    fileUrl: "https://rcpwlkdofuymxyrkrcms.supabase.co/storage/v1/object/public/user-files/usr-001/1716364800000-概率论笔记.pdf",
    status: "failed",
    errorMsg: "文件解析失败：无法提取文字内容",
    createdAt: "2026-05-22T09:00:00.000Z",
  },
]

// ---------- 学习计划 ----------

export const mockPlans: StudyPlan[] = [
  {
    id: "pln-001",
    title: "高等数学上册 · 学习计划",
    totalDays: 14,
    vaultId: "vlt-001",
    createdAt: "2026-05-20T09:05:00.000Z",
  },
]

export const mockPlanDetail: StudyPlan = {
  ...mockPlans[0],
  planData: {
    title: "高等数学上册 · 学习计划",
    totalDays: 14,
    days: Array.from({ length: 14 }, (_, i) => ({
      day: i + 1,
      date: `2026-05-${String(20 + i).padStart(2, "0")}`,
      topics: [`第${i + 1}章主题`],
      goals: [`完成第${i + 1}章内容学习与练习`],
      estimatedMinutes: 60,
    })),
  },
}

// ---------- 闪卡 ----------

export const mockFlashcards: Flashcard[] = [
  {
    id: "fc-001",
    planId: "pln-001",
    front: "极限的 ε-δ 定义是什么？",
    back: "对于任意 ε > 0，存在 δ > 0，使得当 0 < |x - a| < δ 时，有 |f(x) - L| < ε，则称 f(x) 在 x → a 时极限为 L。",
    dayIndex: 1,
    mastery: 0,
    createdAt: "2026-05-20T09:05:00.000Z",
  },
  {
    id: "fc-002",
    planId: "pln-001",
    front: "洛必达法则的适用条件？",
    back: "当极限为 0/0 或 ∞/∞ 不定型时，可以对分子分母分别求导后再取极限，前提是导数之比的极限存在。",
    dayIndex: 1,
    mastery: 2,
    createdAt: "2026-05-20T09:05:00.000Z",
  },
  {
    id: "fc-003",
    planId: "pln-001",
    front: "导数的几何意义是什么？",
    back: "f'(x₀) 表示曲线 y = f(x) 在点 (x₀, f(x₀)) 处切线的斜率。",
    dayIndex: 2,
    mastery: 4,
    createdAt: "2026-05-21T09:05:00.000Z",
  },
  {
    id: "fc-004",
    planId: "pln-001",
    front: "积分中值定理的内容？",
    back: "若 f 在 [a, b] 连续，则存在 ξ ∈ (a, b) 使得 ∫ₐᵇ f(x)dx = f(ξ)(b-a)。",
    dayIndex: 3,
    mastery: 1,
    createdAt: "2026-05-22T09:05:00.000Z",
  },
]

// ---------- 题目 ----------

export const mockQuestions: Question[] = [
  {
    id: "q-001",
    content: "下列关于极限的说法，正确的是？",
    options: {
      A: "极限值一定存在",
      B: "函数在某点有极限，则在该点连续",
      C: "函数在某点连续，则在该点极限存在且等于函数值",
      D: "极限与函数值无关",
    },
    correct: "C",
    explanation: "连续的定义即：lim f(x) = f(a)，所以 C 正确。A 错误（极限可以不存在），B 错误（有极限不代表连续，如跳跃间断点）。",
    dayIndex: 1,
  },
  {
    id: "q-002",
    content: "∫₀¹ x² dx 的值为？",
    options: {
      A: "1/4",
      B: "1/3",
      C: "1/2",
      D: "1",
    },
    correct: "B",
    explanation: "∫₀¹ x² dx = [x³/3]₀¹ = 1/3 - 0 = 1/3。",
    dayIndex: 3,
  },
  {
    id: "q-003",
    content: "函数 f(x) = |x| 在 x = 0 处？",
    options: {
      A: "连续且可导",
      B: "不连续",
      C: "连续但不可导",
      D: "既不连续也不可导",
    },
    correct: "C",
    explanation: "f(x) = |x| 在 x = 0 处连续（左右极限均为 0 等于函数值），但左导数为 -1，右导数为 1，不相等，故不可导。",
    dayIndex: 2,
  },
]

// ---------- 错题本 ----------

export const mockWrongQuestions: WrongQuestion[] = [
  {
    id: "wq-001",
    userId: "usr-001",
    questionId: "q-001",
    wrongCount: 3,
    lastWrongAt: "2026-05-22T10:00:00.000Z",
    question: {
      id: "q-001",
      content: mockQuestions[0].content,
      options: mockQuestions[0].options,
      correct: mockQuestions[0].correct,
      explanation: mockQuestions[0].explanation,
    },
  },
  {
    id: "wq-002",
    userId: "usr-001",
    questionId: "q-003",
    wrongCount: 1,
    lastWrongAt: "2026-05-21T15:00:00.000Z",
    question: {
      id: "q-003",
      content: mockQuestions[2].content,
      options: mockQuestions[2].options,
      correct: mockQuestions[2].correct,
      explanation: mockQuestions[2].explanation,
    },
  },
]
