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

  // 邮件异步发送（fire-and-forget），不阻塞响应。
  // 发邮件耗时 2-3s，若 await 会导致 EdgeOne 边缘层代理超时返回 500。
  // OTP 已写库，立即返回 200；发送失败只记日志，用户可重试。
  sendOtpEmail(email, code).catch((e) => {
    console.error("OTP 邮件发送失败:", e)
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
  const { email, code } = parsed.data

  // 整段 DB + 签发 token 包 try/catch：
  // 之前无 try/catch，校验通过后 oTP.update / user.upsert / signToken 任一抛错
  // 都会被 Hono 默认处理器吞成「裸 500」——前端只看到 500、看不到原因，
  // 服务端日志也没有清晰标记，排查极难。
  // 这里捕获后用固定前缀打印完整错误，并把简要原因返回给前端（上线前诊断用）。
  try {
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

    // 先 upsert 用户 + 签发 token，全部成功后「最后」才把验证码标记 used。
    // 之前的顺序是：先标记 used → 再 upsert，导致 upsert 一旦抛错（500），
    // 验证码已被烧掉，用户拿同一个码重试就只剩 401「验证码错误或已过期」，
    // 把真正的 500 根因掩盖掉了。调整顺序后，失败不会浪费验证码。
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: email.split("@")[0] },
      update: {},
    })

    const token = signToken({ userId: user.id, email: user.email })

    await prisma.oTP.update({
      where: { id: otp.id },
      data: { used: true },
    })

    return c.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "Error"
    const codeStr = (err as { code?: string })?.code
    const message = err instanceof Error ? err.message : String(err)
    // [LOGIN_500] 前缀方便在 pm2 logs 里一眼定位
    console.error("[LOGIN_500] 登录失败:", name, codeStr ?? "", message, err)
    return c.json(
      {
        error: "登录处理失败",
        // 上线前临时回传诊断信息，定位到根因后删除这三行
        _debugName: name,
        _debugCode: codeStr,
        _debugMessage: message,
      },
      500,
    )
  }
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
