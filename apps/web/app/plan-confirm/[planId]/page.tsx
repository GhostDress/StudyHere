"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { BookOpen, Clock, Calendar, ArrowRight, Loader2, RefreshCw } from "lucide-react"
import { planApi } from "@/lib/api"
import type { StudyPlan } from "@/lib/types"

/**
 * v2.2 流程节点：计划确认页（PRD v2.1 §6.2 PlanConfirm）
 *
 * 上游：/loading/[vaultId] 检测到计划生成完毕跳来
 * 下游：用户点「这个计划可以」→ /agent-settings/[vaultId] 选 AI 风格
 *
 * 功能：
 *   - 展示 AI 生成的 N 天学习计划总览
 *   - 让用户预览每天主题，决定是否接受
 *   - 不满意可点「重新生成」（后端重新调用，本期 mock 仅刷新页面）
 */

export default function PlanConfirmPage() {
  const router = useRouter()
  const params = useParams<{ planId: string }>()
  const planId = params.planId

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await planApi.get(planId)
        if (!cancelled) setPlan(res.plan)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "计划加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [planId])

  function handleAccept() {
    if (!plan) return
    // 进入下一步：选智能体（按 PRD v2.1 §6.1 完整愿景图：Plan → PlanConfirm → Agent → Detail）
    router.push(`/agent-settings/${plan.vaultId}?planId=${plan.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center">
        <Loader2 className="size-8 text-[#6940a5] animate-spin" />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex flex-col items-center justify-center px-6">
        <p className="text-[#c4332e] mb-4">{error || "计划不存在"}</p>
        <button
          onClick={() => router.push("/home")}
          className="rounded-xl bg-[#37352f] text-white px-5 py-2.5 text-sm font-semibold hover:bg-black"
        >
          返回首页
        </button>
      </div>
    )
  }

  const days = plan.planData?.days ?? []
  const totalMinutes = days.reduce((sum, d) => sum + (d.estimatedMinutes ?? 0), 0)
  const totalHours = Math.round(totalMinutes / 60)

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#37352f]">
      {/* 顶栏 */}
      <header className="border-b border-[#e9e9e8] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-[#6940a5] text-white flex items-center justify-center text-sm font-bold">
              S
            </div>
            <span className="font-semibold tracking-tight">StudyHere</span>
          </div>
          <span className="text-xs text-[#9b9a97]">Step 2 / 3 · 确认计划</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:py-12 pb-32">
        {/* 标题 */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[#f4efff] text-[#6940a5] px-2.5 py-1 text-[12px] font-semibold mb-4">
            ✨ AI 已生成
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {plan.title}
          </h1>
          <p className="mt-3 text-[#6b6f76] text-base max-w-2xl">
            AI 已经根据你上传的资料生成了一份学习计划。预览一下，没问题就进入下一步选择 AI 助教风格。
          </p>
        </div>

        {/* 总览数据 */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-10">
          <div className="rounded-xl border border-[#e9e9e8] bg-white p-4 md:p-5">
            <div className="flex items-center gap-2 text-[#9b9a97] text-[12px] mb-1">
              <Calendar className="size-3.5" /> 总天数
            </div>
            <div className="text-2xl md:text-3xl font-bold">{plan.totalDays}</div>
            <div className="text-[12px] text-[#9b9a97] mt-1">天</div>
          </div>
          <div className="rounded-xl border border-[#e9e9e8] bg-white p-4 md:p-5">
            <div className="flex items-center gap-2 text-[#9b9a97] text-[12px] mb-1">
              <Clock className="size-3.5" /> 预计总时长
            </div>
            <div className="text-2xl md:text-3xl font-bold">{totalHours}</div>
            <div className="text-[12px] text-[#9b9a97] mt-1">小时</div>
          </div>
          <div className="rounded-xl border border-[#e9e9e8] bg-white p-4 md:p-5">
            <div className="flex items-center gap-2 text-[#9b9a97] text-[12px] mb-1">
              <BookOpen className="size-3.5" /> 每日时长
            </div>
            <div className="text-2xl md:text-3xl font-bold">
              {plan.totalDays > 0 ? Math.round(totalMinutes / plan.totalDays) : 0}
            </div>
            <div className="text-[12px] text-[#9b9a97] mt-1">分钟</div>
          </div>
        </div>

        {/* 每日内容预览 */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-bold">每日学习内容</h2>
            <span className="text-[12px] text-[#9b9a97]">
              展示前 {Math.min(days.length, 7)} 天，完整计划进入下一步可查看
            </span>
          </div>
          <div className="space-y-2">
            {days.slice(0, 7).map((d) => (
              <div
                key={d.day}
                className="rounded-xl border border-[#e9e9e8] bg-white p-4 flex items-start gap-3 hover:bg-[#fafafa] transition-colors"
              >
                <div className="size-9 rounded-lg bg-[#37352f] text-white flex items-center justify-center font-bold text-[14px] flex-shrink-0">
                  {d.day}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 text-[12px] text-[#9b9a97] mb-1">
                    <span>{d.date}</span>
                    <span>·</span>
                    <span>{d.estimatedMinutes} 分钟</span>
                  </div>
                  <div className="text-[14px] font-semibold text-[#37352f]">
                    {d.topics?.join(" · ")}
                  </div>
                  <div className="text-[13px] text-[#6b6f76] mt-0.5">
                    🎯 {d.goals?.join("；")}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {days.length > 7 && (
            <div className="text-center mt-3 text-[12px] text-[#9b9a97]">
              ……还有 {days.length - 7} 天
            </div>
          )}
        </div>
      </main>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#e9e9e8]">
        <div className="mx-auto max-w-5xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[13px] text-[#9b9a97] text-center sm:text-left">
            点「确认并继续」后，下一步选择 AI 助教风格
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleAccept}
              className="inline-flex items-center gap-2 rounded-xl bg-[#37352f] text-white px-5 py-2.5 text-[14px] font-semibold hover:bg-black flex-1 sm:flex-none justify-center"
            >
              确认并继续
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
