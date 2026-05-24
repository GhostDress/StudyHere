"use client"

import { useEffect, useRef } from "react"
import { Eye, ArrowRight, Check, X } from "lucide-react"
import { useFadeIn } from "@/lib/useFadeIn"
import { trackLandingEvent } from "@/lib/analytics"

export default function LandingFeatures() {
  const { ref, visible } = useFadeIn()
  const trackedRef = useRef<Set<string>>(new Set())
  const featureRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute("data-feature-key")
            if (key && !trackedRef.current.has(key)) {
              trackedRef.current.add(key)
              trackLandingEvent("landing_feature_scroll", { feature: key })
            }
          }
        })
      },
      { threshold: 0.5 },
    )
    featureRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="features"
      ref={ref}
      className={`py-32 md:py-40 px-6 bg-[#fbfbfa] transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#9b9a97] font-semibold">
            四个核心能力
          </div>
          <h2 className="mt-5 text-[44px] md:text-[56px] font-bold text-[#37352f] tracking-[-0.03em] leading-[1.05]">
            学—练—考—纠，
            <br />
            一个闭环。
          </h2>
          <p className="mt-6 text-[17px] text-[#787774] leading-[1.7]">
            NotebookLM 只做了"读"，Quizlet 只做了"卡"。
            真正的学习闭环，需要四件事一起跑。
          </p>
        </div>

        {/* —— 学：大画面叙事，左字右大卡片 —— */}
        <div
          ref={(el) => {
            featureRefs.current[0] = el
          }}
          data-feature-key="study"
          className="mt-28 grid grid-cols-1 md:grid-cols-12 gap-12 items-center"
        >
          <div className="md:col-span-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#6940a5] font-bold">
              01 · 学
            </div>
            <h3 className="mt-3 text-[32px] font-bold text-[#37352f] tracking-[-0.02em] leading-[1.15]">
              主动回忆训练，
              <br />
              比被动重读高 10 倍效率。
            </h3>
            <p className="mt-5 text-[15px] text-[#787774] leading-[1.7]">
              AI 把核心概念提炼为问答闪卡。先想 → 再翻面 → 自评掌握度。
              你回忆的瞬间，记忆才真正发生。
            </p>
          </div>

          <div className="md:col-span-7">
            <div className="bg-white rounded-2xl border border-[#e9e9e8] p-10 shadow-sm">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#6940a5] font-bold">
                问题
              </div>
              <p className="mt-4 text-[20px] font-medium text-[#37352f] leading-[1.5] tracking-tight">
                监督学习和无监督学习的核心区别是什么？
              </p>
              <button className="mt-8 inline-flex items-center gap-2 text-[13px] text-[#787774] hover:text-[#37352f] transition-colors">
                <Eye className="w-4 h-4" />
                翻面看答案
              </button>
            </div>
          </div>
        </div>

        {/* —— 练：极简全宽分隔条 + 数据条 —— */}
        <div
          ref={(el) => {
            featureRefs.current[1] = el
          }}
          data-feature-key="practice"
          className="mt-32 border-t border-[#e9e9e8] pt-20"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#37352f] font-bold">
                02 · 练
              </div>
              <h3 className="mt-3 text-[32px] font-bold text-[#37352f] tracking-[-0.02em] leading-[1.15]">
                AI 出题，
                <br />
                不是死记硬背。
              </h3>
              <p className="mt-5 text-[15px] text-[#787774] leading-[1.7]">
                干扰项有「看起来对但有明确错误」。
                每道错题即时显示 AI 解析，告诉你为什么错。
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="bg-white rounded-lg p-4 border border-[#e9e9e8] flex items-center gap-3">
                <span className="w-7 h-7 rounded bg-[#37352f] text-white text-[12px] font-bold flex items-center justify-center">
                  A
                </span>
                <span className="text-[14px] text-[#37352f] flex-1">
                  计算最大公约数
                </span>
                <X className="w-4 h-4 text-[#9b9a97]" />
              </div>
              <div className="bg-white rounded-lg p-4 border border-[#37352f] flex items-center gap-3">
                <span className="w-7 h-7 rounded bg-[#37352f] text-white text-[12px] font-bold flex items-center justify-center">
                  B
                </span>
                <span className="text-[14px] text-[#37352f] flex-1 font-medium">
                  识别手写邮政编码
                </span>
                <Check className="w-4 h-4 text-[#37352f]" strokeWidth={2.5} />
              </div>
              <div className="bg-white rounded-lg p-4 border border-[#e9e9e8] flex items-center gap-3 opacity-50">
                <span className="w-7 h-7 rounded bg-[#f1f1ef] text-[#9b9a97] text-[12px] font-bold flex items-center justify-center">
                  C
                </span>
                <span className="text-[14px] text-[#787774] flex-1">
                  计算贷款利息
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* —— 考：超大数字震撼，反向不对称 —— */}
        <div
          ref={(el) => {
            featureRefs.current[2] = el
          }}
          data-feature-key="exam"
          className="mt-32 border-t border-[#e9e9e8] pt-20"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-7 order-2 md:order-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#37352f] font-bold">
                阶段测验 · Day 7
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-[120px] md:text-[160px] font-bold text-[#37352f] leading-none tracking-[-0.06em]">
                  82
                </span>
                <span className="text-[40px] text-[#787774] font-light">%</span>
              </div>
              <p className="text-[13px] text-[#9b9a97] mt-2">
                答对 14 / 17 道 · 用时 21 分钟
              </p>
              <div className="mt-8 pt-6 border-t border-[#e9e9e8] max-w-xs">
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#9b9a97] font-semibold">
                  薄弱知识点
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded bg-[#37352f] text-white text-[12px] font-medium">
                    特征工程
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[#37352f] text-white text-[12px] font-medium">
                    正则化
                  </span>
                </div>
              </div>
            </div>
            <div className="md:col-span-5 order-1 md:order-2">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#37352f] font-bold">
                03 · 考
              </div>
              <h3 className="mt-3 text-[32px] font-bold text-[#37352f] tracking-[-0.02em] leading-[1.15]">
                阶段测验，
                <br />
                跨知识点综合。
              </h3>
              <p className="mt-5 text-[15px] text-[#787774] leading-[1.7]">
                每 5/7/10 天自动触发，15-20 道综合题。
                检测真实掌握度，给出薄弱点报告。
              </p>
            </div>
          </div>
        </div>

        {/* —— 纠：列表式 + 数字标记 —— */}
        <div
          ref={(el) => {
            featureRefs.current[3] = el
          }}
          data-feature-key="wrong"
          className="mt-32 border-t border-[#e9e9e8] pt-20"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#37352f] font-bold">
                04 · 纠
              </div>
              <h3 className="mt-3 text-[32px] font-bold text-[#37352f] tracking-[-0.02em] leading-[1.15]">
                错题不让你忘。
              </h3>
              <p className="mt-5 text-[15px] text-[#787774] leading-[1.7]">
                答错的题自动归类，按知识点分组。
                重做答对自动移除，3 天后还会再考你一次。
              </p>
            </div>

            <div className="space-y-px bg-[#e9e9e8] rounded-xl overflow-hidden border border-[#e9e9e8]">
              {[
                { topic: "监督学习的本质", count: 3 },
                { topic: "ROC 曲线含义", count: 2 },
                { topic: "过拟合诊断", count: 2 },
                { topic: "正则化方法", count: 1 },
              ].map((w, i) => (
                <div
                  key={w.topic}
                  className="bg-white px-5 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[12px] font-mono text-[#9b9a97] w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[14px] text-[#37352f]">
                      {w.topic}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[#787774]">
                      错过 {w.count} 次
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#9b9a97]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
