"use client"

/**
 * Mock 模式提示横幅。
 *
 * 为什么需要：USE_MOCK=true 时所有 API 调用走 mockData，
 * 真实用户不会看到这个横幅（生产部署 USE_MOCK 默认 false）。
 * 但本地开发时容易忘记自己处于 mock 模式 → 上传 / 答题数据都是
 * 内存里的假数据，刷新页面就没了。横幅提醒一下。
 *
 * 用户可以点 × 关掉，存到 sessionStorage（刷新页面会再显示）。
 */

import { useEffect, useState } from "react"
import { X } from "lucide-react"

export default function MockModeBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"
    if (!useMock) return
    if (sessionStorage.getItem("mock_banner_dismissed") === "1") return
    setShow(true)
  }, [])

  if (!show) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-[12px] px-4 py-1.5 flex items-center justify-center gap-2">
      <span>
        🛠️ Mock 模式 · 任意邮箱 + 任意 6 位数字均可登录，数据仅本地内存（刷新会丢）
      </span>
      <button
        onClick={() => {
          sessionStorage.setItem("mock_banner_dismissed", "1")
          setShow(false)
        }}
        className="opacity-60 hover:opacity-100 ml-1"
        aria-label="关闭提示"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}
