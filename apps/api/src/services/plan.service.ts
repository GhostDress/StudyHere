// ============================================================
// C 模块：AI 生成学习计划 / 闪卡 / 题目
// ------------------------------------------------------------
// Provider：通过 lib/ai.ts 走 DeepSeek（兼容 OpenAI SDK）
// 模型：deepseek-chat（默认，可在 .env 切换）
// 核心策略：
//   - 让 AI 输出 JSON（response_format=json_object）
//   - 给 AI 明确的字段名、数量、约束，减少幻觉
//   - 每个函数有 schema 校验，不信任 AI 输出
// ============================================================

import { chatJSON } from "../lib/ai"

// ---------- 类型定义（与 fileProcessor.ts 里的 Mock 结构保持一致）----------

export interface PlanDay {
  day: number
  date: string
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
  front: string
  back: string
}

export interface QuestionResult {
  content: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
}

// ---------- 1. 生成学习计划 ----------

export async function generatePlan(
  textContent: string,
  totalDays: number,
): Promise<StudyPlanResult> {
  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `你是一位经验丰富的学习规划师。根据用户提供的学习材料，生成一份结构化的学习计划。
要求：
1. 必须输出合法 JSON，不要任何额外说明
2. 计划必须基于材料的真实内容，不要编造材料里没有的主题
3. 每天的内容量要均衡，由浅入深
4. 日期从 ${today} 开始连续 ${totalDays} 天`

  const userPrompt = `请为以下学习材料生成 ${totalDays} 天的学习计划。

材料内容：
"""
${textContent}
"""

输出 JSON 格式：
{
  "title": "学习计划标题（基于材料主题）",
  "totalDays": ${totalDays},
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "topics": ["当天要学的主题1", "主题2"],
      "goals": ["完成后能达到的目标1", "目标2"],
      "estimatedMinutes": 60
    }
  ]
}`

  const result = await chatJSON<StudyPlanResult>(systemPrompt, userPrompt)

  if (!result.days || !Array.isArray(result.days) || result.days.length === 0) {
    throw new Error("generatePlan: AI 返回的 days 字段无效")
  }
  result.totalDays = result.days.length
  return result
}

// ---------- 2. 生成闪卡 ----------

export async function generateFlashcards(
  dayContent: string,
  count: number,
): Promise<FlashcardResult[]> {
  const systemPrompt = `你是一位记忆训练专家。根据学习内容生成用于主动回忆的闪卡（问答对）。
要求：
1. 必须输出合法 JSON，不要任何额外说明
2. front 是问题，要具体不要泛泛而问
3. back 是答案，要精准简短，1-3 句话
4. 不要出"什么是 X"这种死记硬背的题，多出"为什么/怎么做/区别"`

  const userPrompt = `请基于以下学习内容，生成 ${count} 张闪卡。

学习内容：
"""
${dayContent}
"""

输出 JSON 格式：
{
  "cards": [
    { "front": "问题", "back": "答案" }
  ]
}`

  const result = await chatJSON<{ cards: FlashcardResult[] }>(
    systemPrompt,
    userPrompt,
  )

  if (!result.cards || !Array.isArray(result.cards)) {
    throw new Error("generateFlashcards: AI 返回的 cards 字段无效")
  }
  return result.cards.slice(0, count)
}

// ---------- 3. 生成选择题 ----------

export async function generateQuestions(
  dayContent: string,
  count: number,
): Promise<QuestionResult[]> {
  const systemPrompt = `你是一位资深出题老师。根据学习内容出选择题，用于检验学习效果。
要求：
1. 必须输出合法 JSON，不要任何额外说明
2. 题目要考察理解和应用，不是简单的事实记忆
3. 4 个选项必须有干扰性，错误选项要看起来合理但有明确错误
4. correct 字段只能是 "A" / "B" / "C" / "D"
5. explanation 要解释为什么正确选项对、其他选项错在哪`

  const userPrompt = `请基于以下学习内容，出 ${count} 道四选一选择题。

学习内容：
"""
${dayContent}
"""

输出 JSON 格式：
{
  "questions": [
    {
      "content": "题干",
      "options": { "A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D" },
      "correct": "A",
      "explanation": "解析"
    }
  ]
}`

  const result = await chatJSON<{ questions: QuestionResult[] }>(
    systemPrompt,
    userPrompt,
  )

  if (!result.questions || !Array.isArray(result.questions)) {
    throw new Error("generateQuestions: AI 返回的 questions 字段无效")
  }
  return result.questions
    .filter((q) => ["A", "B", "C", "D"].includes(q.correct))
    .slice(0, count)
}
