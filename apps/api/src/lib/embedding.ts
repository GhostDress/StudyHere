// ============================================================
// StudyHere v2.2 · 智谱 Embedding 客户端
// ------------------------------------------------------------
// 用途：把 chunk 文本算成 1024 维向量，存到 chunks.embedding 列（pgvector）
//
// 模型：智谱 embedding-2（开放平台，中文友好，1024 维，价格 ~¥0.5/M tokens）
// 接口文档：https://docs.bigmodel.cn/cn/guide/models/embedding/embedding-2
//
// 设计：
//   - 批量优先：embedding-2 支持数组 input，能批量绝不单条
//   - 内置重试：429/5xx 指数回退最多 3 次
//   - 限流：默认 5 req/s（智谱免费档约 5 QPS，留缓冲）
//   - 不缓存：chunk 文本变了向量必须重算，缓存价值低
//   - 错误抛出：调用方决定是 fail-fast 还是降级用 BGE
//
// v2.5 修复 · 智谱 1210「参数有误」根因 + 修法：
//   智谱 embedding-2 硬限制：单条 ≤ 512 token，整批合计 ≤ 8K token。
//   旧实现固定按"条数 64"分批 × 单条 ~500 字符 ≈ 16K+ token，超 8K 上限
//   2 倍多 → 凡是 chunk 数 ≥ ~16 的文档（稍大点的 PDF）整批必爆 1210。
//
//   改成按"字符预算"分批：
//     1) 单条入参先截断到 MAX_CHARS_PER_INPUT 防 overlap 把单条顶过 512 token
//     2) 累计字符数到 MAX_CHARS_PER_BATCH 就切批，留足缓冲到 8K token 以下
//     3) 字符 ↔ token 换算：中文最坏 1 字符 ≈ 1 token，留 25% 余量 → 6000 字符
//
//   chunk.service 那一侧外层 BATCH=64 是 prisma transaction 大小，不动。
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

// v2.5：单条 ≤ 500 字符（embedding-2 单条 512 token 上限，留缓冲）
const MAX_CHARS_PER_INPUT = 500
// v2.5：单次请求合计 ≤ 4500 字符（embedding-2 整批 8K token 上限）
//   D 生产复现测 3：64 条 × 650 字 = ~24 万字节 payload 必 1210，所以
//   不能光看 token 还要看 payload。4500 字符 ≈ 6750 token，离 8K
//   有 1250 缓冲，且 payload 远低于 1210 触发阈值。
const MAX_CHARS_PER_BATCH = 4500
// 保留作为「条数硬上限」防极端短 chunk 撑爆请求体
const MAX_ITEMS_PER_BATCH = 64
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

  // v2.5：先对每条做截断（防单条爆 512 token），同时跳过空串
  //   截断不会改变 chunk 文本本身，只影响向量计算时喂给智谱的字数
  const trimmedTexts = texts.map((t) =>
    t.length > MAX_CHARS_PER_INPUT ? t.slice(0, MAX_CHARS_PER_INPUT) : t,
  )

  const result: number[][] = new Array(texts.length)

  // v2.5：按"字符预算"切批，不再固定 64 条
  let batchStart = 0
  while (batchStart < trimmedTexts.length) {
    // 找出本批末尾：要么累计字符达 MAX_CHARS_PER_BATCH，要么条数达 MAX_ITEMS_PER_BATCH
    let batchEnd = batchStart
    let chars = 0
    while (batchEnd < trimmedTexts.length) {
      const next = trimmedTexts[batchEnd].length
      // 至少塞 1 条（防超长单条 + 字符预算的死循环）
      if (batchEnd > batchStart && chars + next > MAX_CHARS_PER_BATCH) break
      if (batchEnd - batchStart >= MAX_ITEMS_PER_BATCH) break
      chars += next
      batchEnd++
    }

    const batch = trimmedTexts.slice(batchStart, batchEnd)
    await acquireSlot()
    const vecs = await callWithRetry(batch)
    for (let i = 0; i < vecs.length; i++) {
      result[batchStart + i] = vecs[i]
    }
    batchStart = batchEnd
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
