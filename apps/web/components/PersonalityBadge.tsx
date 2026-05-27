"use client"

import { GraduationCap, Briefcase, Palette, Dumbbell } from "lucide-react"
import type { Personality } from "@/lib/mockContentEngine"

const META: Record<
  Personality,
  { label: string; tagline: string; Icon: typeof GraduationCap; color: string; bg: string; border: string }
> = {
  student: {
    label: "学生党",
    tagline: "耐心举例",
    Icon: GraduationCap,
    color: "#1a5cd0",
    bg: "#eef4ff",
    border: "#cdddff",
  },
  cert: {
    label: "考证型",
    tagline: "直击考点",
    Icon: Briefcase,
    color: "#6940a5",
    bg: "#f4efff",
    border: "#dccffb",
  },
  explorer: {
    label: "兴趣探索",
    tagline: "跨学科联想",
    Icon: Palette,
    color: "#c25a14",
    bg: "#fff3e9",
    border: "#fbd9b8",
  },
  strict: {
    label: "严苛教练",
    tagline: "苏格拉底式",
    Icon: Dumbbell,
    color: "#b8281f",
    bg: "#fbeae9",
    border: "#f4c7c2",
  },
}

interface Props {
  personality?: Personality | null
  size?: "sm" | "md"
}

/**
 * 在闪卡 / 答题 / 错题 等学习页右上角显示一个徽章，
 * 让用户始终能看到当前的 AI 助教风格。
 *
 * 解决问题：v2.2 之前选了人格但学习时完全感知不到。
 */
export default function PersonalityBadge({ personality, size = "md" }: Props) {
  const p = personality && META[personality] ? personality : "student"
  const m = META[p]
  const Icon = m.Icon

  const pad = size === "sm" ? "px-2 py-1" : "px-2.5 py-1.5"
  const iconSize = size === "sm" ? "size-3.5" : "size-4"
  const labelSize = size === "sm" ? "text-[11px]" : "text-[12px]"

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full ${pad} border`}
      style={{ background: m.bg, borderColor: m.border, color: m.color }}
    >
      <Icon className={iconSize} strokeWidth={2.2} />
      <span className={`${labelSize} font-semibold`}>{m.label}</span>
      {size !== "sm" && (
        <span className="text-[11px] opacity-70">· {m.tagline}</span>
      )}
    </div>
  )
}

/**
 * 从 localStorage 读取某个 vault 的人格
 */
export function getStoredPersonality(vaultId: string | undefined): Personality {
  if (typeof window === "undefined" || !vaultId) return "student"
  try {
    const stored = JSON.parse(localStorage.getItem("vault_personalities") || "{}")
    return (stored[vaultId] as Personality) || "student"
  } catch {
    return "student"
  }
}
