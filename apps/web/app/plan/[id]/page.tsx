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
  GraduationCap,
  AlertCircle,
  BarChart3,
  ClipboardCheck,
  FileQuestion,
} from "lucide-react"
import { planApi } from "@/lib/api"
import type { StudyPlan, AgentPersonality } from "@/lib/types"
import PersonalitySwitcher from "@/components/PersonalitySwitcher"
import {
  getActivePersonality,
  getSandbox,
  getStudiedDays,
  getFeedbackSummary,
  FEEDBACK_TAG_LABELS,
} from "@/lib/sandboxStore"

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

// PRD v2.1 §6.2 要求的 Tab 结构：学·练·考·纠·进度
type TabKey = "study" | "practice" | "exam" | "wrong" | "progress"

const TABS: Array<{
  key: TabKey
  label: string
  Icon: typeof BookOpen
  desc: string
}> = [
  { key: "study", label: "学", Icon: GraduationCap, desc: "闪卡复习" },
  { key: "practice", label: "练", Icon: Pencil, desc: "每日小测" },
  { key: "exam", label: "考", Icon: ClipboardCheck, desc: "阶段测验" },
  { key: "wrong", label: "纠", Icon: AlertCircle, desc: "错题本" },
  { key: "progress", label: "进度", Icon: BarChart3, desc: "学习追踪" },
]

export default function PlanDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<TabKey>("study")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    planApi
      .get(params.id)
      .then((res) => setPlan(res.plan))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false))
  }, [params.id, router, refreshKey])

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
        <button onClick={() => router.push("/home")} className="nt-btn-ghost">
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </button>
      </main>
    )
  }

  const planData = plan.planData as PlanData | undefined
  const days = planData?.days ?? []
  const totalMinutes = days.reduce((sum, d) => sum + d.estimatedMinutes, 0)

  // 切换人格后重刷数据
  const handlePersonalitySwitched = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <main className="min-h-screen bg-white">
      {/* 顶栏 */}
      <nav className="border-b border-[#e9e9e8] bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push("/home")}
            className="flex items-center gap-1.5 text-[13px] text-[#787774] hover:text-[#37352f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            资料库
          </button>
          <div className="flex items-center gap-3">
            {/* 人格徽章 · 可点击切换 */}
            <PersonalitySwitcher
              vaultId={plan.vaultId}
              onSwitched={handlePersonalitySwitched}
            />
            <div className="w-6 h-6 rounded bg-[#37352f] text-white flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-[#37352f] text-[15px]">
              StudyHere
            </span>
          </div>
        </div>
      </nav>

      {/* 标题区 */}
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-5">
        <span className="nt-tag-ai">
          <Sparkles className="w-3 h-3" />
          AI 生成
        </span>
        <h1 className="mt-4 text-[28px] md:text-[32px] font-bold text-[#37352f] tracking-tight leading-tight">
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
      </div>

      {/* Tab 切换栏 */}
      <div className="border-b border-[#e9e9e8] bg-white sticky top-14 z-[5]">
        <div className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const Icon = t.Icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "flex items-center gap-1.5 px-4 py-3 text-[13.5px] border-b-2 -mb-px transition-colors whitespace-nowrap",
                  active
                    ? "border-[#6940a5] text-[#6940a5] font-semibold"
                    : "border-transparent text-[#787774] hover:text-[#37352f]",
                ].join(" ")}
              >
                <Icon className="size-4" />
                <span>
                  {t.label}
                  <span className="ml-1 opacity-70 hidden md:inline">·{t.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {tab === "study" && (
          <StudyTab
            plan={plan}
            days={days}
            onStart={() => router.push(`/flashcard/${plan.id}`)}
            onPickDay={(dayIndex) =>
              router.push(`/study/${plan.id}/day/${dayIndex}`)
            }
          />
        )}
        {tab === "practice" && (
          <PracticeTab
            planId={plan.id}
            vaultId={plan.vaultId}
            onStartScope={(scope) => {
              // 「今日」scope 需要从沙箱反推今天学过的卡 IDs
              // 简化版：用 plan 沙箱里所有有 mastery 记录的卡片 ID（≈ 所有学过的）
              // 真正"今日"应该看时间戳，本期 mock 把"累计已学"当"今日"近似
              const sandbox = getSandbox(
                plan.vaultId,
                getActivePersonality(plan.vaultId) || "student",
              )
              const cardIds = Object.keys(sandbox.flashcardMastery)
              sessionStorage.setItem(
                `session_cards_${plan.id}`,
                JSON.stringify(cardIds),
              )
              if (scope === "today") {
                router.push(`/quiz/${plan.id}?scope=today`)
              } else if (scope === "studied") {
                router.push(`/quiz/${plan.id}?scope=studied`)
              } else {
                router.push(`/quiz/${plan.id}`)
              }
            }}
          />
        )}
        {tab === "exam" && (
          <ExamTab
            planId={plan.id}
            vaultId={plan.vaultId}
            totalDays={plan.totalDays}
          />
        )}
        {tab === "wrong" && (
          <WrongTab planId={plan.id} vaultId={plan.vaultId} />
        )}
        {tab === "progress" && <ProgressTab vaultId={plan.vaultId} />}
      </div>
    </main>
  )
}

