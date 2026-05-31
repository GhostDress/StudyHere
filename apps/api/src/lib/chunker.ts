// ============================================================
// StudyHere v2.2 · 递归语义切分器（RAG 基础设施）
// ------------------------------------------------------------
// 用途：把原文按"递归 separators"切成 200-500 字 chunk，每块保留
//      字符 offset → 用于反查 pageStart/pageEnd（pageMap 在 parseFile 提供）
//
// 设计：
//   1. 不引 LangChain（80 行手写够用，避免 50MB 依赖灾难）
//   2. Separators 按"语义粒度从粗到细"排，优先切标题，标题没了切段落，
//      段落没了切句号——保证不切到句子中间
//   3. MAX 500 字 + OVERLAP 50 字：智谱 embedding 单次 8192 token 上限，
//      500 字远低；50 字重叠避免边界关键句被切断后两个 chunk 都召不回
//   4. 输出 offset：每个 chunk 记录在原文中的 [startOffset, endOffset)，
//      上层调 pageMap.lookup(offset) 反查页码
//
// 不做的：
//   - 不做向量聚类合并（对学习材料过度工程）
//   - 不做 token-aware（中文按字符近似够用）
// ============================================================

export interface ChunkResult {
  text: string
  startOffset: number  // chunk 在原文中的起始字符 offset
  endOffset: number    // chunk 在原文中的结束字符 offset（不含）
  index: number        // 在结果数组里的序号（也就是 orderIndex）
}

export interface ChunkOptions {
  maxSize?: number        // 单 chunk 最大字符数，默认 500
  overlap?: number        // 相邻 chunk 重叠字符数，默认 50
  minSize?: number        // 单 chunk 最小字符数，默认 80（避免大量碎屑）
  separators?: string[]   // 自定义 separators，默认递归集
}

const DEFAULT_SEPARATORS = [
  "\n## ",      // markdown 二级标题
  "\n# ",       // markdown 一级标题
  "\n\n",       // 段落
  "\n",         // 行
  "。",         // 中文句号
  "？",         // 中文问号
  "！",         // 中文感叹号
  ".",          // 英文句号
  "?",          // 英文问号
  "!",          // 英文感叹号
  " ",          // 空格
  "",           // 字符级（兜底，强切）
]

/**
 * 主入口：把 text 切成 chunks。
 *
 * 算法：递归切分
 *   - 用第一个能把文本切到 ≤ maxSize 的 separator 切
 *   - 切出的每段如果还 > maxSize，递归用下一个 separator 切它
 *   - 切完后做合并（chunk 合并到刚好 ≤ maxSize）+ overlap
 */
export function chunkText(text: string, options: ChunkOptions = {}): ChunkResult[] {
  const {
    maxSize = 500,
    overlap = 50,
    minSize = 80,
    separators = DEFAULT_SEPARATORS,
  } = options

  if (!text || text.length === 0) return []

  // 文本本身就够短，单个 chunk
  if (text.length <= maxSize) {
    return [{ text: text.trim(), startOffset: 0, endOffset: text.length, index: 0 }]
  }

  // 第一步：递归切分到原子片段（每片 ≤ maxSize）
  const pieces = recursiveSplit(text, 0, separators, maxSize)

  // 第二步：相邻小片合并到接近 maxSize（避免大量碎屑）
  const merged = mergePieces(pieces, maxSize, minSize)

  // 第三步：相邻 chunk 加 overlap
  const withOverlap = addOverlap(merged, overlap, text)

  // 重新编号
  return withOverlap.map((c, i) => ({ ...c, index: i }))
}

interface Piece {
  text: string
  startOffset: number
  endOffset: number
}

/**
 * 递归切分：用 separators[0] 切，过长的子段用 separators[1] 切，依此类推。
 */
function recursiveSplit(
  text: string,
  baseOffset: number,
  separators: string[],
  maxSize: number,
): Piece[] {
  if (text.length <= maxSize) {
    return [{ text, startOffset: baseOffset, endOffset: baseOffset + text.length }]
  }

  if (separators.length === 0) {
    // 兜底：强切
    return forceSplit(text, baseOffset, maxSize)
  }

  const [sep, ...rest] = separators
  if (sep === "") {
    return forceSplit(text, baseOffset, maxSize)
  }

  // 按 sep 切，保留 sep 在每段末尾（更接近原文语义）
  const pieces: Piece[] = []
  let cursor = 0
  while (cursor < text.length) {
    const idx = text.indexOf(sep, cursor)
    if (idx === -1) {
      // 剩余全归一段
      const piece = text.slice(cursor)
      if (piece.length > 0) {
        pieces.push({
          text: piece,
          startOffset: baseOffset + cursor,
          endOffset: baseOffset + text.length,
        })
      }
      break
    }
    const endIdx = idx + sep.length
    const piece = text.slice(cursor, endIdx)
    pieces.push({
      text: piece,
      startOffset: baseOffset + cursor,
      endOffset: baseOffset + endIdx,
    })
    cursor = endIdx
  }

  // 切完后还有 > maxSize 的，用下一级 separator 递归
  const result: Piece[] = []
  for (const p of pieces) {
    if (p.text.length <= maxSize) {
      result.push(p)
    } else {
      result.push(...recursiveSplit(p.text, p.startOffset, rest, maxSize))
    }
  }
  return result
}

