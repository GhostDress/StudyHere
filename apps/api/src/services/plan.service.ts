// ============================================================
// AI 生成学习计划 / 闪卡 / 选择题
// 使用 DeepSeek API（兼容 OpenAI SDK）
// 环境变量：
//   AI_BASE_URL=https://api.deepseek.com
//   AI_API_KEY=sk-xxx
//   AI_MODEL=deepseek-chat
// ============================================================

import OpenAI from "openai"
import { composeSystemPrompt } from "../prompts/personalities"

// ---------- 类型定义（与 fileProcessor.ts 里的结构保持一致）----------

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

// ---------- 初始化 DeepSeek 客户端 ----------

function getAIClient(): OpenAI {
  const baseURL = process.env.AI_BASE_URL || "https://api.deepseek.com"
  const apiKey = process.env.AI_API_KEY || ""
  if (!apiKey) {
    throw new Error("AI_API_KEY 未配置，请在 .env 中填入 DeepSeek API Key")
  }
  return new OpenAI({ baseURL, apiKey })
}

const AI_MODEL = () => process.env.AI_MODEL || "deepseek-chat"

// ---------- 工具函数：调用 AI 并解析 JSON ----------

async function callAIJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const client = getAIClient()
  const response = await client.chat.completions.create({
    model: AI_MODEL(),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  })

  const raw = response.choices[0]?.message?.content ?? "{}"
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`AI 返回的 JSON 格式错误: ${raw.slice(0, 200)}`)
  }
}

// ---------- 截取文本，避免超出 Token 限制 ----------

function truncateText(text: string, maxChars = 6000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n...[内容已截断]"
}

// ---------- 生成学习计划 ----------

/**
 * 根据文本内容生成 N 天学习计划
 *
 * @param textContent  parseFile 提取的纯文本
 * @param totalDays    计划天数（默认 14）
 */
export async function generatePlan(
  textContent: string,
  totalDays: number,
  personality?: string | null,
): Promise<StudyPlanResult> {
  const today = new Date().toISOString().slice(0, 10)
  const excerpt = truncateText(textContent, 6000)

  const taskPrompt = `你是一名专业的学习规划师。用户会给你一份学习材料的文字内容，你需要为用户制定一份系统的 ${totalDays} 天学习计划。
输出严格为 JSON，格式如下：
{
  "title": "计划标题（简洁，含材料名称）",
  "totalDays": ${totalDays},
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "topics": ["今日学习主题1", "主题2"],
      "goals": ["完成目标1", "目标2"],
      "estimatedMinutes": 60
    }
  ]
}
要求：
- 覆盖材料全部核心知识点，循序渐进
- 每天 topics 1-3 个，goals 1-3 条，estimatedMinutes 30-120
- date 从 ${today} 开始，每天递增一天
- 只输出 JSON，不要任何额外文字`

  const userPrompt = `材料内容如下：\n\n${excerpt}`

  const systemPrompt = composeSystemPrompt(personality, taskPrompt)
  const result = await callAIJSON<StudyPlanResult>(systemPrompt, userPrompt)

  // 安全校验
  if (!result.title || !Array.isArray(result.days) || result.days.length === 0) {
    throw new Error("AI 返回的学习计划结构不完整")
  }

  return {
    title: result.title,
    totalDays: result.days.length,
    days: result.days,
  }
}

// ---------- 生成闪卡 ----------

/**
 * 根据单天学习内容生成闪卡
 *
 * @param dayContent  当天的学习主题和目标拼接文本
 * @param count       生成数量（默认 10）
 */
export async function generateFlashcards(
  dayContent: string,
  count: number,
  personality?: string | null,
): Promise<FlashcardResult[]> {
  const taskPrompt = `你是一名教育专家，擅长制作学习闪卡。根据给定的学习内容，生成 ${count} 张高质量的记忆闪卡。
输出严格为 JSON，格式如下：
{
  "flashcards": [
    { "front": "问题/概念", "back": "答案/解释" }
  ]
}
要求：
- 问题面（front）简洁明确，一句话
- 答案面（back）精炼完整，包含核心知识点
- 涵盖今日学习主题的关键概念、定义、公式、方法
- 只输出 JSON，不要任何额外文字`

  const userPrompt = `今日学习内容：${dayContent}`

  const systemPrompt = composeSystemPrompt(personality, taskPrompt)
  const result = await callAIJSON<{ flashcards: FlashcardResult[] }>(systemPrompt, userPrompt)

  if (!Array.isArray(result.flashcards)) {
    throw new Error("AI 返回的闪卡结构不完整")
  }

  return result.flashcards.slice(0, count)
}

// ---------- 生成选择题 ----------

/**
 * 根据单天学习内容生成选择题
 *
 * @param dayContent  当天的学习主题和目标拼接文本
 * @param count       生成数量（默认 5）
 */
export async function generateQuestions(
  dayContent: string,
  count: number,
  personality?: string | null,
): Promise<QuestionResult[]> {
  const taskPrompt = `你是一名出题专家，擅长设计单项选择题。根据给定的学习内容，生成 ${count} 道高质量选择题。
输出严格为 JSON，格式如下：
{
  "questions": [
    {
      "content": "题目内容",
      "options": { "A": "选项A", "B": "选项B", "C": "选项C", "D": "选项D" },
      "correct": "A",
      "explanation": "解析说明"
    }
  ]
}
要求：
- 题目考查核心知识点，难度适中
- 四个选项均有迷惑性，错误选项是常见错误认知
- 解析说明 2-3 句，点明考点和正确理由
- correct 字段只能是 "A"/"B"/"C"/"D" 之一
- 只输出 JSON，不要任何额外文字`

  const userPrompt = `今日学习内容：${dayContent}`

  const systemPrompt = composeSystemPrompt(personality, taskPrompt)
  const result = await callAIJSON<{ questions: QuestionResult[] }>(systemPrompt, userPrompt)

  if (!Array.isArray(result.questions)) {
    throw new Error("AI 返回的选择题结构不完整")
  }

  // 校验 correct 字段合法性
  const validCorrect = new Set(["A", "B", "C", "D"])
  const validated = result.questions
    .filter((q) => validCorrect.has(q.correct))
    .slice(0, count)

  return validated
}
