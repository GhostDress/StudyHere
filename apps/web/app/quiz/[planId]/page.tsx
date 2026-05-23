"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
      <main className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
        加载中...
      </main>
    )
  }

  if (error || questions.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3">
        <div className="text-slate-500">{error || "暂无题目"}</div>
        <button onClick={() => router.back()} className="text-sm text-indigo-600">
          ← 返回
        </button>
      </main>
    )
  }

  if (finished) {
    const correctCount = records.filter((r) => r.result.isCorrect).length
    const accuracy = Math.round((correctCount / records.length) * 100)
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-emerald-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-10 max-w-md text-center">
          <div className="text-6xl mb-4">
            {accuracy >= 80 ? "🏆" : accuracy >= 60 ? "👍" : "💪"}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">练习完成</h1>
          <div className="mt-4 text-5xl font-bold text-indigo-600">
            {accuracy}%
          </div>
          <p className="mt-2 text-slate-500">
            答对 {correctCount} / {records.length} 题
          </p>
          <p className="mt-4 text-sm text-slate-400">
            错题已自动加入错题本，下次会再考你
          </p>
          <div className="flex gap-3 mt-6 justify-center">
            <button
              onClick={() => {
                setIndex(0)
                setPicked(null)
                setResult(null)
                setRecords([])
                setFinished(false)
              }}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
            >
              再练一遍
            </button>
            <button
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium"
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
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-900 text-sm"
          >
            ← 退出练习
          </button>
          <div className="text-sm text-slate-600">
            {index + 1} / {questions.length}
          </div>
        </div>
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="text-xs text-slate-400 mb-3">
          Day {question?.dayIndex} · 选择题
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8">
          <p className="text-lg text-slate-900 leading-relaxed">
            {question?.content}
          </p>

          <div className="mt-6 space-y-3">
            {(["A", "B", "C", "D"] as AnswerKey[]).map((key) => {
              const isPicked = picked === key
              const isCorrect = result && key === result.correctAnswer
              const isWrong = result && isPicked && !result.isCorrect

              let styles = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
              if (result) {
                if (isCorrect)
                  styles = "border-emerald-400 bg-emerald-50"
                else if (isWrong)
                  styles = "border-red-400 bg-red-50"
                else styles = "border-slate-200 opacity-60"
              } else if (isPicked) {
                styles = "border-indigo-400 bg-indigo-50"
              }

              return (
                <button
                  key={key}
                  onClick={() => handleSubmit(key)}
                  disabled={!!picked || submitting}
                  className={`w-full text-left p-4 rounded-xl border-2 transition flex items-start gap-4 ${styles} ${
                    !picked ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                    {key}
                  </div>
                  <div className="text-slate-900 flex-1 pt-1">
                    {question?.options[key]}
                  </div>
                  {isCorrect && (
                    <span className="text-emerald-600 font-bold flex-shrink-0">
                      ✓
                    </span>
                  )}
                  {isWrong && (
                    <span className="text-red-600 font-bold flex-shrink-0">
                      ✗
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {result && (
          <div
            className={`mt-6 rounded-2xl border p-6 ${
              result.isCorrect
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">
                {result.isCorrect ? "✅" : "❌"}
              </span>
              <span
                className={`font-semibold ${
                  result.isCorrect ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {result.isCorrect
                  ? "答对了"
                  : `答错了，正确答案是 ${result.correctAnswer}`}
              </span>
            </div>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
              AI 解析
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {result.explanation}
            </p>
            <button
              onClick={handleNext}
              className="mt-5 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
            >
              {index < questions.length - 1 ? "下一题 →" : "完成练习"}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
