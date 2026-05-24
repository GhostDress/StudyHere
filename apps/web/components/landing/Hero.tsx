"use client"

import { useRouter } from "next/navigation"
import { ArrowRight, Sparkles, Layers, Pencil } from "lucide-react"
import { trackLandingEvent } from "@/lib/analytics"

export default function LandingHero() {
  const router = useRouter()

  function goRegister() {
    trackLandingEvent("landing_cta_click", { position: "hero" })
    router.push("/login")
  }

  return (
    <section className="relative pt-40 pb-32 overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h1 className="text-[64px] md:text-[88px] font-bold text-[#37352f] leading-[1.02] tracking-[-0.04em]">
          帮你掌握
          <br />
          任何知识和技能
        </h1>

        <p className="mt-8 text-[17px] md:text-[19px] text-[#787774] max-w-xl mx-auto leading-[1.6]">
          上传一份资料，AI 自动拆解出学习计划、闪卡和题目。
          学—练—考—纠，一站完成。
        </p>

        <div className="mt-12">
          <button
            onClick={goRegister}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-[#37352f] text-white text-[15px] font-medium hover:bg-[#1a1a1a] transition-colors"
          >
            立即免费体验
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-5 text-[12px] text-[#9b9a97]">
          无需信用卡 · MVP 完全免费
        </p>

        <div className="mt-24 relative">
          <div
            className="absolute -inset-x-8 -top-8 -bottom-12 -z-10 rounded-3xl"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(105,64,165,0.08), transparent)",
            }}
          />

          <div className="rounded-xl overflow-hidden border border-[#e9e9e8] bg-white shadow-2xl shadow-[#37352f]/[0.08] text-left max-w-3xl mx-auto">
            <div className="px-4 py-2.5 border-b border-[#e9e9e8] bg-[#fbfbfa] flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[12px] text-[#9b9a97] font-mono">
                studyhere.app
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5">
              <div className="md:col-span-3 p-8 border-r border-[#e9e9e8]">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6940a5]">
                  <Sparkles className="w-3 h-3" />
                  AI 生成 · 基于你的资料
                </div>
                <h3 className="mt-3 text-[22px] font-bold text-[#37352f] tracking-tight">
                  机器学习入门 · 7 天计划
                </h3>

                <div className="mt-6 space-y-1.5">
                  {[
                    { day: 1, title: "机器学习概述", done: true },
                    { day: 2, title: "监督学习", done: true },
                    { day: 3, title: "无监督学习", done: false, current: true },
                    { day: 4, title: "评估指标", done: false },
                    { day: 5, title: "过拟合与正则化", done: false },
                  ].map((d) => (
                    <div
                      key={d.day}
                      className="flex items-center gap-3 py-1.5"
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                          d.done
                            ? "bg-[#37352f] text-white"
                            : d.current
                              ? "bg-[#6940a5] text-white"
                              : "bg-[#f1f1ef] text-[#9b9a97]"
                        }`}
                      >
                        {d.done ? "✓" : d.day}
                      </div>
                      <span
                        className={`text-[14px] flex-1 ${
                          d.done
                            ? "text-[#9b9a97] line-through"
                            : "text-[#37352f]"
                        }`}
                      >
                        Day {d.day}：{d.title}
                      </span>
                      {d.current && (
                        <span className="text-[11px] text-[#6940a5] font-medium">
                          今天
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 p-8 bg-[#fbfbfa]">
                <div className="text-[11px] uppercase tracking-widest text-[#9b9a97] font-semibold">
                  今日任务
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-white border border-[#e9e9e8]">
                    <Layers className="w-3.5 h-3.5 text-[#6940a5]" />
                    <span className="text-[13px] text-[#37352f] flex-1">
                      闪卡 · 12 张
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-white border border-[#e9e9e8]">
                    <Pencil className="w-3.5 h-3.5 text-[#37352f]" />
                    <span className="text-[13px] text-[#37352f] flex-1">
                      小测 · 8 道
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-[#e9e9e8]">
                  <div className="text-[11px] uppercase tracking-widest text-[#9b9a97] font-semibold">
                    连续学习
                  </div>
                  <div className="mt-2 text-[28px] font-bold text-[#37352f] tracking-tight">
                    7 <span className="text-[14px] text-[#787774] font-normal">天</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
