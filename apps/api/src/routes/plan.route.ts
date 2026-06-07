import { Hono } from "hono"
import { prisma } from "../lib/prisma"
import { authMiddleware, type AuthVariables } from "../middleware/auth"
import { generatePlan, type PlanDay } from "../services/plan.service"
import type { PageMap } from "../lib/chunker"
import {
  generatePlanAdvice,
  type PlanSnapshot,
} from "../services/planAdvice.service"

const plan = new Hono<{ Variables: AuthVariables }>()

plan.use("*", authMiddleware)

// 与 worker 保持一致的默认天数（worker 也写死 14）
// v2.4：上限值，AI 在 5-N 间自决（详见 plan.service.generatePlan）
const DEFAULT_PLAN_DAYS = 21

/**
 * 自愈：修复「vault 已 done 但没有对应 plan」的数据不一致。
 *
 * 背景：正常流水线里 worker 是在 studyPlan.create 成功后才把 vault 标 done，
 * 所以 done 理应蕴含 plan 存在。但历史上存在旧版 worker / 半截运行留下的脏数据，
 * 表现为 vault.status=done 却查不到 plan，导致前端跳到 /plan-confirm/:id 后 404。
 *
 * 策略：用 vault 里已存的 textContent 直接重新生成 plan（不重下载、不重切 chunk），
 * 生成成功补建 studyPlan 记录。整个过程在后台 fire-and-forget，前端继续轮询即可。
 *
 * 并发安全：用 updateMany(where status=done → processing) 原子抢占，
 * 只有把状态从 done 翻成 processing 成功的那一次请求才真正补生成，
 * 后续 1.5s 一次的轮询看到 processing 就不会重复触发。
 */
