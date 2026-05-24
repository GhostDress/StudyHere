"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { trackLandingEvent } from "@/lib/analytics"

const NAV_ITEMS = [
  { label: "功能", href: "#features" },
  { label: "效果", href: "#results" },
  { label: "对比", href: "#compare" },
  { label: "常见问题", href: "#faq" },
]

export default function LandingNavbar() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  function goRegister() {
    trackLandingEvent("landing_cta_click", { position: "navbar" })
    router.push("/login")
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/85 backdrop-blur-md border-b border-[#e9e9e8]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 group"
        >
          <div className="w-7 h-7 rounded-md bg-[#37352f] text-white flex items-center justify-center font-bold text-sm">
            S
          </div>
          <span className="font-semibold text-[#37352f] text-[15px]">
            StudyHere
          </span>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-md text-[14px] text-[#787774] hover:text-[#37352f] hover:bg-[#f1f1ef] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>

        <button
          onClick={goRegister}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#37352f] text-white text-[13px] font-medium hover:bg-[#1a1a1a] transition-colors"
        >
          免费开始
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  )
}
