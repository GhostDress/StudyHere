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
import type { PageMap } from "../lib/chunker"

// ---------- 类型定义（与 fileProcessor.ts 里的结构保持一致）----------

export interface PlanDay {
  day: number
  date: string          // "YYYY-MM-DD"
  topics: string[]
  goals: string[]
  estimatedMinutes: number

  // ---- v2.3 slice 2 信任链路字段（可选，等后端回填）----
  /** 这一天对应原文页码范围（e.g. [12, 13, 14, 15, 16, 17, 18]）—— PdfDrawer 跳页用 */
  sourcePages?: number[]
  /** AI 提炼的核心点 —— 展示在"📖 源于原文"行下 */
  extractedPoints?: string[]
  /** AI 解释为什么这天这么拆 —— 折叠展示 */
  reasoning?: string
}

export interface StudyPlanResult {
  title: string
  totalDays: number
  days: PlanDay[]
}

export interface FlashcardResult {
  front: string         // 问题面（兜底；跟 byPersonality[active].question 大致一致）
  back: string          // 答案面（裸文本兜底，老前端 fallback）
  // v2.5++：4 人格"原料 + 各自字段"全部一次生成，前端按当前激活人格实时切版式
  // null 时前端 fallback 走 back 字段
  cardData?: FlashcardCardData | null
}

/**
 * v2.5++ · 多人格闪卡数据结构
 *
 * 设计哲学："一张卡 = 一个知识点 × 4 套人格视角"
 * 不是为每个人格单独生成 4 张卡（用户切人格看不到对应版本），
 * 而是一张卡同时存 4 套人格的差异化字段，前端按 active personality
 * 选哪几个字段渲染。这跟 mockContentEngine 的设计哲学一致。
 *
 * Token 代价：单卡 prompt 4x 大，但避免重复生成 4 套独立卡片。
 */
export interface FlashcardCardData {
  /** 共享原料（所有人格都用） */
  baseQa: {
    keyword: string       // 核心关键词，如 "RAG"、"幻觉"
    definition: string    // 精准定义（1-2 句）
  }
  /** 学习理论锚定（跟当前 vault active personality 对应） */
  theoryByPersonality: {
    student: { name: string; shortDesc: string; citation: string }
    cert: { name: string; shortDesc: string; citation: string }
    explorer: { name: string; shortDesc: string; citation: string }
    strict: { name: string; shortDesc: string; citation: string }
  }
  /** 4 人格各自的差异化字段 */
  byPersonality: {
    student: {
      question: string
      example: string
      hint: string
    }
    cert: {
      question: string
      examFrequency: "high" | "mid" | "low"
      examTrap: string
      mnemonic: string
    }
    explorer: {
      question: string
      crossDomain: string
      counterfactual: string
    }
    strict: {
      question: string
      socraticQuestions: string[]
      socraticDialogues: Array<{ bubbles: string[] }>
    }
  }
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
  // ⚠️ 关键：必须显式设 timeout / maxRetries。
  // OpenAI SDK 默认 timeout=600000ms(10分钟) + maxRetries=2，
  // 一次卡住的 DeepSeek 请求最坏要 ~30 分钟才放弃，期间 vault 一直停在
  // processing，前端轮询永远等不到 done/failed → 页面「正在定制计划」无限转圈。
  // 这里收紧到单请求 60s 超时、最多重试 1 次：卡住的调用会及时抛错，
  // 流水线 catch 后把 vault 标记 failed，前端轮询拿到 failed 即可退出。
  return new OpenAI({
    baseURL,
    apiKey,
    timeout: 60_000,
    maxRetries: 1,
  })
}

const AI_MODEL = () => process.env.AI_MODEL || "deepseek-chat"

// ---------- 工具函数：调用 AI 并解析 JSON ----------

/**
 * 调用 AI 并把返回内容解析成 JSON 对象。
 *
 * 健壮性处理（针对 DeepSeek 实际表现）：
 *   1. 显式设 max_tokens=8000：默认 4096 容易把较长的 JSON 截断，
 *      导致 "questions" 数组只输出一半、结尾缺 } ] → JSON.parse 必失败。
 *   2. 剥掉偶发的 ```json ... ``` markdown 包裹。
 *   3. 兜底截取第一个 { 到最后一个 }，去掉模型可能加的前后缀废话。
 *   4. 失败重试一次（temperature 0.7，重新生成往往就正常了）。
 *   5. 失败时把完整原文 + finish_reason 打到日志，便于排查（之前只记前 200 字）。
 */
