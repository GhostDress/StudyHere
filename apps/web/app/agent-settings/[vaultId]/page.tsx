"use client"

import { useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { setActivePersonality } from "@/lib/sandboxStore"
import {
  GraduationCap,
  Briefcase,
  Palette,
  Dumbbell,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"

// 与后端 apps/api/src/prompts/personalities.ts 保持一致
type Personality = "student" | "cert" | "explorer" | "strict"

interface PersonalityCard {
  id: Personality
  label: string
  tagline: string
  description: string
  // v2.2.1：每个人格对应的真实教育学理论（用户做选择时看到一次）
  theory: string
  citation: string
  Icon: typeof GraduationCap
  // Tailwind 颜色类（运行时不能拼接，必须写全）
  accent: string
  accentSoft: string
  iconBg: string
  iconText: string
  borderActive: string
  ringActive: string
}

const CARDS: PersonalityCard[] = [
  {
    id: "student",
    label: "学生党",
    tagline: "耐心举例，把每个概念讲到你懂",
    description:
      "假设你是高中或大学初学者，用最朴素的例子和最常见的语言。适合考前突击、知识入门。",
    theory: "认知负荷理论 + 渐进披露",
    citation: "Sweller, 1988",
    Icon: GraduationCap,
    accent: "text-[#1a5cd0]",
    accentSoft: "bg-[#eef4ff]",
    iconBg: "bg-[#1a5cd0]",
    iconText: "text-white",
    borderActive: "border-[#1a5cd0]",
    ringActive: "ring-[#1a5cd0]/15",
  },
  {
    id: "cert",
    label: "考证型",
    tagline: "直击考点，告诉你怎么记",
    description:
      "PMP / CFA / 法考 / 一建等证书复习场景。突出高频考点、命题套路、记忆口诀。",
    theory: "检索练习 + 间隔重复",
    citation: "Roediger & Karpicke, 2006",
    Icon: Briefcase,
    accent: "text-[#6940a5]",
    accentSoft: "bg-[#f4efff]",
    iconBg: "bg-[#6940a5]",
    iconText: "text-white",
    borderActive: "border-[#6940a5]",
    ringActive: "ring-[#6940a5]/15",
  },
  {
    id: "explorer",
    label: "兴趣探索",
    tagline: "跨学科联想，启发你思考",
    description:
      "用类比、迁移、思想实验把概念拓展到其他领域。适合工作者好奇心驱动的学习。",
    theory: "远距离迁移 + 类比推理",
    citation: "Gick & Holyoak, 1980",
    Icon: Palette,
    accent: "text-[#c25a14]",
    accentSoft: "bg-[#fff3e9]",
    iconBg: "bg-[#c25a14]",
    iconText: "text-white",
    borderActive: "border-[#c25a14]",
    ringActive: "ring-[#c25a14]/15",
  },
  {
    id: "strict",
    label: "严苛教练",
    tagline: "不容混过，挑战式提问",
    description:
      "苏格拉底式提问，不直接给答案。适合已有基础、想深度内化、面试备战的高阶学习者。",
    theory: "生成效应 + 苏格拉底式提问",
    citation: "Slamecka & Graf, 1978",
    Icon: Dumbbell,
    accent: "text-[#b8281f]",
    accentSoft: "bg-[#fbeae9]",
    iconBg: "bg-[#b8281f]",
    iconText: "text-white",
    borderActive: "border-[#b8281f]",
    ringActive: "ring-[#b8281f]/15",
  },
]

export default function AgentSettingsPage() {
  const router = useRouter()
  const params = useParams<{ vaultId: string }>()
  const searchParams = useSearchParams()
  const vaultId = params.vaultId
  const planId = searchParams.get("planId") // 从计划确认页带过来

  const [selected, setSelected] = useState<Personality | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      // v2.2.1：用 sandboxStore 统一管理，触发同标签页 'vault-personality-change' 事件
      setActivePersonality(vaultId, selected)

      // 跳转到学习计划页
      const target = planId ? `/plan/${planId}` : `/plan/${vaultId}`
      router.push(target)
    } catch (err) {
      setError("保存失败，请重试")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#37352f]">
      {/* 顶栏 */}
      <header className="border-b border-[#e9e9e8] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-[#6940a5] text-white flex items-center justify-center text-sm font-bold">
              S
            </div>
            <span className="font-semibold tracking-tight">StudyHere</span>
          </div>
          <span className="text-xs text-[#9b9a97]">Step 3 / 3 · 选择智能体</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
        {/* 标题区 */}
        <div className="mb-10 md:mb-14">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            选择你的 AI 助教风格
          </h1>
          <p className="mt-3 text-[#6b6f76] text-base max-w-2xl">
            这会影响后续所有 AI 输出的语气与教学方式。
            <span className="text-[#6940a5] font-semibold">可在学习中随时切换</span>
            ——每种风格独立记录进度，可对比找出最适合自己的学习方式。
          </p>
        </div>

        {/* 4 张卡片 · 2x2 网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {CARDS.map((card) => {
            const isActive = selected === card.id
            const Icon = card.Icon
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelected(card.id)}
                className={[
                  "group relative text-left rounded-2xl border bg-white transition-all",
                  "p-6 md:p-7",
                  "hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:-translate-y-0.5",
                  isActive
                    ? `${card.borderActive} ring-4 ${card.ringActive} shadow-[0_8px_24px_rgba(0,0,0,0.05)]`
                    : "border-[#e9e9e8]",
                ].join(" ")}
              >
                {/* 选中态 角标 */}
                {isActive && (
                  <div className={`absolute top-4 right-4 ${card.accent}`}>
                    <CheckCircle2 className="size-6" strokeWidth={2.5} />
                  </div>
                )}

                {/* 顶部 Icon */}
                <div
                  className={`size-14 rounded-xl ${card.iconBg} ${card.iconText} flex items-center justify-center mb-5`}
                >
                  <Icon className="size-7" strokeWidth={2} />
                </div>

                {/* 标题 + 一句话 */}
                <div className="mb-3">
                  <h3 className="text-xl font-bold text-[#37352f]">{card.label}</h3>
                  <p className={`text-sm mt-1 font-medium ${card.accent}`}>
                    {card.tagline}
                  </p>
                </div>

                {/* 描述 */}
                <p className="text-sm text-[#6b6f76] leading-relaxed">
                  {card.description}
                </p>

                {/* v2.2.1：学习机制 · 真实教育学理论依据 */}
                <div className="mt-4 pt-3 border-t border-current/10 text-[12px] text-[#9b9a97]">
                  <div>
                    🎯 教学法：
                    <span className={`font-semibold ${card.accent}`}>
                      {card.theory}
                    </span>
                  </div>
                  <div className="mt-0.5 italic">— {card.citation}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* 底部确认栏 */}
        <div className="mt-10 md:mt-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-sm text-[#9b9a97]">
            {selected ? (
              <>
                你选择的风格：
                <span className="font-semibold text-[#37352f] ml-1">
                  {CARDS.find((c) => c.id === selected)?.label}
                </span>
              </>
            ) : (
              "请从上方 4 张卡片中选择一种"
            )}
          </div>

          <button
            type="button"
            disabled={!selected || submitting}
            onClick={handleConfirm}
            className={[
              "inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all",
              selected && !submitting
                ? "bg-[#37352f] text-white hover:bg-black"
                : "bg-[#e9e9e8] text-[#9b9a97] cursor-not-allowed",
            ].join(" ")}
          >
            {submitting ? "保存中..." : "确认并开始学习"}
            <ArrowRight className="size-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 text-sm text-[#c4332e] bg-[#fbeae9] px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 底部说明 */}
        <div className="mt-12 text-xs text-[#9b9a97] border-t border-[#e9e9e8] pt-6">
          💡 为什么强制选择？每种风格的 AI Prompt 工程不同，闪卡、题目、讲解都会按对应风格生成。先选一种开始学习，
          之后在学习计划页可以随时切换 —— 每种风格的进度独立保存，互不干扰，方便你对比哪种最适合自己。
        </div>
      </main>
    </div>
  )
}
