"use client"

import { useEffect, useState } from "react"
import {
  BookOpen,
  Lightbulb,
  AlertTriangle,
  Brain,
  GitBranch,
  Sparkles,
  HelpCircle,
  Flame,
  Target,
  FlaskConical,
  ChevronDown,
} from "lucide-react"
import type { FlashcardCard } from "@/lib/mockContentEngine"

interface Props {
  card: FlashcardCard
  /** 用于来源溯源展示 */
  dayIndex?: number
}

/**
 * v2.2.1 · 闪卡答案卡片
 *
 * 按 personality 渲染 4 种不同的版式：
 *   - student: 定义 + 举栗子 + 提示
 *   - cert:    定义 + 高频徽章 + 命题陷阱 + 记忆口诀
 *   - explorer: 定义 + 跨界类比 + 反事实
 *   - strict:  定义 + 3 个递进反问（编号、独立）
 *
 * 底部统一带「学习机制」脚注，引用真实教育学理论。
 */
const CREDIBILITY_GUIDE_KEY = "studyhere_credibility_guide_seen"

export default function FlashcardAnswerCard({ card, dayIndex }: Props) {
  const { personality, answer, theory, credibility } = card
  // v2.2.1：可信度区默认折叠
  const [showCredibility, setShowCredibility] = useState(false)
  // 手风琴模式：严苛教练反问只能同时展开一个
  const [activeSocratic, setActiveSocratic] = useState<number | null>(null)
  // 卡切换时，手风琴 + 可信度区状态重置
  useEffect(() => {
    setActiveSocratic(null)
    setShowCredibility(false)
  }, [card.question])
  // v2.2.1：首次使用导引（看过一次后不再显示）
  const [showGuide, setShowGuide] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem(CREDIBILITY_GUIDE_KEY)) {
      setShowGuide(true)
    }
  }, [])
  function dismissGuide() {
    setShowGuide(false)
    if (typeof window !== "undefined") {
      localStorage.setItem(CREDIBILITY_GUIDE_KEY, "1")
    }
  }
  function handleToggleCredibility() {
    setShowCredibility(!showCredibility)
    if (!showCredibility && showGuide) dismissGuide()
  }

  return (
    <div className="w-full">
      {/* 1. 参考定义 —— 核心，裸文字大字号，不被卡片框框住 */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-3">
          <BookOpen className="size-3.5 text-[#1a5cd0]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1a5cd0]">
            参考定义
          </span>
        </div>
        <p className="text-[20px] leading-[1.6] text-[#37352f] font-medium">
          {answer.definition}
        </p>
      </div>

      {/* 1.5 结构化对比表（如果有） */}
      {answer.comparisonTable && (
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#37352f] mb-2">
            📊 {answer.comparisonTable.title}
          </div>
          <div className="rounded-lg border border-[#e9e9e8] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#fbfbfa] border-b border-[#e9e9e8]">
                  {answer.comparisonTable.columns.map((c, i) => (
                    <th
                      key={i}
                      className="text-left px-3 py-2 font-semibold text-[#37352f]"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {answer.comparisonTable.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 1 ? "bg-[#fbfbfa]" : "bg-white"}
                  >
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-3 py-2 text-[#37352f] border-t border-[#f1f1ef]"
                      >
                        {j === 0 ? (
                          <span className="font-semibold">{cell}</span>
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分割线 + 延伸标签 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-[#e9e9e8]" />
        <span className="text-[10px] uppercase tracking-widest text-[#9b9a97] font-semibold">
          延伸
        </span>
        <div className="h-px flex-1 bg-[#e9e9e8]" />
      </div>

      {/* 2. 按人格渲染特色区块 —— 降级为辅助内容 */}
      {personality === "student" && (
        <>
          {answer.example && (
            <Section Icon={Lightbulb} label="举个栗子" color="#c25a14" bg="#fff3e9">
              <p className="text-[14px] leading-relaxed text-[#37352f]">
                {answer.example}
              </p>
            </Section>
          )}
          {answer.hint && (
            <Section Icon={Sparkles} label="学习提示" color="#1a5cd0" bg="#eef4ff" subtle>
              <p className="text-[13px] leading-relaxed text-[#6b6f76]">
                {answer.hint}
              </p>
            </Section>
          )}
        </>
      )}

      {personality === "cert" && (
        <>
          {answer.examFrequency && (
            <FrequencyBadge frequency={answer.examFrequency} />
          )}
          {answer.examTrap && (
            <Section Icon={AlertTriangle} label="命题陷阱" color="#c4332e" bg="#fdf3f3">
              <p className="text-[14px] leading-relaxed text-[#37352f]">
                {answer.examTrap}
              </p>
            </Section>
          )}
          {answer.mnemonic && (
            <Section Icon={Brain} label="记忆口诀" color="#6940a5" bg="#f4efff">
              <p className="text-[14px] leading-relaxed text-[#37352f]">
                {answer.mnemonic}
              </p>
            </Section>
          )}
        </>
      )}

      {personality === "explorer" && (
        <>
          {answer.crossDomain && (
            <Section Icon={GitBranch} label="跨学科类比" color="#c25a14" bg="#fff3e9">
              <p className="text-[14px] leading-relaxed text-[#37352f]">
                {answer.crossDomain}
              </p>
            </Section>
          )}
          {answer.counterfactual && (
            <CollapsibleSection
              Icon={FlaskConical}
              label="反事实追问"
              color="#6940a5"
              hint="想象极端场景"
            >
              <p className="text-[14px] leading-relaxed text-[#37352f]">
                {answer.counterfactual}
              </p>
            </CollapsibleSection>
          )}
        </>
      )}

      {personality === "strict" &&
        answer.socraticQuestions &&
        answer.socraticQuestions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-3">
              <HelpCircle className="size-4 text-[#b8281f]" />
              <span className="text-[13px] font-semibold text-[#b8281f]">
                进一步追问 · 请先独立思考，再点击查看教练引导
              </span>
            </div>
            <div className="space-y-2.5">
              {answer.socraticQuestions.map((q, i) => {
                const dialogue = answer.socraticDialogues?.[i]
                const isOpen = activeSocratic === i
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-[#fbeae9] bg-[#fdf3f3] overflow-hidden"
                  >
                    <div className="flex gap-3 p-3.5">
                      <div className="size-6 rounded-full bg-[#b8281f] text-white flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <p className="text-[14.5px] leading-relaxed text-[#37352f] flex-1 pt-0.5">
                        {q}
                      </p>
                    </div>
                    {dialogue && (
                      <>
                        <button
                          onClick={() =>
                            setActiveSocratic(isOpen ? null : i)
                          }
                          className="w-full text-left px-3.5 py-2 border-t border-[#fbeae9] flex items-center justify-between text-[12px] text-[#b8281f] font-semibold hover:bg-[#fbeae9]/40"
                        >
                          <span>
                            {isOpen ? "🔼 收起" : "💡 思考完毕？听听教练怎么说"}
                          </span>
                          <ChevronDown
                            className={`size-4 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-3.5 py-4 bg-white border-t border-[#fbeae9]">
                            {/* 教练对话气泡 */}
                            <div className="flex items-start gap-2.5">
                              <div className="size-8 rounded-full bg-[#b8281f] text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                                💪
                              </div>
                              <div className="flex-1 space-y-1.5">
                                <div className="text-[11px] font-semibold text-[#b8281f]">
                                  严苛教练
                                </div>
                                {dialogue.bubbles.map((bubble, bi) => (
                                  <div
                                    key={bi}
                                    className="rounded-2xl rounded-tl-sm bg-[#fbeae9] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#37352f]"
                                  >
                                    {bubble}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {/* v2.2.1 终版：可信度 = 真实溯源对象（用户资料 / 权威引用 / AI 综合）*/}
      {credibility && (
        <div className="mt-6 pt-4 border-t border-[#e9e9e8]">
          {/* 始终可见的来源徽章——明确告诉用户这段内容的可信度等级 */}
          <SourceBadgeRow credibility={credibility} />

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleToggleCredibility}
              className={[
                "flex items-center gap-1.5 text-[12px] font-semibold transition-colors",
                showGuide && !showCredibility
                  ? "text-[#6940a5] bg-[#f4efff] px-2 py-1 rounded-md"
                  : "text-[#6940a5] hover:underline",
              ].join(" ")}
            >
              <span>
                📖 {showCredibility ? "收起溯源" : "查看溯源详情"}
              </span>
              <ChevronDown
                className={`size-3.5 transition-transform ${
                  showCredibility ? "rotate-180" : ""
                }`}
              />
            </button>
            {showGuide && !showCredibility && (
              <span className="text-[11px] text-[#6940a5] inline-flex items-center gap-1">
                <span className="text-[14px]">←</span>
                <span>点击查看原文 / 权威引用</span>
              </span>
            )}
          </div>

          {showCredibility && (
            <div className="mt-4">
              <SourceDetail credibility={credibility} dayIndex={dayIndex} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ 子组件：始终可见的来源徽章 ============

function SourceBadgeRow({
  credibility,
}: {
  credibility: NonNullable<FlashcardCard["credibility"]>
}) {
  const map = {
    "user-doc": {
      label: "✓ 来自你的资料",
      color: "#2d7a45",
      bg: "#eaf5ec",
      tip: "已核验 · 最高可信",
    },
    authority: {
      label: "📚 权威引用",
      color: "#1a5cd0",
      bg: "#eef4ff",
      tip: "可点击跳转查证",
    },
    "ai-synthesis": {
      label: "🤖 AI 综合",
      color: "#a36b00",
      bg: "#fef5d6",
      tip: "无直接原文 · 请审慎",
    },
  } as const
  const m = map[credibility.sourceType]
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
        style={{ background: m.bg, color: m.color }}
      >
        {m.label}
      </span>
      <span className="text-[11px] text-[#9b9a97]">{m.tip}</span>
    </div>
  )
}

// ============ 子组件：溯源详情区（按来源类型分发渲染） ============

function SourceDetail({
  credibility,
  dayIndex,
}: {
  credibility: NonNullable<FlashcardCard["credibility"]>
  dayIndex?: number
}) {
  // 类型 1：用户资料
  if (credibility.sourceType === "user-doc" && credibility.userDocSource) {
    const s = credibility.userDocSource
    return (
      <div>
        <div className="rounded-lg border-l-4 border-[#2d7a45] bg-[#eaf5ec]/40 p-4">
          <p className="text-[14px] leading-relaxed text-[#37352f]">
            {s.quote}
          </p>
          <div className="mt-3 pt-3 border-t border-[#2d7a45]/15 flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-[12px] text-[#6b6f76]">
              📖 {s.docName} · {s.location}
              {dayIndex && <> · Day {dayIndex}</>}
            </span>
            <a
              href={s.previewUrl || "#"}
              className="text-[11px] text-[#2d7a45] font-semibold hover:underline"
              onClick={(e) => {
                e.preventDefault()
                alert(
                  "v2.3 RAG 接入后：跳转到资料预览页，高亮该段落\n（mock 期暂不实现）",
                )
              }}
            >
              👁️ 在原文档中查看 →
            </a>
          </div>
        </div>
        <p className="text-[10px] text-[#9b9a97] italic mt-2">
          v2.2.1 mock：原文为示意数据 · v2.3 接 RAG 后真实从你的资料抽取
        </p>
      </div>
    )
  }

  // 类型 2：权威引用
  if (credibility.sourceType === "authority" && credibility.authoritySource) {
    const s = credibility.authoritySource
    return (
      <div>
        <div className="rounded-lg border-l-4 border-[#1a5cd0] bg-[#eef4ff]/40 p-4">
          {s.quote && (
            <p className="text-[14px] leading-relaxed text-[#37352f] italic mb-3">
              「{s.quote}」
            </p>
          )}
          <div className="space-y-1 text-[13px] text-[#37352f]">
            <div>
              <span className="font-semibold">{s.title}</span>
              <span className="text-[#6b6f76] ml-2">— {s.author}, {s.year}</span>
            </div>
            {s.chapter && (
              <div className="text-[12px] text-[#6b6f76]">{s.chapter}</div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-[#1a5cd0]/15">
            <a
              href={s.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-[#1a5cd0] font-semibold hover:underline"
            >
              🔗 查看原书页面 / 权威词条 →
            </a>
          </div>
        </div>
      </div>
    )
  }

  // 类型 3：AI 综合（无直接原文支撑）
  if (credibility.sourceType === "ai-synthesis" && credibility.aiSynthesis) {
    const s = credibility.aiSynthesis
    return (
      <div>
        <div className="rounded-lg border-l-4 border-[#a36b00] bg-[#fef5d6]/40 p-4">
          <p className="text-[13px] leading-relaxed text-[#37352f]">
            ⚠️ {s.note}
          </p>
          {s.suggestedReadings && s.suggestedReadings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#a36b00]/15">
              <div className="text-[11px] font-semibold text-[#a36b00] mb-1.5">
                建议延伸阅读：
              </div>
              <ul className="text-[12px] space-y-1">
                {s.suggestedReadings.map((r, i) => (
                  <li key={i}>
                    <span className="text-[#37352f] font-semibold">{r.title}</span>
                    <span className="text-[#6b6f76] ml-1">— {r.author}</span>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1a5cd0] hover:underline ml-2"
                      >
                        🔗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <p className="text-[10px] text-[#9b9a97] italic mt-2">
          AI 综合内容可信度低于原文引用，建议结合权威资料核实
        </p>
      </div>
    )
  }

  return null
}

// ============ 子组件 ============

function Section({
  Icon,
  label,
  color,
  bg,
  subtle,
  children,
}: {
  Icon: typeof BookOpen
  label: string
  color: string
  bg: string
  subtle?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="first:mt-0 mt-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="size-4" style={{ color }} />
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
      </div>
      <div
        className={[
          "rounded-xl p-4",
          subtle ? "" : "border",
        ].join(" ")}
        style={{
          background: subtle ? "transparent" : bg,
          borderColor: subtle ? "transparent" : `${color}30`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// 可折叠的 Section（默认折叠）
function CollapsibleSection({
  Icon,
  label,
  color,
  hint,
  children,
}: {
  Icon: typeof BookOpen
  label: string
  color: string
  hint?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="first:mt-0 mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border hover:bg-[#fafafa] transition-colors"
        style={{ borderColor: `${color}30` }}
      >
        <span className="flex items-center gap-1.5">
          <Icon className="size-3.5" style={{ color }} />
          <span
            className="text-[12px] font-semibold uppercase tracking-wider"
            style={{ color }}
          >
            {label}
          </span>
          {hint && !open && (
            <span className="text-[11px] text-[#9b9a97] ml-1.5">{hint}</span>
          )}
        </span>
        <ChevronDown
          className={`size-4 transition-transform`}
          style={{
            color,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open && <div className="mt-2 px-3 py-3 rounded-lg bg-[#fbfbfa]">{children}</div>}
    </div>
  )
}

function FrequencyBadge({ frequency }: { frequency: "high" | "mid" | "low" }) {
  const map = {
    high: { label: "🔥 高频考点", color: "#c4332e", bg: "#fdf3f3", desc: "近 3 年出现 8+ 次，必拿分" },
    mid: { label: "中频考点", color: "#c25a14", bg: "#fff3e9", desc: "近 3 年出现 3-7 次" },
    low: { label: "低频考点", color: "#6b6f76", bg: "#f1f1ef", desc: "偶尔考察，了解即可" },
  }[frequency]

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Flame className="size-4" style={{ color: map.color }} />
        <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: map.color }}>
          考点频次
        </span>
      </div>
      <div
        className="rounded-xl p-4 border flex items-center justify-between"
        style={{ background: map.bg, borderColor: `${map.color}30` }}
      >
        <span className="text-[15px] font-bold" style={{ color: map.color }}>
          {map.label}
        </span>
        <span className="text-[12px]" style={{ color: map.color, opacity: 0.7 }}>
          {map.desc}
        </span>
      </div>
    </div>
  )
}
