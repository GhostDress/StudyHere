"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  BookOpen,
  Clock,
  Calendar,
  ArrowRight,
  Loader2,
  FileText,
  Pin,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Sparkles,
  RefreshCw,
} from "lucide-react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { planApi, vaultApi } from "@/lib/api"
import type { StudyPlan, PlanDay, Vault } from "@/lib/types"
import { usePdfDrawer } from "@/components/PdfDrawer"
import {
  getPinnedDays,
  togglePinnedDay,
  getDayOrder,
  setDayOrder,
  mockSourcePages,
  mockExtractedPoints,
  mockReasoning,
} from "@/lib/planConfirmStore"

/**
 * v2.2 / v2.3 slice 2 · 计划确认页（信任链路核心）
 *
 * 上游：/loading/[vaultId] 检测到计划生成完毕跳来
 * 下游：用户点「这个计划可以」→ /agent-settings/[vaultId] 选 AI 风格
 *
 * v2.3 slice 2 新增（PRD §2 决策 1/2/3）：
 *   ✅ 决策 1：每个 Day 卡片右上角 📄 按钮 → 打开 PdfDrawer 跳到 sourcePages[0]
 *   ✅ 决策 2：📖 源于原文 P12-18 溯源行 + 🧠 为什么这么拆 折叠区
 *   ✅ 决策 3：📌 钉住按钮 + 同 Day 拖拽换序（跨 Day 拖拽留 v2.3.1）
 *
 * 数据源 fallback：
 *   后端 plan.service 还没接 chunks 表前，sourcePages / extractedPoints / reasoning
 *   会缺失——前端 mock fallback 让视觉先跑通。
 */

