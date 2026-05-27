// ============================================================
// StudyHere v2.2.1 · 人格沙箱存储（localStorage）
// ------------------------------------------------------------
// PRD v2.2.1 §3：每个 (vaultId × personality) = 一个独立学习沙箱
// 包含该沙箱的：闪卡 mastery / 题目答题记录 / 错题集 / 已完成天数
//
// 切换人格 = 切沙箱：
//   - 当前人格的进度不丢
//   - 新人格独立计数（首次进入默认全 0）
// ============================================================

import type { AgentPersonality } from "./types"

export const ALL_PERSONALITIES: AgentPersonality[] = [
  "student",
  "cert",
  "explorer",
  "strict",
]

// ============ Active Personality（当前激活） ============

const ACTIVE_KEY = "vault_active_personality"

/**
 * 读取当前 vault 激活的人格。
 * 没设置过返回 null（用户首次进入 agent-settings 必须强制选）。
 */
export function getActivePersonality(
  vaultId: string,
): AgentPersonality | null {
  if (typeof window === "undefined" || !vaultId) return null
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "{}")
    const v = stored[vaultId]
    if (
      v === "student" ||
      v === "cert" ||
      v === "explorer" ||
      v === "strict"
    ) {
      return v
    }
    return null
  } catch {
    return null
  }
}

export function setActivePersonality(
  vaultId: string,
  personality: AgentPersonality,
): void {
  if (typeof window === "undefined") return
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "{}")
    stored[vaultId] = personality
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(stored))
    // 触发同标签页内的"激活人格变化"事件，让监听者刷新
    window.dispatchEvent(
      new CustomEvent("vault-personality-change", {
        detail: { vaultId, personality },
      }),
    )
  } catch {
    // ignore
  }
}

// ============ Sandbox Data（每个沙箱的进度） ============

interface SandboxData {
  // 闪卡掌握度：flashcardId → mastery（0-3）
  flashcardMastery: Record<string, number>
  // 题目答题记录：questionId → { picked, isCorrect, answeredAt }
  answerRecords: Record<
    string,
    {
      picked: string
      isCorrect: boolean
      answeredAt: string
    }
  >
  // 错题集：questionId[]（unique）
  wrongQuestionIds: string[]
  // v2.2.1：每题的错次数 + 连续答对计数
  wrongQuestionMeta: Record<
    string,
    {
      wrongCount: number          // 累计错次数
      consecutiveCorrects: number // 连续答对次数（≥2 移除）
      lastWrongAt: string
      lastPicked?: string          // 最近一次错的答案
    }
  >
  // 学习累计天数（mock 期简化）
  studyDays: number
  // 沙箱首次激活时间
  createdAt: string
}

function emptySandbox(): SandboxData {
  return {
    flashcardMastery: {},
    answerRecords: {},
    wrongQuestionIds: [],
    wrongQuestionMeta: {},
    studyDays: 0,
    createdAt: new Date().toISOString(),
  }
}

// 把老 localStorage 沙箱数据补齐到当前 schema —— 新加字段必须在这里加显式兜底
function normalizeSandbox(raw: Partial<SandboxData> | undefined): SandboxData {
  const empty = emptySandbox()
  if (!raw) return empty
  return {
    ...empty,
    ...raw,
    flashcardMastery: raw.flashcardMastery ?? {},
    answerRecords: raw.answerRecords ?? {},
    wrongQuestionIds: raw.wrongQuestionIds ?? [],
    wrongQuestionMeta: raw.wrongQuestionMeta ?? {},
  }
}

const SANDBOX_KEY = "vault_sandbox_data"

function loadAll(): Record<string, SandboxData> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(SANDBOX_KEY) || "{}")
  } catch {
    return {}
  }
}

function saveAll(all: Record<string, SandboxData>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(SANDBOX_KEY, JSON.stringify(all))
}

function sandboxKey(vaultId: string, personality: AgentPersonality): string {
  return `${vaultId}::${personality}`
}

/**
 * 取某个沙箱的进度数据（不存在则返回空沙箱，不写回）
 */
export function getSandbox(
  vaultId: string,
  personality: AgentPersonality,
): SandboxData {
  const all = loadAll()
  return normalizeSandbox(all[sandboxKey(vaultId, personality)])
}

/**
 * 更新某沙箱（合并式写回）
 */
export function updateSandbox(
  vaultId: string,
  personality: AgentPersonality,
  updater: (s: SandboxData) => SandboxData,
): void {
  const all = loadAll()
  const k = sandboxKey(vaultId, personality)
  const current = normalizeSandbox(all[k])
  all[k] = updater(current)
  saveAll(all)
}

/**
 * 重置某沙箱（用户主动清掉某个人格的进度）
 */
export function resetSandbox(
  vaultId: string,
  personality: AgentPersonality,
): void {
  const all = loadAll()
  const k = sandboxKey(vaultId, personality)
  delete all[k]
  saveAll(all)
}

// ============ 跨沙箱聚合（错题集 / 进度页"全部风格"用） ============

export interface SandboxSummary {
  personality: AgentPersonality
  data: SandboxData
  flashcardCount: number  // 已学闪卡数
  answeredCount: number   // 已答题目数
  correctCount: number    // 答对数
  wrongCount: number      // 错题数
}

/**
 * 取某 vault 下所有 4 个人格沙箱的进度汇总
 */
