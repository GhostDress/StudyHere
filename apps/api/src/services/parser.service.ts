import { readFile } from "node:fs/promises"
import path from "node:path"

/**
 * 从本地临时文件提取纯文本内容
 *
 * @param filePath  服务器上的临时文件绝对路径（/tmp/studyhere/...）
 * @param mimeType  文件 MIME 类型，如 "application/pdf"
 * @returns         提取出的纯文本字符串（已去除多余空行）
 */
export async function parseFile(filePath: string, mimeType: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()

  // ---- PDF ----
  if (mimeType === "application/pdf" || ext === ".pdf") {
    const buffer = await readFile(filePath)
    // pdf-parse v2 改成了 class API：导出 { PDFParse }，不再是可直接调用的函数。
    // 旧写法 require("pdf-parse")(buffer) 会报 "pdfParse is not a function"。
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require("pdf-parse")
    // 构造器接受 Buffer（内部会自动转 Uint8Array）
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return cleanText(result.text)
    } finally {
      // 释放底层 pdfjs 文档，避免内存/句柄泄漏
      await parser.destroy().catch(() => {})
    }
  }

  // ---- Word (.docx) ----
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const buffer = await readFile(filePath)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value)
  }

  // ---- Word (.doc 旧格式，mammoth 也能处理) ----
  if (mimeType === "application/msword" || ext === ".doc") {
    const buffer = await readFile(filePath)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require("mammoth")
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value)
  }

  // ---- 纯文本兜底 ----
  if (mimeType === "text/plain" || ext === ".txt") {
    const raw = await readFile(filePath, "utf-8")
    return cleanText(raw)
  }

  throw new Error(`不支持的文件类型: mimeType=${mimeType}, ext=${ext}`)
}

/**
 * 清理文本：去除多余空行、首尾空白、Windows 换行
 */
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")          // 统一换行符
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")      // 3+ 连续空行 → 2 行
    .replace(/[ \t]+\n/g, "\n")      // 行末空白
    .trim()
}