async function callAIJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const client = getAIClient()

  const requestOnce = async (): Promise<{ raw: string; finishReason: string | null }> => {
    const response = await client.chat.completions.create({
      model: AI_MODEL(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 8000, // deepseek-chat 输出上限 8192，留余量避免 JSON 被截断
    })
    return {
      raw: response.choices[0]?.message?.content ?? "",
      finishReason: response.choices[0]?.finish_reason ?? null,
    }
  }

  const tryParse = (raw: string): T | null => {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "")
      .trim()
    try {
      return JSON.parse(cleaned) as T
    } catch {
      // 兜底：截取最外层 {...}，去掉模型可能加的前后缀
      const start = cleaned.indexOf("{")
      const end = cleaned.lastIndexOf("}")
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1)) as T
        } catch {
          return null
        }
      }
      return null
    }
  }

  // 第 1 次
  let { raw, finishReason } = await requestOnce()
  let parsed = tryParse(raw)
  if (parsed) return parsed

  console.error(
    `[plan.service] JSON 解析失败（第1次）finish_reason=${finishReason} 长度=${raw.length}\n----RAW----\n${raw}\n----END----`,
  )

  // 第 2 次重试
  ;({ raw, finishReason } = await requestOnce())
  parsed = tryParse(raw)
  if (parsed) return parsed

  console.error(
    `[plan.service] JSON 解析失败（第2次）finish_reason=${finishReason} 长度=${raw.length}\n----RAW----\n${raw}\n----END----`,
  )
  throw new Error(`AI 返回的 JSON 格式错误（已重试）: ${raw.slice(0, 200)}`)
}

// ---------- 截取文本，避免超出 Token 限制 ----------

function truncateText(text: string, maxChars = 6000): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + "\n...[内容已截断]"
}

/**
 * 给文本注入页码 marker：把 pageMap 的页边界处插入 `[P{N}]` 标签。
 * AI 看到这些 marker 就能在输出 sourcePages 时引用正确的页码。
 *
 * 例：
 *   原文 "...第一页内容...第二页内容..."
 *   注入后："[P1] ...第一页内容...[P2] ...第二页内容..."
 *
 * 没有 pageMap 时返回原文（向后兼容 docx/txt 等无页面概念的文件）。
 */
function injectPageMarkers(text: string, pageMap?: PageMap): string {
  if (!pageMap || pageMap.pages.length === 0) return text

  // 从后往前插入，避免 offset 偏移
  const pages = [...pageMap.pages].sort((a, b) => b.startOffset - a.startOffset)
  let result = text
  for (const p of pages) {
    if (p.startOffset >= 0 && p.startOffset <= result.length) {
      result =
        result.slice(0, p.startOffset) +
        `[P${p.pageNumber}] ` +
        result.slice(p.startOffset)
    }
  }
  return result
}

// ---------- 生成学习计划 ----------

/**
 * 根据文本内容生成 N 天学习计划
 *
 * @param textContent  parseFile 提取的纯文本
 * @param totalDays    天数上限（AI 会根据原文复杂度在 5..totalDays 之间自决最合理天数）
 */
export interface GeneratePlanOptions {
  /** 页码映射 —— 注入 [P{N}] marker 让 AI 输出 sourcePages 时引用真实页码 */
  pageMap?: PageMap
  /** 人格 */
  personality?: string | null
}

