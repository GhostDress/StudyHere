"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Eye,
  PartyPopper,
  Pencil,
} from "lucide-react"
import { flashcardApi, planApi } from "@/lib/api"
import type { Flashcard, AgentPersonality } from "@/lib/types"
import PersonalitySwitcher from "@/components/PersonalitySwitcher"
import FlashcardAnswerCard from "@/components/FlashcardAnswerCard"
import { getActivePersonality, markFlashcardMastery } from "@/lib/sandboxStore"

export default function FlashcardPage() {
  const router = useRouter()
  const params = useParams<{ planId: string }>()
  const [cards, setCards] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [finished, setFinished] = useState(false)
  const [vaultId, setVaultId] = useState<string>("")
  const [refreshKey, setRefreshKey] = useState(0)
  // v2.2.1：本次会话每张卡的评估记录，用于完成页统计 + 待复习列表
  const [sessionRecords, setSessionRecords] = useState<
    Array<{ cardId: string; front: string; level: number }>
  >([])
  // v2.2.1：完成页「接下来做小测」选项弹层
  const [showQuizDialog, setShowQuizDialog] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    setLoading(true)
    setIndex(0)
    setRevealed(false)
    setFinished(false)
    setSessionRecords([])
    Promise.all([planApi.get(params.planId), flashcardApi.list(params.planId)])
      .then(([planRes, cardsRes]) => {
        setVaultId(planRes.plan.vaultId)
        // v2.2.1：支持 URL query 过滤（从单日明细页跳来时）
        let filtered = cardsRes.flashcards
        const url = new URL(window.location.href)
        const dayParam = url.searchParams.get("day")
        const filterParam = url.searchParams.get("filter")
        if (dayParam) {
          const dayNum = parseInt(dayParam, 10)
          filtered = filtered.filter((c) => c.dayIndex === dayNum)
        }
        if (filterParam === "single" || filterParam === "needReview") {
          const idsRaw = sessionStorage.getItem(`card_filter_${params.planId}`)
          if (idsRaw) {
            const ids = new Set<string>(JSON.parse(idsRaw))
            filtered = filtered.filter((c) => ids.has(c.id))
            // 用完即清，避免下次干扰
            sessionStorage.removeItem(`card_filter_${params.planId}`)
          }
        }
        setCards(filtered)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false))
  }, [params.planId, router, refreshKey])

  const card = cards[index]

  async function handleMastery(level: number) {
    if (!card) return
    try {
      await flashcardApi.updateMastery(card.id, level)
    } catch {}
    // v2.2.1：写入当前激活人格的沙箱
    if (vaultId) {
      const cur = getActivePersonality(vaultId) || "student"
      markFlashcardMastery(vaultId, cur, card.id, level)
    }
    // v2.2.1：本次会话记录
    setSessionRecords((prev) => [
      ...prev,
      { cardId: card.id, front: card.front, level },
    ])
    if (index < cards.length - 1) {
      setIndex(index + 1)
      setRevealed(false)
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

  if (error || cards.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <div className="text-[#787774] text-sm">{error || "暂无闪卡"}</div>
        <button onClick={() => router.push(`/plan/${params.planId}`)} className="nt-btn-ghost">
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      </main>
    )
  }

  if (finished) {
    const notKnown = sessionRecords.filter((r) => r.level === 0)
    const blurry = sessionRecords.filter((r) => r.level === 3)
    const mastered = sessionRecords.filter((r) => r.level === 5)
    const needReview = [...notKnown, ...blurry] // 需要再练的

    function handleBatchReviewAll() {
      // 「逐张过一遍」批量模式：把待复习卡放到队首重新开一轮
      const needReviewIds = new Set(needReview.map((r) => r.cardId))
      const reordered = [
        ...cards.filter((c) => needReviewIds.has(c.id)),
        ...cards.filter((c) => !needReviewIds.has(c.id)),
      ]
      setCards(reordered)
      setSessionRecords([])
      setIndex(0)
      setRevealed(false)
      setFinished(false)
    }

    return (
      <main className="min-h-screen bg-[#fbfbfa] py-10 px-6">
        <div className="max-w-2xl mx-auto">
          {/* 顶部 emoji + 标题 */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#f4efff] flex items-center justify-center">
              <PartyPopper className="w-7 h-7 text-[#6940a5]" />
            </div>
            <h1 className="mt-5 text-[26px] font-bold text-[#37352f] tracking-tight">
              本轮复习完成
            </h1>
            <p className="mt-2 text-[14px] text-[#787774]">
              共复习 {cards.length} 张闪卡 · 数据已记录到本人格沙箱
            </p>
          </div>

          {/* 3 数字框 · 大字 + 鲜明对比 */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border-2 border-[#fbeae9] bg-[#fdf3f3] p-6 text-center">
              <div className="text-[64px] font-bold text-[#c4332e] leading-none tracking-tight">
                {notKnown.length}
              </div>
              <div className="text-[13px] text-[#c4332e] mt-3 font-semibold">
                ❌ 完全不会
              </div>
            </div>
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-center">
              <div className="text-[64px] font-bold text-amber-600 leading-none tracking-tight">
                {blurry.length}
              </div>
              <div className="text-[13px] text-amber-700 mt-3 font-semibold">
                🟡 模糊
              </div>
            </div>
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
              <div className="text-[64px] font-bold text-emerald-600 leading-none tracking-tight">
                {mastered.length}
              </div>
              <div className="text-[13px] text-emerald-700 mt-3 font-semibold">
                ✅ 掌握
              </div>
            </div>
          </div>

          {/* 总结反馈一句话 */}
          <div className="mt-4 text-center">
            <p className="text-[14px] text-[#37352f]">
              {(() => {
                const total = sessionRecords.length
                if (total === 0) return ""
                const masteredPct = Math.round((mastered.length / total) * 100)
                if (needReview.length === 0) {
                  return `🎉 全部掌握，本轮无需复习`
                }
                if (masteredPct >= 70) {
                  return `👍 掌握 ${masteredPct}%，${needReview.length} 张需要再练`
                }
                if (masteredPct >= 40) {
                  return `📈 掌握 ${masteredPct}%，建议把 ${needReview.length} 张再过一遍`
                }
                return `💪 掌握 ${masteredPct}%，先把不会的 ${notKnown.length} 张攻克下`
              })()}
            </p>
          </div>

          {/* 待复习列表 · 点击行就地展开重评 */}
          {needReview.length > 0 && (
            <div className="mt-8">
              <div className="flex items-baseline justify-between mb-3 gap-2">
                <h2 className="text-[15px] font-semibold text-[#37352f]">
                  📌 需要复习的卡片 · {needReview.length} 张
                </h2>
                <button
                  onClick={handleBatchReviewAll}
                  className="text-[12px] text-[#6940a5] font-semibold hover:underline"
                >
                  逐张过一遍 →
                </button>
              </div>
              <div className="space-y-2">
                {needReview.map((r) => (
                  <ReviewListItem
                    key={r.cardId}
                    record={r}
                    cards={cards}
                    vaultId={vaultId}
                    onRemastered={(newLevel) => {
                      // 用户重新评级后，更新 sessionRecords
                      setSessionRecords((prev) =>
                        prev.map((s) =>
                          s.cardId === r.cardId ? { ...s, level: newLevel } : s,
                        ),
                      )
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 没有错卡 · 鼓励 */}
          {needReview.length === 0 && (
            <div className="mt-8 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-[14px] text-emerald-800 font-semibold">
                🎉 全部掌握，本轮无需复习
              </p>
              <p className="text-[12px] text-emerald-700 mt-1">
                可以去答题练习巩固一下
              </p>
            </div>
          )}

          {/* 操作按钮 · 极简两个出口 */}
          <div className="mt-8 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => setShowQuizDialog(true)}
              className="nt-btn-ai justify-center flex-1"
            >
              <Pencil className="w-4 h-4" />
              接下来做小测
            </button>
            <button
              onClick={() => router.push(`/plan/${params.planId}`)}
              className="nt-btn-ghost border border-[#e9e9e8] justify-center flex-1"
            >
              返回学习计划
            </button>
          </div>

          {/* 数据流向提示 · 让用户知道这些数据有用 */}
          <p className="text-center text-[12px] text-[#9b9a97] mt-8">
            本次评估已沉淀到「进度」Tab，下次进入时会按 SM-2 算法智能安排复习时机
          </p>
        </div>

        {/* 「接下来做小测」选项弹层 · 3 档 */}
        {showQuizDialog && (
          <QuizOptionDialog
            cardCount={sessionRecords.length}
            sessionCardIds={sessionRecords.map((r) => r.cardId)}
            planId={params.planId}
            onClose={() => setShowQuizDialog(false)}
            onChoose={(option, sessionIds) => {
              setShowQuizDialog(false)
              // 写入 sessionStorage 让 quiz 页能拿到今日卡片 ID
              if (sessionIds) {
                sessionStorage.setItem(
                  `session_cards_${params.planId}`,
                  JSON.stringify(sessionIds),
                )
              }
              if (option === "today") {
                router.push(`/quiz/${params.planId}?scope=today`)
              } else if (option === "studied") {
                router.push(`/quiz/${params.planId}?scope=studied`)
              } else if (option === "all") {
                router.push(`/quiz/${params.planId}`)
              } else {
                router.push(`/plan/${params.planId}`)
              }
            }}
          />
        )}
      </main>
    )
  }

  const progress = ((index + 1) / cards.length) * 100

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
            {vaultId && (
              <PersonalitySwitcher
                vaultId={vaultId}
                onSwitched={() => setRefreshKey((k) => k + 1)}
              />
            )}
            <span className="nt-tag-ai">
              <Sparkles className="w-3 h-3" />
              主动回忆
            </span>
            <span className="text-[#9b9a97]">
              {index + 1} / {cards.length}
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

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center text-[12px] text-[#9b9a97] uppercase tracking-widest mb-6">
          Day {card?.dayIndex}
        </div>

        {!revealed ? (
          // 问题面：居中 + 大字 + 翻面提示
          <div
            onClick={() => setRevealed(true)}
            className="nt-card p-12 min-h-[320px] flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#37352f] hover:shadow-[0_4px_16px_rgba(15,15,15,0.06)] transition-all duration-200"
          >
            <div className="text-[11px] uppercase tracking-widest text-[#6940a5] font-semibold mb-6">
              问题
            </div>
            <p className="text-[22px] text-[#37352f] leading-[1.5] font-medium max-w-xl tracking-tight">
              {card?.front}
            </p>
            <button className="mt-10 nt-btn-ghost border border-[#e9e9e8]">
              <Eye className="w-4 h-4" />
              翻面看答案
            </button>
            <p className="mt-5 text-[12px] text-[#9b9a97] max-w-sm leading-relaxed">
              先自己想 30 秒。主动回忆比被动重读，记忆效率高 10 倍。
            </p>
          </div>
        ) : (
          // 答案面：v2.2.1 修订 —— 视觉权重 答案 >> 问题
          <div className="nt-card p-7 md:p-9">
            {/* 顶部：问题（轻量提示，单行小字） */}
            <div className="flex items-baseline gap-2 pb-4 border-b border-[#e9e9e8]">
              <span className="text-[11px] text-[#9b9a97] uppercase tracking-wider font-semibold flex-shrink-0">
                问题
              </span>
              <p className="text-[13px] text-[#787774] leading-relaxed">
                {card?.front}
              </p>
            </div>

            {/* 答案区（核心） */}
            <div className="mt-6">
              {card?.card ? (
                <FlashcardAnswerCard card={card.card} dayIndex={card.dayIndex} />
              ) : (
                <p className="text-[18px] text-[#37352f] leading-[1.7] font-medium">
                  {card?.back}
                </p>
              )}
            </div>
          </div>
        )}

        {revealed && (
          <div className="mt-10">
            <p className="text-center text-[13px] text-[#787774] mb-4">
              诚实评估掌握程度
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => handleMastery(0)}
                className="group nt-card p-5 text-left hover:border-red-300 hover:bg-red-50/50 transition-all duration-200"
              >
                <div className="text-[14px] font-semibold text-[#37352f] flex items-center gap-1.5">
                  <span className="text-red-500">❌</span> 完全不会
                </div>
                <div className="text-[11px] text-[#787774] leading-relaxed mt-1.5">
                  问题反应不出答案
                </div>
                <div className="text-[11px] text-[#9b9a97] mt-2 pt-2 border-t border-[#e9e9e8]">
                  明天再来
                </div>
              </button>
              <button
                onClick={() => handleMastery(3)}
                className="group nt-card p-5 text-left hover:border-amber-300 hover:bg-amber-50/50 transition-all duration-200"
              >
                <div className="text-[14px] font-semibold text-[#37352f] flex items-center gap-1.5">
                  <span className="text-amber-500">🟡</span> 模糊
                </div>
                <div className="text-[11px] text-[#787774] leading-relaxed mt-1.5">
                  能讲个大概但不精准
                </div>
                <div className="text-[11px] text-[#9b9a97] mt-2 pt-2 border-t border-[#e9e9e8]">
                  3 天后
                </div>
              </button>
              <button
                onClick={() => handleMastery(5)}
                className="group nt-card p-5 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-all duration-200"
              >
                <div className="text-[14px] font-semibold text-[#37352f] flex items-center gap-1.5">
                  <span className="text-emerald-500">✅</span> 掌握
                </div>
                <div className="text-[11px] text-[#787774] leading-relaxed mt-1.5">
                  30 秒内能讲清楚
                </div>
                <div className="text-[11px] text-[#9b9a97] mt-2 pt-2 border-t border-[#e9e9e8]">
                  1 周后
                </div>
              </button>
            </div>
            <p className="text-center text-[11px] text-[#9b9a97] mt-4">
              依据 Anki / SuperMemo 的 SM-2 间隔重复算法
              <span className="italic">· Wozniak, 1985</span>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

// ============ 子组件：待复习列表项（就地展开 + 重评级） ============

function ReviewListItem({
  record,
  cards,
  vaultId,
  onRemastered,
}: {
  record: { cardId: string; front: string; level: number }
  cards: Flashcard[]
  vaultId: string
  onRemastered: (newLevel: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const fullCard = cards.find((c) => c.id === record.cardId)

  function handleRemaster(level: number) {
    // 写入沙箱
    if (vaultId) {
      const cur = getActivePersonality(vaultId) || "student"
      markFlashcardMastery(vaultId, cur, record.cardId, level)
    }
    onRemastered(level)
    setExpanded(false)
  }

  return (
    <div className="rounded-lg border border-[#e9e9e8] bg-white overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-[#fafafa] transition-colors"
      >
        <span className="text-[14px] flex-shrink-0 pt-0.5">
          {record.level === 0 ? "❌" : "🟡"}
        </span>
        <div className="flex-1 text-[14px] text-[#37352f] leading-snug">
          {record.front}
        </div>
        <span className="text-[12px] text-[#9b9a97] flex-shrink-0">
          {expanded ? "收起" : "展开重评"}
        </span>
      </button>

      {expanded && fullCard && (
        <div className="border-t border-[#e9e9e8] px-4 py-4 bg-[#fafafa]">
          {/* 答案区域 */}
          {fullCard.card ? (
            <div className="mb-4">
              <FlashcardAnswerCard card={fullCard.card} dayIndex={fullCard.dayIndex} />
            </div>
          ) : (
            <p className="text-[14px] text-[#37352f] leading-[1.7] mb-4">
              {fullCard.back}
            </p>
          )}

          {/* 重评级 3 按钮 */}
          <div className="border-t border-[#e9e9e8] pt-3">
            <p className="text-[12px] text-[#9b9a97] mb-2">重新评估这张卡</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleRemaster(0)}
                className="rounded-md border border-[#fbeae9] bg-white hover:bg-[#fdf3f3] text-[#c4332e] text-[12px] font-semibold py-2"
              >
                ❌ 完全不会
              </button>
              <button
                onClick={() => handleRemaster(3)}
                className="rounded-md border border-amber-200 bg-white hover:bg-amber-50 text-amber-700 text-[12px] font-semibold py-2"
              >
                🟡 模糊
              </button>
              <button
                onClick={() => handleRemaster(5)}
                className="rounded-md border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-[12px] font-semibold py-2"
              >
                ✅ 掌握
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 子组件：「接下来做小测」选项弹层 · 3 档 ============

function QuizOptionDialog({
  cardCount,
  sessionCardIds,
  planId,
  onClose,
  onChoose,
}: {
  cardCount: number
  sessionCardIds: string[]
  planId: string
  onClose: () => void
  onChoose: (option: "today" | "studied" | "all" | "later", sessionIds?: string[]) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-[#37352f] mb-1">接下来做小测？</h3>
        <p className="text-[13px] text-[#787774] mb-5">
          通过答题巩固刚才的学习。选一种方式开始：
        </p>

        <div className="space-y-2">
          {/* 档 1：今日 · 推荐 */}
          <button
            onClick={() => onChoose("today", sessionCardIds)}
            className="w-full text-left rounded-xl border-2 border-[#6940a5] bg-[#f4efff] p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[15px] font-bold text-[#6940a5]">
                📅 针对刚学的 {cardCount} 张做小测
              </span>
              <span className="text-[11px] text-[#6940a5] font-semibold">推荐</span>
            </div>
            <p className="text-[12px] text-[#787774] mt-1">
              AI 出题，5-10 道，约 5 分钟，趁热打铁
            </p>
          </button>

          {/* 档 2：累计已学 */}
          <button
            onClick={() => onChoose("studied")}
            className="w-full text-left rounded-xl border border-[#cdddff] bg-[#eef4ff] p-4 hover:shadow-md transition-all"
          >
            <div className="text-[15px] font-semibold text-[#1a5cd0]">
              📚 针对至今学过的所有内容
            </div>
            <p className="text-[12px] text-[#787774] mt-1">
              综合检验之前学过的所有闪卡（含今天）
            </p>
          </button>

          {/* 档 3：全计划 */}
          <button
            onClick={() => onChoose("all")}
            className="w-full text-left rounded-xl border border-[#e9e9e8] bg-white p-4 hover:border-[#37352f] transition-all"
          >
            <div className="text-[15px] font-semibold text-[#37352f]">
              🎯 做本计划的全部题目
            </div>
            <p className="text-[12px] text-[#787774] mt-1">
              挑战完整覆盖（含还没学的天数）
            </p>
          </button>

          {/* 档 4：稍后 */}
          <button
            onClick={() => onChoose("later")}
            className="w-full text-left rounded-xl border border-[#e9e9e8] bg-white p-4 hover:bg-[#fafafa] transition-all"
          >
            <div className="text-[15px] font-semibold text-[#787774]">
              ⏰ 稍后再做（返回学习计划）
            </div>
            <p className="text-[12px] text-[#9b9a97] mt-1">
              随时可在「练」Tab 进入答题
            </p>
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={onClose}
            className="text-[12px] text-[#9b9a97] hover:text-[#37352f]"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
