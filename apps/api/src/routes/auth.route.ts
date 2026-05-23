import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { signToken } from "../lib/jwt"
import { sendOtpEmail } from "../services/mailer"
import { authMiddleware, type AuthVariables } from "../middleware/auth"

const auth = new Hono<{ Variables: AuthVariables }>()

const OTP_EXPIRES_MINUTES = 10
const SEND_LIMIT_PER_HOUR = 5

const sendOtpSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
})

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  code: z.string().length(6, "验证码必须为6位"),
})

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/auth/send-otp
auth.post("/send-otp", async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = sendOtpSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0].message }, 400)
  }
  const { email } = parsed.data

  // 限流：1 小时内同邮箱最多 5 次
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCount = await prisma.oTP.count({
    where: { email, createdAt: { gte: oneHourAgo } },
  })
  if (recentCount >= SEND_LIMIT_PER_HOUR) {
    return c.json({ error: "请求过于频繁，请稍后再试" }, 429)
  }

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000)

  await prisma.oTP.create({
    data: { email, code, expiresAt },
  })

  try {
    await sendOtpEmail(email, code)
  } catch (e) {
    console.error("OTP 邮件发送失败:", e)
    return c.json({ error: "验证码发送失败，请稍后重试" }, 500)
  }

  return c.json({ success: true })
})

// POST /api/auth/login
auth.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.errors[0].message }, 400)
  }
  const { email, code } = parsed.data

  const otp = await prisma.oTP.findFirst({
    where: {
      email,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!otp) {
    return c.json({ error: "验证码错误或已过期" }, 401)
  }

  await prisma.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  })

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0] },
    update: {},
  })

  const token = signToken({ userId: user.id, email: user.email })

  return c.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name },
  })
})

// GET /api/auth/me
auth.get("/me", authMiddleware, async (c) => {
  const payload = c.get("user")
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  })

  if (!user) return c.json({ error: "用户不存在" }, 404)

  return c.json({ user })
})

export default auth