export async function generatePlan(
  textContent: string,
  totalDays: number,
  personalityOrOptions?: string | null | GeneratePlanOptions,
): Promise<StudyPlanResult> {
  // 向后兼容：第三个参数既可以是字符串（旧接口）也可以是 options 对象
  const opts: GeneratePlanOptions =
    typeof personalityOrOptions === "object" && personalityOrOptions !== null
      ? personalityOrOptions
      : { personality: personalityOrOptions as string | null | undefined }

  const today = new Date().toISOString().slice(0, 10)
  // 注入页码 marker 让 AI 能输出 sourcePages
  const textWithPages = injectPageMarkers(textContent, opts.pageMap)
  const excerpt = truncateText(textWithPages, 8000)
  const hasPages = !!opts.pageMap && opts.pageMap.pages.length > 0

  // v2.4：天数从"硬要求 N 天"改成"5..N 之间根据原文复杂度自决"。
  // 简单资料（10 页内的概念说明）不应该硬撑 14 天；
  // 复杂资料（80 页技术书）也不该被压缩到 14 天。
  // 让 AI 按内容真实复杂度评估，写进简历能讲："基于原文章节数 / 知识密度 /
  // 概念依赖深度三维拟合学习周期，避免硬编码导致的学习体验失真"。
  const minDays = Math.max(5, Math.min(7, Math.floor(totalDays / 2)))
  const taskPrompt = `你是一名专业的学习规划师。用户给你一份学习材料，你需要拟合一份**合理天数**的学习计划。

【天数自决规则 —— 重要】
- 天数上限：${totalDays} 天
- 天数下限：${minDays} 天
- 你必须根据原文**真实复杂度**在 ${minDays}-${totalDays} 之间选择最合理的天数，不要为凑数硬撑或硬压
- 判断依据：① 章节/小节数量 ② 核心概念数量 ③ 概念之间的依赖深度 ④ 总字数粗略对应的阅读时长
- 例子：
  · 10 页基础概念说明 → 5-7 天合理
  · 30-50 页带练习的教程 → 9-12 天合理
  · 80+ 页系统教材 → 接近上限 ${totalDays} 天

${
  hasPages
    ? `**页码 marker**：文本中夹杂 \`[P1]\` \`[P2]\` 表示原文页边界。
每一天必须根据 topics 来源给出 sourcePages（页码数组）。
`
    : ""
}

输出严格为 JSON：
{
  "title": "计划标题（简洁，含材料名称）",
  "totalDays": <你自决的天数，必须等于 days.length>,
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "topics": ["今日学习主题1", "主题2"],
      "goals": ["完成目标1", "目标2"],
      "estimatedMinutes": 60,
      "sourcePages": [1, 2, 3],
      "extractedPoints": ["核心点1（精炼到一行）", "核心点2", "核心点3"],
      "reasoning": "为什么这一天这么拆 —— 2-3 句话，解释这天 topics 在整本资料里的位置/作用/学习路径上的依据"
    }
  ]
}

要求：
- 覆盖材料全部核心知识点，循序渐进
- 每天 topics 1-3 个，goals 1-3 条
- **estimatedMinutes 必须根据当天 topics 的实际复杂度给出合理估算**：
  · 概念入门 / 基础回顾 / 简单复习类：30-45 分钟
  · 核心方法 / 案例对照类：45-75 分钟
  · 深入综合 / 多概念串联 / 实操类：75-120 分钟
  · **不要全部 60 分钟懒省事**，让总时长真实反映学习投入