export function getAllSandboxSummaries(vaultId: string): SandboxSummary[] {
  return ALL_PERSONALITIES.map((p) => {
    const data = getSandbox(vaultId, p)
    const answered = Object.values(data.answerRecords)
    return {
      personality: p,
      data,
      flashcardCount: Object.keys(data.flashcardMastery).length,
      answeredCount: answered.length,
      correctCount: answered.filter((a) => a.isCorrect).length,
      wrongCount: data.wrongQuestionIds.length,
    }
  })
}

// ============ 业务辅助函数 ============

/**
 * 标记闪卡掌握度
 * mastery: 0=不会, 1=模糊, 2=已掌握
 */
export function markFlashcardMastery(
  vaultId: string,
  personality: AgentPersonality,
  flashcardId: string,
  mastery: number,
): void {
  updateSandbox(vaultId, personality, (s) => ({
    ...s,
    flashcardMastery: { ...s.flashcardMastery, [flashcardId]: mastery },
  }))
}

/**
 * 记录答题
 * v2.2.1 修订：
 *   - 错题集进入条件：答错 1 次 → 加入
 *   - 错题集移除条件：连续答对 2 次 → 真正移除（一次不行，避免靠运气）
 */
export function recordAnswer(
  vaultId: string,
  personality: AgentPersonality,
  questionId: string,
  picked: string,
  isCorrect: boolean,
): void {
  updateSandbox(vaultId, personality, (s) => {
    const meta = { ...(s.wrongQuestionMeta?.[questionId] ?? null) } as Partial<
      SandboxData["wrongQuestionMeta"][string]
    >
    const newWrongIds = new Set(s.wrongQuestionIds)
    const now = new Date().toISOString()

    if (!isCorrect) {
      // 答错：加入错题集 + wrongCount++ + 重置 consecutiveCorrects
      newWrongIds.add(questionId)
      meta.wrongCount = (meta.wrongCount ?? 0) + 1
      meta.consecutiveCorrects = 0
      meta.lastWrongAt = now
      meta.lastPicked = picked
    } else if (newWrongIds.has(questionId)) {
      // 已在错题集 + 这次答对 → consecutiveCorrects++
      meta.consecutiveCorrects = (meta.consecutiveCorrects ?? 0) + 1
      // 连续答对 2 次才真正移除
      if (meta.consecutiveCorrects >= 2) {
        newWrongIds.delete(questionId)
      }
    }

    const newMeta = { ...s.wrongQuestionMeta }
    if (Object.keys(meta).length > 0) {
      newMeta[questionId] = {
        wrongCount: meta.wrongCount ?? 0,
        consecutiveCorrects: meta.consecutiveCorrects ?? 0,
        lastWrongAt: meta.lastWrongAt ?? now,
        lastPicked: meta.lastPicked,
      }
    }

    return {
      ...s,
      answerRecords: {
        ...s.answerRecords,
        [questionId]: { picked, isCorrect, answeredAt: now },
      },
      wrongQuestionIds: Array.from(newWrongIds),
      wrongQuestionMeta: newMeta,
    }
  })
}

// ============ v2.2.1：从沙箱反推"今日 / 累计已学" dayIndex 集合 ============

/**
 * 解析 flashcard ID 中的 dayIndex
 * ID 格式：fc-{planId}-{personality}-{day}-{i}
 */
function parseDayFromFlashcardId(id: string): number | null {
  const m = id.match(/-(\d+)-\d+$/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * 累计：用户已学过的所有 day 集合（沙箱内全部 flashcardMastery key 反推）
 */
export function getStudiedDays(
  vaultId: string,
  personality: AgentPersonality,
): number[] {
  const sandbox = getSandbox(vaultId, personality)
  const days = new Set<number>()
  for (const cardId of Object.keys(sandbox.flashcardMastery)) {
    const d = parseDayFromFlashcardId(cardId)
    if (d != null) days.add(d)
  }
  return Array.from(days).sort((a, b) => a - b)
}

/**
 * 今日学过的 day 集合：从最近 N 张评估记录里反推
 * （简化：用最近 24h 评估的卡的 dayIndex 集合）
 */
export function getTodayStudiedDaysFromSession(
  sessionCardIds: string[],
): number[] {
  const days = new Set<number>()
  for (const id of sessionCardIds) {
    const d = parseDayFromFlashcardId(id)
    if (d != null) days.add(d)
  }
  return Array.from(days).sort((a, b) => a - b)
}

// ============ Migration：兼容老的 vault_personalities ============

/**
 * 旧版本（v2.2 初版）用 `vault_personalities` key 存激活人格，
 * 这个 migration 在首次启动时自动迁移到新 key。
 */
export function migrateLegacyPersonalities(): void {
  if (typeof window === "undefined") return
  try {
    const legacy = localStorage.getItem("vault_personalities")
    if (!legacy) return
    const legacyData = JSON.parse(legacy)
    const current = JSON.parse(localStorage.getItem(ACTIVE_KEY) || "{}")
    for (const [vaultId, personality] of Object.entries(legacyData)) {
      if (!current[vaultId] && typeof personality === "string") {
        current[vaultId] = personality
      }
    }
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(current))
    // 老 key 保留，不删（防回退时丢数据）
  } catch {
    // ignore
  }
}
