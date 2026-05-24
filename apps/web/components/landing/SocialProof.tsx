"use client"

import { useFadeIn } from "@/lib/useFadeIn"

const STATS = [
  { value: "8", suffix: "秒", label: "上传到生成首份计划平均耗时" },
  { value: "10", suffix: "倍", label: "主动回忆 vs 被动重读的效率差" },
  { value: "92", suffix: "%", label: "AI 出题质量人工评估通过率" },
]

const TESTIMONIALS = [
  {
    quote:
      "之前 PMP 备考时看视频总是走神。用 StudyHere 之后，AI 把 80 小时视频拆成 30 天每天 1 小时的清单，每天结束还能小测——第一次有了「在进步」的感觉。",
    author: "晨晨",
    role: "32 岁 · PMP 在职备考",
  },
  {
    quote:
      "我是被它的「错题不让你忘」打动的。其他工具答错就过了，它会在 3 天后突然再考你一遍。这才是真正在帮你学，不是给你一种「学过了」的错觉。",
    author: "小张",
    role: "22 岁 · 大三考研生",
  },
]

export default function LandingSocialProof() {
  const { ref, visible } = useFadeIn()

  return (
    <section
      id="results"
      ref={ref}
      className={`py-32 md:py-40 px-6 bg-white transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#9b9a97] font-semibold">
            真实声音
          </div>
          <h2 className="mt-5 text-[44px] md:text-[56px] font-bold text-[#37352f] tracking-[-0.03em] leading-[1.05]">
            不只是另一个
            <br />
            AI 工具。
          </h2>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 border-y border-[#e9e9e8] divide-y md:divide-y-0 md:divide-x divide-[#e9e9e8]">
          {STATS.map((s) => (
            <div key={s.label} className="py-10 md:px-10 first:md:pl-0 last:md:pr-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[64px] md:text-[80px] font-bold text-[#37352f] leading-none tracking-[-0.04em]">
                  {s.value}
                </span>
                <span className="text-[24px] text-[#787774] font-light">
                  {s.suffix}
                </span>
              </div>
              <p className="mt-4 text-[14px] text-[#787774] leading-[1.5]">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="flex flex-col">
              <div className="text-[12px] font-mono text-[#9b9a97] mb-6">
                {String(i + 1).padStart(2, "0")} / {String(TESTIMONIALS.length).padStart(2, "0")}
              </div>
              <p className="text-[18px] text-[#37352f] leading-[1.7] flex-1 tracking-[-0.005em]">
                {t.quote}
              </p>
              <div className="mt-8 pt-6 border-t border-[#e9e9e8]">
                <div className="text-[14px] font-semibold text-[#37352f]">
                  {t.author}
                </div>
                <div className="text-[13px] text-[#9b9a97] mt-0.5">
                  {t.role}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-16 text-[12px] text-[#9b9a97]">
          数据基于 MVP 内测期 100+ 用户样本 · 证言已获用户授权
        </p>
      </div>
    </section>
  )
}
