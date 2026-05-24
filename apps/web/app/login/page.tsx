"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
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

  useEffect(() => {
    if (typeof window === "undefined") return
    if (localStorage.getItem("token")) {
      router.replace("/home")
    }
  }, [router])

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
      router.push("/home")
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败")
    } finally {
      setLogging(false)
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#787774] hover:text-[#37352f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[360px]">
          <div className="flex items-center justify-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-md bg-[#37352f] text-white flex items-center justify-center font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-[#37352f] text-[16px]">
              StudyHere
            </span>
          </div>

          <h1 className="text-[24px] font-bold text-[#37352f] tracking-tight text-center">
            登录或注册
          </h1>
          <p className="mt-2 text-[14px] text-[#787774] text-center">
            邮箱即可登录，首次自动创建账户
          </p>

          <div className="mt-10 space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#37352f] mb-1.5">
                邮箱地址
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="nt-input"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#37352f] mb-1.5">
                验证码
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6 位数字"
                  className="nt-input tracking-[0.3em] font-mono"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sending || countdown > 0}
                  className="nt-btn-ghost border border-[#e9e9e8] whitespace-nowrap min-w-[100px]"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : otpSent ? (
                    "重新发送"
                  ) : (
                    "发送验证码"
                  )}
                </button>
              </div>
              {otpSent && (
                <p className="mt-2 text-xs text-[#6940a5]">
                  验证码已发送到 {email}
                </p>
              )}
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleLogin}
              disabled={logging || !email || code.length !== 6}
              className="nt-btn-primary w-full py-2.5"
            >
              {logging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中
                </>
              ) : (
                <>
                  继续
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <p className="mt-8 text-[12px] text-[#9b9a97] text-center leading-relaxed">
            继续即代表同意服务条款 · OTP 登录，不收密码
          </p>
        </div>
      </div>
    </main>
  )
}
