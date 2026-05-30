import { readFile } from "node:fs/promises"
import path from "node:path"
import type { PageMap } from "../lib/chunker"

/**
 * 文件解析结果：纯文本 + pageMap（offset → 页码 映射）。
 *
 * 为什么要 pageMap：
 *   v2.3 slice 2 chunker 需要把每个 chunk 反查到原文页码（PdfDrawer 跳页用）。
 *   不带 pageMap 的话 chunks 表 pageStart/pageEnd 没法填。
 *
 * 非 PDF 文件（docx/txt）没有"页"概念，pageMap 只有一页伪页面（pageNumber=1）。
 */
export interface ParsedFile {
  text: string
  pageMap: PageMap
}

/**
 * 从本地临时文件提取纯文本 + pageMap。
 *
 * v2.3 slice 2 起改造：之前只返回 text，现在多返回 pageMap 给 chunker 用。
 * 老调用方拿 .text 字段即可（向后兼容）。
 *
 * @param filePath  服务器上的临时文件绝对路径（/tmp/studyhere/...）
 * @param mimeType  文件 MIME 类型，如 "application/pdf"
 */
export async function parseFileWithPages(
  filePath: string,
  mimeType: string,
): Promise<ParsedFile> {
  const ext = path.extname(filePath).toLowerCase()
  const buffer = await readFile(filePath)

  // ---- PDF：用 pdf-parse v2 API 拿每页文本 ----
  if (mimeType === "application/pdf" || ext === ".pdf") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const result = await parser.getText({ partial: false })
      return buildPagedResult(result.pages)
    } finally {
      await parser.destroy?.()
    }
  }

  // ---- Word (.docx) ----
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return buildSinglePageResult(result.value)
  }

  // ---- Word (.doc 旧格式) ----
  if (mimeType === "application/msword" || ext === ".doc") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return buildSinglePageResult(result.value)
  }

  // ---- 纯文本兜底 ----
  if (mimeType === "text/plain" || ext === ".txt") {
    const raw = buffer.toString("utf-8")
    return buildSinglePageResult(raw)
  }

  throw new Error(`不支持的文件类型: mimeType=${mimeType}, ext=${ext}`)
}

/**
 * v0.1 兼容：保留原签名只返回 text 字符串。
 * 新代码请用 parseFileWithPages 同时拿 pageMap。
 */
export async function parseFile(
  filePath: string,
  mimeType: string,
): Promise<string> {
  const { text } = await parseFileWithPages(filePath, mimeType)
  return text
}

// ============================================================
// 内部工具
// ============================================================

interface RawPdfPage {
  num: number
  text: string
}

function buildPagedResult(rawPages: RawPdfPage[]): ParsedFile {
  // pages 按页码升序排（pdf-parse 一般已经是有序，保险起见）
  const sorted = [...rawPages].sort((a, b) => a.num - b.num)

  const pieces: string[] = []
  const pageMap: PageMap = { pages: [] }
  let offset = 0

  for (const p of sorted) {
    const cleaned = cleanText(p.text)
    const startOffset = offset
    const endOffset = offset + cleaned.length

    pageMap.pages.push({
      pageNumber: p.num,
      startOffset,
      endOffset,
    })

    pieces.push(cleaned)
    offset = endOffset

    // 页与页之间补一个换行（不计入 pageMap，方便 chunker 在页边界优雅切分）
    pieces.push("\n\n")
    offset += 2
  }

  // 拼出来的最后一段尾巴是 "\n\n"，去掉
  const fullText = pieces.join("").replace(/\n\n$/, "").trim()

  // 因为最后 trim 掉了 \n\n，修正 pageMap 末页的 endOffset 不超过 fullText.length
  if (pageMap.pages.length > 0) {
    const last = pageMap.pages[pageMap.pages.length - 1]
    if (last.endOffset > fullText.length) last.endOffset = fullText.length
  }

  return { text: fullText, pageMap }
}

function buildSinglePageResult(raw: string): ParsedFile {
  const text = cleanText(raw)
  return {
    text,
    pageMap: {
      pages: [{ pageNumber: 1, startOffset: 0, endOffset: text.length }],
    },
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n") // 统一换行符
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // 3+ 连续空行 → 2 行
    .replace(/[ \t]+\n/g, "\n") // 行末空白
    .trim()
}
