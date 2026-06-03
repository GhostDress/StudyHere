"use client"

/**
 * v2.3+ 计划合理性对话式校准（PlanAdvisor）· 右侧抽屉版
 *
 * 设计哲学：贴合 v2.3 信任链路的「对照阅读」原则。
 *   抽屉无遮罩，用户能边看左侧 plan 卡片边跟 AI 讨论；
 *   宽度可拖拽调节（右下角手柄），让用户按对照需求自定义；
 *   宽度记忆 localStorage，下次打开恢复用户的偏好布局。
 *
 * 第 8 个 AI 调用点（项目三简历叙事）：
 *   用户元问题 → AI 三层上下文 (原文摘要 + 当前 plan + 用户背景) →
 *   结构化 action JSON → 一键应用走 regenerate (仅重生 AI 建议的天，其余自动钉住)
 *   → 用户每次微调沉淀为偏好数据（SFT 样本来源）
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Check,
  CornerDownLeft,
  AlertCircle,
  GripVertical,
} from "lucide-react"
import { planApi } from "@/lib/api"
import type { PlanAdviceMessage, PlanAction } from "@/lib/types"

interface PlanAdvisorProps {
  planId: string
  totalDays: number
  /** 应用 action 后通知父组件刷新 plan */
  onPlanUpdated: () => void
}

const SAMPLE_QUESTIONS = [
  "这个计划漏了什么重点吗？",
  "Day 顺序合理吗？有没有应该提前的内容？",
  "我有一定基础，能不能跳过开头几天？",
]

const WIDTH_KEY = "plan_advisor_width"
const DEFAULT_WIDTH = 480
const MIN_WIDTH = 380
const MAX_WIDTH = 720

export default function PlanAdvisor({
  planId,
  totalDays,
  onPlanUpdated,
}: PlanAdvisorProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<PlanAdviceMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH)
  const [resizing, setResizing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 从 localStorage 恢复用户上次调到的宽度
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = parseInt(localStorage.getItem(WIDTH_KEY) || "", 10)
    if (Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= MAX_WIDTH) {
      setWidth(stored)
    }
  }, [])

  // 之前的实现给 body 加 padding-right 让 main 右缩，
  // 但这会把 max-w-5xl 的 3 列 grid 挤到 wrap，主面板视觉被推坏。
  // 改成不动 body —— 抽屉会盖在右侧 main 之上，用户用拖拽手柄按需调宽度对照。
  // 这样保证主面板视觉稳定，抽屉只是叠在上面的浮层。
  useEffect(() => {
    // 兼容旧版本残留：第一次升级时把上次写入的 padding 清掉
    if (typeof window === "undefined") return
    document.body.style.paddingRight = ""
    document.body.style.transition = ""
  }, [])

  // 自动滚到底
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [open, messages.length, sending])

  // 拖拽改宽
  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setResizing(true)
    const startX = e.clientX
    const startWidth = width
    const onMove = (ev: PointerEvent) => {
      // 抽屉在右侧，向左拖 = 加宽，向右拖 = 变窄
      const next = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, startWidth + (startX - ev.clientX)),
      )
      setWidth(next)
    }
    const onEnd = () => {
      setResizing(false)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onEnd)
      // 持久化用户偏好宽度
      const final = parseInt(
        document.documentElement.style.getPropertyValue("--advisor-w") ||
          String(width),
        10,
      )
      const safeFinal =
        Number.isFinite(final) && final > 0 ? final : width
      localStorage.setItem(WIDTH_KEY, String(safeFinal))
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onEnd)
  }, [width])

  // 持久化最终宽度
  useEffect(() => {
    if (!resizing && typeof window !== "undefined") {
      localStorage.setItem(WIDTH_KEY, String(width))
    }
  }, [width, resizing])

  async function send(question: string) {
    const q = question.trim()
    if (!q || sending) return
    setError(null)
    const now = Date.now()
    setMessages((prev) => [...prev, { role: "user", content: q, ts: now }])
    setInput("")
    setSending(true)
    try {
      const history = messages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }))
      const res = await planApi.advice(planId, { question: q, history })
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          action: res.action,
          ts: Date.now(),
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 暂时无法回答")
    } finally {
      setSending(false)
    }
  }

  async function applyAction(msgIdx: number, action: PlanAction) {
    if (applyingIdx !== null) return
    if (action.type !== "regenerate_days" && action.type !== "reorder") return
    setApplyingIdx(msgIdx)
    setError(null)
    try {
      let payload: { pinnedDays: number[]; dayOrder: number[] }
      if (action.type === "regenerate_days") {
        const allDays = Array.from({ length: totalDays }, (_, i) => i + 1)
        const pinned = allDays.filter((d) => !action.targetDays.includes(d))
        payload = { pinnedDays: pinned, dayOrder: [] }
      } else {
        const allDays = Array.from({ length: totalDays }, (_, i) => i + 1)
        payload = { pinnedDays: allDays, dayOrder: action.newOrder }
      }
      await planApi.regenerate(planId, payload)
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIdx ? { ...m, appliedAt: Date.now() } : m,
        ),
      )
      onPlanUpdated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "应用失败，请重试")
    } finally {
      setApplyingIdx(null)
    }
  }

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-[#6940a5] to-[#8d62d6] text-white px-3.5 py-2 text-[13px] font-medium shadow-[0_2px_8px_rgba(105,64,165,0.25)] hover:shadow-[0_4px_16px_rgba(105,64,165,0.35)] transition-shadow"
      >
        <Sparkles className="size-3.5" />
        跟 AI 聊聊这个计划
      </button>

      {/* 右侧抽屉（无遮罩，左侧卡片仍可见可点）*/}
      <aside
        className={`fixed top-0 right-0 z-40 h-screen bg-white border-l border-[#e9e9e8] shadow-[-8px_0_32px_rgba(0,0,0,0.08)] flex transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        } ${resizing ? "select-none" : ""}`}
        style={{ width: `${width}px` }}
        aria-hidden={!open}
      >
        {/* 左侧拖拽手柄（贴抽屉左边）*/}
        <div
          onPointerDown={onResizeStart}
          className={`group absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#6940a5]/20 ${
            resizing ? "bg-[#6940a5]/30" : ""
          }`}
          title="拖拽调整宽度"
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="size-4 text-[#6940a5]" />
          </div>
        </div>

        <div className="flex flex-col w-full pl-1.5">
          {/* 顶部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e9e9e8]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 rounded-lg bg-gradient-to-br from-[#6940a5] to-[#8d62d6] flex items-center justify-center flex-shrink-0">
                <Sparkles className="size-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[#37352f] truncate">
                  AI 计划校准师
                </div>
                <div className="text-[11px] text-[#9b9a97] truncate">
                  对照左侧卡片，跟 AI 调整计划
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="size-8 rounded-lg hover:bg-[#f4f4f3] flex items-center justify-center flex-shrink-0"
              aria-label="关闭"
            >
              <X className="size-4 text-[#9b9a97]" />
            </button>
          </div>

          {/* 消息流 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="size-12 rounded-2xl bg-[#f4efff] flex items-center justify-center mb-3">
                  <Sparkles className="size-5 text-[#6940a5]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[#37352f] mb-1">
                  问点你对这个计划的疑问
                </h3>
                <p className="text-[12px] text-[#6b6f76] max-w-xs mb-5">
                  AI 会比对原文判断「漏了什么」「顺序对吗」「能不能按你的基础调」，
                  给出可一键应用的修改建议。
                </p>
                <div className="space-y-1.5 w-full">
                  <div className="text-[11px] text-[#9b9a97] font-semibold mb-1 text-left">
                    试试这些问题：
                  </div>
                  {SAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={sending}
                      className="block w-full text-left rounded-lg border border-[#e9e9e8] hover:border-[#6940a5] hover:bg-[#fafafa] px-3 py-2 text-[13px] text-[#37352f] transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <AdviceMessage
                    key={i}
                    message={m}
                    onApply={() =>
                      m.action && applyAction(i, m.action)
                    }
                    applying={applyingIdx === i}
                  />
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-[13px] text-[#9b9a97] py-2">
                    <Loader2 className="size-4 animate-spin" />
                    AI 正在比对原文…
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 错误条 */}
          {error && (
            <div className="border-t border-[#fbeae9] bg-[#fdf3f3] px-4 py-2 text-[12px] text-[#c4332e]">
              {error}
            </div>
          )}

          {/* 输入框 */}
          <div className="border-t border-[#e9e9e8] p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="问 AI 对计划的疑问，Enter 发送"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none rounded-xl border border-[#e9e9e8] focus:border-[#6940a5] focus:outline-none px-3 py-2 text-[13px] disabled:bg-[#fafafa] max-h-32"
                style={{ minHeight: 40 }}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="size-10 rounded-xl bg-[#6940a5] text-white flex items-center justify-center hover:bg-[#5a3490] disabled:bg-[#c4c4c2] flex-shrink-0"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  )
}

