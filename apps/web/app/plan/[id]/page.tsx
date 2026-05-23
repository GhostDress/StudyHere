"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { planApi } from "@/lib/api"
import type { StudyPlan } from "@/lib/types"

interface PlanDay {
  day: number
  date: string
  topics: string[]
  goals: string[]
  estimatedMinutes: number
}

interface PlanData {
  title: string
  totalDays: number
  days: PlanDay[]
}

export default function PlanDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    planApi
      .get(params.id)
      .then((res) => setPlan(res.plan))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "加载失败"),
      )
      .finally(() => setLoading(false))
  }, [params.id, router])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        加载中...
      </main>
    )
  }

  if (error || !plan) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-red-600">{error || "计划不存在"}</div>
        <button
          onClick={() => router.push("/vault")}
          className="text-sm text-indigo-600"
        >
          返回资料库
        </button>
      </main>
    )
  }

  const planData = plan.planData as PlanData | undefined
  const days = planData?.days ?? []

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/vault")}
            className="text-slate-500 hover:text-slate-900 text-sm flex items-center gap-2"
          >
            ← 返回资料库
          </button>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <span className="font-semibold text-slate-900">StudyHere</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{plan.title}</h1>
        <p className="mt-1 text-slate-500 text-sm">
          共 {plan.totalDays} 天 · 每天约 60 分钟 · AI 生成
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push(`/flashcard/${plan.id}`)}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
          >
            🎴 开始闪卡复习
          </button>
          <button
            onClick={() => router.push(`/quiz/${plan.id}`)}
            className="px-5 py-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 text-slate-900 text-sm font-medium transition"
          >
            ✏️ 开始答题练习
          </button>
        </div>

        <h2 className="mt-10 text-lg font-semibold text-slate-900">
          每日学习内容
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {days.map((day) => (
            <div
              key={day.day}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                    {day.day}
                  </div>
                  <div className="text-xs text-slate-400">{day.date}</div>
                </div>
                <div className="text-xs text-slate-400">
                  ⏱ {day.estimatedMinutes} 分钟
                </div>
              </div>

              <div className="text-sm font-medium text-slate-900 mb-2">
                主题
              </div>
              <ul className="text-sm text-slate-600 space-y-1 mb-3">
                {day.topics.map((t, i) => (
                  <li key={i}>· {t}</li>
                ))}
              </ul>

              <div className="text-sm font-medium text-slate-900 mb-2">
                目标
              </div>
              <ul className="text-sm text-slate-600 space-y-1">
                {day.goals.map((g, i) => (
                  <li key={i}>· {g}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
