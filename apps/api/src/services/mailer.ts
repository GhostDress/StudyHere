import { Resend } from "resend"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "StudyHere <onboarding@resend.dev>"

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

// ──────────────────────────────────────────────
// 内部辅助：统一发送入口
// ──────────────────────────────────────────────
async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!resend) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    console.log(`📧 [MOCK 邮件] 收件人: ${to}`)
    console.log(`📨 主题: ${subject}`)
    console.log(text)
    console.log("(未配置 RESEND_API_KEY，邮件仅打印到控制台)")
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    return
  }
  const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, text, html })
  if (error) {
    console.error("Resend 发送失败:", error)
    throw new Error("邮件发送失败")
  }
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const subject = "StudyHere 登录验证码"
  const text = `您的验证码是：${code}\n\n10 分钟内有效，请勿泄露给他人。\n\n如非本人操作，请忽略此邮件。`

  await sendEmail(to, subject, text)
}

/**
 * SRS 每日复习提醒邮件
 * @param to         用户邮箱
 * @param userName   用户名（可选，用于个性化称呼）
 * @param planTitle  学习计划标题
 * @param daysDue    有多少天的内容待复习
 */
export async function sendSrsReminderEmail(
  to: string,
  userName: string | null,
  planTitle: string,
  daysDue: number,
): Promise<void> {
  const greeting = userName ? `Hi ${userName}，` : "Hi，"
  const subject = `📚 StudyHere · 今天有 ${daysDue} 天待复习的内容`
  const text = `${greeting}

你昨天没有打开 StudyHere，今天记得复习一下哦！

📖 计划：${planTitle}
📅 待复习：${daysDue} 天内容

打开学习：https://studyhere.com.cn

坚持每天复习，记忆效果会好 3-5 倍 💪

— StudyHere 学习助理`

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">📚 今天记得复习</h2>
  <p style="color: #555; font-size: 15px; line-height: 1.7; margin-bottom: 20px;">
    ${greeting}你昨天没有打开 StudyHere，今天记得复习一下哦！
  </p>
  <div style="background: #f5f5f5; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
    <div style="font-size: 13px; color: #888; margin-bottom: 4px;">当前学习计划</div>
    <div style="font-size: 16px; font-weight: 600;">${planTitle}</div>
    <div style="font-size: 14px; color: #555; margin-top: 8px;">📅 待复习 <strong>${daysDue}</strong> 天内容</div>
  </div>
  <a href="https://studyhere.com.cn"
     style="display: inline-block; background: #1a5cd0; color: white; text-decoration: none;
            padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">
    去复习 →
  </a>
  <p style="font-size: 12px; color: #aaa; margin-top: 32px;">
    坚持每天复习，记忆效果会好 3-5 倍 💪<br>
    如不想再收到提醒，请回复此邮件。
  </p>
</div>`

  await sendEmail(to, subject, text, html)
}
