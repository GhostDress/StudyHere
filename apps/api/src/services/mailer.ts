import { Resend } from "resend"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "StudyHere <onboarding@resend.dev>"

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const subject = "StudyHere 登录验证码"
  const text = `您的验证码是：${code}\n\n10 分钟内有效，请勿泄露给他人。\n\n如非本人操作，请忽略此邮件。`

  if (!resend) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(`📧 [MOCK 邮件] 收件人: ${to}`)
    console.log(`📨 主题: ${subject}`)
    console.log(`🔑 验证码: ${code}`)
    console.log("(未配置 RESEND_API_KEY，验证码仅打印到控制台)")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    return
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
  })

  if (error) {
    console.error("Resend 发送失败:", error)
    throw new Error("邮件发送失败")
  }
}
