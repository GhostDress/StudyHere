// ============================================================
// StudyHere v2.2 · RAG 检索 service
// ------------------------------------------------------------
// 职责：
//   1. 把用户问题算成向量
//   2. 在 chunks 表里按余弦相似度找 TopK 相关 chunks
//   3. 阈值过滤 + 兜底（未命中 → KG 邻近实体 / 显式拒答）
//   4. 拼 prompt 喂给 AI，返回带溯源的答案
//
// 设计原则：
//   - 严格"基于原文作答"：system prompt 强制 AI 不能用自己知识补充
//   - 双层兜底：阈值过滤 + AI 自己判断（system prompt 写"原文无关就拒答"）
//   - 不联网：v2.3 信任链路核心是"AI 说的话都来自用户上传的资料"
// ============================================================

import { prisma } from "../lib/prisma"
import { embedText, vecToPg } from "../lib/embedding"
import { aiClient, AI_MODEL } from "../lib/ai"
import { composeSystemPrompt } from "../prompts/personalities"

// ============ 类型 ============

export interface RetrievedChunk {
  id: string
  text: string
  pageStart: number
  pageEnd: number
  orderIndex: number
  /** 余弦相似度，范围 0-1，越大越相关 */
  similarity: number
}

export interface RagAnswer {
  /** AI 答案（已基于原文，附溯源） */
  answer: string
  /** 答案引用的 chunks（前端用来渲染"📖 来自 P12-15"溯源面板） */
  sources: RetrievedChunk[]
  /** 未命中标志：true 表示数据库里没有相关原文，answer 是兜底文案 */
  notFound: boolean
}

// ============ 配置 ============

const TOPK = 5
const SIMILARITY_THRESHOLD = 0.65  // 智谱 embedding-2 经验值；上线后跑 30 个 query 调
const MAX_CONTEXT_CHARS = 4000     // 喂 AI 的总 context 上限（防 prompt 爆）

// ============ 主接口 ============

/**
 * 在指定 vault 内做语义检索，返回 TopK 相关 chunks。
 *
 * 用法：
 *   const chunks = await retrieveChunks(vaultId, "MVP 是啥")
 *   // chunks.filter(c => c.similarity >= SIMILARITY_THRESHOLD)
 *
 * 注意：这只做检索，不调 AI。AI 对话场景请用 ragAnswer。
 */
export async function retrieveChunks(
  vaultId: string,
  query: string,
  topK = TOPK,
): Promise<RetrievedChunk[]> {
  if (!query.trim()) return []

  const queryVec = await embedText(query)
  const pgVec = vecToPg(queryVec)

  // pgvector 余弦距离用 `<=>` 运算符（值越小越相似）
  // 转换成相似度：similarity = 1 - distance
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      text: string
      pageStart: number
      pageEnd: number
      orderIndex: number
      distance: number
    }>
  >`
    SELECT
      id,
      text,
      "pageStart",
      "pageEnd",
      "orderIndex",
      embedding <=> ${pgVec}::vector AS distance
    FROM chunks
    WHERE "vaultId" = ${vaultId}
      AND embedding IS NOT NULL
    ORDER BY distance ASC
    LIMIT ${topK}
  `

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    pageStart: r.pageStart,
    pageEnd: r.pageEnd,
    orderIndex: r.orderIndex,
    similarity: 1 - Number(r.distance),
  }))
}

/**
 * RAG 问答：检索 + 阈值过滤 + AI 生成 + 兜底。
 *
 * 流程：
 *   1. 检索 TopK chunks
 *   2. 阈值过滤（< 0.65 视为不相关）
 *   3. 全过滤掉 → 兜底（KG 邻近实体推荐 / 显式拒答）
 *   4. 有相关 chunks → 喂 AI 答（严格 system prompt）
 */
export async function ragAnswer(
  vaultId: string,
  question: string,
  // v2.5：注入 vault 当前激活人格，让 RAG 追问的语气也跟着 4 套教育学理论走
  // （之前 RAG/chat 完全没传人格，所有追问口吻都一致）
  personality?: string | null,
): Promise<RagAnswer> {
  // 1. 检索
  const allChunks = await retrieveChunks(vaultId, question, TOPK)

  // 2. 阈值过滤
  const relevant = allChunks.filter((c) => c.similarity >= SIMILARITY_THRESHOLD)

  // 3. 未命中：兜底（v1 先做"显式拒答"，KG 邻近推荐留 v2 加）
  if (relevant.length === 0) {
    return {
      answer: buildFallbackAnswer(allChunks),
      sources: [],
      notFound: true,
    }
  }

  // 4. 控制 context 长度（防 prompt 爆）
  const usedChunks = trimToMaxChars(relevant, MAX_CONTEXT_CHARS)

  // 5. 喂 AI
  const answer = await callAi(question, usedChunks, personality)

  return {
    answer,
    sources: usedChunks,
    notFound: false,
  }
}

// ============ AI 调用 ============

const SYSTEM_PROMPT = `你是一个严格基于"用户上传资料"作答的学习助手。

【绝对规则】
1. 你只能用下面提供的"原文片段"作答，不能用你自己的知识补充
2. 如果原文片段不足以回答用户问题，你必须明确说："根据你上传的资料，这部分内容我没有找到。"
3. 答案末尾必须用「📖 来自 P{页码}」标注来源（多页用 P12, P15, P18 这种格式）
4. 用简洁中文回答，不要寒暄、不要"根据您提供的资料……"这种废话
5. 引用原文时用「」括起来，让用户能直接核对`

async function callAi(
  question: string,
  context: RetrievedChunk[],
  personality?: string | null,
): Promise<string> {
  const contextStr = context
    .map(
      (c, i) =>
        `[原文片段 ${i + 1} · P${c.pageStart}${
          c.pageEnd > c.pageStart ? `-${c.pageEnd}` : ""
        }]\n${c.text}`,
    )
    .join("\n\n")

  const userPrompt = `用户问题：${question}\n\n${contextStr}`

  // v2.5：把 personality 前缀 prompt 拼在严格基于原文 SYSTEM_PROMPT 之前。
  //   语气走人格 / 严格性走 SYSTEM_PROMPT —— 两者互不冲突。
  const systemPrompt = composeSystemPrompt(personality, SYSTEM_PROMPT)

  const completion = await aiClient.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2, // 低温度 = 别瞎发挥
  })

  return completion.choices[0]?.message?.content?.trim() ?? ""
}

// ============ 兜底 ============

function buildFallbackAnswer(nearChunks: RetrievedChunk[]): string {
  if (nearChunks.length === 0) {
    return "根据你上传的资料，这部分内容我没有找到。建议你换一种问法，或者上传更多相关资料。"
  }
  // 相关度都没过阈值，但还是给个最接近的页码引导
  const nearest = nearChunks[0]
  return `根据你上传的资料，这部分内容我没有找到。但你可以看看 P${nearest.pageStart}${
    nearest.pageEnd > nearest.pageStart ? `-${nearest.pageEnd}` : ""
  } 附近的内容，可能跟你想问的方向相关。`
}

// ============ 内部工具 ============

function trimToMaxChars(
  chunks: RetrievedChunk[],
  maxChars: number,
): RetrievedChunk[] {
  const result: RetrievedChunk[] = []
  let total = 0
  for (const c of chunks) {
    if (total + c.text.length > maxChars && result.length > 0) break
    result.push(c)
    total += c.text.length
  }
  return result
}
