import { Hono } from "hono"
import { prisma } from "../lib/prisma"
import { authMiddleware, type AuthVariables } from "../middleware/auth"

const plan = new Hono<{ Variables: AuthVariables }>()

plan.use("*", authMiddleware)

// GET /api/plan — 当前用户所有学习计划
plan.get("/", async (c) => {
  const user = c.get("user")
  const plans = await prisma.studyPlan.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      totalDays: true,
      vaultId: true,
      createdAt: true,
    },
  })
  return c.json({ plans })
})

// GET /api/plan/:id — 单个计划完整详情
plan.get("/:id", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  const record = await prisma.studyPlan.findFirst({
    where: { id, userId: user.userId },
  })

  if (!record) return c.json({ error: "学习计划不存在" }, 404)
  return c.json({ plan: record })
})

// GET /api/plan/:id/status — 轮询 AI 处理进度
// 注意：状态实际存在 Vault 上，前端轮询的是「这份资料处理到哪一步了」
plan.get("/:id/status", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  // 先按 plan id 查
  const record = await prisma.studyPlan.findFirst({
    where: { id, userId: user.userId },
    select: { id: true, vaultId: true },
  })

  if (record) {
    const vault = await prisma.vault.findUnique({
      where: { id: record.vaultId },
      select: { status: true, errorMsg: true },
    })
    return c.json({
      planId: record.id,
      status: vault?.status ?? "done",
      errorMsg: vault?.errorMsg ?? null,
    })
  }

  // 找不到 plan 时，可能 AI 还没生成完，按 vaultId 反查
  const vault = await prisma.vault.findFirst({
    where: { id, userId: user.userId },
    select: { id: true, status: true, errorMsg: true },
  })

  if (vault) {
    // 若 AI 已生成完计划，一并返回 planId，前端才能跳转到 /plan-confirm/:planId
    const plan = await prisma.studyPlan.findFirst({
      where: { vaultId: vault.id, userId: user.userId },
      select: { id: true },
    })
    return c.json({
      vaultId: vault.id,
      planId: plan?.id,
      status: vault.status,
      errorMsg: vault.errorMsg,
    })
  }

  return c.json({ error: "找不到对应的学习计划或资料" }, 404)
})

export default plan