/**
 * 强切：所有 separator 都失败时，每 maxSize 字符硬切一段。
 */
function forceSplit(text: string, baseOffset: number, maxSize: number): Piece[] {
  const pieces: Piece[] = []
  for (let i = 0; i < text.length; i += maxSize) {
    const end = Math.min(i + maxSize, text.length)
    pieces.push({
      text: text.slice(i, end),
      startOffset: baseOffset + i,
      endOffset: baseOffset + end,
    })
  }
  return pieces
}

/**
 * 合并相邻 piece：贪心拼接到接近 maxSize（保留语义连续性，减少 chunk 数）。
 * 太小的（< minSize）也强行并入下一个，避免"半句话"碎屑。
 */
function mergePieces(pieces: Piece[], maxSize: number, minSize: number): Piece[] {
  if (pieces.length === 0) return []

  const merged: Piece[] = []
  let current: Piece = { ...pieces[0] }

  for (let i = 1; i < pieces.length; i++) {
    const next = pieces[i]
    const combined = current.text + next.text

    if (combined.length <= maxSize) {
      // 还能继续装
      current = {
        text: combined,
        startOffset: current.startOffset,
        endOffset: next.endOffset,
      }
    } else if (current.text.length < minSize) {
      // 当前太短，强行吞掉 next（即便超过 maxSize 一点也比留碎屑好）
      current = {
        text: combined,
        startOffset: current.startOffset,
        endOffset: next.endOffset,
      }
    } else {
      // 当前已够长，封板
      merged.push(current)
      current = { ...next }
    }
  }
  merged.push(current)
  return merged
}

/**
 * 给相邻 chunk 加 overlap：从 chunk[i+1] 的前 overlap 字符往 chunk[i] 末尾补，
 * 让边界关键句双向召回。
 * 实现：直接从原文取前后字符，不改 startOffset/endOffset（offset 保持语义"主体范围"，
 * overlap 只在 text 字段体现，下层用 offset 反查页码不受 overlap 影响）。
 */
function addOverlap(pieces: Piece[], overlap: number, fullText: string): Piece[] {
  if (overlap <= 0 || pieces.length <= 1) {
    return pieces.map((p) => ({ ...p, text: p.text.trim() }))
  }

  return pieces.map((p, i) => {
    let head = ""
    let tail = ""
    if (i > 0) {
      const prevEnd = p.startOffset
      const headStart = Math.max(0, prevEnd - overlap)
      head = fullText.slice(headStart, prevEnd)
    }
    if (i < pieces.length - 1) {
      const nextStart = p.endOffset
      const tailEnd = Math.min(fullText.length, nextStart + overlap)
      tail = fullText.slice(nextStart, tailEnd)
    }
    return {
      ...p,
      text: (head + p.text + tail).trim(),
    }
  })
}

// ============================================================
// pageMap：字符 offset → 页码 反查（chunker 不构造它，由 parseFile 喂入）
// ============================================================

export interface PageMap {
  // 每页的 [startOffset, endOffset) 在 fullText 中的位置
  pages: Array<{ pageNumber: number; startOffset: number; endOffset: number }>
}

/**
 * 给定一个 chunk 的字符 offset 范围，反查它跨越的页码区间。
 * 用于 chunks 表的 pageStart / pageEnd 字段。
 *
 * 例：chunk [120, 800)，PageMap 上 page1=[0,500) page2=[500,900)
 *     → pageStart=1, pageEnd=2
 */
export function lookupPageRange(
  pageMap: PageMap,
  startOffset: number,
  endOffset: number,
): { pageStart: number; pageEnd: number } {
  // 找 startOffset 落在哪一页（第一个 startOffset < page.endOffset 的页）
  let pageStart = 1
  for (const p of pageMap.pages) {
    if (startOffset < p.endOffset) {
      pageStart = p.pageNumber
      break
    }
  }
  // 找 endOffset 落在哪一页（最后一个 page.startOffset < endOffset 的页）
  let pageEnd = pageStart
  for (const p of pageMap.pages) {
    if (p.startOffset < endOffset) {
      pageEnd = p.pageNumber
    } else {
      break
    }
  }
  return { pageStart, pageEnd }
}

/**
 * 整合便利函数：text + pageMap → 带页码的 chunks。
 * parseFile 拿到 PDF 文本和 pageMap 后直接调它，输出可入库结构。
 */
export interface PagedChunk extends ChunkResult {
  pageStart: number
  pageEnd: number
  charCount: number
}

export function chunkTextWithPages(
  text: string,
  pageMap: PageMap,
  options: ChunkOptions = {},
): PagedChunk[] {
  const chunks = chunkText(text, options)
  return chunks.map((c) => {
    const { pageStart, pageEnd } = lookupPageRange(pageMap, c.startOffset, c.endOffset)
    return {
      ...c,
      pageStart,
      pageEnd,
      charCount: c.text.length,
    }
  })
}
