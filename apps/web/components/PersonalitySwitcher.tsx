"use client"

import { useEffect, useState } from "react"
import {
  GraduationCap,
  Briefcase,
  Palette,
  Dumbbell,
  CheckCircle2,
  X,
  ChevronDown,
} from "lucide-react"
import type { AgentPersonality } from "@/lib/types"
import {
  ALL_PERSONALITIES,
  getActivePersonality,
  setActivePersonality,
  getAllSandboxSummaries,
  type SandboxSummary,
} from "@/lib/sandboxStore"

// 元数据
const META: Record<
  AgentPersonality,
  {
    label: string
    tagline: string
    Icon: typeof GraduationCap
    color: string
    bg: string
    border: string
    theory: string
    citation: string
  }
> = {
  student: {
    label: "学生党",
    tagline: "耐心举例",
    Icon: GraduationCap,
    color: "#1a5cd0",
    bg: "#eef4ff",
    border: "#cdddff",
    theory: "认知负荷理论",
    citation: "Sweller, 1988",
  },
  cert: {
    label: "考证型",
    tagline: "直击考点",
    Icon: Briefcase,
    color: "#6940a5",
    bg: "#f4efff",
    border: "#dccffb",
    theory: "检索练习",
    citation: "Roediger & Karpicke, 2006",
  },
  explorer: {
    label: "兴趣探索",
    tagline: "跨学科联想",
    Icon: Palette,
    color: "#c25a14",
    bg: "#fff3e9",
    border: "#fbd9b8",
    theory: "远距离迁移",
    citation: "Gick & Holyoak, 1980",
  },
  strict: {
    label: "严苛教练",
    tagline: "苏格拉底式",
    Icon: Dumbbell,
    color: "#b8281f",
    bg: "#fbeae9",
    border: "#f4c7c2",
    theory: "生成效应",
    citation: "Slamecka & Graf, 1978",
  },
}

interface SwitcherProps {
  vaultId: string
  /**
   * 切换成功后回调（用于刷新页面数据）
   * 不传则刷新整个 window（兜底）
   */
  onSwitched?: (newPersonality: AgentPersonality) => void
}

/**
 * 顶部人格徽章 + 切换弹层
 *
 * 用法：
 *   <PersonalitySwitcher vaultId={vaultId} onSwitched={(p) => refetch()} />
 *
 * 视觉：
 *   - 默认显示一个小徽章，右侧带 ⌄
 *   - 点击徽章 → 弹层显示 4 张人格卡（含已学数据）
 *   - 点新卡 → 二次确认弹层
 *   - 确认 → 切换 + 关闭 + 回调
 */
