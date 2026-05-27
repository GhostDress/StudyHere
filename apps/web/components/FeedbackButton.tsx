"use client"

import { useEffect, useState } from "react"
import { Flag, X, Check } from "lucide-react"
import {
  reportFeedback,
  clearFeedback,
  getFeedback,
  FEEDBACK_TAG_LABELS,
  type FeedbackTag,
} from "@/lib/sandboxStore"
import type { AgentPersonality } from "@/lib/types"

interface FeedbackButtonProps {
  vaultId: string
  personality: AgentPersonality
  itemId: string
  itemType: "flashcard" | "question"
}

export default function FeedbackButton({
  vaultId,
  personality,
  itemId,
  itemType,
}: FeedbackButtonProps) {
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState<FeedbackTag | null>(null)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [existing, setExisting] = useState<ReturnType<typeof getFeedback>>(
    undefined,
  )

  useEffect(() => {
    if (!vaultId) return
    setExisting(getFeedback(vaultId, personality, itemId))
  }, [vaultId, personality, itemId, submitted])

  if (!vaultId) return null

  // 已报错状态：橙色按钮 + 可点击撤销
  if (existing && !open) {
    return (
      <button
        onClick={() => {
          if (
            confirm(
              `已报告：${FEEDBACK_TAG_LABELS[existing.tag]}\n撤销这次反馈？`,
            )
          ) {
            clearFeedback(vaultId, personality, itemId)
            setSubmitted((s) => !s) // 触发 re-fetch
          }
        }}
        className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-200 transition"
        title={`已报告：${FEEDBACK_TAG_LABELS[existing.tag]}（点击撤销）`}
      >
        <Check className="w-3 h-3" />
        已反馈
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-[#787774] hover:text-[#6940a5] hover:bg-[#f4f3f0] px-2 py-1 rounded-md transition"
        title="对这条提炼有疑问"
      >
        <Flag className="w-3 h-3" />
        我觉得这点有问题
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-[90%] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-[#37352f]">
                  报告问题
                </h3>
                <p className="text-[12px] text-[#787774] mt-0.5">
                  你的反馈会帮助 AI 改进同类提炼
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#9b9a97] hover:text-[#37352f]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-[12px] text-[#787774] font-semibold">
                问题类型（选一个）
              </p>
              {(Object.keys(FEEDBACK_TAG_LABELS) as FeedbackTag[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-[13px] transition ${
                    tag === t
                      ? "border-[#6940a5] bg-[#f4f0fb] text-[#6940a5] font-semibold"
                      : "border-[#e9e9e8] hover:bg-[#fbfbfa]"
                  }`}
                >
                  {FEEDBACK_TAG_LABELS[t]}
                  <span className="text-[11px] text-[#9b9a97] ml-2">
                    {t === "wording" && "· 表述不清晰或不准确"}
                    {t === "off_topic" && "· 跟原文意思不符"}
                    {t === "redundant" && "· 跟其他点重复了"}
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-[12px] text-[#787774] font-semibold block mb-1.5">
                想说点什么？（可选 · 最多 60 字）
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 60))}
                placeholder="例：这条跟第 3 条意思重复了..."
                className="w-full px-3 py-2 text-[13px] border border-[#e9e9e8] rounded-lg focus:outline-none focus:border-[#6940a5] resize-none"
                rows={2}
              />
              <p className="text-[10px] text-[#9b9a97] text-right mt-0.5">
                {comment.length} / 60
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-[13px] text-[#787774] hover:text-[#37352f]"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!tag) return
                  reportFeedback(
                    vaultId,
                    personality,
                    itemId,
                    itemType,
                    tag,
                    comment,
                  )
                  setOpen(false)
                  setTag(null)
                  setComment("")
                  setSubmitted((s) => !s)
                }}
                disabled={!tag}
                className={`px-4 py-1.5 text-[13px] rounded-lg font-semibold transition ${
                  tag
                    ? "bg-[#6940a5] text-white hover:bg-[#5a3690]"
                    : "bg-[#e9e9e8] text-[#9b9a97] cursor-not-allowed"
                }`}
              >
                提交反馈
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
