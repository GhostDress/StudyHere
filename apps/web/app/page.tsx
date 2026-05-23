"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    router.replace(token ? "/vault" : "/login")
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-400 text-sm">正在跳转...</div>
    </main>
  )
}