export default function PersonalitySwitcher({ vaultId, onSwitched }: SwitcherProps) {
  const [open, setOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<AgentPersonality | null>(null)
  const [current, setCurrent] = useState<AgentPersonality>("student")
  const [summaries, setSummaries] = useState<SandboxSummary[]>([])

  useEffect(() => {
    function refresh() {
      const cur = getActivePersonality(vaultId) || "student"
      setCurrent(cur)
      setSummaries(getAllSandboxSummaries(vaultId))
    }
    refresh()
    function onChange(e: Event) {
      const detail = (e as CustomEvent).detail as { vaultId: string }
      if (detail.vaultId === vaultId) refresh()
    }
    window.addEventListener("vault-personality-change", onChange)
    return () => window.removeEventListener("vault-personality-change", onChange)
  }, [vaultId])

  const curMeta = META[current]
  const CurIcon = curMeta.Icon

  function handleCardClick(p: AgentPersonality) {
    if (p === current) {
      setOpen(false)
      return
    }
    setConfirmTarget(p)
  }

  function handleConfirmSwitch() {
    if (!confirmTarget) return
    setActivePersonality(vaultId, confirmTarget)
    onSwitched?.(confirmTarget)
    setConfirmTarget(null)
    setOpen(false)
  }

  return (
    <>
      {/* 当前徽章（可点） */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 border transition-all hover:scale-105"
        style={{
          background: curMeta.bg,
          borderColor: curMeta.border,
          color: curMeta.color,
        }}
      >
        <CurIcon className="size-4" strokeWidth={2.2} />
        <span className="text-[12px] font-semibold">{curMeta.label}</span>
        <ChevronDown className="size-3.5 opacity-70" />
      </button>

      {/* 切换弹层 · 选择 */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">切换 AI 助教</h2>
                <p className="text-sm text-[#6b6f76] mt-1">
                  每种风格独立记录进度，可对比找出最适合你的学习方式
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#9b9a97] hover:text-[#37352f] p-1"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* 4 张人格卡 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ALL_PERSONALITIES.map((p) => {
                const m = META[p]
                const Icon = m.Icon
                const isActive = p === current
                const sum = summaries.find((s) => s.personality === p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleCardClick(p)}
                    className={[
                      "text-left rounded-xl border p-4 transition-all relative",
                      isActive
                        ? "border-2"
                        : "border hover:shadow-md hover:-translate-y-0.5",
                    ].join(" ")}
                    style={{
                      borderColor: isActive ? m.color : "#e9e9e8",
                      background: isActive ? m.bg : "#ffffff",
                    }}
                  >
                    {isActive && (
                      <div
                        className="absolute top-3 right-3 text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: m.color, color: "#fff" }}
                      >
                        当前
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div
                        className="size-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: m.color, color: "#fff" }}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[15px] text-[#37352f]">
                          {m.label}
                        </div>
                        <div
                          className="text-[12px] font-semibold mt-0.5"
                          style={{ color: m.color }}
                        >
                          {m.tagline}
                        </div>
                      </div>
                    </div>

                    {/* v2.2.1：学习机制小字 */}
                    <div className="mt-2 text-[11px] text-[#9b9a97]">
                      🎯 {m.theory} <span className="italic">· {m.citation}</span>
                    </div>

                    {/* 已学数据 */}
                    <div className="mt-3 pt-3 border-t flex items-center gap-3 text-[12px] text-[#6b6f76]" style={{ borderColor: isActive ? m.border : "#f1f1ef" }}>
                      <span>已学闪卡 <strong className="text-[#37352f]">{sum?.flashcardCount ?? 0}</strong></span>
                      <span>·</span>
                      <span>已答 <strong className="text-[#37352f]">{sum?.answeredCount ?? 0}</strong></span>
                      <span>·</span>
                      <span>错题 <strong className="text-[#c4332e]">{sum?.wrongCount ?? 0}</strong></span>
                    </div>
                  </button>
                )
              })}
            </div>

            <p className="mt-5 text-[12px] text-[#9b9a97] text-center">
              切换后题库会按新人格风格重新生成，原人格的进度完整保留可随时切回
            </p>
          </div>
        </div>
      )}

      {/* 二次确认弹层 */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              {(() => {
                const m = META[confirmTarget]
                const Icon = m.Icon
                return (
                  <div
                    className="size-10 rounded-lg flex items-center justify-center"
                    style={{ background: m.color, color: "#fff" }}
                  >
                    <Icon className="size-5" />
                  </div>
                )
              })()}
              <div>
                <div className="font-bold text-[16px]">
                  切换到「{META[confirmTarget].label}」？
                </div>
                <div className="text-[12px] text-[#6b6f76] mt-0.5">
                  {META[confirmTarget].tagline}
                </div>
              </div>
            </div>

            <div className="text-sm text-[#37352f] space-y-1.5 mb-5 bg-[#fbfbfa] rounded-lg p-3">
              <p>• 进入「{META[confirmTarget].label}」的独立学习沙箱</p>
              <p>• 题库会按新风格重新生成（约 1-2 秒）</p>
              <p>• 「{META[current].label}」的进度完整保留，随时可切回</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-xl border border-[#e9e9e8] bg-white text-[#37352f] px-4 py-2.5 text-sm font-medium hover:bg-[#fafafa]"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="flex-1 rounded-xl bg-[#37352f] text-white px-4 py-2.5 text-sm font-semibold hover:bg-black"
              >
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