async function repairMissingPlan(vaultId: string): Promise<void> {
  const claimed = await prisma.vault.updateMany({
    where: { id: vaultId, status: "done" },
    data: { status: "processing", errorMsg: null },
  })
  if (claimed.count === 0) return // 别的轮询已抢到，直接退出

  try {
    const v = await prisma.vault.findUnique({
      where: { id: vaultId },
      select: { userId: true, textContent: true },
    })
    if (!v?.textContent) {
      await prisma.vault.update({
        where: { id: vaultId },
        data: { status: "failed", errorMsg: "资料文本缺失，无法补生成计划，请重新上传" },
      })
      return
    }

    const generated = await generatePlan(v.textContent, DEFAULT_PLAN_DAYS)
    await prisma.studyPlan.create({
      data: {
        userId: v.userId,
        vaultId,
        title: generated.title,
        totalDays: generated.totalDays,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        planData: generated as any,
      },
    })
    await prisma.vault.update({
      where: { id: vaultId },
      data: { status: "done" },
    })
    console.log(`[plan.repair] ✅ vault ${vaultId} 缺失的 plan 已补生成`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[plan.repair] ❌ vault ${vaultId} 补生成失败:`, msg)
    await prisma.vault.update({
      where: { id: vaultId },
      data: { status: "failed", errorMsg: msg },
    })
  }
}

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
// 注意：:id 既可能是 planId，也可能是 vaultId（前端某些路径会把 vaultId 拼进
// /plan-confirm/[planId]，导致按 planId 查不到→404）。这里做容错：先按 planId 查，
// 查不到时再把它当 vaultId 反查对应的 plan，使端点对两种 id 都健壮。
plan.get("/:id", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  let record = await prisma.studyPlan.findFirst({
    where: { id, userId: user.userId },
  })

  // 兜底：按 vaultId 反查（同一用户名下该 vault 最新的 plan）
  if (!record) {
    record = await prisma.studyPlan.findFirst({
      where: { vaultId: id, userId: user.userId },
      orderBy: { createdAt: "desc" },
    })
  }

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

    // 自愈：vault 已 done 但查不到 plan（脏数据）→ 后台补生成，
    // 并对外暂时报 processing，让前端继续轮询而不是跳到 plan-confirm 吃 404。
    if (!plan && vault.status === "done") {
      repairMissingPlan(vault.id).catch((e) => {
        console.error(
          `[plan.status] ⚠️ vault ${vault.id} 自愈补生成触发失败:`,
          e instanceof Error ? e.message : e,
        )
      })
      return c.json({
        vaultId: vault.id,
        planId: undefined,
        status: "processing",
        errorMsg: null,
      })
    }

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

/**
 * POST /api/plan/:id/advice — v2.3+ 计划合理性对话式校准
 *
 * body: {
 *   question: string                       // 用户的元问题
 *   history?: Array<{ role, content }>      // 已有对话历史（可选，让追问能延续）
 * }
 *
 * resp: AdviceResult = { answer, action }
 *
 * 行为：
 *   1. 校验 plan + vault 归属
 *   2. 取 vault.textContent 前 6000 字作为原文摘要
 *   3. 把 planData.days 序列化成 AI 友好格式
 *   4. 调 generatePlanAdvice 拿到 { answer, action }
 *   5. 返回给前端（前端按 action.type 渲染"应用"按钮）
 *
 * 前端"一键应用"会直接调 /api/plan/:id/regenerate（已有路由），
 * 把 action.targetDays 之外的天传给 pinnedDays，只重生 AI 建议改的天。
 */
plan.post("/:id/advice", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  const body = await c.req.json().catch(() => null)
  const question = body?.question
  if (typeof question !== "string" || !question.trim()) {
    return c.json({ error: "缺少 question 字段" }, 400)
  }
  if (question.length > 500) {
    return c.json({ error: "问题过长（限 500 字以内）" }, 400)
  }

  const history = Array.isArray(body?.history)
    ? (body.history as unknown[])
        .filter(
          (m): m is { role: "user" | "assistant"; content: string } =>
            typeof m === "object" &&
            m !== null &&
            (("role" in m && ((m as { role: unknown }).role === "user" || (m as { role: unknown }).role === "assistant"))) &&
            "content" in m &&
            typeof (m as { content: unknown }).content === "string",
        )
        .slice(-6) // 最多保留最近 6 条，防 prompt 过长
    : []

  // 查 plan + 校验归属
  // 注：跟 GET /api/plan/:id 一致，:id 既可能是 planId 也可能是 vaultId
  // （前端有些路径会拼 /plan-confirm/[vaultId]）。先按 planId 查，
  // 查不到时按 vaultId 反查。advice/regenerate 之前漏了这条 fallback
  // 导致前端拼 vaultId 调 advice 时直接 404。
  let record = await prisma.studyPlan.findFirst({
    where: { id, userId: user.userId },
  })
  if (!record) {
    record = await prisma.studyPlan.findFirst({
      where: { vaultId: id, userId: user.userId },
      orderBy: { createdAt: "desc" },
    })
  }
  if (!record) return c.json({ error: "学习计划不存在" }, 404)

  // 查 vault 拿 textContent
  // v2.5：把 agentPersonality 一并取出，让 advice 追问语气也跟人格走
  const vault = await prisma.vault.findUnique({
    where: { id: record.vaultId },
    select: { textContent: true, agentPersonality: true },
  })
  if (!vault?.textContent) {
    return c.json(
      { error: "资料文本不可用，无法生成建议" },
      409,
    )
  }

  // 序列化 plan
  type OldPlanData = { title?: string; totalDays?: number; days?: PlanDay[] }
  const oldPlanData = (record.planData ?? {}) as OldPlanData
  const days = oldPlanData.days ?? []
  const planSnapshot: PlanSnapshot = {
    title: record.title,
    totalDays: record.totalDays,
    days: days.map((d) => ({
      day: d.day,
      topics: d.topics ?? [],
      goals: d.goals ?? [],
      sourcePages: d.sourcePages,
    })),
  }

  // 调 AI
  try {
    const result = await generatePlanAdvice({
      question: question.trim(),
      textExcerpt: vault.textContent.slice(0, 6000),
      plan: planSnapshot,
      history,
      personality: vault.agentPersonality,
    })
    return c.json(result)
  } catch (e) {
    console.error(`[plan.advice] AI 调用失败:`, e)
    return c.json(
      {
        error: "AI 暂时无法回答，请稍后再试",
        detail: e instanceof Error ? e.message.slice(0, 200) : "未知错误",
      },
      502,
    )
  }
})

export default plan