// ============ Tab 内容组件 ============

/**
 * 单天的状态：未开始 / 学习中 / 已完成 / 今日推荐
 * 依据：沙箱里 flashcardMastery 中含 `-{day}-` 的卡片数
 */
type DayStatus = "untouched" | "in-progress" | "done" | "recommended"

interface DayProgress {
  status: DayStatus
  studiedCount: number
  totalCount: number
  masteredCount: number
  blurryCount: number
  notKnownCount: number
  lastStudiedAt?: string
}

/**
 * 从沙箱反推某天的进度
 * 假设：每天动态生成 4 张闪卡（mockContentEngine 默认）
 */
function getDayProgress(
  vaultId: string,
  dayIndex: number,
  recommendedDay: number,
): DayProgress {
  if (!vaultId) {
    return {
      status: dayIndex === recommendedDay ? "recommended" : "untouched",
      studiedCount: 0,
      totalCount: 4,
      masteredCount: 0,
      blurryCount: 0,
      notKnownCount: 0,
    }
  }
  const cur = getActivePersonality(vaultId) || "student"
  const sandbox = getSandbox(vaultId, cur)
  // 按 ID 格式 fc-{planId}-{personality}-{day}-{i} 反推
  const dayRegex = new RegExp(`-${dayIndex}-\\d+$`)
  const cardIds = Object.keys(sandbox.flashcardMastery).filter((id) =>
    dayRegex.test(id),
  )
  const studiedCount = cardIds.length
  const totalCount = 4  // mock 每天 4 张
  let masteredCount = 0
  let blurryCount = 0
  let notKnownCount = 0
  for (const id of cardIds) {
    const m = sandbox.flashcardMastery[id]
    if (m >= 5) masteredCount++
    else if (m >= 3) blurryCount++
    else notKnownCount++
  }

  let status: DayStatus
  if (studiedCount === 0) {
    status = dayIndex === recommendedDay ? "recommended" : "untouched"
  } else if (studiedCount >= totalCount && masteredCount === totalCount) {
    status = "done"
  } else {
    status = "in-progress"
  }

  return {
    status,
    studiedCount,
    totalCount,
    masteredCount,
    blurryCount,
    notKnownCount,
  }
}

/**
 * 推荐用户今天学哪天：第一个未完成的 day
 */
function getRecommendedDay(vaultId: string, totalDays: number): number {
  if (!vaultId) return 1
  const cur = getActivePersonality(vaultId) || "student"
  const sandbox = getSandbox(vaultId, cur)
  // 找第一个 mastery 都 < 5 的 day
  for (let day = 1; day <= totalDays; day++) {
    const dayRegex = new RegExp(`-${day}-\\d+$`)
    const cardIds = Object.keys(sandbox.flashcardMastery).filter((id) =>
      dayRegex.test(id),
    )
    if (cardIds.length < 4) return day  // 还没学完
    if (cardIds.some((id) => sandbox.flashcardMastery[id] < 5)) return day  // 学了但没掌握全
  }
  return totalDays  // 全部都掌握了
}

