"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Sparkles,
  Layers,
  Pencil,
  Clock,
  Target,
  BookOpen,
} from "lucide-react"
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
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[#9b9a97] text-sm">加载中</div>
      </main>
    )
  }

  if (error || !plan) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-[#787774]">{error || "计划不存在"}</div>
        <button
          onClick={() => router.push("/vault")}
          className="nt-btn-ghost"
        >
          <ArrowLeft className="w-4 h-4" />
          返回资料库
        </button>
      </main>
    )
  }

  const planData = plan.planData as PlanData | undefined
  const days = planData?.days ?? []
  const totalMinutes = days.reduce((sum, d) => sum + d.estimatedMinutes, 0)

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-[#e9e9e8] bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push("/vault")}
            className="flex items-center gap-1.5 text-[13px] text-[#787774] hover:text-[#37352f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            资料库
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#37352f] text-white flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-[#37352f] text-[15px]">
              StudyHere
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <span className="nt-tag-ai">
          <Sparkles className="w-3 h-3" />
          AI 生成
        </span>
        <h1 className="mt-4 text-[32px] font-bold text-[#37352f] tracking-tight leading-tight">
          {plan.title}
        </h1>
        <div className="mt-3 flex items-center gap-4 text-[13px] text-[#787774]">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {plan.totalDays} 天
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            共约 {Math.round(totalMinutes / 60)} 小时
          </span>
        </div>

        <div className="mt-7 flex gap-2.5">
          <button
            onClick={() => router.push(`/flashcard/${plan.id}`)}
            className="nt-btn-ai"
          >
            <Layers className="w-4 h-4" />
            闪卡复习
          </button>
          <button
            onClick={() => router.push(`/quiz/${plan.id}`)}
            className="nt-btn-ghost border border-[#e9e9e8]"
          >
            <Pencil className="w-4 h-4" />
            答题练习
          </button>
        </div>

        <div className="mt-12 mb-5">
          <h2 className="text-[15px] font-semibold text-[#37352f]">
            每日学习内容
          </h2>
          <p className="text-[13px] text-[#9b9a97] mt-1">
            点击日期卡片查看详情
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {days.map((day) => (
            <div
              key={day.day}
              className="nt-card p-5 hover:border-[#37352f] hover:shadow-[0_2px_8px_rgba(15,15,15,0.06)] transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-[#37352f] text-white flex items-center justify-center text-[12px] font-semibold">
                    {day.day}
                  </div>
                  <span className="text-[12px] text-[#9b9a97]">
                    {day.date}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[12px] text-[#9b9a97]">
                  <Clock className="w-3 h-3" />
                  {day.estimatedMinutes} 分钟
                </span>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-[#9b9a97] font-semibold mb-1.5">
                  主题
                </div>
                <ul className="space-y-1">
                  {day.topics.map((t, i) => (
                    <li
                      key={i}
                      className="text-[14px] text-[#37352f] leading-relaxed"
                    >
                      · {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wider text-[#9b9a97] font-semibold mb-1.5 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  目标
                </div>
                <ul className="space-y-1">
                  {day.goals.map((g, i) => (
                    <li
                      key={i}
                      className="text-[14px] text-[#787774] leading-relaxed"
                    >
                      · {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
