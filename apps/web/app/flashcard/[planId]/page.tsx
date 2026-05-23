"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { flashcardApi } from "@/lib/api"
import type { Flashcard } from "@/lib/types"

export default function FlashcardPage() {
  const router = useRouter()
  const params = useParams<{ planId: string }>()
  const [cards, setCards] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    flashcardApi
      .list(params.planId)
      .then((res) => setCards(res.flashcards))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false))
  }, [params.planId, router])

  const card = cards[index]

  async function handleMastery(level: number) {
    if (!card) return
    try {
      await flashcardApi.updateMastery(card.id, level)
    } catch {
      // Mock 模式失败不阻断
    }
    if (index < cards.length - 1) {
      setIndex(index + 1)
      setRevealed(false)
    } else {
      setFinished(true)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        加载中...
      </main>
    )
  }

  if (error || cards.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-slate-500">{error || "暂无闪卡"}</div>
        <button
          onClick={() => router.back()}
          className="text-sm text-indigo-600"
        >
          ← 返回
        </button>
      </main>
    )
  }

  if (finished) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-50 to-indigo-50">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold text-slate-900">复习完成</h1>
        <p className="text-slate-500">已完成 {cards.length} 张闪卡的复习</p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => router.push(`/quiz/${params.planId}`)}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
          >
            去答题练习 →
          </button>
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium"
          >
            返回计划
          </button>
        </div>
      </main>
    )
  }

  const progress = ((index + 1) / cards.length) * 100

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-900 text-sm"
          >
            ← 退出复习
          </button>
          <div className="text-sm text-slate-600">
            {index + 1} / {cards.length}
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center text-xs text-slate-400 mb-3">
          Day {card?.dayIndex} · 主动回忆训练
        </div>

        <div
          onClick={() => !revealed && setRevealed(true)}
          className={`bg-white rounded-2xl border border-slate-200 p-10 min-h-[300px] flex flex-col items-center justify-center text-center shadow-sm ${
            !revealed ? "cursor-pointer hover:border-indigo-300" : ""
          }`}
        >
          {!revealed ? (
            <>
              <div className="text-xs uppercase tracking-widest text-indigo-500 font-semibold mb-4">
                问题
              </div>
              <p className="text-xl text-slate-900 leading-relaxed">
                {card?.front}
              </p>
              <button className="mt-8 px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition">
                👀 翻面看答案
              </button>
              <p className="mt-4 text-xs text-slate-400">
                先自己想一遍 —— 主动回忆比被动重读有用 10 倍
              </p>
            </>
          ) : (
            <>
              <div className="text-xs uppercase tracking-widest text-emerald-500 font-semibold mb-4">
                答案
              </div>
              <p className="text-lg text-slate-900 leading-relaxed">
                {card?.back}
              </p>
            </>
          )}
        </div>

        {revealed && (
          <div className="mt-8">
            <p className="text-center text-sm text-slate-500 mb-4">
              对照答案，诚实评估你的掌握程度
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleMastery(0)}
                className="py-4 rounded-xl bg-white border-2 border-red-200 hover:border-red-400 hover:bg-red-50 transition"
              >
                <div className="text-2xl mb-1">😵</div>
                <div className="text-sm font-medium text-slate-900">
                  完全不会
                </div>
                <div className="text-xs text-slate-400 mt-1">明天再来</div>
              </button>
              <button
                onClick={() => handleMastery(3)}
                className="py-4 rounded-xl bg-white border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition"
              >
                <div className="text-2xl mb-1">🤔</div>
                <div className="text-sm font-medium text-slate-900">
                  模糊
                </div>
                <div className="text-xs text-slate-400 mt-1">3 天后</div>
              </button>
              <button
                onClick={() => handleMastery(5)}
                className="py-4 rounded-xl bg-white border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition"
              >
                <div className="text-2xl mb-1">😎</div>
                <div className="text-sm font-medium text-slate-900">
                  掌握
                </div>
                <div className="text-xs text-slate-400 mt-1">1 周后</div>
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-4">
              基于 SM-2 简化版间隔重复算法
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