function StudyTab({
  plan,
  days,
  onStart,
  onPickDay,
}: {
  plan: StudyPlan
  days: PlanDay[]
  onStart: () => void
  onPickDay: (dayIndex: number) => void
}) {
  const [refreshTick, setRefreshTick] = useState(0)
  const recommendedDay = getRecommendedDay(plan.vaultId, plan.totalDays)
  const recommendedDayInfo = days.find((d) => d.day === recommendedDay)

  // 监听人格切换刷新
  useEffect(() => {
    function onChange() {
      setRefreshTick((t) => t + 1)
    }
    window.addEventListener("vault-personality-change", onChange)
    return () => window.removeEventListener("vault-personality-change", onChange)
  }, [])

  return (
    <>
      {/* 今日推荐模块 */}
      {recommendedDayInfo && (
        <div className="rounded-2xl border-2 border-[#6940a5] bg-gradient-to-br from-[#f4efff] to-white p-5 mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[20px]">🎯</span>
            <span className="text-[13px] font-semibold text-[#6940a5] uppercase tracking-wider">
              今日推荐
            </span>
          </div>
          <h3 className="text-[18px] font-bold text-[#37352f] mb-1">
            Day {recommendedDay} · {recommendedDayInfo.topics?.[0] || "学习"}
          </h3>
          <p className="text-[13px] text-[#6b6f76] mb-4">
            {recommendedDay === 1
              ? "从第 1 天开始你的学习之旅"
              : `已学到 Day ${recommendedDay - 1}，今天建议继续学 Day ${recommendedDay}`}
          </p>
          <button
            onClick={() => onPickDay(recommendedDay)}
            className="nt-btn-ai"
          >
            <Layers className="w-4 h-4" />
            开始 Day {recommendedDay} 学习
          </button>
        </div>
      )}

      {/* 每日内容标题 */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-[#37352f]">
          学习路径 · {plan.totalDays} 天
        </h2>
        <span className="text-[12px] text-[#9b9a97]">
          点击卡片进入单日详情
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {days.map((day) => {
          const progress = getDayProgress(
            plan.vaultId,
            day.day,
            recommendedDay,
          )
          return (
            <DayCard
              key={day.day}
              day={day}
              progress={progress}
              onClick={() => onPickDay(day.day)}
            />
          )
        })}
      </div>
    </>
  )
}

// 子组件：单天卡片
function DayCard({
  day,
  progress,
  onClick,
}: {
  day: PlanDay
  progress: DayProgress
  onClick: () => void
}) {
  // 状态视觉
  const STATUS_META: Record<
    DayStatus,
    { label: string; bg: string; border: string; text: string; ring: string }
  > = {
    untouched: {
      label: "未开始",
      bg: "#fbfbfa",
      border: "#e9e9e8",
      text: "#9b9a97",
      ring: "border-[#e9e9e8]",
    },
    "in-progress": {
      label: "学习中",
      bg: "#eef4ff",
      border: "#cdddff",
      text: "#1a5cd0",
      ring: "border-[#cdddff]",
    },
    done: {
      label: "已完成",
      bg: "#eaf5ec",
      border: "#b8e0c0",
      text: "#2d7a45",
      ring: "border-[#b8e0c0]",
    },
    recommended: {
      label: "今日推荐",
      bg: "#f4efff",
      border: "#6940a5",
      text: "#6940a5",
      ring: "border-[#6940a5] border-2",
    },
  }
  const meta = STATUS_META[progress.status]

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "text-left p-5 rounded-xl border bg-white transition-all hover:shadow-md hover:-translate-y-0.5",
        meta.ring,
      ].join(" ")}
    >
      {/* 顶部：Day 编号 + 状态徽章 + 日期 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#37352f] text-white flex items-center justify-center text-[12px] font-semibold">
            {day.day}
          </div>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: meta.bg, color: meta.text }}
          >
            {meta.label}
          </span>
        </div>
        <span className="text-[12px] text-[#9b9a97]">{day.date}</span>
      </div>

      {/* 主题 */}
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[#9b9a97] font-semibold mb-1">
          主题
        </div>
        <h3 className="text-[16px] font-semibold text-[#37352f] leading-snug">
          {day.topics?.[0] || "学习内容"}
        </h3>
      </div>

      {/* 进度数据 */}
      {progress.studiedCount > 0 ? (
        <div className="pt-3 border-t border-[#e9e9e8]">
          {/* 进度条 */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 bg-[#e9e9e8] rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${(progress.studiedCount / progress.totalCount) * 100}%`,
                  background: meta.text,
                }}
              />
            </div>
            <span className="text-[11px] text-[#787774] font-mono">
              {progress.studiedCount}/{progress.totalCount}
            </span>
          </div>
          {/* 掌握度分布 */}
          <div className="flex items-center gap-3 text-[11px] text-[#6b6f76]">
            {progress.masteredCount > 0 && (
              <span>✅ {progress.masteredCount}</span>
            )}
            {progress.blurryCount > 0 && (
              <span>🟡 {progress.blurryCount}</span>
            )}
            {progress.notKnownCount > 0 && (
              <span className="text-[#c4332e]">
                ❌ {progress.notKnownCount}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-[#e9e9e8]">
          <p className="text-[12px] text-[#9b9a97]">
            {progress.status === "recommended"
              ? "👉 系统推荐：从这天开始"
              : `共 ${progress.totalCount} 张闪卡待学习`}
          </p>
        </div>
      )}
    </button>
  )
}

function PracticeTab({
  planId,
  vaultId,
  onStartScope,
}: {
  planId: string
  vaultId: string
  onStartScope: (scope: "today" | "studied" | "all") => void
}) {
  const [stats, setStats] = useState<{
    studiedDayCount: number
    answeredCount: number
    correctCount: number
    wrongCount: number
  }>({ studiedDayCount: 0, answeredCount: 0, correctCount: 0, wrongCount: 0 })

  useEffect(() => {
    if (!vaultId) return
    const cur = getActivePersonality(vaultId) || "student"
    const studied = getStudiedDays(vaultId, cur)
    const sandbox = getSandbox(vaultId, cur)
    const answered = Object.values(sandbox.answerRecords)
    setStats({
      studiedDayCount: studied.length,
      answeredCount: answered.length,
      correctCount: answered.filter((a) => a.isCorrect).length,
      wrongCount: sandbox.wrongQuestionIds.length,
    })
  }, [vaultId])

  const accuracy =
    stats.answeredCount > 0
      ? Math.round((stats.correctCount / stats.answeredCount) * 100)
      : 0

  const hasStudied = stats.studiedDayCount > 0

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#37352f] mb-1">每日小测</h2>
      <p className="text-[13px] text-[#9b9a97] mb-5">
        选一种范围开始答题。错题会自动归集到「纠」Tab。
      </p>

      <div className="space-y-3">
        {/* 档 1：今日 · 推荐 */}
        <button
          onClick={() => onStartScope("today")}
          disabled={!hasStudied}
          className={[
            "w-full text-left rounded-2xl p-5 transition-all border-2",
            hasStudied
              ? "border-[#6940a5] bg-[#f4efff] hover:shadow-md hover:-translate-y-0.5"
              : "border-[#e9e9e8] bg-[#fafafa] opacity-60 cursor-not-allowed",
          ].join(" ")}
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[16px] font-bold text-[#6940a5]">
              📅 今日小测
            </span>
            <span className="text-[11px] text-[#6940a5] font-semibold">推荐</span>
          </div>
          <p className="text-[13px] text-[#787774] mt-1.5">
            {hasStudied
              ? `针对今天学过的内容出题，趁热打铁`
              : `今天还没学闪卡，先去「学」Tab 开始学习`}
          </p>
        </button>

        {/* 档 2：累计已学 */}
        <button
          onClick={() => onStartScope("studied")}
          disabled={!hasStudied}
          className={[
            "w-full text-left rounded-2xl p-5 transition-all border",
            hasStudied
              ? "border-[#cdddff] bg-[#eef4ff] hover:shadow-md hover:-translate-y-0.5"
              : "border-[#e9e9e8] bg-[#fafafa] opacity-60 cursor-not-allowed",
          ].join(" ")}
        >
          <div className="text-[16px] font-bold text-[#1a5cd0]">
            📚 累计练习
          </div>
          <p className="text-[13px] text-[#787774] mt-1.5">
            {hasStudied
              ? `涵盖你截至今天学过的 ${stats.studiedDayCount} 天内容，综合检验`
              : `等你学过几天再回来`}
          </p>
        </button>

        {/* 档 3：全计划 */}
        <button
          onClick={() => onStartScope("all")}
          className="w-full text-left rounded-2xl p-5 border border-[#e9e9e8] bg-white hover:border-[#37352f] hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <div className="text-[16px] font-bold text-[#37352f]">
            🎯 全计划题目
          </div>
          <p className="text-[13px] text-[#787774] mt-1.5">
            本学习计划全部 14 天的题目，挑战完整覆盖
          </p>
        </button>
      </div>

      {/* 答题历史摘要 */}
      <div className="mt-8 pt-6 border-t border-[#e9e9e8]">
        <div className="text-[11px] uppercase tracking-wider text-[#9b9a97] font-semibold mb-3">
          你的答题历史
        </div>
        <div className="flex items-baseline gap-5 text-[13px] text-[#37352f]">
          <span>
            已答 <strong className="text-[16px]">{stats.answeredCount}</strong> 道
          </span>
          <span className="text-[#9b9a97]">·</span>
          <span>
            正确 <strong className="text-[16px]">{stats.correctCount}</strong> 道
          </span>
          <span className="text-[#9b9a97]">·</span>
          <span>
            正确率{" "}
            <strong className="text-[16px]">{accuracy}%</strong>
          </span>
          {stats.wrongCount > 0 && (
            <>
              <span className="text-[#9b9a97]">·</span>
              <span className="text-[#c4332e]">
                错题 <strong className="text-[16px]">{stats.wrongCount}</strong> 道
              </span>
            </>
          )}
        </div>
        {stats.answeredCount === 0 && (
          <p className="text-[12px] text-[#9b9a97] mt-2">
            还没答过题，选一种范围开始吧
          </p>
        )}
      </div>
    </div>
  )
}

function ComingSoonTab({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="min-h-[300px] flex flex-col items-center justify-center text-center">
      <div className="size-16 rounded-2xl bg-[#f1f1ef] flex items-center justify-center mb-4">
        <FileQuestion className="size-8 text-[#9b9a97]" />
      </div>
      <h3 className="text-lg font-bold text-[#37352f] mb-1">{title}</h3>
      <p className="text-sm text-[#9b9a97]">{hint}</p>
    </div>
  )
}

// ============ 「考」Tab：阶段测验 ============

function ExamTab({
  planId,
  vaultId,
  totalDays,
}: {
  planId: string
  vaultId: string
  totalDays: number
}) {
  const router = useRouter()
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    function onChange() {
      setRefreshTick((t) => t + 1)
    }
    window.addEventListener("vault-personality-change", onChange)
    return () => window.removeEventListener("vault-personality-change", onChange)
  }, [])

  const cur = getActivePersonality(vaultId) || "student"
  const studiedDays = vaultId ? getStudiedDays(vaultId, cur) : []
  const sandbox = vaultId
    ? getSandbox(vaultId, cur)
    : { wrongQuestionIds: [], answerRecords: {} }
  const wrongCount = sandbox.wrongQuestionIds.length

  function startExam(scope: "stage" | "full" | "wrong") {
    if (scope === "wrong" && wrongCount === 0) return
    if (scope === "stage" && studiedDays.length === 0) return
    if (scope === "wrong") {
      sessionStorage.setItem(
        `wrong_redo_${planId}`,
        JSON.stringify(sandbox.wrongQuestionIds),
      )
      router.push(`/quiz/${planId}?scope=wrong&mode=exam`)
    } else if (scope === "stage") {
      router.push(`/quiz/${planId}?scope=studied&mode=exam`)
    } else {
      router.push(`/quiz/${planId}?mode=exam`)
    }
  }

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-[#37352f] mb-1">阶段测验</h2>
      <p className="text-[13px] text-[#9b9a97] mb-5">
        ⏱️ 一次性出题、统一交卷、不能边做边看答案 —— 仿真考场体验
      </p>

      <div className="space-y-3">
        {/* 档 1：阶段测验（按已学的 Days） */}
        <button
          onClick={() => startExam("stage")}
          disabled={studiedDays.length === 0}
          className={[
            "w-full text-left rounded-2xl p-5 transition-all border-2",
            studiedDays.length > 0
              ? "border-[#6940a5] bg-[#f4efff] hover:shadow-md hover:-translate-y-0.5"
              : "border-[#e9e9e8] bg-[#fafafa] opacity-60 cursor-not-allowed",
          ].join(" ")}
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[16px] font-bold text-[#6940a5]">
              📅 阶段综合测验
            </span>
            <span className="text-[11px] text-[#6940a5] font-semibold">推荐</span>
          </div>
          <p className="text-[13px] text-[#787774] mt-1.5">
            {studiedDays.length > 0
              ? `涵盖你已学的 Day ${studiedDays[0]}-${
                  studiedDays[studiedDays.length - 1]
                } · 15-20 道综合题`
              : `等你学过几天后再来`}
          </p>
        </button>

        {/* 档 2：全计划综合 */}
        <button
          onClick={() => startExam("full")}
          className="w-full text-left rounded-2xl p-5 border border-[#e9e9e8] bg-white hover:border-[#37352f] hover:shadow-md hover:-translate-y-0.5 transition-all"
        >
          <div className="text-[16px] font-bold text-[#37352f]">
            🎯 全计划终极测验
          </div>
          <p className="text-[13px] text-[#787774] mt-1.5">
            涵盖全部 {totalDays} 天的题目 · 挑战完整覆盖（含尚未学过的）
          </p>
        </button>

        {/* 档 3：错题专项 */}
        <button
          onClick={() => startExam("wrong")}
          disabled={wrongCount === 0}
          className={[
            "w-full text-left rounded-2xl p-5 transition-all border",
            wrongCount > 0
              ? "border-[#fbeae9] bg-[#fdf3f3] hover:border-[#c4332e] hover:shadow-md hover:-translate-y-0.5"
              : "border-[#e9e9e8] bg-[#fafafa] opacity-60 cursor-not-allowed",
          ].join(" ")}
        >
          <div className="text-[16px] font-bold text-[#c4332e]">
            🔥 错题专项测验
          </div>
          <p className="text-[13px] text-[#787774] mt-1.5">
            {wrongCount > 0
              ? `针对你的 ${wrongCount} 道错题做专项突破`
              : `还没有错题`}
          </p>
        </button>
      </div>

      {/* 与"练"的区别说明 */}
      <div className="mt-8 pt-6 border-t border-[#e9e9e8]">
        <div className="text-[11px] uppercase tracking-wider text-[#9b9a97] font-semibold mb-3">
          考 vs 练 · 有什么区别？
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
          <div className="rounded-lg bg-[#fbfbfa] p-3">
            <div className="font-semibold text-[#37352f] mb-1">📝 练 · 随做随评</div>
            <p className="text-[#6b6f76] leading-relaxed">
              答一题立刻看解析，错题立刻进错题集 —— 适合日常巩固
            </p>
          </div>
          <div className="rounded-lg bg-[#f4efff] p-3">
            <div className="font-semibold text-[#6940a5] mb-1">⏱️ 考 · 一次性交卷</div>
            <p className="text-[#6b6f76] leading-relaxed">
              全部答完才看总分 + 弱项分布 —— 适合阶段性检验
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function WrongTab({ planId, vaultId }: { planId: string; vaultId: string }) {
  const router = useRouter()
  const [scope, setScope] = useState<"current" | "all">("current")
  const [refreshTick, setRefreshTick] = useState(0)

  // 监听人格切换刷新
  useEffect(() => {
    function onChange() {
      setRefreshTick((t) => t + 1)
    }
    window.addEventListener("vault-personality-change", onChange)
    return () => window.removeEventListener("vault-personality-change", onChange)
  }, [])

  const cur = getActivePersonality(vaultId) || "student"

  // 收集错题
  const wrongList: Array<{
    questionId: string
    personality: AgentPersonality
    wrongCount: number
    consecutiveCorrects: number
    lastWrongAt: string
    dayIndex: number
    topic: string
  }> = []

  const personalitiesToCheck: AgentPersonality[] =
    scope === "current" ? [cur] : ["student", "cert", "explorer", "strict"]

  for (const p of personalitiesToCheck) {
    const sandbox = getSandbox(vaultId, p)
    for (const qid of sandbox.wrongQuestionIds) {
      const meta = sandbox.wrongQuestionMeta[qid]
      // 解析 questionId: q-{planId}-{personality}-{day}-{i}
      const m = qid.match(/-(\d+)-\d+$/)
      const day = m ? parseInt(m[1], 10) : 1
      wrongList.push({
        questionId: qid,
        personality: p,
        wrongCount: meta?.wrongCount ?? 1,
        consecutiveCorrects: meta?.consecutiveCorrects ?? 0,
        lastWrongAt: meta?.lastWrongAt ?? "",
        dayIndex: day,
        topic: "",  // 后面再填
      })
    }
  }

  // 按主题（day）分组
  const grouped = wrongList.reduce<Record<number, typeof wrongList>>((acc, item) => {
    acc[item.dayIndex] = acc[item.dayIndex] || []
    acc[item.dayIndex].push(item)
    return acc
  }, {})
  // 每组内按错次数降序
  for (const day in grouped) {
    grouped[day].sort((a, b) => b.wrongCount - a.wrongCount)
  }

  const totalCount = wrongList.length
  const stubbornCount = wrongList.filter((w) => w.wrongCount >= 2).length

  function startRedo(items: typeof wrongList) {
    const ids = items.map((i) => i.questionId)
    sessionStorage.setItem(`wrong_redo_${planId}`, JSON.stringify(ids))
    router.push(`/quiz/${planId}?scope=wrong`)
  }

  if (totalCount === 0) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center text-center">
        <div className="size-16 rounded-2xl bg-[#eaf5ec] flex items-center justify-center mb-4">
          <AlertCircle className="size-8 text-[#2d7a45]" />
        </div>
        <h3 className="text-lg font-bold text-[#37352f] mb-1">还没有错题</h3>
        <p className="text-sm text-[#9b9a97] max-w-xs">
          先去「练」Tab 做几道题，错的题会自动归集到这里。<br />
          连续答对 2 次才会从错题集移除。
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* 顶部：toggle 切当前/全部人格 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#37352f]">
            错题集 · {totalCount} 道
            {stubbornCount > 0 && (
              <span className="text-[#c4332e] ml-2">
                （顽固错题 {stubbornCount} 道）
              </span>
            )}
          </h2>
          <p className="text-[12px] text-[#9b9a97] mt-1">
            连续答对 2 次才会真正移除（避免靠运气）
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[#e9e9e8] p-0.5 text-[12px]">
          <button
            onClick={() => setScope("current")}
            className={[
              "px-3 py-1.5 rounded-md transition-colors",
              scope === "current"
                ? "bg-[#37352f] text-white font-semibold"
                : "text-[#787774]",
            ].join(" ")}
          >
            当前风格
          </button>
          <button
            onClick={() => setScope("all")}
            className={[
              "px-3 py-1.5 rounded-md transition-colors",
              scope === "all"
                ? "bg-[#37352f] text-white font-semibold"
                : "text-[#787774]",
            ].join(" ")}
          >
            全部风格
          </button>
        </div>
      </div>

      {/* 一键重做全部 */}
      <button
        onClick={() => startRedo(wrongList)}
        className="nt-btn-ai mb-6"
      >
        <AlertCircle className="size-4" />
        重做全部错题（{totalCount} 道）
      </button>

      {/* 按主题分组 */}
      <div className="space-y-4">
        {Object.keys(grouped)
          .map((d) => parseInt(d, 10))
          .sort((a, b) => a - b)
          .map((day) => {
            const items = grouped[day]
            return (
              <div key={day} className="rounded-xl border border-[#e9e9e8] bg-white">
                <div className="px-4 py-3 border-b border-[#e9e9e8] flex items-baseline justify-between">
                  <h3 className="text-[14px] font-semibold text-[#37352f]">
                    Day {day} · 错题 {items.length} 道
                  </h3>
                  <button
                    onClick={() => startRedo(items)}
                    className="text-[12px] text-[#6940a5] font-semibold hover:underline"
                  >
                    重做这组 →
                  </button>
                </div>
                <div className="divide-y divide-[#f1f1ef]">
                  {items.map((item) => {
                    const isStubborn = item.wrongCount >= 2
                    return (
                      <div
                        key={item.questionId + item.personality}
                        className="px-4 py-3 flex items-center gap-3"
                      >
                        <div
                          className={[
                            "size-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0",
                            isStubborn
                              ? "bg-[#c4332e] text-white"
                              : "bg-[#fef5d6] text-[#a36b00]",
                          ].join(" ")}
                        >
                          {isStubborn ? "🔥" : "❌"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-[#37352f] truncate">
                            题目 {item.questionId.split("-").slice(-2).join("·")}
                          </div>
                          <div className="text-[11px] text-[#9b9a97] mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>
                              错 {item.wrongCount} 次
                              {item.consecutiveCorrects > 0 &&
                                ` · 已连答对 ${item.consecutiveCorrects}/2`}
                            </span>
                            {scope === "all" && (
                              <span className="px-1.5 py-0.5 rounded bg-[#f1f1ef] text-[10px]">
                                {item.personality === "student"
                                  ? "学生党"
                                  : item.personality === "cert"
                                  ? "考证型"
                                  : item.personality === "explorer"
                                  ? "兴趣探索"
                                  : "严苛教练"}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => startRedo([item])}
                          className="text-[12px] text-[#37352f] hover:text-[#6940a5] font-semibold flex-shrink-0"
                        >
                          再做 →
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

function ProgressTab({ vaultId }: { vaultId: string }) {
  const [personality, setPersonality] = useState<AgentPersonality>("student")
  const [stats, setStats] = useState<{
    flashcardCount: number
    answeredCount: number
    correctCount: number
    wrongCount: number
  }>({ flashcardCount: 0, answeredCount: 0, correctCount: 0, wrongCount: 0 })
  // v2.3：跨人格聚合反馈统计
  const [feedback, setFeedback] = useState<ReturnType<typeof getFeedbackSummary> | null>(null)

  useEffect(() => {
    const cur = getActivePersonality(vaultId) || "student"
    setPersonality(cur)
    const sandbox = getSandbox(vaultId, cur)
    const answered = Object.values(sandbox.answerRecords)
    setStats({
      flashcardCount: Object.keys(sandbox.flashcardMastery).length,
      answeredCount: answered.length,
      correctCount: answered.filter((a) => a.isCorrect).length,
      wrongCount: sandbox.wrongQuestionIds.length,
    })
    setFeedback(getFeedbackSummary(vaultId))
  }, [vaultId])

  const accuracy =
    stats.answeredCount > 0
      ? Math.round((stats.correctCount / stats.answeredCount) * 100)
      : 0

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBox label="已学闪卡" value={String(stats.flashcardCount)} />
        <StatBox label="已答题目" value={String(stats.answeredCount)} />
        <StatBox label="答题正确率" value={`${accuracy}%`} />
        <StatBox label="错题数" value={String(stats.wrongCount)} highlight={stats.wrongCount > 0} />
      </div>

      {/* v2.3：你对 AI 的影响（0 反馈时隐藏，避免空状态） */}
      {feedback && feedback.total > 0 && (
        <div className="rounded-xl border border-[#e9e9e8] bg-gradient-to-br from-[#fbfbfa] to-[#f4f0fb] p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[16px]">📊</span>
            <h3 className="text-[14px] font-semibold text-[#37352f]">你对 AI 的影响</h3>
            <span className="text-[11px] text-[#9b9a97] ml-auto">跨全部人格聚合</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <FeedbackStat label="累计反馈" value={feedback.total} highlight />
            <FeedbackStat label="闪卡相关" value={feedback.byType.flashcard} />
            <FeedbackStat label="题目相关" value={feedback.byType.question} />
          </div>

          <div className="border-t border-[#e9e9e8] pt-3">
            <p className="text-[11px] text-[#787774] mb-2 font-semibold">反馈类型分布</p>
            <div className="space-y-1.5">
              {(Object.keys(feedback.byTag) as Array<keyof typeof feedback.byTag>).map((tag) => {
                const count = feedback.byTag[tag]
                const pct = feedback.total > 0 ? Math.round((count / feedback.total) * 100) : 0
                return (
                  <div key={tag} className="flex items-center gap-2 text-[12px]">
                    <span className="text-[#37352f] min-w-[60px]">{FEEDBACK_TAG_LABELS[tag]}</span>
                    <div className="flex-1 h-1.5 bg-[#e9e9e8] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#6940a5]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[#9b9a97] min-w-[40px] text-right">
                      {count} 次
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="text-[11px] text-[#9b9a97] italic mt-3">
            💡 你的反馈会进入 AI 生成上下文，影响同主题的下次提炼（v2.3.1 联调后真正生效）
          </p>
        </div>
      )}

      <div className="text-sm text-[#9b9a97] text-center pt-3">
        当前展示「{personality === "student" ? "学生党" : personality === "cert" ? "考证型" : personality === "explorer" ? "兴趣探索" : "严苛教练"}」风格的进度。<br />
        跨人格对比视图将在批 2 实施。
      </div>
    </div>
  )
}

function FeedbackStat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg bg-white border border-[#e9e9e8] p-2.5 text-center">
      <div
        className={[
          "text-xl font-bold leading-tight",
          highlight ? "text-[#6940a5]" : "text-[#37352f]",
        ].join(" ")}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#787774] mt-0.5">{label}</div>
    </div>
  )
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#e9e9e8] bg-white p-4">
      <div className="text-[12px] text-[#9b9a97] mb-1">{label}</div>
      <div
        className={[
          "text-2xl font-bold",
          highlight ? "text-[#c4332e]" : "text-[#37352f]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  )
}
