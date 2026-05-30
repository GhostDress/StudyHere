"use client"

/**
 * v2.3 · AI 对话 Tab（RAG）
 *
 * 位置：/plan/[id] 第 6 个 Tab「问 AI」
 *
 * 设计：
 *   - 简洁聊天 UI：消息流 + 底部输入框
 *   - AI 答案下方挂溯源面板（点 chunk 卡片 → 打开 PdfDrawer 跳页）
 *   - 未命中（notFound）显示橙色提示卡，告诉用户"资料里没找到"
 *   - 状态本地，不入后端（本期 stateless 多轮对话）
 *   - 大段历史滚动加载（暂不做分页，超 50 条提示用户清空）
 */

import { useEffect, useRef, useState } from "react"
import { Send, Loader2, Sparkles, FileText, Trash2, AlertCircle } from "lucide-react"
import { chatApi, vaultApi } from "@/lib/api"
import type { ChatMessage, ChatSource } from "@/lib/types"
import { usePdfDrawer } from "@/components/PdfDrawer"

const SAMPLE_QUESTIONS = [
  "这份资料的核心论点是什么？",
  "帮我用一句话总结",
  "这里面最重要的 3 个概念是什么？",
]

export default function ChatTab({ vaultId }: { vaultId: string }) {
  const { open: openPdf } = usePdfDrawer()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 拉 vault 拿 fileUrl 给 PdfDrawer 用
  useEffect(() => {
    let cancelled = false
    vaultApi
      .get(vaultId)
      .then((res) => {
        if (!cancelled) setFileUrl(res.vault.fileUrl)
      })
      .catch(() => {
        // 拉不到不致命，溯源卡片就降级显示"资料不可访问"
      })
    return () => {
      cancelled = true
    }
  }, [vaultId])

  // 消息追加时自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages.length])

  async function send(question: string) {
    const q = question.trim()
    if (!q || sending) return
    setError(null)
    const now = Date.now()
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q, ts: now },
    ])
    setInput("")
    setSending(true)
    try {
      const res = await chatApi.ask(vaultId, q)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          sources: res.sources,
          notFound: res.notFound,
          ts: Date.now(),
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 暂时无法回答")
    } finally {
      setSending(false)
    }
  }

  function openSource(s: ChatSource) {
    if (!fileUrl) return
    openPdf({ fileUrl, page: s.pageStart })
  }

  function clearAll() {
    if (messages.length === 0) return
    if (confirm("清空当前对话？")) setMessages([])
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[480px] rounded-2xl border border-[#e9e9e8] bg-white">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-[#e9e9e8] px-5 py-3">
        <div className="flex items-center gap-2 text-[14px]">
          <Sparkles className="size-4 text-[#6940a5]" />
          <span className="font-semibold">问 AI</span>
          <span className="text-[12px] text-[#9b9a97]">
            · 答案严格基于你上传的资料，会标注页码
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-[12px] text-[#9b9a97] hover:text-[#37352f]"
          >
            <Trash2 className="size-3.5" />
            清空
          </button>
        )}
      </div>

      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="size-14 rounded-2xl bg-[#f4efff] flex items-center justify-center mb-4">
              <Sparkles className="size-6 text-[#6940a5]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#37352f] mb-1">
              基于你的资料问 AI
            </h3>
            <p className="text-[13px] text-[#6b6f76] max-w-md mb-6">
              AI 只会根据你上传的资料作答，每个答案都会附原文页码。
              资料里没说的内容会明确告诉你"没找到"，不胡编。
            </p>
            <div className="space-y-2 w-full max-w-sm">
              <div className="text-[11px] text-[#9b9a97] font-semibold mb-1.5">
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
              <MessageBubble key={i} message={m} onSourceClick={openSource} hasFile={!!fileUrl} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-[13px] text-[#9b9a97] py-2">
                <Loader2 className="size-4 animate-spin" />
                AI 正在查阅原文…
              </div>
            )}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="border-t border-[#fbeae9] bg-[#fdf3f3] px-5 py-2 text-[12px] text-[#c4332e]">
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
            placeholder="问点啥…（Enter 发送，Shift+Enter 换行）"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-[#e9e9e8] focus:border-[#6940a5] focus:outline-none px-3 py-2 text-[14px] disabled:bg-[#fafafa] disabled:text-[#9b9a97] max-h-32"
            style={{ minHeight: 40 }}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="size-10 rounded-xl bg-[#6940a5] text-white flex items-center justify-center hover:bg-[#5a3490] disabled:bg-[#c4c4c2] disabled:cursor-not-allowed"
            aria-label="发送"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>
        <div className="mt-1.5 text-[11px] text-[#9b9a97] text-right">
          {input.length}/500
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Message Bubble
// ============================================================

interface MessageBubbleProps {
  message: ChatMessage
  onSourceClick: (source: ChatSource) => void
  hasFile: boolean
}

function MessageBubble({ message, onSourceClick, hasFile }: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-tr-sm bg-[#37352f] text-white px-3.5 py-2 max-w-[80%] text-[14px]">
          {message.content}
        </div>
      </div>
    )
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
            message.notFound
              ? "bg-[#fff4e5] text-[#9c5a14] border border-[#f5d9a9]"
              : "bg-[#f4f4f3] text-[#37352f]"
          }`}
        >
          {message.notFound && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-1 opacity-80">
              <AlertCircle className="size-3.5" />
              资料里没找到
            </div>
          )}
          {message.content}
        </div>

        {/* 溯源面板 */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pl-1">
            <div className="text-[11px] text-[#9b9a97] font-semibold mb-1.5">
              📖 引用了 {message.sources.length} 段原文
            </div>
            <div className="space-y-1.5">
              {message.sources.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => onSourceClick(s)}
                  disabled={!hasFile}
                  className="block w-full text-left rounded-lg border border-[#e9e9e8] hover:border-[#6940a5] hover:bg-[#fafafa] px-3 py-2 transition-colors group disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6940a5]">
                      <span>
                        #{i + 1} · P{s.pageStart}
                        {s.pageEnd > s.pageStart ? `-${s.pageEnd}` : ""}
                      </span>
                      <span className="text-[#9b9a97]">·</span>
                      <span className="text-[#9b9a97]">
                        相关度 {Math.round(s.similarity * 100)}%
                      </span>
                    </div>
                    {hasFile && (
                      <FileText className="size-3 text-[#c4c4c2] group-hover:text-[#6940a5]" />
                    )}
                  </div>
                  <div className="text-[12px] text-[#6b6f76] line-clamp-2">
                    {s.text}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
