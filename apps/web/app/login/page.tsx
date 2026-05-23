"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, ArrowRight, Loader2 } from "lucide-react"
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
    <main className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-[#fbfbfa] border-r border-[#e9e9e8] flex-col justify-between p-12">
        <div className="flex items-center gap-2 text-[#37352f]">
          <div className="w-7 h-7 rounded-md bg-[#37352f] text-white flex items-center justify-center font-bold text-sm">
            S
          </div>
          <span className="font-semibold">StudyHere</span>
        </div>

        <div className="max-w-md">
          <span className="nt-tag-ai">
            <Sparkles className="w-3 h-3" />
            AI 学习闭环
          </span>
          <h1 className="mt-6 text-4xl font-bold text-[#37352f] leading-tight tracking-tight">
            把任何资料，
            <br />
            变成你掌握的知识。
          </h1>
          <p className="mt-5 text-[15px] text-[#787774] leading-relaxed">
            上传 PDF / Word，AI 自动生成 14 天学习计划、闪卡、题目。
            <br />
            学—练—考—纠，一站完成。
          </p>

          <div className="mt-10 space-y-3 text-[14px] text-[#37352f]">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6940a5] mt-2" />
              <span><strong className="font-semibold">主动回忆</strong>训练，不是被动重读</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6940a5] mt-2" />
              <span><strong className="font-semibold">间隔重复</strong>算法，掌握的卡片自动延后</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6940a5] mt-2" />
              <span><strong className="font-semibold">错题自动归档</strong>，下次专项突破</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#9b9a97]">© StudyHere · 2026</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-md bg-[#37352f] text-white flex items-center justify-center font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-[#37352f]">StudyHere</span>
          </div>

          <h2 className="text-2xl font-bold text-[#37352f]">登录或注册</h2>
          <p className="mt-1.5 text-sm text-[#787774]">
            首次输入邮箱将自动创建账户
          </p>

          <div className="mt-8 space-y-5">
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

          <p className="mt-8 text-xs text-[#9b9a97] text-center">
            继续即代表同意服务条款 · OTP 登录，不收密码
          </p>
        </div>
      </div>
    </main>
  )
}
