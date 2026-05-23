"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authApi } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState("")

  async function handleSendOtp() {
    setError("")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("请输入合法的邮箱地址")
      return
    }
    setSending(true)
    try {
      await authApi.sendOtp(email)
      setOtpSent(true)
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((n) => {
          if (n <= 1) {
            clearInterval(timer)
            return 0
          }
          return n - 1
        })
      }, 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败，请重试")
    } finally {
      setSending(false)
    }
  }

  async function handleLogin() {
    setError("")
    if (!email) return setError("请先填写邮箱")
    if (!/^\d{6}$/.test(code)) return setError("验证码必须是 6 位数字")

    setLogging(true)
    try {
      const res = await authApi.login(email, code)
      localStorage.setItem("token", res.token)
      localStorage.setItem("user", JSON.stringify(res.user))
      router.push("/vault")
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败")
    } finally {
      setLogging(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">📚</div>
          <h1 className="text-3xl font-bold text-slate-900">StudyHere</h1>
          <p className="mt-2 text-slate-500">学得快，记得牢 · AI 学习闭环</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
          />

          <label className="block text-sm font-medium text-slate-700 mt-5 mb-2">
            验证码
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6 位数字"
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition tracking-widest"
            />
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sending || countdown > 0}
              className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              {sending
                ? "发送中..."
                : countdown > 0
                  ? `${countdown}s 后重发`
                  : otpSent
                    ? "重新发送"
                    : "发送验证码"}
            </button>
          </div>

          {otpSent && (
            <p className="mt-2 text-xs text-emerald-600">
              ✓ 验证码已发送到 {email}（mock 模式：任何 6 位数字都能通过）
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={handleLogin}
            disabled={logging || !email || code.length !== 6}
            className="w-full mt-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {logging ? "登录中..." : "登录"}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          继续即代表同意服务条款 · OTP 登录，不收密码
        </p>
      </div>
    </main>
  )
}
