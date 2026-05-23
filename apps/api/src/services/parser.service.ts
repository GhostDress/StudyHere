// ============================================================
// C 对接点：文件解析服务
// 把 PDF / Word 文件转成纯文本，供后续 AI 生成计划使用
// ============================================================
// 实现要求：
//   - 支持 PDF（建议 pdfjs-dist 或 pdf-parse）
//   - 支持 Word（建议 mammoth）
//   - 返回干净的纯文本，去掉多余空行
//   - 国内 AI 候选：DeepSeek / 通义千问 / Kimi（不能用 OpenAI）
// ============================================================

/**
 * 从本地临时文件提取纯文本内容
 *
 * @param filePath  服务器上的临时文件绝对路径（/tmp/studyhere/...）
 * @param mimeType  文件 MIME 类型，如 "application/pdf"
 * @returns         提取出的纯文本字符串
 */
export async function parseFile(filePath: string, mimeType: string): Promise<string> {
  // TODO by C：实现真实的文件解析逻辑
  throw new Error(`parseFile 尚未实现（filePath=${filePath}, mimeType=${mimeType}）`)
}
