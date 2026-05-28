// ============================================================
// StudyHere v2.2 · SRS 每日复习提醒（A-002）
// ------------------------------------------------------------
// 每天 08:00 北京时间（UTC+8 = UTC 00:00）运行一次：
//   1. 查找有学习计划的用户
//   2. 过滤出"昨天没有答题记录"的用户（需要提醒）
//   3. 给每人发一封邮件，提醒今天来复习
//
// 没有 RESEND_API_KEY 时：邮件内容打印到 PM2 日志（控制台 Mock 模式）
// ============================================================

import cron from "node-cron"
import { prisma } from "../lib/prisma"
import { sendSrsReminderEmail } from "../services/mailer"

// 每天 UTC 00:00 = 北京时间 08:00
const CRON_SCHEDULE = "0 0 * * *"

/**
 * 查询需要提醒的用户列表。
 * 条件：有至少一个学习计划，且过去 24 小时内没有任何答题记录。
 */
async function findUsersToRemind(): Promise<
  Array<{
    userId: string
    email: string
    name: string | null
    planTitle: string
    totalDays: number
    createdAt: Date
  }>
> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // 1. 取所有有计划的用户（每人取最新一个计划）
  const plans = await prisma.studyPlan.findMany({
    select: {
      id: true,
      title: true,
      totalDays: true,
      createdAt: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["userId"], // 每个用户只取最新计划
  })

  if (plans.length === 0) return []

  // 2. 查最近 24h 内有答题记录的 userId
  const recentActiveUserIds = await prisma.answerRecord
    .findMany({
      where: { answeredAt: { gte: oneDayAgo } },
      select: { userId: true },
      distinct: ["userId"],
    })
    .then((rows) => new Set(rows.map((r) => r.userId)))

  // 3. 过滤：昨天没有活跃的用户
  return plans
    .filter((p) => !recentActiveUserIds.has(p.userId))
    .map((p) => ({
      userId: p.userId,
      email: p.user.email,
      name: p.user.name,
      planTitle: p.title,
      totalDays: p.totalDays,
      createdAt: p.createdAt,
    }))
}

/**
 * 根据计划创建时间计算"今天是第几天"，用于邮件里说明有几天待复习。
 * 如果已超出总天数，返回 totalDays（提示可从头复习）。
 */
function calcDaysDue(createdAt: Date, totalDays: number): number {
  const diffMs = Date.now() - createdAt.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  // 已过的天数中，最多提示 totalDays 天
  return Math.min(Math.max(diffDays, 1), totalDays)
}

/**
 * 执行一次提醒任务（可在测试时手动调用）
 */
export async function runSrsNotifier(): Promise<void> {
  console.log(`[SRS Notifier] ${new Date().toISOString()} 开始运行...`)

  let users: Awaited<ReturnType<typeof findUsersToRemind>>
  try {
    users = await findUsersToRemind()
  } catch (err) {
    console.error("[SRS Notifier] 查询用户失败:", err)
    return
  }

  console.log(`[SRS Notifier] 共 ${users.length} 位用户需要提醒`)

  let successCount = 0
  let failCount = 0

  for (const u of users) {
    try {
      const daysDue = calcDaysDue(u.createdAt, u.totalDays)
      await sendSrsReminderEmail(u.email, u.name, u.planTitle, daysDue)
      successCount++
    } catch (err) {
      console.error(`[SRS Notifier] 发送给 ${u.email} 失败:`, err)
      failCount++
    }
  }

  console.log(
    `[SRS Notifier] 完成：成功 ${successCount} 封，失败 ${failCount} 封`,
  )
}

/**
 * 注册 Cron 任务。在服务器启动时调用一次即可。
 */
export function startSrsCron(): void {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error("[SRS Notifier] Cron 表达式无效，跳过注册")
    return
  }

  cron.schedule(CRON_SCHEDULE, () => {
    runSrsNotifier().catch((err) =>
      console.error("[SRS Notifier] 未捕获异常:", err),
    )
  }, {
    timezone: "UTC", // 明确指定 UTC；北京时间 08:00 = UTC 00:00
  })

  console.log(
    `[SRS Notifier] ✅ 已注册每日提醒 Cron（北京时间 08:00，${CRON_SCHEDULE} UTC）`,
  )
}
