"use client"

import { Check, Minus } from "lucide-react"
import { useFadeIn } from "@/lib/useFadeIn"

type Cell = "yes" | "no" | "partial"

const COMPARE_DATA: {
  feature: string
  studyhere: Cell
  chatgpt: Cell
  anki: Cell
  notebooklm: Cell
}[] = [
  { feature: "上传资料生成计划", studyhere: "yes", chatgpt: "partial", anki: "no", notebooklm: "no" },
  { feature: "AI 生成闪卡 / 题目", studyhere: "yes", chatgpt: "partial", anki: "no", notebooklm: "partial" },
  { feature: "主动回忆 + 间隔重复", studyhere: "yes", chatgpt: "no", anki: "yes", notebooklm: "no" },
  { feature: "阶段测验 + 掌握度反算", studyhere: "yes", chatgpt: "no", anki: "no", notebooklm: "no" },
  { feature: "错题本自动归档", studyhere: "yes", chatgpt: "no", anki: "partial", notebooklm: "no" },
  { feature: "进度追踪 + 智能下一步", studyhere: "yes", chatgpt: "no", anki: "no", notebooklm: "no" },
  { feature: "中文资料优化", studyhere: "yes", chatgpt: "yes", anki: "yes", notebooklm: "partial" },
]

function CellMark({ value, highlight = false }: { value: Cell; highlight?: boolean }) {
  if (value === "yes")
    return (
      <Check
        className={`w-4 h-4 mx-auto ${highlight ? "text-[#37352f]" : "text-[#37352f]"}`}
        strokeWidth={2.5}
      />
    )
  if (value === "partial")
    return <Minus className="w-4 h-4 text-[#9b9a97] mx-auto" strokeWidth={2.5} />
  return <span className="text-[#d4d4d2] text-[18px] block">·</span>
}

export default function LandingCompare() {
  const { ref, visible } = useFadeIn()

  return (
    <section
      id="compare"
      ref={ref}
      className={`py-32 md:py-40 px-6 bg-[#fbfbfa] transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#9b9a97] font-semibold">
            产品对比
          </div>
          <h2 className="mt-5 text-[44px] md:text-[56px] font-bold text-[#37352f] tracking-[-0.03em] leading-[1.05]">
            和其他工具，
            <br />
            差在哪里？
          </h2>
          <p className="mt-6 text-[17px] text-[#787774] leading-[1.7]">
            不是要替代它们——是把它们各自做一半的事，串成一个完整闭环。
          </p>
        </div>

        <div className="mt-20 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[#37352f]">
                <th className="text-left pb-4 text-[12px] uppercase tracking-[0.15em] text-[#9b9a97] font-semibold w-2/5">
                  能力
                </th>
                <th className="pb-4 px-4 text-center">
                  <span className="text-[14px] font-bold text-[#37352f]">
                    StudyHere
                  </span>
                </th>
                <th className="pb-4 px-4 text-center text-[14px] font-medium text-[#787774]">
                  ChatGPT
                </th>
                <th className="pb-4 px-4 text-center text-[14px] font-medium text-[#787774]">
                  Anki
                </th>
                <th className="pb-4 px-4 text-center text-[14px] font-medium text-[#787774]">
                  NotebookLM
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_DATA.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-[#e9e9e8] hover:bg-white transition-colors"
                >
                  <td className="py-5 text-[14px] text-[#37352f]">
                    {row.feature}
                  </td>
                  <td className="py-5 px-4 text-center">
                    <CellMark value={row.studyhere} highlight />
                  </td>
                  <td className="py-5 px-4 text-center">
                    <CellMark value={row.chatgpt} />
                  </td>
                  <td className="py-5 px-4 text-center">
                    <CellMark value={row.anki} />
                  </td>
                  <td className="py-5 px-4 text-center">
                    <CellMark value={row.notebooklm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex items-center gap-6 text-[12px] text-[#9b9a97]">
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#37352f]" strokeWidth={2.5} />
            完整支持
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
            部分支持
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#d4d4d2] text-[16px]">·</span>
            不支持
          </span>
        </div>
      </div>
    </section>
  )
}