// ============================================================
// 消息气泡 + Action 卡片
// ============================================================

interface AdviceMessageProps {
  message: PlanAdviceMessage
  onApply: () => void
  applying: boolean
}

function AdviceMessage({ message, onApply, applying }: AdviceMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-tr-sm bg-[#37352f] text-white px-3 py-2 max-w-[85%] text-[13px]">
          {message.content}
        </div>
      </div>
    )
  }

  const action = message.action
  const applied = !!message.appliedAt
  const canApply =
    action &&
    (action.type === "regenerate_days" || action.type === "reorder")

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-2 w-full">
        <div className="rounded-2xl rounded-tl-sm bg-[#f4f4f3] text-[#37352f] px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>

        {action && action.type !== "no_change" && (
          <div className="rounded-xl border border-[#6940a5]/20 bg-[#faf6ff] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6940a5] mb-1">
              <CornerDownLeft className="size-3" />
              {actionTitle(action)}
            </div>
            <div className="text-[12px] text-[#6b6f76] mb-2.5 leading-relaxed">
              {actionDescription(action)}
            </div>
            {canApply && !applied && (
              <button
                onClick={onApply}
                disabled={applying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#6940a5] text-white px-3 py-1.5 text-[12px] font-medium hover:bg-[#5a3490] disabled:bg-[#c4c4c2]"
              >
                {applying ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    应用中…
                  </>
                ) : (
                  <>
                    <Check className="size-3" />
                    一键应用这个建议
                  </>
                )}
              </button>
            )}
            {applied && (
              <div className="inline-flex items-center gap-1.5 text-[12px] text-[#2d7a45] font-medium">
                <Check className="size-3" />
                已应用，计划已更新
              </div>
            )}
            {action.type === "need_more_info" && (
              <div className="inline-flex items-center gap-1.5 text-[12px] text-[#9c5a14]">
                <AlertCircle className="size-3" />
                AI 需要更多信息才能给建议
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function actionTitle(action: PlanAction): string {
  switch (action.type) {
    case "regenerate_days":
      return `建议重生 Day ${action.targetDays.join(", ")}`
    case "reorder":
      return "建议调整顺序"
    case "need_more_info":
      return "AI 反问"
    default:
      return ""
  }
}

function actionDescription(action: PlanAction): string {
  switch (action.type) {
    case "regenerate_days":
      return action.reason
    case "reorder":
      return `${action.reason} · 新顺序：${action.newOrder.join(" → ")}`
    case "need_more_info":
      return action.question
    default:
      return ""
  }
}
