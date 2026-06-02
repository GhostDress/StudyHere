import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { signToken } from "../lib/jwt"
import { sendVerifyCode, checkVerifyCode } from "../services/sms"
import { authMiddleware, type AuthVariables } from "../middleware/auth"

const auth = new Hono<{ Variables: AuthVariables }>()

// 国内手机号：1 开头，第二位 3-9，共 11 位
const phoneSchema = z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确")

const sendOtpSchema = z.object({
  phone: phoneSchema,
})

const loginSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, "验证码必须为6位"),
})

// POST /api/auth/send-otp
//
// v2.3 起改用阿里云「号码认证服务 → 短信认证服务」(DyPNSAPI)：
// 验证码的生成、存库、有效期、频控、去重、校验全部由阿里云托管，
// 本地不再写 OTP 表、不再做限流（频控由阿里云 interval 默认 60s 兜底）。
auth.post("/send-otp", async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = sendOtpSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0].message }, 400)
  }
  const { phone } = parsed.data

  // 短信异步发送（fire-and-forget），不阻塞响应。
  // 发短信有网络往返，若 await 会拖慢响应、并可能触发 EdgeOne 边缘层代理超时返回 500。
  // 立即返回 200；发送失败只记日志，用户可重试。
  sendVerifyCode(phone).catch((e) => {
    console.error("OTP 短信发送失败:", e)
  })

  return c.json({ success: true })
})

// POST /api/auth/login
auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0].message }, 400)
  }
  const { phone, code } = parsed.data

  // 整段「校验验证码 + upsert 用户 + 签发 token」包 try/catch：
  // 任一步抛错都会被 Hono 默认处理器吞成「裸 500」——前端只看到 500、看不到原因。
  // 这里捕获后用 [LOGIN_500] 固定前缀打印完整错误到服务端日志（pm2 logs 可查），
  // 前端只收到通用的「登录处理失败」，不暴露内部错误细节。
  try {
    // 验证码交给阿里云比对，本地不存码、不做一次性烧码（阿里云已托管全生命周期）。
    const passed = await checkVerifyCode(phone, code)
    if (!passed) {
      return c.json({ error: "验证码错误或已过期" }, 401)
    }

    const user = await prisma.user.upsert({
      where: { phone },
      create: { phone, name: `用户${phone.slice(-4)}` },
      update: {},
    })

    const token = signToken({ userId: user.id, phone: user.phone })

    return c.json({
      success: true,
      token,
      user: { id: user.id, phone: user.phone, name: user.name },
    })
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "Error"
    const codeStr = (err as { code?: string })?.code
    const message = err instanceof Error ? err.message : String(err)
    // [LOGIN_500] 前缀方便在 pm2 logs 里一眼定位
    console.error("[LOGIN_500] 登录失败:", name, codeStr ?? "", message, err)
    return c.json({ error: "登录处理失败" }, 500)
  }
})

// GET /api/auth/me
auth.get("/me", authMiddleware, async (c) => {
  const payload = c.get("user")
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, phone: true, email: true, name: true, createdAt: true },
  })

  if (!user) return c.json({ error: "用户不存在" }, 404)

  return c.json({ user })
})

export default auth
