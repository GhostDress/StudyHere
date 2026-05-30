// ============================================================
// StudyHere v2.2 · 智谱 Embedding 客户端
// ------------------------------------------------------------
// 用途：把 chunk 文本算成 1024 维向量，存到 chunks.embedding 列（pgvector）
//
// 模型：智谱 embedding-2（开放平台，中文友好，1024 维，价格 ~¥0.5/M tokens）
// 接口文档：https://open.bigmodel.cn/dev/api#text_embedding
//
// 设计：
//   - 批量优先：智谱单次最多 64 条 input，能批量绝不单条
//   - 内置重试：429/5xx 指数回退最多 3 次
//   - 限流：默认 5 req/s（智谱免费档约 5 QPS，留缓冲）
//   - 不缓存：chunk 文本变了向量必须重算，缓存价值低
//   - 错误抛出：调用方决定是 fail-fast 还是降级用 BGE
// ============================================================

const BASE_URL =
  process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4"
const API_KEY = process.env.ZHIPU_API_KEY
const MODEL = process.env.ZHIPU_EMBEDDING_MODEL ?? "embedding-2"

if (!API_KEY) {
  // 不在 import 时崩，让 dev server 能起；调用时再报
  console.warn(
    "[embedding.ts] 缺少 ZHIPU_API_KEY，RAG 算向量会失败。检查 apps/api/.env",
  )
}

const BATCH_SIZE = 64
const MAX_RETRIES = 3
const RATE_LIMIT_PER_SEC = 5

// ============ 限流器 ============

let queue: Array<() => void> = []
let lastTickAt = 0

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    queue.push(resolve)
    drainQueue()
  })
}

function drainQueue() {
  const now = Date.now()
  const interval = 1000 / RATE_LIMIT_PER_SEC
  const wait = Math.max(0, lastTickAt + interval - now)
  if (queue.length === 0) return
  setTimeout(() => {
    const resolve = queue.shift()
    if (resolve) {
      lastTickAt = Date.now()
      resolve()
    }
    drainQueue()
  }, wait)
}

// ============ 主接口 ============

interface ZhipuEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>
  model: string
  usage?: { prompt_tokens: number; total_tokens: number }
}

/**
 * 算单条向量。
 * 适合 RAG 检索时算 query 向量（单条更直接）。
 */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text])
  return vec
}

/**
 * 批量算向量。
 * 自动分批（每批最多 BATCH_SIZE 条）、自动限流、自动重试。
 *
 * @param texts 多条待算文本
 * @returns 同长度向量数组，索引一一对应
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!API_KEY) {
    throw new Error("[embedding.ts] 缺少 ZHIPU_API_KEY，无法算向量")
  }
  if (texts.length === 0) return []

  const result: number[][] = new Array(texts.length)

  // 分批
  for (let batchStart = 0; batchStart < texts.length; batchStart += BATCH_SIZE) {
    const batch = texts.slice(batchStart, batchStart + BATCH_SIZE)
    await acquireSlot()
    const vecs = await callWithRetry(batch)
    for (let i = 0; i < vecs.length; i++) {
      result[batchStart + i] = vecs[i]
    }
  }

  return result
}

async function callWithRetry(batch: string[]): Promise<number[][]> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callZhipu(batch)
    } catch (e) {
      lastErr = e
      const status = (e as { status?: number }).status
      // 4xx 非 429 不重试（请求本身有问题，重试也无用）
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw e
      }
      if (attempt < MAX_RETRIES) {
        const backoff = Math.min(2 ** attempt * 500, 8000) // 0.5s, 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  }
  throw lastErr
}

async function callZhipu(batch: string[]): Promise<number[][]> {
  const url = `${BASE_URL}/embeddings`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: batch,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    const err = new Error(
      `智谱 embedding API ${res.status}: ${errText.slice(0, 200)}`,
    ) as Error & { status: number }
    err.status = res.status
    throw err
  }

  const json = (await res.json()) as ZhipuEmbeddingResponse
  // 按 index 字段重排（智谱可能不按输入顺序返回，保险起见）
  const sorted = [...json.data].sort((a, b) => a.index - b.index)
  return sorted.map((d) => d.embedding)
}

// ============ pgvector 序列化辅助 ============

/**
 * 把 number[] 转成 pgvector 期望的字符串字面量：'[0.1,0.2,0.3]'。
 * Prisma $queryRaw 写向量时必须用这种格式，否则报类型错。
 *
 * 示例：
 *   await prisma.$executeRaw`UPDATE chunks SET embedding = ${vecToPg(vec)}::vector WHERE id = ${id}`
 */
export function vecToPg(vec: number[]): string {
  return `[${vec.join(",")}]`
}
