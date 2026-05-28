"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Sparkles,
  Trophy,
} from "lucide-react"
import { questionApi, planApi } from "@/lib/api"
import type { Question, AnswerKey, AnswerResponse, AgentPersonality } from "@/lib/types"
import PersonalitySwitcher from "@/components/PersonalitySwitcher"
import { getActivePersonality, recordAnswer, getStudiedDays } from "@/lib/sandboxStore"

interface AnswerRecord {
  questionId: string
  picked: string   // "A" | "A,B" | "T" etc. (supports single / multi / tf)
  result: AnswerResponse
}

export default function QuizPage() {
  const router = useRouter()
  const params = useParams<{ planId: string }>()
  const searchParams = useSearchParams()
  // v2.2.1: scope 决定题目范围
  const scope = (searchParams.get("scope") as
    | "today"
    | "studied"
    | "all"
    | "wrong"
    | null) ?? "all"
  // v2.2.1：考试模式（一次性交卷，不允许边做边看）
  const examMode = searchParams.get("mode") === "exam"
  // 从 sessionStorage 拿"今日学过的卡 ID"（由完成页传过来）
  const sessionCardIdsRaw =
    typeof window !== "undefined"
      ? sessionStorage.getItem(`session_cards_${params.planId}`)
      : null
  const sessionCardIds: string[] = sessionCardIdsRaw ? JSON.parse(sessionCardIdsRaw) : []
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  /** 已提交的答案（single: "A" / multi: "A,B" / tf: "T"） */
  const [picked, setPicked] = useState<string | null>(null)
  /** 多选累积选择 + 严苛教练的"理由" */
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState("")
  const [result, setResult] = useState<AnswerResponse | null>(null)
  const [records, setRecords] = useState<AnswerRecord[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [finished, setFinished] = useState(false)
  const [vaultId, setVaultId] = useState<string>("")
  const [refreshKey, setRefreshKey] = useState(0)
  // v2.2.1：dayIndex → topic 映射（用于跨 Day 范围下的题目主题徽章）
  const [dayTopics, setDayTopics] = useState<Record<number, string>>({})

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    setLoading(true)
    setIndex(0)
    setPicked(null)
    setMultiSelected(new Set())
    setReason("")
    setResult(null)
    setRecords([])
    setFinished(false)
    planApi
      .get(params.planId)
      .then((planRes) => {
        const vId = planRes.plan.vaultId
        setVaultId(vId)

        // v2.2.1：从 plan.planData.days 提取 dayIndex → topic 映射
        const planData = planRes.plan.planData as
          | { days?: Array<{ day: number; topics?: string[] }> }
          | undefined
        const map: Record<number, string> = {}
        planData?.days?.forEach((d) => {
          if (d.topics && d.topics.length > 0) {
            map[d.day] = d.topics[0]
          }
        })
        setDayTopics(map)

        // v2.2.1：按 scope 计算要拉的 dayIndexes
        let listOpts: { scope?: "today" | "studied" | "all"; dayIndexes?: number[] } = {}
        if (scope === "today") {
          const days = new Set<number>()
          for (const id of sessionCardIds) {
            const m = id.match(/-(\d+)-\d+$/)
            if (m) days.add(parseInt(m[1], 10))
          }
          listOpts = { scope: "today", dayIndexes: Array.from(days) }
        } else if (scope === "studied") {
          const cur = getActivePersonality(vId) || "student"
          listOpts = { scope: "studied", dayIndexes: getStudiedDays(vId, cur) }
        }

        return questionApi.list(params.planId, listOpts)
      })
      .then((qRes) => {
        // v2.2.1：scope=wrong 时只保留错题集里的 questionId
        let qs = qRes.questions
        if (scope === "wrong") {
          const idsRaw = sessionStorage.getItem(`wrong_redo_${params.planId}`)
          if (idsRaw) {
            const ids = new Set<string>(JSON.parse(idsRaw))
            qs = qs.filter((q) => ids.has(q.id))
            sessionStorage.removeItem(`wrong_redo_${params.planId}`)
          }
        }
        setQuestions(qs)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false))
  }, [params.planId, router, refreshKey, scope])

  const question = questions[index]
  const qType = question?.type ?? "single"

  /**
   * 提交答案（按题型构造 finalAnswer）
   *   single        : "A"
   *   multi         : 多选 set 排序后 "A,B"
   *   true-false-explain : "T" / "F"（reason 一起带到后端做关键词评判）
   */
  async function handleSubmit(finalAnswer: string) {
    if (picked || !question) return
    setPicked(finalAnswer)
    setSubmitting(true)
    try {
      const res = await questionApi.answer(question.id, finalAnswer, reason)
      setRecords((prev) => [
        ...prev,
        { questionId: question.id, picked: finalAnswer, result: res },
      ])
      if (vaultId) {
        const cur = getActivePersonality(vaultId) || "student"
        recordAnswer(vaultId, cur, question.id, finalAnswer, res.isCorrect)
      }
      // v2.2.1：考试模式 = 不显示解析，立刻跳下一题
      if (examMode) {
        // 短延时显示提交反馈
        setTimeout(() => {
          if (index < questions.length - 1) {
            setIndex(index + 1)
            setPicked(null)
            setMultiSelected(new Set())
            setReason("")
            setResult(null)
          } else {
            setFinished(true)
          }
        }, 250)
      } else {
        setResult(res)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmitSingle(option: AnswerKey) {
    handleSubmit(option)
  }

  function handleSubmitMulti() {
    const sorted = Array.from(multiSelected).sort().join(",")
    if (!sorted) return
    handleSubmit(sorted)
  }

  // v2.2.1：临时报错态（让用户先点 T/F → 缺理由时弹提示）
  const [reasonError, setReasonError] = useState(false)

  function handleSubmitTrueFalse(value: "T" | "F") {
    if (!reason.trim()) {
      // 严苛教练：理由是必填的，但允许先点 T/F → 友好报错
      setReasonError(true)
      // 滚动到 textarea 让用户看到
      const ta = document.getElementById("reason-textarea")
      ta?.focus()
      ta?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setReasonError(false)
    handleSubmit(value)
  }

  function handleNext() {
    if (index < questions.length - 1) {
      setIndex(index + 1)
      setPicked(null)
      setMultiSelected(new Set())
      setReason("")
      setResult(null)
    } else {
      setFinished(true)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-[#9b9a97] text-sm">
        加载中
      </main>
    )
  }

  if (error || questions.length === 0) {
    const scopeHint =
      scope === "today"
        ? "今天还没学闪卡，请先去「学」Tab 学几张再来做小测"
        : scope === "studied"
        ? "你还没学过任何闪卡，先去「学」Tab 开始学习吧"
        : "暂无题目"
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <div className="text-[#787774] text-sm text-center max-w-sm">
          {error || scopeHint}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/flashcard/${params.planId}`)}
            className="nt-btn-ai"
          >
            去学闪卡
          </button>
          <button
            onClick={() => router.push(`/plan/${params.planId}`)}
            className="nt-btn-ghost border border-[#e9e9e8]"
          >
            <ArrowLeft className="w-4 h-4" />
            返回计划
          </button>
        </div>
      </main>
    )
  }

  if (finished) {
    const correctCount = records.filter((r) => r.result.isCorrect).length
    const accuracy = Math.round((correctCount / records.length) * 100)

    // v2.2.1：考试模式下按 Day 分布正确率（弱项分析）
    const dayStats = records.reduce<
      Record<number, { total: number; correct: number; topic: string }>
    >((acc, r) => {
      const q = questions.find((x) => x.id === r.questionId)
      if (!q) return acc
      const day = q.dayIndex
      if (!acc[day]) {
        acc[day] = { total: 0, correct: 0, topic: dayTopics[day] || `Day ${day}` }
      }
      acc[day].total++
      if (r.result.isCorrect) acc[day].correct++
      return acc
    }, {})
    const weakDays = Object.entries(dayStats)
      .map(([day, s]) => ({
        day: parseInt(day, 10),
        ...s,
        rate: Math.round((s.correct / s.total) * 100),
      }))
      .filter((d) => d.rate < 70)
      .sort((a, b) => a.rate - b.rate)

    return (
      <main className="min-h-screen px-6 bg-[#fbfbfa] py-10">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#f4efff] flex items-center justify-center">
              <Trophy className="w-7 h-7 text-[#6940a5]" />
            </div>
            <h1 className="mt-5 text-[26px] font-bold text-[#37352f] tracking-tight">
              {examMode ? "📋 交卷报告" : "练习完成"}
            </h1>
            <p className="mt-2 text-[13px] text-[#787774]">
              {examMode ? "考试模式 · 一次性提交结果" : "本轮已完成"}
            </p>

            <div className="mt-7 flex items-baseline justify-center gap-2">
              <span
                className={[
                  "text-[72px] font-bold tracking-tight leading-none",
                  accuracy >= 80
                    ? "text-emerald-600"
                    : accuracy >= 60
                    ? "text-amber-600"
                    : "text-[#c4332e]",
                ].join(" ")}
              >
                {accuracy}
              </span>
              <span className="text-[24px] font-semibold text-[#787774]">%</span>
            </div>
            <p className="mt-2 text-[14px] text-[#787774]">
              答对 {correctCount} / {records.length} 题
            </p>
          </div>

          {/* v2.2.1：考试模式下按 Day 分布的弱项分析 */}
          {examMode && Object.keys(dayStats).length > 1 && (
            <div className="mt-8">
              <div className="text-[11px] uppercase tracking-wider text-[#9b9a97] font-semibold mb-3">
                各主题正确率分布
              </div>
              <div className="space-y-2">
                {Object.entries(dayStats)
                  .map(([d, s]) => ({ day: parseInt(d, 10), ...s, rate: Math.round((s.correct / s.total) * 100) }))
                  .sort((a, b) => a.day - b.day)
                  .map(({ day, total, correct, rate, topic }) => (
                    <div
                      key={day}
                      className="rounded-lg border border-[#e9e9e8] bg-white p-3"
                    >
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-[13px] font-semibold text-[#37352f]">
                          Day {day} · {topic}
                        </span>
                        <span
                          className={[
                            "text-[13px] font-bold",
                            rate >= 80
                              ? "text-emerald-600"
                              : rate >= 60
                              ? "text-amber-600"
                              : "text-[#c4332e]",
                          ].join(" ")}
                        >
                          {rate}% ({correct}/{total})
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#e9e9e8] rounded-full overflow-hidden">
                        <div
                          className={[
                            "h-full transition-all",
                            rate >= 80
                              ? "bg-emerald-500"
                              : rate >= 60
                              ? "bg-amber-500"
                              : "bg-[#c4332e]",
                          ].join(" ")}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {weakDays.length > 0 && (
                <div className="mt-4 rounded-lg bg-[#fdf3f3] border border-[#fbeae9] p-3">
                  <p className="text-[12px] font-semibold text-[#c4332e] mb-1">
                    🎯 弱项建议
                  </p>
                  <p className="text-[12px] text-[#787774] leading-relaxed">
                    {weakDays.length === 1
                      ? `Day ${weakDays[0].day}「${weakDays[0].topic}」正确率仅 ${weakDays[0].rate}%，建议回去复习一下。`
                      : `${weakDays.length} 个主题正确率低于 70%（${weakDays
                          .slice(0, 3)
                          .map((d) => `Day ${d.day}`)
                          .join("、")}）`}
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="text-center mt-6 text-[12px] text-[#9b9a97]">
            错题已自动归档至「纠」Tab · 连续答对 2 次才移除
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              onClick={() => router.push(`/plan/${params.planId}`)}
              className="nt-btn-ai justify-center flex-1"
            >
              返回学习计划
            </button>
            {correctCount < records.length && (
              <button
                onClick={() => {
                  // 跳错题集
                  router.push(`/plan/${params.planId}`)
                  // 自动切到「纠」Tab —— 在 plan 页用 URL hash 控制
                  setTimeout(() => {
                    window.location.hash = "#wrong"
                  }, 100)
                }}
                className="nt-btn-ghost border border-[#fbeae9] text-[#c4332e] justify-center flex-1"
              >
                去看错题集
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  const progress = ((index + 1) / questions.length) * 100

  return (
    <main className="min-h-screen bg-[#fbfbfa]">
      <nav className="border-b border-[#e9e9e8] bg-white">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push(`/plan/${params.planId}`)}
            className="flex items-center gap-1.5 text-[13px] text-[#787774] hover:text-[#37352f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            退出
          </button>
          <div className="flex items-center gap-2 text-[13px]">
            {/* v2.2.1：范围徽章 */}
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
              style={{
                background:
                  scope === "today"
                    ? "#f4efff"
                    : scope === "studied"
                    ? "#eef4ff"
                    : scope === "wrong"
                    ? "#fdf3f3"
                    : "#f1f1ef",
                color:
                  scope === "today"
                    ? "#6940a5"
                    : scope === "studied"
                    ? "#1a5cd0"
                    : scope === "wrong"
                    ? "#c4332e"
                    : "#37352f",
              }}
            >
              {scope === "today"
                ? "📅 今日小测"
                : scope === "studied"
                ? "📚 累计练习"
                : scope === "wrong"
                ? "🔥 错题专项"
                : "🎯 全计划题目"}
            </span>
            {/* 考试模式徽章 */}
            {examMode && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[#c4332e] text-white">
                ⏱️ 考试模式
              </span>
            )}
            {vaultId && (
              <PersonalitySwitcher
                vaultId={vaultId}
                onSwitched={() => setRefreshKey((k) => k + 1)}
              />
            )}
            <span className="text-[#9b9a97]">
              {index + 1} / {questions.length}
            </span>
          </div>
        </div>
        <div className="h-0.5 bg-[#e9e9e8]">
          <div
            className="h-full bg-[#6940a5] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-5">
          {/* v2.2.1：跨 Day 范围下显示「主题：XX · Day N」明确语义，today 范围隐藏 */}
          {scope !== "today" && question?.dayIndex && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#9b9a97]">
              <span className="px-1.5 py-0.5 rounded bg-[#f1f1ef] text-[10px] font-semibold text-[#37352f] tracking-wide">
                主题
              </span>
              {dayTopics[question.dayIndex] && (
                <span className="text-[#37352f] font-medium">
                  {dayTopics[question.dayIndex]}
                </span>
              )}
              <span className="text-[#d4d4d2]">·</span>
              <span>Day {question.dayIndex}</span>
              <span className="text-[#d4d4d2]">·</span>
            </span>
          )}
          <span className="nt-tag-ai">
            <Sparkles className="w-3 h-3" />
            AI 出题
          </span>
        </div>

        {/* 题型徽章（明示交互方式） */}
        <div className="mb-3">
          <span
            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
            style={{
              background:
                qType === "multi"
                  ? "#fff3e9"
                  : qType === "true-false-explain"
                  ? "#fbeae9"
                  : "#f1f1ef",
              color:
                qType === "multi"
                  ? "#c25a14"
                  : qType === "true-false-explain"
                  ? "#b8281f"
                  : "#787774",
            }}
          >
            {qType === "multi"
              ? "📋 多选题（多个答案可能都对）"
              : qType === "true-false-explain"
              ? "✍️ 判断题 + 理由（需要你写出依据）"
              : "🔘 单选题"}
          </span>
        </div>

        <h2 className="text-[20px] text-[#37352f] leading-[1.5] font-medium tracking-tight whitespace-pre-line">
          {question?.content}
        </h2>

        {/* === 题型 1：single 单选 === */}
        {qType === "single" && (
          <div className="mt-7 space-y-2">
            {(["A", "B", "C", "D"] as AnswerKey[]).map((key) => {
              const isPicked = picked === key
              const isCorrect = result && key === result.correctAnswer
              const isWrong = result && isPicked && !result.isCorrect

              let styles = "border-[#e9e9e8] hover:border-[#37352f] hover:bg-white"
              let badgeStyles =
                "bg-[#f1f1ef] text-[#787774] group-hover:bg-[#37352f] group-hover:text-white"
              if (result) {
                if (isCorrect) {
                  styles = "border-emerald-400 bg-emerald-50/50"
                  badgeStyles = "bg-emerald-500 text-white"
                } else if (isWrong) {
                  styles = "border-red-400 bg-red-50/50"
                  badgeStyles = "bg-red-500 text-white"
                } else {
                  styles = "border-[#e9e9e8] opacity-50"
                }
              } else if (isPicked) {
                styles = "border-[#6940a5] bg-[#f4efff]"
                badgeStyles = "bg-[#6940a5] text-white"
              }

              return (
                <button
                  key={key}
                  onClick={() => handleSubmitSingle(key)}
                  disabled={!!picked || submitting}
                  className={`group w-full text-left p-4 rounded-lg border-2 transition-all duration-200 flex items-start gap-4 bg-white ${styles} ${
                    !picked ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-semibold flex-shrink-0 transition-colors ${badgeStyles}`}
                  >
                    {key}
                  </div>
                  <div className="text-[15px] text-[#37352f] flex-1 pt-0.5 leading-relaxed">
                    {question?.options[key]}
                  </div>
                  {isCorrect && (
                    <Check className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                  )}
                  {isWrong && (
                    <X className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* === 题型 2：multi 多选 === */}
        {qType === "multi" && (
          <>
            <div className="mt-7 space-y-2">
              {(["A", "B", "C", "D"] as AnswerKey[]).map((key) => {
                const correctSet = new Set(
                  (result?.correctAnswer ?? "").split(","),
                )
                const userSet = result
                  ? new Set(picked?.split(",") ?? [])
                  : multiSelected
                const isSelected = userSet.has(key)
                const isCorrectKey = correctSet.has(key)

                let styles = "border-[#e9e9e8] hover:border-[#c25a14] hover:bg-[#fff3e9]/30"
                let badgeStyles = "bg-[#f1f1ef] text-[#787774]"
                if (result) {
                  if (isCorrectKey && isSelected) {
                    styles = "border-emerald-400 bg-emerald-50/50"
                    badgeStyles = "bg-emerald-500 text-white"
                  } else if (isCorrectKey && !isSelected) {
                    styles = "border-amber-300 bg-amber-50/50"
                    badgeStyles = "bg-amber-500 text-white"
                  } else if (!isCorrectKey && isSelected) {
                    styles = "border-red-400 bg-red-50/50"
                    badgeStyles = "bg-red-500 text-white"
                  } else {
                    styles = "border-[#e9e9e8] opacity-50"
                  }
                } else if (isSelected) {
                  styles = "border-[#c25a14] bg-[#fff3e9]"
                  badgeStyles = "bg-[#c25a14] text-white"
                }

                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (picked) return
                      setMultiSelected((prev) => {
                        const next = new Set(prev)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }}
                    disabled={!!picked || submitting}
                    className={`group w-full text-left p-4 rounded-lg border-2 transition-all duration-200 flex items-start gap-4 bg-white ${styles}`}
                  >
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center text-[13px] font-semibold flex-shrink-0 ${badgeStyles}`}
                    >
                      {isSelected ? "✓" : key}
                    </div>
                    <div className="text-[15px] text-[#37352f] flex-1 pt-0.5 leading-relaxed">
                      {question?.options[key]}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 多选提交按钮 */}
            {!result && (
              <div className="mt-5">
                <button
                  onClick={handleSubmitMulti}
                  disabled={multiSelected.size === 0 || submitting}
                  className={`w-full py-3 rounded-lg text-[14px] font-semibold transition-all ${
                    multiSelected.size === 0
                      ? "bg-[#e9e9e8] text-[#9b9a97] cursor-not-allowed"
                      : "bg-[#c25a14] text-white hover:bg-[#a44a0e]"
                  }`}
                >
                  提交多选 · 已选 {multiSelected.size} 项
                </button>
              </div>
            )}
          </>
        )}

        {/* === 题型 3：true-false-explain 判断+理由 === */}
        {qType === "true-false-explain" && (
          <>
            <div className="mt-7">
              <p className="text-[13px] font-semibold text-[#b8281f] mb-3">
                第一步：判断陈述对错
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(["T", "F"] as const).map((v) => {
                  const isPicked = picked === v
                  const isCorrect = result && v === result.correctAnswer
                  const isWrong = result && isPicked && !result.isCorrect

                  let styles = "border-[#e9e9e8] hover:border-[#b8281f] hover:bg-[#fbeae9]/30"
                  if (result) {
                    if (isCorrect) styles = "border-emerald-400 bg-emerald-50"
                    else if (isWrong) styles = "border-red-400 bg-red-50"
                    else styles = "border-[#e9e9e8] opacity-50"
                  } else if (picked) {
                    styles = "border-[#e9e9e8] opacity-50"
                  }

                  return (
                    <button
                      key={v}
                      onClick={() => handleSubmitTrueFalse(v)}
                      disabled={!!picked || submitting}
                      className={`py-5 rounded-lg border-2 text-[18px] font-bold transition-all ${styles}`}
                    >
                      {v === "T" ? "✓ 正确" : "✗ 错误"}
                    </button>
                  )
                })}
              </div>

              <p className="text-[13px] font-semibold text-[#b8281f] mb-2 flex items-center gap-1.5">
                第二步：用一句话写出你的理由
                <span className="text-red-500" aria-label="必填">*</span>
                <span className="text-[#9b9a97] text-[11px] font-normal">
                  （必填，30 字以内）
                </span>
              </p>
              <textarea
                id="reason-textarea"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (e.target.value.trim()) setReasonError(false)
                }}
                disabled={!!picked}
                rows={2}
                maxLength={60}
                placeholder="写下你判断的依据……生成效应：自己写出来比 4 选 1 记得更深"
                className={[
                  "w-full px-4 py-3 rounded-lg border-2 outline-none text-[14px] resize-none transition-colors",
                  reasonError
                    ? "border-red-400 bg-red-50/30 focus:border-red-500"
                    : "border-[#e9e9e8] focus:border-[#b8281f]",
                ].join(" ")}
              />
              <div className="mt-1 flex items-baseline justify-between">
                {reasonError ? (
                  <p className="text-[12px] text-red-600 font-semibold">
                    ⚠️ 理由是必填项，请先写下你的判断依据
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-[11px] text-[#9b9a97]">
                  {reason.length} / 60
                </span>
              </div>

              {result?.reasonScore !== undefined && (
                <div className="mt-4 rounded-lg p-3 bg-[#fbfbfa] border border-[#e9e9e8]">
                  <p className="text-[12px] text-[#787774]">
                    你的理由关键词命中度：
                    <strong className="text-[#37352f] ml-1">
                      {Math.round(result.reasonScore * 100)}%
                    </strong>
                    {result.reasonScore >= 0.5 ? (
                      <span className="text-emerald-600 ml-2">✓ 论证有要点</span>
                    ) : (
                      <span className="text-amber-600 ml-2">
                        ⚠ 论证不够具体 — 试着提到「
                        {((question?.reasonKeywords as string[] | undefined) ?? [])
                          .slice(0, 2)
                          .join("、") || "核心概念"}
                        」
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {result && question && (
          <AnswerExplanation
            result={result}
            question={question}
            topic={dayTopics[question.dayIndex] || ""}
            onNext={handleNext}
            isLast={index >= questions.length - 1}
          />
        )}
      </div>
    </main>
  )
}

// ============ 子组件：AI 解析（3 层可信度建立） ============

function AnswerExplanation({
  result,
  question,
  topic,
  onNext,
  isLast,
}: {
  result: AnswerResponse
  question: Question
  topic: string
  onNext: () => void
  isLast: boolean
}) {
  const [expandFull, setExpandFull] = useState(false)

  // 把解析拆成"核心理由 + 完整内容"——核心是第一行，完整是全部
  const explanation = result.explanation || ""
  const firstLine = explanation.split("\n")[0]
  const restLines = explanation.split("\n").slice(1).join("\n").trim()

  return (
    <div
      className={`mt-7 rounded-xl border p-5 ${
        result.isCorrect
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-red-200 bg-red-50/50"
      }`}
    >
      {/* 顶部：对错判定 */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center ${
            result.isCorrect ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {result.isCorrect ? (
            <Check className="w-3.5 h-3.5 text-white" />
          ) : (
            <X className="w-3.5 h-3.5 text-white" />
          )}
        </div>
        <span
          className={`text-[14px] font-semibold ${
            result.isCorrect ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {result.isCorrect
            ? "答对了"
            : `答错了，正确答案是 ${result.correctAnswer}`}
        </span>
      </div>

      {/* Layer 1：判断依据（核心 AI 解析） */}
      <div className="mb-4">
        <div className="text-[11px] uppercase tracking-widest text-[#787774] font-semibold mb-1.5">
          判断依据
        </div>
        <p className="text-[14px] text-[#37352f] leading-relaxed whitespace-pre-line">
          {firstLine}
        </p>
      </div>

      {/* Layer 2：完整参考答案（可展开） */}
      {restLines && (
        <div className="mb-4">
          <button
            onClick={() => setExpandFull(!expandFull)}
            className="flex items-center gap-1.5 text-[12px] text-[#6940a5] font-semibold hover:underline"
          >
            <span>📄 {expandFull ? "收起" : "展开"}完整参考答案</span>
            <span
              className={`transition-transform ${expandFull ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>
          {expandFull && (
            <div className="mt-3 rounded-lg bg-white border border-[#e9e9e8] p-3.5">
              <p className="text-[13px] text-[#37352f] leading-relaxed whitespace-pre-line">
                {restLines}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Layer 3：可信度建立（与闪卡页对齐：3 档来源类型 + 真实溯源） */}
      <CredibilityBlock
        dayIndex={question.dayIndex}
        sourceText={firstLine}
        topic={topic}
      />

      <button onClick={onNext} className="mt-5 nt-btn-primary">
        {isLast ? "完成练习" : "下一题"}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ============ 子组件：可信度块（v2.2.1 终版 · 与闪卡页一致设计） ============

function CredibilityBlock({
  dayIndex,
  sourceText,
  topic,
}: {
  dayIndex: number
  sourceText: string
  topic: string
}) {
  const [open, setOpen] = useState(false)

  // 根据 topic 命中权威库决定来源类型
  // 简化：复用闪卡 mockContentEngine 的权威库逻辑
  // mock 期：若 topic 命中权威库则展示权威引用，否则用户资料

  return (
    <div className="border-t border-current/10 pt-3 mt-3">
      {/* 始终展示来源徽章 */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
          style={{ background: "#eaf5ec", color: "#2d7a45" }}
        >
          ✓ 来自你的资料
        </span>
        <span className="text-[11px] text-[#9b9a97]">已核验 · 最高可信</span>
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[12px] text-[#6940a5] font-semibold hover:underline"
      >
        <span>📖 {open ? "收起溯源" : "查看溯源详情"}</span>
        <span
          className={`text-[10px] transition-transform inline-block ${
            open ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="rounded-lg border-l-4 border-[#2d7a45] bg-[#eaf5ec]/40 p-3.5">
            <p className="text-[13.5px] leading-relaxed text-[#37352f]">
              「{sourceText}」
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-[#2d7a45]/15 flex items-baseline justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-[#6b6f76]">
                📖 你上传的资料 · {topic || `Day ${dayIndex} 章节`} · 段落{" "}
                {(dayIndex - 1) * 3 + 1}
              </span>
              <button
                onClick={() =>
                  alert(
                    "v2.3 RAG 接入后：跳转到资料预览页，高亮该段落\n（mock 期暂不实现）",
                  )
                }
                className="text-[11px] text-[#2d7a45] font-semibold hover:underline"
              >
                👁️ 在原文档中查看 →
              </button>
            </div>
          </div>
          <p className="text-[10px] text-[#9b9a97] italic mt-2">
            v2.2.1 mock：原文为示意 · v2.3 RAG 接入后真实溯源
          </p>
        </div>
      )}
    </div>
  )
}
