import { Hono } from "hono"
import { prisma } from "../lib/prisma"
import { authMiddleware, type AuthVariables } from "../middleware/auth"
import { generatePlan, type PlanDay } from "../services/plan.service"
import type { PageMap } from "../lib/chunker"

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

/**
 * POST /api/plan/:id/regenerate — v2.3 slice 2 重新生成
 *
 * body: { pinnedDays: number[], dayOrder?: number[] }
 *   - pinnedDays: 不参与重生的 Day 序号（如 [2, 5]）
 *   - dayOrder: 用户拖拽后的顺序（如 [1,3,5,2,4,...]），AI 重生时保持此顺序
 *
 * 行为：
 *   1. 用 vault.textContent 重新调 AI 生成 plan
 *   2. 拿到新结果后，把 pinnedDays 替换回原 plan 对应 Day（保留旧内容）
 *   3. 按 dayOrder 重排（如有）
 *   4. UPDATE study_plans 表（同 id 不新建，前端不用切换 planId）
 */
plan.post("/:id/regenerate", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  // 解析 body
  let body: { pinnedDays?: unknown; dayOrder?: unknown } = {}
  try {
    body = await c.req.json()
  } catch {
    // body 可空，没 body 视为 {pinnedDays:[],dayOrder:[]}
  }
  const pinnedDays: number[] = Array.isArray(body.pinnedDays)
    ? (body.pinnedDays as unknown[]).filter(
        (n): n is number => typeof n === "number" && n > 0,
      )
    : []
  const dayOrder: number[] = Array.isArray(body.dayOrder)
    ? (body.dayOrder as unknown[]).filter(
        (n): n is number => typeof n === "number" && n > 0,
      )
    : []

  // 查 plan + 校验归属
  const record = await prisma.studyPlan.findFirst({
    where: { id, userId: user.userId },
  })
  if (!record) return c.json({ error: "学习计划不存在" }, 404)

  // 查 vault 拿 textContent（plan 重生靠原文）
  const vault = await prisma.vault.findUnique({
    where: { id: record.vaultId },
    select: { textContent: true },
  })
  if (!vault?.textContent) {
    return c.json(
      { error: "资料文本不可用，无法重生（vault.textContent 为空）" },
      409,
    )
  }

  // 解析原 plan 的 days，钉住的内容要保留
  type OldPlanData = { title?: string; totalDays?: number; days?: PlanDay[] }
  const oldPlanData = (record.planData ?? {}) as OldPlanData
  const oldDays = oldPlanData.days ?? []

  // 从 chunks 表反查 pageMap，让 AI 重生时仍能输出 sourcePages
  // 注：chunks 表的 orderIndex + pageStart/pageEnd 能重建近似 pageMap
  const chunks = await prisma.chunk.findMany({
    where: { vaultId: record.vaultId },
    orderBy: { orderIndex: "asc" },
    select: { pageStart: true, pageEnd: true, charCount: true },
  })

  let pageMap: PageMap | undefined
  if (chunks.length > 0) {
    // 用 chunks 的字符数累加近似 offset
    const pages: PageMap["pages"] = []
    let offset = 0
    const pageOffsets = new Map<number, { start: number; end: number }>()
    for (const c of chunks) {
      for (let p = c.pageStart; p <= c.pageEnd; p++) {
        const ex = pageOffsets.get(p)
        if (!ex) pageOffsets.set(p, { start: offset, end: offset + c.charCount })
        else ex.end = offset + c.charCount
      }
      offset += c.charCount
    }
    for (const [pageNumber, { start, end }] of [...pageOffsets.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      pages.push({ pageNumber, startOffset: start, endOffset: end })
    }
    pageMap = { pages }
  }

  // 调 AI 重生
  let regenResult
  try {
    regenResult = await generatePlan(
      vault.textContent,
      record.totalDays,
      { pageMap },
    )
  } catch (e) {
    console.error(`[plan.regenerate] AI 重生失败:`, e)
    return c.json({ error: "AI 重生失败，请稍后再试" }, 502)
  }

  // 合并：钉住的 Day 用旧数据
  const mergedDays = regenResult.days.map((nd) => {
    if (pinnedDays.includes(nd.day)) {
      const oldDay = oldDays.find((od) => od.day === nd.day)
      return oldDay ?? nd
    }
    return nd
  })

  // 按 dayOrder 重排（如果用户拖拽过）
  let finalDays = mergedDays
  if (dayOrder.length > 0) {
    const dayMap = new Map(mergedDays.map((d) => [d.day, d]))
    const reordered = dayOrder
      .map((dayNum) => dayMap.get(dayNum))
      .filter((d): d is PlanDay => !!d)
    // 把没在 dayOrder 里的（如果有）补到末尾
    const seen = new Set(dayOrder)
    for (const d of mergedDays) {
      if (!seen.has(d.day)) reordered.push(d)
    }
    if (reordered.length === mergedDays.length) {
      finalDays = reordered
    }
  }

  // 写库（同 id update，前端不用切 planId）
  // planData 是 Prisma Json 字段，需要 cast 成 InputJsonValue
  const newPlanData = {
    title: regenResult.title,
    totalDays: finalDays.length,
    days: finalDays,
  }
  const updated = await prisma.studyPlan.update({
    where: { id: record.id },
    data: {
      title: regenResult.title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      planData: newPlanData as any,
    },
  })

  return c.json({ plan: updated })
})

export default plan
