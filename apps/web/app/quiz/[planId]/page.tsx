"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Sparkles,
  Trophy,
} from "lucide-react"
import { questionApi } from "@/lib/api"
import type { Question, AnswerKey, AnswerResponse } from "@/lib/types"

interface AnswerRecord {
  questionId: string
  picked: AnswerKey
  result: AnswerResponse
}

export default function QuizPage() {
  const router = useRouter()
  const params = useParams<{ planId: string }>()
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<AnswerKey | null>(null)
  const [result, setResult] = useState<AnswerResponse | null>(null)
  const [records, setRecords] = useState<AnswerRecord[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    questionApi
      .list(params.planId)
      .then((res) => setQuestions(res.questions))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false))
  }, [params.planId, router])

  const question = questions[index]

  async function handleSubmit(option: AnswerKey) {
    if (picked || !question) return
    setPicked(option)
    setSubmitting(true)
    try {
      const res = await questionApi.answer(question.id, option)
      setResult(res)
      setRecords((prev) => [
        ...prev,
        { questionId: question.id, picked: option, result: res },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    if (index < questions.length - 1) {
      setIndex(index + 1)
      setPicked(null)
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
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <div className="text-[#787774] text-sm">{error || "暂无题目"}</div>
        <button onClick={() => router.back()} className="nt-btn-ghost">
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
      </main>
    )
  }

  if (finished) {
    const correctCount = records.filter((r) => r.result.isCorrect).length
    const accuracy = Math.round((correctCount / records.length) * 100)
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-[#fbfbfa]">
        <div className="nt-card p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#f4efff] flex items-center justify-center">
            <Trophy className="w-7 h-7 text-[#6940a5]" />
          </div>
          <h1 className="mt-6 text-[24px] font-bold text-[#37352f] tracking-tight">
            练习完成
          </h1>
          <div className="mt-8 flex items-baseline justify-center gap-2">
            <span className="text-[56px] font-bold text-[#37352f] tracking-tight leading-none">
              {accuracy}
            </span>
            <span className="text-[20px] font-semibold text-[#787774]">%</span>
          </div>
          <p className="mt-2 text-[14px] text-[#787774]">
            答对 {correctCount} / {records.length} 题
          </p>
          <p className="mt-4 text-[12px] text-[#9b9a97]">
            错题已自动归档至错题本，下次会再考你
          </p>
          <div className="mt-8 flex gap-2.5 justify-center">
            <button
              onClick={() => {
                setIndex(0)
                setPicked(null)
                setResult(null)
                setRecords([])
                setFinished(false)
              }}
              className="nt-btn-ai"
            >
              再练一遍
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

  const progress = ((index + 1) / questions.length) * 100

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
          <span className="text-[13px] text-[#9b9a97]">
            {index + 1} / {questions.length}
          </span>
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
          <span className="nt-tag">Day {question?.dayIndex}</span>
          <span className="nt-tag-ai">
            <Sparkles className="w-3 h-3" />
            AI 出题
          </span>
        </div>

        <h2 className="text-[20px] text-[#37352f] leading-[1.5] font-medium tracking-tight">
          {question?.content}
        </h2>

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
                onClick={() => handleSubmit(key)}
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

        {result && (
          <div
            className={`mt-7 rounded-lg border p-5 ${
              result.isCorrect
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-red-200 bg-red-50/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
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
            <div className="text-[11px] uppercase tracking-widest text-[#787774] font-semibold mb-1.5">
              AI 解析
            </div>
            <p className="text-[14px] text-[#37352f] leading-relaxed">
              {result.explanation}
            </p>
            <button onClick={handleNext} className="mt-5 nt-btn-primary">
              {index < questions.length - 1 ? "下一题" : "完成练习"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