- date 从 ${today} 开始，每天递增一天
${
  hasPages
    ? '- sourcePages 必须是原文中实际出现的页码（来自 [P{N}] marker），用 number 数组，最多 6 个最相关页'
    : '- 如果文本没有页码 marker，sourcePages 留空数组 []'
}
- extractedPoints 是这天 AI 提炼的 3-5 个核心知识点，每个一行内
- reasoning 是给用户看的"AI 拆解理由"，要解释**为什么**这天拆出这几个 topic（比如"这是 X 概念的前置基础"、"为后续 Y 章节铺垫"），不要重复 topic 名
- 只输出 JSON，不要任何额外文字`

  const userPrompt = `材料内容如下：\n\n${excerpt}`

  const systemPrompt = composeSystemPrompt(opts.personality, taskPrompt)
  const result = await callAIJSON<StudyPlanResult>(systemPrompt, userPrompt)

  // 安全校验
  if (!result.title || !Array.isArray(result.days) || result.days.length === 0) {
    throw new Error("AI 返回的学习计划结构不完整")
  }

  // 字段净化：确保 sourcePages 是数字数组、extractedPoints 是字符串数组
  const cleanedDays = result.days.map((d) => ({
    day: d.day,
    date: d.date,
    topics: Array.isArray(d.topics) ? d.topics : [],
    goals: Array.isArray(d.goals) ? d.goals : [],
    estimatedMinutes: typeof d.estimatedMinutes === "number" ? d.estimatedMinutes : 60,
    sourcePages: Array.isArray(d.sourcePages)
      ? d.sourcePages.filter((n): n is number => typeof n === "number" && n > 0)
      : [],
    extractedPoints: Array.isArray(d.extractedPoints)
      ? d.extractedPoints.filter((s): s is string => typeof s === "string")
      : [],
    reasoning: typeof d.reasoning === "string" ? d.reasoning : "",
  }))

  return {
    title: result.title,
    totalDays: cleanedDays.length,
    days: cleanedDays,
  }
}

// ---------- 生成闪卡 ----------

/**
 * 根据单天学习内容生成闪卡
 *
 * @param dayContent  当天的学习主题和目标拼接文本
 * @param count       生成数量（默认 10）
 */
/**
 * v2.5++ 多人格闪卡 prompt
 *
 * 关键设计：一张卡 = 1 个知识点 × 4 套人格视角字段同时生成。
 *   学生党字段 → example（举例）+ hint（易混点提示）
 *   考证型字段 → examFrequency + examTrap + mnemonic
 *   兴趣探索字段 → crossDomain + counterfactual
 *   严苛教练字段 → socraticQuestions + socraticDialogues
 *
 * 这样前端就能根据用户当前激活的人格，从同一张卡里选对应字段渲染，
 * 用户切人格按钮 → 闪卡立即切版式（贴近 mock 体验）。
 */
const MULTI_PERSONALITY_CARD_SCHEMA = `cardData 结构（一张卡同时包含 4 人格字段）：
{
  "baseQa": {
    "keyword": "本卡核心关键词（短，3-8 字）",
    "definition": "精准定义（1-2 句，所有人格共享）"
  },
  "theoryByPersonality": {
    "student": { "name": "认知负荷理论", "shortDesc": "渐进披露，分块呈现，控制工作记忆负荷", "citation": "Sweller, 1988" },
    "cert":    { "name": "检索练习", "shortDesc": "主动提取比被动复读记得更牢", "citation": "Roediger & Karpicke, 2006" },
    "explorer":{ "name": "远距离迁移", "shortDesc": "跨域类比促进深度理解和远迁移", "citation": "Gick & Holyoak, 1980" },
    "strict":  { "name": "生成效应 + 苏格拉底式", "shortDesc": "主动生成答案 + 反问引导，深度内化", "citation": "Slamecka & Graf, 1978" }
  },
  "byPersonality": {
    "student": {
      "question": "想象你在跟同学解释：什么是「<keyword>」？",
      "example": "至少 2 句的真实生活/工作场景举例，要具体，不要抽象比喻",
      "hint": "易混点提示：告诉用户最容易跟什么概念搞混 + 怎么区分"
    },
    "cert": {
      "question": "【高频/中频/低频考点】「<keyword>」的标准定义？",
      "examFrequency": "high",
      "examTrap": "命题陷阱：考官最容易用什么相似概念做干扰项，2-3 句",
      "mnemonic": "记忆口诀：用一个朗朗上口的短句/缩写帮助记忆"
    },
    "explorer": {
      "question": "「<keyword>」可以跟哪个其他领域的概念类比？为什么？",
      "crossDomain": "跨学科类比：把这个概念跟一个完全不同领域（生物/物理/历史/艺术等）的概念关联起来，2-3 句",
      "counterfactual": "反事实追问：如果这个概念在某个极端场景不成立会怎样？这条边界比定义本身更值得思考"
    },
    "strict": {
      "question": "用你自己的话，30 秒内解释「<keyword>」。先在心里答完，再翻面对照。",
      "socraticQuestions": [
        "第一个反问：从反例角度问",
        "第二个反问：从边界条件问",
        "第三个反问：从易混淆概念问"
      ],
      "socraticDialogues": [
        { "bubbles": ["对每个反问的引导对话第 1 句（教练人设，简短直接）", "第 2 句（提示思路）", "第 3 句（最后给一个具体策略）"] },
        { "bubbles": ["对第二个反问的引导对话 3 句", "...", "..."] },
        { "bubbles": ["对第三个反问的引导对话 3 句", "...", "..."] }
      ]
    }
  }
}`

export async function generateFlashcards(
  dayContent: string,
  count: number,
  personality?: string | null,
): Promise<FlashcardResult[]> {
  // 第一轮：尝试 multi-personality 完整版（含 strict.socraticDialogues 9 句对话）
  try {
    const result = await tryGenerateMultiCards(dayContent, count, personality, false)
    if (result.length > 0) return result
  } catch (e) {
    console.warn(
      `[plan.service] multi-cards 第一轮失败（可能 token 超），降级再试：`,
      e instanceof Error ? e.message : e,
    )
  }

  // 第二轮：降级——strict 只留 socraticQuestions 3 句，不要 socraticDialogues
  // 大幅减少输出 token，保证 4 张/天能塞进 8000 输出上限
  return tryGenerateMultiCards(dayContent, count, personality, true)
}

async function tryGenerateMultiCards(
  dayContent: string,
  count: number,
  personality: string | null | undefined,
  lightStrict: boolean,
): Promise<FlashcardResult[]> {
  const strictBlock = lightStrict
    ? `    "strict": {
      "question": "用你自己的话，30 秒内解释「<keyword>」。",
      "socraticQuestions": ["反问 1（反例角度）", "反问 2（边界条件）", "反问 3（易混概念）"]
    }`
    : `    "strict": {
      "question": "用你自己的话，30 秒内解释「<keyword>」。先在心里答完，再翻面对照。",
      "socraticQuestions": ["反问 1（反例）", "反问 2（边界）", "反问 3（易混）"],
      "socraticDialogues": [
        { "bubbles": ["教练话 1", "提示话 2", "策略话 3"] },
        { "bubbles": ["...", "...", "..."] },
        { "bubbles": ["...", "...", "..."] }
      ]
    }`

  const schema = `cardData 结构（一张卡同时含 4 人格字段）：
{
  "baseQa": { "keyword": "核心关键词 3-8 字", "definition": "精准定义 1-2 句" },
  "theoryByPersonality": {
    "student": { "name": "认知负荷", "shortDesc": "渐进披露", "citation": "Sweller, 1988" },
    "cert":    { "name": "检索练习", "shortDesc": "主动提取", "citation": "Roediger, 2006" },
    "explorer":{ "name": "远距离迁移", "shortDesc": "跨域类比", "citation": "Gick, 1980" },
    "strict":  { "name": "苏格拉底式", "shortDesc": "反问引导", "citation": "Slamecka, 1978" }
  },
  "byPersonality": {
    "student": { "question": "想象你跟同学解释「<keyword>」？", "example": "真实场景举例 2 句", "hint": "易混点提示" },
    "cert": { "question": "【高/中/低频考点】「<keyword>」？", "examFrequency": "high", "examTrap": "命题陷阱 2 句", "mnemonic": "记忆口诀" },
    "explorer": { "question": "「<keyword>」可类比哪个领域？", "crossDomain": "跨学科类比 2 句", "counterfactual": "反事实追问" },
${strictBlock}
  }
}`

  const taskPrompt = `你是教育专家，生成 ${count} 张闪卡。每张卡的 cardData 必须同时含 4 人格字段。

