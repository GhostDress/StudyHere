// ============================================================
// AI 统一客户端
// ------------------------------------------------------------
// 为什么单独抽这个文件：
//   1. 全项目所有 AI 调用走同一个 client，方便统一加日志/重试/超时
//   2. 模型 provider 通过环境变量切换（DeepSeek / 通义 / Kimi 都兼容 OpenAI SDK）
//   3. 未来换 provider 只改 .env，不改业务代码 —— Vendor Lock-in 对抗
// ============================================================

import OpenAI from "openai"

const baseURL = process.env.AI_BASE_URL
const apiKey = process.env.AI_API_KEY
const defaultModel = process.env.AI_MODEL ?? "deepseek-chat"

if (!baseURL || !apiKey) {
  throw new Error(
    "[ai.ts] 缺少环境变量 AI_BASE_URL / AI_API_KEY，请检查 apps/api/.env",
  )
}

export const aiClient = new OpenAI({ baseURL, apiKey })

export const AI_MODEL = defaultModel

/**
 * 调用 AI 并强制返回 JSON 对象
 *
 * 为什么单独包一层：
 *   - AI 经常在 JSON 外面套 ```json ... ``` Markdown 包裹
 *   - 偶尔会输出"我帮你生成了如下 JSON："这种废话前缀
 *   - 这里统一做清洗，业务代码拿到的就是干净的对象
 */
export async function chatJSON<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const completion = await aiClient.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  })

  const raw = completion.choices[0]?.message?.content ?? ""
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    console.error("[ai.ts] AI 返回内容不是合法 JSON：", raw)
    throw new Error(`AI 返回内容解析失败：${(err as Error).message}`)
  }
}
