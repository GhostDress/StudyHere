"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Layers,
  Target,
  Sparkles,
  Eye,
} from "lucide-react"
import { flashcardApi, planApi } from "@/lib/api"
import type { Flashcard, StudyPlan, AgentPersonality } from "@/lib/types"
import PersonalitySwitcher from "@/components/PersonalitySwitcher"
import { getActivePersonality, getSandbox } from "@/lib/sandboxStore"

/**
 * v2.2.1 · 单日学习明细页
 *
 * 入口：从「学」Tab 点击某天的卡片进来
 *
 * 功能：
 *   - 展示这一天的主题 + 闪卡明细列表
 *   - 每张闪卡含状态徽章（未学 / 模糊 / 已掌握 / 完全不会）
 *   - 多个操作入口：
 *     · 学这一天所有闪卡
 *     · 只练未掌握的（mastery < 5）
 *     · 点击单张闪卡 → 进入只含这一张的闪卡练习
 */
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

type FlashcardStatus = "untouched" | "not-known" | "blurry" | "mastered"

function statusOf(mastery: number | undefined): FlashcardStatus {
  if (mastery == null) return "untouched"
  if (mastery >= 5) return "mastered"
  if (mastery >= 3) return "blurry"
  return "not-known"
}

const STATUS_META: Record<
  FlashcardStatus,
  { label: string; emoji: string; color: string; bg: string }
> = {
  untouched: {
    label: "未学",
    emoji: "⚪",
    color: "#9b9a97",
    bg: "#fbfbfa",
  },
  "not-known": {
    label: "完全不会",
    emoji: "❌",
    color: "#c4332e",
    bg: "#fdf3f3",
  },
  blurry: {
    label: "模糊",
    emoji: "🟡",
    color: "#a36b00",
    bg: "#fef5d6",
  },
  mastered: {
    label: "已掌握",
    emoji: "✅",
    color: "#2d7a45",
    bg: "#eaf5ec",
  },
}