export default function PlanConfirmPage() {
  const router = useRouter()
  const params = useParams<{ planId: string }>()
  const planId = params.planId
  const { open: openPdf } = usePdfDrawer()

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [vault, setVault] = useState<Vault | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [pinnedDays, setPinnedDays] = useState<number[]>([])
  const [expandedReasonings, setExpandedReasonings] = useState<Set<number>>(new Set())
  const [orderedDays, setOrderedDays] = useState<PlanDay[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)
  const [regenNotice, setRegenNotice] = useState<string | null>(null)

  // 加载 plan + vault（vault 为了拿 fileUrl 给 PdfDrawer 用）
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await planApi.get(planId)
        if (cancelled) return
        setPlan(res.plan)
        // 拉 vault 拿 fileUrl
        try {
          const vRes = await vaultApi.get(res.plan.vaultId)
          if (!cancelled) setVault(vRes.vault)
        } catch {
          // vault 拉不到不致命，PDF 抽屉会降级显示
        }
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

  // plan 加载后初始化 pinnedDays + orderedDays
  useEffect(() => {
    if (!plan) return
    setPinnedDays(getPinnedDays(planId))
    const days = plan.planData?.days ?? []
    const customOrder = getDayOrder(planId)
    if (customOrder && customOrder.length === days.length) {
      // 按自定义顺序重排
      const map = new Map(days.map((d) => [d.day, d]))
      const reordered = customOrder
        .map((dayNum) => map.get(dayNum))
        .filter((d): d is PlanDay => !!d)
      setOrderedDays(reordered.length === days.length ? reordered : days)
    } else {
      setOrderedDays(days)
    }
  }, [plan, planId])

  function handleAccept() {
    if (!plan) return
    router.push(`/agent-settings/${plan.vaultId}?planId=${plan.id}`)
  }

  function handleTogglePin(day: number) {
    const next = togglePinnedDay(planId, day)
    setPinnedDays(next)
  }

  function handleToggleReasoning(day: number) {
    setExpandedReasonings((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  function handleOpenPdf(d: PlanDay) {
    if (!vault?.fileUrl) return
    const pages = d.sourcePages ?? mockSourcePages(d.day, plan?.totalDays ?? 7)
    openPdf({ fileUrl: vault.fileUrl, page: pages[0] ?? 1 })
  }

  async function handleRegenerate() {
    if (!plan || regenerating) return
    const totalDays = orderedDays.length
    const pinnedCount = pinnedDays.length
    const willRegen = totalDays - pinnedCount

    const confirmMsg =
      pinnedCount > 0
        ? `保留 ${pinnedCount} 天钉住的内容，重新拆解其余 ${willRegen} 天？`
        : `重新拆解全部 ${totalDays} 天的学习内容？\n（如想保留某些天不变，请先 📌 钉住它们）`
    if (!confirm(confirmMsg)) return

    setRegenerating(true)
    setRegenError(null)
    setRegenNotice(null)
    try {
      const res = await planApi.regenerate(plan.id, {
        pinnedDays,
        dayOrder: orderedDays.map((d) => d.day),
      })
      const newPlan = res.plan
      const newDays = newPlan.planData?.days ?? []

      // 防御：如果后端/mock 没返回 days，不清空 UI，提示用户重试
      if (newDays.length === 0) {
        setRegenError(
          "后端暂未返回新计划（接口可能还未部署），当前内容保持不变",
        )
        return
      }

      setPlan(newPlan)
      // 重生后保留钉住的 Day 的旧数据，其他 Day 用新返回的
      const merged = newDays.map((nd) =>
        pinnedDays.includes(nd.day)
          ? orderedDays.find((od) => od.day === nd.day) ?? nd
          : nd,
      )
      setOrderedDays(merged)
      const changedCount = newDays.length - pinnedDays.length
      setRegenNotice(
        pinnedDays.length > 0
          ? `已重新生成 ${changedCount} 天（钉住的 ${pinnedDays.length} 天保持不变）`
          : `已重新生成 ${newDays.length} 天的内容`,
      )
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : "重新生成失败，请稍后再试")
    } finally {
      setRegenerating(false)
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    if (result.source.index === result.destination.index) return
    const next = [...orderedDays]
    const [moved] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, moved)
    setOrderedDays(next)
    setDayOrder(
      planId,
      next.map((d) => d.day)
    )
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

  const visibleDays = orderedDays.slice(0, 7)
  const totalMinutes = orderedDays.reduce(
    (sum, d) => sum + (d.estimatedMinutes ?? 0),
    0
  )
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
          <div className="flex items-center gap-3">
            {vault?.fileUrl && (
              <button
                onClick={() =>
                  openPdf({ fileUrl: vault.fileUrl, page: 1 })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e9e9e8] hover:border-[#6940a5] hover:text-[#6940a5] px-3 py-1.5 text-[12px] font-medium transition-colors"
              >
                <FileText className="size-3.5" />
                查看原文
              </button>
            )}
            <span className="text-xs text-[#9b9a97]">Step 2 / 3 · 确认计划</span>
          </div>
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
            每天内容下方都标了「📖 源于原文」和「🧠 为什么这么拆」——点开就能跳回原文核对。
            觉得哪天 AI 拆得对，可以 📌 钉住；想换顺序直接拖。
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
              展示前 {Math.min(orderedDays.length, 7)} 天，可拖拽换序 · 完整计划进入下一步可查看
            </span>
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="plan-days">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-2"
                >
                  {visibleDays.map((d, idx) => (
                    <DayCard
                      key={d.day}
                      day={d}
                      index={idx}
                      totalDays={plan.totalDays}
                      isPinned={pinnedDays.includes(d.day)}
                      isReasoningOpen={expandedReasonings.has(d.day)}
                      hasVaultFile={!!vault?.fileUrl}
                      onTogglePin={() => handleTogglePin(d.day)}
                      onToggleReasoning={() => handleToggleReasoning(d.day)}
                      onOpenPdf={() => handleOpenPdf(d)}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {orderedDays.length > 7 && (
            <div className="text-center mt-3 text-[12px] text-[#9b9a97]">
              ……还有 {orderedDays.length - 7} 天
            </div>
          )}
        </div>
      </main>

      {/* 底部固定操作栏 */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-[#e9e9e8]">
        {/* 提示条（重生成功/失败） */}
        {(regenNotice || regenError) && (
          <div
            className={`mx-auto max-w-5xl px-6 py-2 text-[12px] ${
              regenError
                ? "text-[#c4332e] bg-[#fdf3f3]"
                : "text-[#2d7a45] bg-[#eaf5ec]"
            }`}
          >
            {regenError ?? regenNotice}
          </div>
        )}
        <div className="mx-auto max-w-5xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[13px] text-[#9b9a97] text-center sm:text-left">
            {pinnedDays.length > 0
              ? `已钉住 ${pinnedDays.length} 天，重新生成时会保留这几天`
              : "点「确认并继续」后，下一步选择 AI 助教风格"}
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#e9e9e8] hover:border-[#6940a5] hover:text-[#6940a5] px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none justify-center"
              title={
                pinnedDays.length > 0
                  ? `保留 ${pinnedDays.length} 天钉住的内容，其余重新拆`
                  : "完全重新拆解所有天（如想保留某些天，请先钉住）"
              }
            >
              {regenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {regenerating ? "重新生成中" : "重新生成"}
            </button>
            <button
              onClick={handleAccept}
              disabled={regenerating}
              className="inline-flex items-center gap-2 rounded-xl bg-[#37352f] text-white px-5 py-2.5 text-[14px] font-semibold hover:bg-black flex-1 sm:flex-none justify-center disabled:opacity-50"
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

// ============================================================
// Day 卡片（拖拽 + 钉住 + 溯源 + 为什么拆）
// ============================================================

interface DayCardProps {
  day: PlanDay
  index: number
  totalDays: number
  isPinned: boolean
  isReasoningOpen: boolean
  hasVaultFile: boolean
  onTogglePin: () => void
  onToggleReasoning: () => void
  onOpenPdf: () => void
}

function DayCard({
  day,
  index,
  totalDays,
  isPinned,
  isReasoningOpen,
  hasVaultFile,
  onTogglePin,
  onToggleReasoning,
  onOpenPdf,
}: DayCardProps) {
  // 后端缺字段时走 mock fallback（slice 2 阶段必备）
  const sourcePages = day.sourcePages ?? mockSourcePages(day.day, totalDays)
  const extractedPoints =
    day.extractedPoints ?? mockExtractedPoints(day.day, day.topics ?? [])
  const reasoning = day.reasoning ?? mockReasoning(day.day, day.topics ?? [])
  const pageRangeLabel =
    sourcePages.length >= 2
      ? `P${sourcePages[0]}-${sourcePages[sourcePages.length - 1]}`
      : `P${sourcePages[0] ?? "?"}`

  return (
    <Draggable draggableId={String(day.day)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-xl border bg-white p-4 transition-all ${
            isPinned
              ? "border-[#d97757] border-2"
              : "border-[#e9e9e8]"
          } ${snapshot.isDragging ? "shadow-lg ring-2 ring-[#6940a5]/30" : ""}`}
        >
          <div className="flex items-start gap-3">
            {/* 拖拽手柄 */}
            <div
              {...provided.dragHandleProps}
              className="flex-shrink-0 mt-1 text-[#c4c4c2] hover:text-[#37352f] cursor-grab active:cursor-grabbing"
              aria-label="拖拽换序"
            >
              <GripVertical className="size-4" />
            </div>

            {/* Day 编号 */}
            <div className="size-9 rounded-lg bg-[#37352f] text-white flex items-center justify-center font-bold text-[14px] flex-shrink-0">
              {day.day}
            </div>

            {/* 内容主体 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 text-[12px] text-[#9b9a97] mb-1">
                <span>{day.date}</span>
                <span>·</span>
                <span>{day.estimatedMinutes} 分钟</span>
              </div>
              <div className="text-[14px] font-semibold text-[#37352f]">
                {day.topics?.join(" · ")}
              </div>
              <div className="text-[13px] text-[#6b6f76] mt-0.5">
                🎯 {day.goals?.join("；")}
              </div>

              {/* 📖 源于原文 行 */}
              <button
                type="button"
                onClick={onOpenPdf}
                disabled={!hasVaultFile}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#6940a5] hover:underline disabled:text-[#9b9a97] disabled:no-underline disabled:cursor-not-allowed"
              >
                <span>📖 源于原文 {pageRangeLabel}</span>
                {hasVaultFile && <FileText className="size-3" />}
              </button>

              {/* 🧠 为什么这么拆 折叠区 */}
              <button
                type="button"
                onClick={onToggleReasoning}
                className="ml-3 inline-flex items-center gap-1 text-[12px] text-[#6b6f76] hover:text-[#37352f]"
              >
                <span>🧠 为什么这么拆</span>
                {isReasoningOpen ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                )}
              </button>

              {isReasoningOpen && (
                <div className="mt-2 rounded-lg bg-[#fafafa] border border-[#e9e9e8] p-3 text-[13px] text-[#37352f] leading-relaxed">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#9b9a97] mb-1.5 font-semibold">
                    <Sparkles className="size-3" />
                    AI 拆解理由
                  </div>
                  <p>{reasoning}</p>
                  {extractedPoints.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[#e9e9e8]">
                      <div className="text-[11px] text-[#9b9a97] mb-1 font-semibold">
                        提炼了 {extractedPoints.length} 个核心点：
                      </div>
                      <ul className="text-[12px] text-[#6b6f76] space-y-0.5 list-disc list-inside">
                        {extractedPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 📌 钉住按钮 */}
            <button
              type="button"
              onClick={onTogglePin}
              className={`flex-shrink-0 size-8 rounded-lg flex items-center justify-center transition-colors ${
                isPinned
                  ? "bg-[#d97757] text-white"
                  : "text-[#9b9a97] hover:bg-[#f4f4f3]"
              }`}
              aria-label={isPinned ? "取消钉住" : "钉住"}
              title={isPinned ? "取消钉住（参与重生）" : "钉住这天（重生时保留）"}
            >
              <Pin
                className={`size-4 ${isPinned ? "fill-current" : ""}`}
                style={isPinned ? { transform: "rotate(-30deg)" } : undefined}
              />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  )
}
