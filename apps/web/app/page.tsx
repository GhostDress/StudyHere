"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import LandingNavbar from "@/components/landing/Navbar"
import LandingHero from "@/components/landing/Hero"
import LandingPainPoints from "@/components/landing/PainPoints"
import LandingFeatures from "@/components/landing/Features"
import LandingSocialProof from "@/components/landing/SocialProof"
import LandingCompare from "@/components/landing/Compare"
import LandingFaq from "@/components/landing/Faq"
import LandingFooter from "@/components/landing/Footer"
import { trackLandingEvent } from "@/lib/analytics"

export default function RootPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // JWT 鉴权：已登录用户直接跳 /home
    const token = localStorage.getItem("token")
    if (token) {
      router.replace("/home")
      return
    }

    // 落地页访问埋点
    trackLandingEvent("landing_page_view", {
      isFirstVisit: !sessionStorage.getItem("landing_visited"),
      utm_source: new URLSearchParams(window.location.search).get("utm_source"),
    })
    sessionStorage.setItem("landing_visited", "1")

    setReady(true)
  }, [router])

  if (!ready) {
    // 鉴权检查期间显示空白，避免 Landing 内容闪现给已登录用户
    return <main className="min-h-screen bg-white" />
  }

  return (
    <main className="min-h-screen bg-white">
      <LandingNavbar />
      <LandingHero />
      <LandingPainPoints />
      <LandingFeatures />
      <LandingSocialProof />
      <LandingCompare />
      <LandingFaq />
      <LandingFooter />
    </main>
  )
}
