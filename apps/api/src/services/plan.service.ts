// ============================================================
// C 对接点：AI 生成学习计划 / 闪卡 / 题目
// ============================================================
// 实现要求：
//   - 国内 AI 候选：DeepSeek / 通义千问 / Kimi（不能用 OpenAI）
//   - DeepSeek API 兼容 OpenAI SDK，推荐优先使用
//   - 环境变量：在 apps/api/.env 里填入对应 key
//       DEEPSEEK_API_KEY=sk-xxx  或  DASHSCOPE_API_KEY=xxx
// ============================================================

// ---------- 类型定义（与 fileProcessor.ts 里的 Mock 结构保持一致）----------

export interface PlanDay {
  day: number
  date: string          // "YYYY-MM-DD"
  topics: string[]
  goals: string[]
  estimatedMinutes: number
}

export interface StudyPlanResult {
  title: string
  totalDays: number
  days: PlanDay[]
}

export interface FlashcardResult {
  front: string         // 问题面
  back: string          // 答案面
}

export interface QuestionResult {
  content: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
}

// ---------- 接口实现（C 填入）----------

/**
 * 根据文本内容生成 N 天学习计划
 *
 * @param textContent  parseFile 提取的纯文本
 * @param totalDays    计划天数（默认 14）
 * @returns            结构化学习计划
 */
export async function generatePlan(
  textContent: string,
  totalDays: number,
): Promise<StudyPlanResult> {
  // TODO by C：调用 AI API 生成学习计划
  throw new Error(`generatePlan 尚未实现（totalDays=${totalDays}）`)
}

/**
 * 根据单天学习内容生成闪卡
 *
 * @param dayContent  当天的学习主题和目标拼接文本
 * @param count       生成数量（默认 10）
 * @returns           闪卡数组
 */
export async function generateFlashcards(
  dayContent: string,
  count: number,
): Promise<FlashcardResult[]> {
  // TODO by C：调用 AI API 生成闪卡
  throw new Error(`generateFlashcards 尚未实现（count=${count}）`)
}

/**
 * 根据单天学习内容生成选择题
 *
 * @param dayContent  当天的学习主题和目标拼接文本
 * @param count       生成数量（默认 5）
 * @returns           题目数组
 */
export async function generateQuestions(
  dayContent: string,
  count: number,
): Promise<QuestionResult[]> {
  // TODO by C：调用 AI API 生成选择题
  throw new Error(`generateQuestions 尚未实现（count=${count}）`)
}
