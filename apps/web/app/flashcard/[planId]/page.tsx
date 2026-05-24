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
    } catch {}
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
        <button onClick={() => router.back()} className="nt-btn-ghost">
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      </main>
    )
  }

  if (finished) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-[#fbfbfa]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#f4efff] flex items-center justify-center">
            <PartyPopper className="w-7 h-7 text-[#6940a5]" />
          </div>
          <h1 className="mt-6 text-[28px] font-bold text-[#37352f] tracking-tight">
            复习完成
          </h1>
          <p className="mt-2 text-[14px] text-[#787774]">
            今天已复习 {cards.length} 张闪卡。按 SM-2 算法，未掌握的卡片会在合适的时间再次出现。
          </p>
          <div className="mt-8 flex gap-2.5 justify-center">
            <button
              onClick={() => router.push(`/quiz/${params.planId}`)}
              className="nt-btn-ai"
            >
              <Pencil className="w-4 h-4" />
              继续答题
            </button>
            <button
              onClick={() => router.back()}
              className="nt-btn-ghost border border-[#e9e9e8]"
            >
              返回计划
            </button>
          </div>
        </div>
      </main>
    )
  }

  const progress = ((index + 1) / cards.length) * 100

  return (
    <main className="min-h-screen bg-[#fbfbfa]">
      <nav className="border-b border-[#e9e9e8] bg-white">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[13px] text-[#787774] hover:text-[#37352f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            退出
          </button>
          <div className="flex items-center gap-2 text-[13px]">
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

        <div
          onClick={() => !revealed && setRevealed(true)}
          className={`nt-card p-12 min-h-[320px] flex flex-col items-center justify-center text-center ${
            !revealed
              ? "cursor-pointer hover:border-[#37352f] hover:shadow-[0_4px_16px_rgba(15,15,15,0.06)] transition-all duration-200"
              : ""
          }`}
        >
          {!revealed ? (
            <>
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
            </>
          ) : (
            <>
              <div className="text-[11px] uppercase tracking-widest text-[#2d7a45] font-semibold mb-6">
                答案
              </div>
              <p className="text-[17px] text-[#37352f] leading-[1.7] max-w-xl">
                {card?.back}
              </p>
            </>
          )}
        </div>

        {revealed && (
          <div className="mt-10">
            <p className="text-center text-[13px] text-[#787774] mb-4">
              诚实评估掌握程度
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => handleMastery(0)}
                className="group nt-card p-5 hover:border-red-300 hover:bg-red-50/50 transition-all duration-200"
              >
                <div className="text-[14px] font-semibold text-[#37352f]">
                  完全不会
                </div>
                <div className="text-[12px] text-[#9b9a97] mt-1">明天再来</div>
              </button>
              <button
                onClick={() => handleMastery(3)}
                className="group nt-card p-5 hover:border-amber-300 hover:bg-amber-50/50 transition-all duration-200"
              >
                <div className="text-[14px] font-semibold text-[#37352f]">
                  模糊
                </div>
                <div className="text-[12px] text-[#9b9a97] mt-1">3 天后</div>
              </button>
              <button
                onClick={() => handleMastery(5)}
                className="group nt-card p-5 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all duration-200"
              >
                <div className="text-[14px] font-semibold text-[#37352f]">
                  掌握
                </div>
                <div className="text-[12px] text-[#9b9a97] mt-1">1 周后</div>
              </button>
            </div>
            <p className="text-center text-[11px] text-[#9b9a97] mt-4">
              基于 SM-2 简化版间隔重复算法
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
