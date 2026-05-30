// ============================================================
// StudyHere v2.2 · chunks 表服务（RAG 基础设施层）
// ------------------------------------------------------------
// 职责：
//   1. 把 parseFile 的产物（text + pageMap）切成 chunks，批量写库
//   2. 异步算向量回填（不阻塞上传链路，用户先看到 plan）
//   3. 暴露 listChunksByVault 给 plan.service 改造 prompt 时用
//
// 为什么不用 prisma.chunk.create：
//   - embedding 列是 vector(1024)，Prisma 标记 Unsupported，client 写不进去
//   - 但 prisma.$executeRaw + ::vector cast 能写
//   - 非 embedding 字段也能用 prisma.chunk.createMany 批量写，向量列后续 update
//
// 设计：
//   - 入库：用 createMany 写 chunks（无 embedding），1 次 SQL
//   - 算向量：批量调 embedBatch（智谱单次 64 条）后逐条 update
//   - 整个过程在 fileProcessor 流水线中**同步** 走完（不开新 worker）
//     原因：算 1k 向量约 5 秒，比 plan/flashcard 生成快，没必要异步
//     但 embedChunksForVault 分开导出，未来要异步化只需把它扔到 BullMQ
// ============================================================

import { prisma } from "../lib/prisma"
import { chunkTextWithPages, type PageMap, type PagedChunk } from "../lib/chunker"
import { embedBatch, vecToPg } from "../lib/embedding"

const DEFAULT_CHUNK_OPTIONS = {
  maxSize: 500,
  overlap: 50,
  minSize: 80,
}

interface BuildChunksInput {
  vaultId: string
  documentId?: string | null  // null = 主文件（Vault.fileUrl）
  text: string
  pageMap: PageMap
  startOrderIndex?: number    // vault 内已有 chunk 数，新切的接在后面
}

interface ChunkRecord {
  id: string
  text: string
  pageStart: number
  pageEnd: number
  orderIndex: number
}

/**
 * 把 text + pageMap 切 chunks 入库（不算向量）。
 *
 * 返回新建的 chunk 记录列表（含 id + text + pageStart/pageEnd）。
 * 调用方可以立即拿这些 chunk 给 plan.service 当 AI prompt 输入用。
 */
export async function buildChunksFromText(
  input: BuildChunksInput,
): Promise<ChunkRecord[]> {
  const { vaultId, documentId, text, pageMap, startOrderIndex = 0 } = input

  const pagedChunks: PagedChunk[] = chunkTextWithPages(
    text,
    pageMap,
    DEFAULT_CHUNK_OPTIONS,
  )

  if (pagedChunks.length === 0) return []

  // prisma createMany 批量写
  const created = await prisma.$transaction(async (tx) => {
    const rows = pagedChunks.map((c) => ({
      vaultId,
      documentId: documentId ?? null,
      text: c.text,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      orderIndex: startOrderIndex + c.index,
      charCount: c.charCount,
    }))

    // createMany 不返回 id，所以分两步：插入 + 回查
    await tx.chunk.createMany({ data: rows })

    // 回查刚插入的 chunks（按 orderIndex 范围）
    const inserted = await tx.chunk.findMany({
      where: {
        vaultId,
        orderIndex: {
          gte: startOrderIndex,
          lt: startOrderIndex + pagedChunks.length,
        },
      },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        text: true,
        pageStart: true,
        pageEnd: true,
        orderIndex: true,
      },
    })

    return inserted
  })

  console.log(
    `[chunk.service] vault ${vaultId} 写入 ${created.length} chunks（待算向量）`,
  )
  return created
}

/**
 * 给指定 vault 的所有"待算向量"chunks 调智谱 API 算向量并回填。
 *
 * 设计：
 *   - 一次拉所有 embedding IS NULL 的 chunks（按 orderIndex 排）
 *   - 智谱 batch 64 条 / 次，embedding.ts 内部已限流
 *   - 算完一批 update 一批（防止全算完中间崩了白算）
 *   - 错误处理：单批失败抛出，调用方决定整体 fail 还是降级
 *
 * @returns 算完的 chunk 数量
 */
export async function embedChunksForVault(vaultId: string): Promise<number> {
  // 找待算的 chunks（用 raw query，因为 prisma client 看不到 embedding 列）
  const pending = await prisma.$queryRaw<
    Array<{ id: string; text: string }>
  >`
    SELECT id, text FROM chunks
    WHERE "vaultId" = ${vaultId} AND embedding IS NULL
    ORDER BY "orderIndex" ASC
  `

  if (pending.length === 0) {
    console.log(`[chunk.service] vault ${vaultId} 无待算 chunks`)
    return 0
  }

  console.log(`[chunk.service] vault ${vaultId} 算 ${pending.length} 条向量...`)
  const t0 = Date.now()

  const BATCH = 64
  let done = 0
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH)
    const vecs = await embedBatch(batch.map((c) => c.text))

    // 算完一批立即回填
    await prisma.$transaction(
      batch.map((chunk, idx) =>
        prisma.$executeRaw`
          UPDATE chunks
          SET embedding = ${vecToPg(vecs[idx])}::vector,
              "embeddedAt" = NOW()
          WHERE id = ${chunk.id}
        `,
      ),
    )

    done += batch.length
    console.log(`  ↳ ${done}/${pending.length}`)
  }

  console.log(
    `[chunk.service] ✓ vault ${vaultId} 算完 ${done} 条向量，耗时 ${
      Date.now() - t0
    }ms`,
  )
  return done
}

/**
 * 拉某个 vault 的所有 chunks（按 orderIndex 升序），不含 embedding。
 *
 * 用途：
 *   - plan.service 改造时拿来给 AI prompt 用（带 id 让 AI 输出 sourceChunkIds）
 *   - flashcard.service / question.service 同理
 */
export async function listChunksByVault(vaultId: string): Promise<ChunkRecord[]> {
  return prisma.chunk.findMany({
    where: { vaultId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      text: true,
      pageStart: true,
      pageEnd: true,
      orderIndex: true,
    },
  })
}
