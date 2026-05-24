"use client"

import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { useFadeIn } from "@/lib/useFadeIn"
import { trackLandingEvent } from "@/lib/analytics"

export default function LandingFooter() {
  const router = useRouter()
  const { ref, visible } = useFadeIn()

  function goRegister() {
    trackLandingEvent("landing_cta_click", { position: "footer" })
    router.push("/login")
  }

  return (
    <>
      <section
        ref={ref}
        className={`py-32 md:py-44 px-6 bg-[#fbfbfa] border-t border-[#e9e9e8] transition-all duration-700 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-[48px] md:text-[72px] font-bold text-[#37352f] tracking-[-0.04em] leading-[1.02]">
            把任何资料，
            <br />
            变成你掌握的知识。
          </h2>

          <div className="mt-12">
            <button
              onClick={goRegister}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-[#37352f] text-white text-[15px] font-medium hover:bg-[#1a1a1a] transition-colors"
            >
              开始我的学习之旅
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-6 text-[12px] text-[#9b9a97]">
            无需信用卡 · 数据加密 · 随时删除账户
          </p>
        </div>
      </section>

      <footer className="bg-white border-t border-[#e9e9e8]">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-[#37352f] text-white flex items-center justify-center font-bold text-sm">
                  S
                </div>
                <span className="font-semibold text-[#37352f] text-[15px]">
                  StudyHere
                </span>
              </div>
              <p className="mt-4 text-[13px] text-[#787774] max-w-xs leading-[1.7]">
                帮你掌握任何知识和技能的 AI 学习闭环平台。
              </p>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#9b9a97] font-semibold">
                产品
              </div>
              <ul className="mt-4 space-y-2.5 text-[13px] text-[#37352f]">
                <li><a href="#features" className="hover:text-[#6940a5] transition-colors">功能</a></li>
                <li><a href="#compare" className="hover:text-[#6940a5] transition-colors">对比</a></li>
                <li><a href="#faq" className="hover:text-[#6940a5] transition-colors">常见问题</a></li>
              </ul>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#9b9a97] font-semibold">
                支持
              </div>
              <ul className="mt-4 space-y-2.5 text-[13px] text-[#37352f]">
                <li><a href="mailto:hi@studyhere.app" className="hover:text-[#6940a5] transition-colors">邮箱</a></li>
                <li><a href="#" className="hover:text-[#6940a5] transition-colors">隐私政策</a></li>
                <li><a href="#" className="hover:text-[#6940a5] transition-colors">服务条款</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-[#e9e9e8] flex items-center justify-between flex-wrap gap-3 text-[12px] text-[#9b9a97]">
            <span>© 2026 StudyHere</span>
            <span>MVP v1.0 · 内测中</span>
          </div>
        </div>
      </footer>
    </>
  )
}
