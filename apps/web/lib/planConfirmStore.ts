// ============================================================
// StudyHere v2.3 slice 2 · plan-confirm 本地交互状态
// ------------------------------------------------------------
// 用户在 plan-confirm 页面对计划做的局部修改：
//   - 钉住的 Day（pinnedDays）：不参与重新拆分
//   - 自定义 Day 顺序（dayOrder）：用户拖拽后的顺序覆盖原始顺序
//
// 存 localStorage，按 planId 隔离（不同计划互不影响）。
// 后端落地后这里的状态会通过"用户点确认"提交到 plan.service。
// ============================================================

const PIN_KEY_PREFIX = "plan_confirm_pinned_"
const ORDER_KEY_PREFIX = "plan_confirm_order_"

function pinKey(planId: string) {
  return `${PIN_KEY_PREFIX}${planId}`
}

function orderKey(planId: string) {
  return `${ORDER_KEY_PREFIX}${planId}`
}

// ============ 钉住的 Day ============

export function getPinnedDays(planId: string): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(pinKey(planId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : []
  } catch {
    return []
  }
}

export function togglePinnedDay(planId: string, day: number): number[] {
  const current = getPinnedDays(planId)
  const next = current.includes(day)
    ? current.filter((d) => d !== day)
    : [...current, day]
  if (typeof window !== "undefined") {
    localStorage.setItem(pinKey(planId), JSON.stringify(next))
  }
  return next
}

// ============ 自定义顺序 ============

/**
 * 返回用户拖拽后的 Day 顺序（按 day number 数组）。
 * 没拖过返回 null（让调用方用原始顺序）。
 */
export function getDayOrder(planId: string): number[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(orderKey(planId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : null
  } catch {
    return null
  }
}

export function setDayOrder(planId: string, order: number[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(orderKey(planId), JSON.stringify(order))
}

export function clearDayOrder(planId: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(orderKey(planId))
}

// ============ Mock 数据 fallback（slice 2 阶段后端未回填时用）============
// 后端 plan.service 接入 chunks 表后会返回真实 sourcePages / extractedPoints / reasoning
// 在此之前，前端按 day index 生成稳定 mock 让视觉跑起来。

export function mockSourcePages(day: number, totalDays: number): number[] {
  // 假设原文 60 页，按 day 比例分布
  const pagesPerDay = Math.max(2, Math.floor(60 / totalDays))
  const start = (day - 1) * pagesPerDay + 1
  const end = start + pagesPerDay - 1
  return [start, end]
}

export function mockExtractedPoints(day: number, topics: string[]): string[] {
  return topics.map((t, i) => `${t}（核心定义 + 应用场景 + 易混点 ${i + 1}）`)
}

export function mockReasoning(day: number, topics: string[]): string {
  return `这一天聚焦 ${topics[0] ?? "核心概念"}，因为它是后续 ${
    topics.slice(1).join("、") || "进阶内容"
  } 的前置依赖。建议按"概念→例子→对比→练习"的顺序学，比直接看原文少走 30% 弯路。`
}