export default function DayDetailPage() {
  const router = useRouter()
  const params = useParams<{ planId: string; dayIndex: string }>()
  const planId = params.planId
  const dayIndex = parseInt(params.dayIndex, 10)

  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [allCards, setAllCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [vaultId, setVaultId] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    setLoading(true)
    Promise.all([planApi.get(planId), flashcardApi.list(planId)])
      .then(([planRes, cardsRes]) => {
        setPlan(planRes.plan)
        setVaultId(planRes.plan.vaultId)
        setAllCards(cardsRes.flashcards)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false))
  }, [planId, router, refreshKey])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#9b9a97] text-sm">
        加载中
      </main>
    )
  }

  if (error || !plan) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <div className="text-[#787774] text-sm">{error || "学习计划不存在"}</div>
        <button
          onClick={() => router.push(`/plan/${planId}`)}
          className="nt-btn-ghost"
        >
          <ArrowLeft className="w-4 h-4" />
          返回学习计划
        </button>
      </main>
    )
  }

  const planData = plan.planData as PlanData | undefined
  const day = planData?.days?.find((d) => d.day === dayIndex)

  if (!day) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <div className="text-[#787774] text-sm">
          Day {dayIndex} 不存在（本计划共 {plan.totalDays} 天）
        </div>
        <button
          onClick={() => router.push(`/plan/${planId}`)}
          className="nt-btn-ghost"
        >
          <ArrowLeft className="w-4 h-4" />
          返回学习计划
        </button>
      </main>
    )
  }

  // 当前天的闪卡
  const dayCards = allCards.filter((c) => c.dayIndex === dayIndex)

  // 沙箱进度
  const cur = (getActivePersonality(vaultId) || "student") as AgentPersonality
  const sandbox = vaultId
    ? getSandbox(vaultId, cur)
    : { flashcardMastery: {} as Record<string, number> }

  const cardsWithStatus = dayCards.map((c) => ({
    card: c,
    mastery: sandbox.flashcardMastery[c.id],
    status: statusOf(sandbox.flashcardMastery[c.id]),
  }))

  const masteredCount = cardsWithStatus.filter((c) => c.status === "mastered").length
  const blurryCount = cardsWithStatus.filter((c) => c.status === "blurry").length
  const notKnownCount = cardsWithStatus.filter((c) => c.status === "not-known").length
  const untouchedCount = cardsWithStatus.filter((c) => c.status === "untouched").length
  const needReviewCount = blurryCount + notKnownCount + untouchedCount

  function startAll() {
    // 学这一天所有闪卡 — 跳闪卡页带 day 过滤
    sessionStorage.setItem(`day_filter_${planId}`, String(dayIndex))
    router.push(`/flashcard/${planId}?day=${dayIndex}`)
  }

  function startNeedReview() {
    // 只练未掌握的（包括 untouched / not-known / blurry）
    const ids = cardsWithStatus
      .filter((c) => c.status !== "mastered")
      .map((c) => c.card.id)
    if (ids.length === 0) return
    sessionStorage.setItem(`card_filter_${planId}`, JSON.stringify(ids))
    router.push(`/flashcard/${planId}?day=${dayIndex}&filter=needReview`)
  }

  function startSingle(cardId: string) {
    sessionStorage.setItem(`card_filter_${planId}`, JSON.stringify([cardId]))
    router.push(`/flashcard/${planId}?day=${dayIndex}&filter=single`)
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-[#e9e9e8] bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push(`/plan/${planId}`)}
            className="flex items-center gap-1.5 text-[13px] text-[#787774] hover:text-[#37352f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回学习计划
          </button>
          <div className="flex items-center gap-3">
            {vaultId && (
              <PersonalitySwitcher
                vaultId={vaultId}
                onSwitched={() => setRefreshKey((k) => k + 1)}
              />
            )}
            <div className="w-6 h-6 rounded bg-[#37352f] text-white flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-[#37352f] text-[15px]">
              StudyHere
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 顶部：Day N · 主题 */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-[#37352f] text-white flex items-center justify-center text-[13px] font-bold">
              {dayIndex}
            </div>
            <span className="text-[12px] text-[#9b9a97]">Day · {day.date}</span>
          </div>
          <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight text-[#37352f] leading-tight">
            {day.topics?.[0] || "学习内容"}
          </h1>
        </div>

        {/* 进度统计 */}
        <div className="grid grid-cols-4 gap-3 mb-7">
          <ProgressBox
            label="总闪卡"
            value={dayCards.length}
            color="#37352f"
          />
          <ProgressBox
            label="已掌握"
            value={masteredCount}
            color="#2d7a45"
            highlight={masteredCount > 0}
          />
          <ProgressBox
            label="模糊"
            value={blurryCount}
            color="#a36b00"
            highlight={blurryCount > 0}
          />
          <ProgressBox
            label="不会"
            value={notKnownCount}
            color="#c4332e"
            highlight={notKnownCount > 0}
          />
        </div>

        {/* 操作入口 */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-8">
          <button onClick={startAll} className="nt-btn-ai flex-1 justify-center">
            <Layers className="w-4 h-4" />
            学这一天全部 {dayCards.length} 张
          </button>
          {needReviewCount > 0 && needReviewCount < dayCards.length && (
            <button
              onClick={startNeedReview}
              className="nt-btn-ghost border border-[#6940a5] text-[#6940a5] flex-1 justify-center"
            >
              <Target className="w-4 h-4" />
              只练未掌握的 {needReviewCount} 张
            </button>
          )}
        </div>

        {/* 闪卡明细列表 */}
        {dayCards.length === 0 ? (
          <div className="text-center py-12 text-[#9b9a97] text-sm">
            这一天的闪卡还没生成
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-[#37352f]">
                闪卡明细
              </h2>
              <span className="text-[12px] text-[#9b9a97]">
                点击单张可只练这一张
              </span>
            </div>
            <div className="space-y-2">
              {cardsWithStatus.map(({ card, status }, i) => {
                const meta = STATUS_META[status]
                return (
                  <button
                    key={card.id}
                    onClick={() => startSingle(card.id)}
                    className="w-full text-left rounded-lg border border-[#e9e9e8] bg-white p-4 hover:border-[#37352f] hover:shadow-sm transition-all flex items-start gap-3"
                  >
                    <span className="text-[18px] flex-shrink-0">{meta.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-[#9b9a97]">
                          闪卡 {i + 1}
                        </span>
                      </div>
                      <p className="text-[14px] text-[#37352f] leading-snug line-clamp-2">
                        {card.front}
                      </p>
                    </div>
                    <Eye className="size-4 text-[#9b9a97] flex-shrink-0 mt-1" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* 底部小字 */}
        <p className="text-center text-[11px] text-[#9b9a97] mt-8">
          所有操作都会按 SM-2 算法记录到「{cur === "student" ? "学生党" : cur === "cert" ? "考证型" : cur === "explorer" ? "兴趣探索" : "严苛教练"}」沙箱
        </p>
      </div>
    </main>
  )
}

function ProgressBox({
  label,
  value,
  color,
  highlight = false,
}: {
  label: string
  value: number
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className={[
        "rounded-xl border p-3 text-center transition-all",
        highlight ? "border-2" : "border border-[#e9e9e8]",
      ].join(" ")}
      style={{
        borderColor: highlight ? color : undefined,
      }}
    >
      <div
        className="text-[24px] font-bold leading-none"
        style={{ color: highlight ? color : "#9b9a97" }}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#787774] mt-1.5">{label}</div>
    </div>
  )
}
