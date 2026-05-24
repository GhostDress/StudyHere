"use client"

import { useState } from "react"
import { Plus, Minus } from "lucide-react"
import { useFadeIn } from "@/lib/useFadeIn"
import { trackLandingEvent } from "@/lib/analytics"

const FAQS = [
  {
    q: "完全免费吗？什么时候开始收费？",
    a: "MVP 内测期完全免费，包括所有功能。我们会先验证产品价值，再考虑付费模式。如果未来上线订阅，老用户会获得首月免费 + 终身优惠。",
  },
  {
    q: "我上传的资料安全吗？AI 会用我的数据训练吗？",
    a: "你的资料加密存储（行业标准 AES-256），仅用于生成你自己的学习内容，绝不会用于训练任何 AI 模型。你可以随时一键删除账户及所有数据，符合 GDPR / PIPL 合规要求。",
  },
  {
    q: "支持哪些资料格式？有大小限制吗？",
    a: "MVP 阶段支持 PDF 和 Word（.docx）。单个文件最大 10MB / 30 页（约 1-2 万字）。1.0 版本会扩展支持 Markdown、扫描版 PDF（OCR）、网页链接、PPT 等。",
  },
  {
    q: "AI 生成的内容质量怎么样？会不会胡说？",
    a: "我们使用 GPT-4o / Claude 等顶级模型，所有 prompt 经过反向约束设计（明确告诉 AI 不要编造材料里没有的主题）。MVP 阶段我们承诺：AI 出题质量人工评估通过率 ≥ 90%。发现质量问题可一键反馈，我们当周修复。",
  },
  {
    q: "和 ChatGPT、NotebookLM、Anki 比，最大区别是什么？",
    a: "ChatGPT 是助手，问什么答什么但不跟踪你；NotebookLM 帮你「读懂」资料但不「训练」你；Anki 强迫你手动制卡。StudyHere 是唯一把「学—练—考—纠」做成自动闭环的产品。",
  },
  {
    q: "我没有自己的资料，能用吗？",
    a: "能。我们提供 5 份精选示范资料（产品入门、Python 基础、PMP 备考、商务英语、财务入门），任意选择就能完整体验闭环。后续也会持续扩充示范库。",
  },
]

export default function LandingFaq() {
  const { ref, visible } = useFadeIn()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function handleToggle(index: number, question: string) {
    const willOpen = openIndex !== index
    setOpenIndex(willOpen ? index : null)
    if (willOpen) {
      trackLandingEvent("landing_faq_expand", { index, question })
    }
  }

  return (
    <section
      id="faq"
      ref={ref}
      className={`py-32 md:py-40 px-6 bg-white transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="max-w-2xl">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#9b9a97] font-semibold">
            常见问题
          </div>
          <h2 className="mt-5 text-[44px] md:text-[56px] font-bold text-[#37352f] tracking-[-0.03em] leading-[1.05]">
            还有疑问？
          </h2>
        </div>

        <div className="mt-16 border-t border-[#37352f]">
          {FAQS.map((item, i) => {
            const open = openIndex === i
            return (
              <div
                key={i}
                className="border-b border-[#e9e9e8]"
              >
                <button
                  onClick={() => handleToggle(i, item.q)}
                  className="w-full py-6 flex items-center justify-between gap-6 text-left group"
                >
                  <span className="text-[16px] font-medium text-[#37352f] group-hover:text-[#6940a5] transition-colors">
                    {item.q}
                  </span>
                  {open ? (
                    <Minus className="w-4 h-4 text-[#37352f] flex-shrink-0" strokeWidth={2.5} />
                  ) : (
                    <Plus className="w-4 h-4 text-[#9b9a97] flex-shrink-0 group-hover:text-[#37352f] transition-colors" strokeWidth={2.5} />
                  )}
                </button>
                <div
                  className={`grid transition-all duration-200 ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-6 text-[15px] text-[#787774] leading-[1.8] max-w-2xl">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
