"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Sparkles, FileText, BookOpen, ListChecks, CheckCircle2 } from "lucide-react"
import { planApi } from "@/lib/api"

/**
 * v2.2 流程节点：上传完成 → 此页（轮询后端） → 计划生成完毕 → /plan-confirm/[planId]
 *
 * 设计要点：
 *   - 用 4 个进度阶段的语言把"AI 在做什么"讲清楚，缓解干等焦虑
 *   - 紫色光晕呼吸 + 阶段进度条 + 当前阶段高亮
 *   - 真后端模式：每 1.5 秒调一次 /api/plan/{vaultId}/status，拿到 done 跳走
 *   - Mock 模式：vaultApi.upload 自动 8 秒后变 done，这里照常轮询即可
 */

interface StageItem {
  key: string
  label: string
  hint: string
  Icon: typeof FileText
}

const STAGES: StageItem[] = [
  {
    key: "parse",
    label: "解析资料",
    hint: "从 PDF/Word 提取纯文本，清洗格式",
    Icon: FileText,
  },
  {
    key: "extract",
    label: "提炼知识点",
    hint: "AI 识别核心概念、定义、方法",
    Icon: BookOpen,
  },
  {
    key: "plan",
    label: "生成学习计划",
    hint: "按目标天数拆解每日学习内容",
    Icon: ListChecks,
  },
  {
    key: "ready",
    label: "准备就绪",
    hint: "可以开始你的专属学习旅程",
    Icon: CheckCircle2,
  },
]

export default function LoadingPage() {
  const router = useRouter()
  const params = useParams<{ vaultId: string }>()
  const vaultId = params.vaultId

  const [stageIndex, setStageIndex] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 阶段动画：每 2.5 秒推进一阶段，但不会越过 ready，等待真实 done
  useEffect(() => {
    if (stageIndex >= STAGES.length - 1) return
    const t = setTimeout(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 2))
    }, 2500)
    return () => clearTimeout(t)
  }, [stageIndex])

  // 真实轮询
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const res = await planApi.status(vaultId)
        if (cancelled) return

        if (res.status === "done" && res.planId) {
          setStageIndex(STAGES.length - 1)
          // 给用户一点完成感后再跳
          setTimeout(() => {
            if (!cancelled) router.push(`/plan-confirm/${res.planId}`)
          }, 800)
          return
        }
        if (res.status === "failed") {
          setErrorMsg(res.errorMsg || "AI 生成失败，请重试")
          return
        }
      } catch (e) {
        // 容忍一次失败，下一次再试
      }
      timer = setTimeout(poll, 1500)
    }

    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [vaultId, router])

  const failed = !!errorMsg

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#37352f] flex flex-col">
      {/* 顶栏 */}
      <header className="border-b border-[#e9e9e8] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-[#6940a5] text-white flex items-center justify-center text-sm font-bold">
              S
            </div>
            <span className="font-semibold tracking-tight">StudyHere</span>
          </div>
          <span className="text-xs text-[#9b9a97]">Step 1 / 3 · AI 正在工作</span>
        </div>
      </header>

      {/* 主体 */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {/* 顶部呼吸光晕 + sparkle */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative">
              {/* 外圈呼吸光 */}
              <div className="absolute inset-0 size-24 rounded-full bg-[#6940a5] opacity-20 blur-2xl animate-pulse" />
              {/* 中圈 */}
              <div className="absolute inset-0 size-24 rounded-full bg-[#6940a5] opacity-10 blur-xl" />
              {/* 主标 */}
              <div className="relative size-24 rounded-2xl bg-gradient-to-br from-[#6940a5] to-[#8d62d6] flex items-center justify-center shadow-[0_8px_32px_rgba(105,64,165,0.3)]">
                <Sparkles className="size-10 text-white" strokeWidth={2} />
              </div>
            </div>

            <h1 className="mt-8 text-3xl md:text-4xl font-bold tracking-tight text-center">
              AI 正在为你定制学习计划
            </h1>
            <p className="mt-3 text-[#6b6f76] text-base text-center max-w-md">
              通常需要 5-15 秒。我们会自动解析你的资料、提炼核心知识点、按目标天数拆解每日内容。
            </p>
          </div>

          {/* 阶段进度 */}
          {!failed && (
            <div className="space-y-3">
              {STAGES.map((s, i) => {
                const isActive = i === stageIndex
                const isDone = i < stageIndex
                const Icon = s.Icon
                return (
                  <div
                    key={s.key}
                    className={[
                      "flex items-start gap-4 rounded-2xl border p-4 transition-all",
                      isActive
                        ? "border-[#6940a5] bg-white shadow-[0_4px_16px_rgba(105,64,165,0.08)]"
                        : isDone
                        ? "border-[#e9e9e8] bg-white opacity-60"
                        : "border-[#e9e9e8] bg-[#fafafa] opacity-40",
                    ].join(" ")}
                  >
                    {/* 左侧 icon */}
                    <div
                      className={[
                        "size-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                        isActive
                          ? "bg-[#6940a5] text-white"
                          : isDone
                          ? "bg-[#eaf5ec] text-[#2d7a45]"
                          : "bg-[#f1f1ef] text-[#9b9a97]",
                      ].join(" ")}
                    >
                      {isDone ? (
                        <CheckCircle2 className="size-5" />
                      ) : (
                        <Icon
                          className={isActive ? "size-5 animate-pulse" : "size-5"}
                        />
                      )}
                    </div>

                    {/* 文案 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[15px] text-[#37352f]">
                        {s.label}
                        {isActive && (
                          <span className="ml-2 inline-flex gap-0.5 align-baseline">
                            <span className="inline-block size-1 rounded-full bg-[#6940a5] animate-bounce [animation-delay:-0.3s]" />
                            <span className="inline-block size-1 rounded-full bg-[#6940a5] animate-bounce [animation-delay:-0.15s]" />
                            <span className="inline-block size-1 rounded-full bg-[#6940a5] animate-bounce" />
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#6b6f76] mt-0.5">{s.hint}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 失败态 */}
          {failed && (
            <div className="mt-6 rounded-2xl border border-[#fbeae9] bg-[#fdf3f3] p-6 text-center">
              <p className="text-[#c4332e] font-semibold mb-2">生成失败</p>
              <p className="text-sm text-[#6b6f76] mb-4">{errorMsg}</p>
              <button
                type="button"
                onClick={() => router.push("/home")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#37352f] text-white px-5 py-2.5 text-sm font-semibold hover:bg-black"
              >
                返回首页重试
              </button>
            </div>
          )}

          {/* 底部小字 */}
          <p className="mt-10 text-center text-xs text-[#9b9a97]">
            页面不要关闭，生成完成后会自动跳转
          </p>
        </div>
      </main>
    </div>
  )
}