【规则】
1. 4 人格字段必须真有差异，不能 4 套填一样
2. baseQa.keyword 所有人格 question 要包含
3. front=兜底问题，back=兜底答案文本（用 definition）

${schema}

输出 JSON：
{ "flashcards": [ { "front": "...", "back": "...", "cardData": { ... } } ] }

只输出 JSON，不要 markdown 包裹。`

  const userPrompt = `今日学习内容：${dayContent}`

  const systemPrompt = composeSystemPrompt(personality, taskPrompt)
  const result = await callAIJSON<{ flashcards: FlashcardResult[] }>(systemPrompt, userPrompt)

  if (!Array.isArray(result.flashcards)) {
    throw new Error("AI 返回的闪卡结构不完整")
  }

  // 字段净化 + byPersonality 4 人格字段必须都在
  const cleaned = result.flashcards
    .slice(0, count)
    .map<FlashcardResult>((f) => {
      const cd = f.cardData as FlashcardCardData | undefined
      const valid =
        cd &&
        typeof cd === "object" &&
        typeof cd.baseQa === "object" &&
        typeof cd.byPersonality === "object" &&
        cd.byPersonality?.student &&
        cd.byPersonality?.cert &&
        cd.byPersonality?.explorer &&
        cd.byPersonality?.strict
      return {
        front: typeof f.front === "string" ? f.front : "",
        back: typeof f.back === "string" ? f.back : "",
        cardData: valid ? cd : null,
      }
    })

  return cleaned
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
