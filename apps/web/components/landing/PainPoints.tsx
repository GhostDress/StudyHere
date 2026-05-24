"use client"

import { useFadeIn } from "@/lib/useFadeIn"

const PAIN_POINTS = [
  {
    persona: "在职备考的 PMP 考生",
    pain: "80 小时培训视频看不完，AI 拆解资料 → 30 天计划，每天 60 分钟。",
  },
  {
    persona: "新晋项目的产品人",
    pain: "资料散乱不知道学什么，上传文档 → AI 自动生成主题图谱 + 每日清单。",
  },
  {
    persona: "考研冲刺的大学生",
    pain: "看完就忘没考过自己，学完即测 + 错题自动归档 + 间隔重复。",
  },
]

export default function LandingPainPoints() {
  const { ref, visible } = useFadeIn()

  return (
    <section
      ref={ref}
      className={`py-32 md:py-40 px-6 bg-white transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        <div className="max-w-3xl">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#9b9a97] font-semibold">
            为什么是 StudyHere
          </div>
          <h2 className="mt-5 text-[44px] md:text-[56px] font-bold text-[#37352f] tracking-[-0.03em] leading-[1.05]">
            你已经买了课程，
            <br />
            为什么还是学不会？
          </h2>
          <p className="mt-6 text-[17px] text-[#787774] leading-[1.7] max-w-xl">
            不是你不努力——是市面上的工具都把学习交给了你自己。
            真正缺的，是一个会拆解、会反问、会跟踪的学习伴侣。
          </p>
        </div>

        <div className="mt-20 space-y-px bg-[#e9e9e8]">
          {PAIN_POINTS.map((p) => (
            <div
              key={p.persona}
              className="bg-white grid grid-cols-1 md:grid-cols-3 gap-8 py-10 hover:bg-[#fbfbfa] transition-colors duration-200 group"
            >
              <div className="md:col-span-1">
                <div className="text-[12px] uppercase tracking-[0.15em] text-[#9b9a97] font-semibold">
                  场景
                </div>
                <div className="mt-2 text-[17px] font-semibold text-[#37352f]">
                  {p.persona}
                </div>
              </div>
              <div className="md:col-span-2">
                <p className="text-[17px] text-[#37352f] leading-[1.7]">
                  {p.pain}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
