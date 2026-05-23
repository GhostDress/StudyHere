import { Hono } from "hono"
import { prisma } from "../lib/prisma"
import { supabaseAdmin, STORAGE_BUCKET } from "../lib/supabase"
import { authMiddleware, type AuthVariables } from "../middleware/auth"
import { processVault } from "../workers/fileProcessor"

const vault = new Hono<{ Variables: AuthVariables }>()

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])
const ALLOWED_EXT = /\.(pdf|doc|docx)$/i

vault.use("*", authMiddleware)

// POST /api/vault/upload
vault.post("/upload", async (c) => {
  const user = c.get("user")

  const form = await c.req.parseBody().catch(() => null)
  if (!form) {
    return c.json({ error: "请求体格式错误，需要 multipart/form-data" }, 400)
  }

  const file = form["file"]
  if (!(file instanceof File)) {
    return c.json({ error: "缺少 file 字段或格式不正确" }, 400)
  }

  // 校验类型
  if (!ALLOWED_MIME.has(file.type) && !ALLOWED_EXT.test(file.name)) {
    return c.json({ error: "仅支持 PDF / Word 文件（.pdf / .doc / .docx）" }, 400)
  }

  // 校验大小
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: `文件超过 50MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` }, 400)
  }
  if (file.size === 0) {
    return c.json({ error: "文件为空" }, 400)
  }

  // 路径：userId/时间戳-文件名，避免重名覆盖
  const safeName = file.name.replace(/[^\w.\-]+/g, "_")
  const objectPath = `${user.userId}/${Date.now()}-${safeName}`

  // 上传到 Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadErr) {
    console.error("Supabase upload error:", uploadErr)
    return c.json({ error: "文件上传失败，请稍后重试" }, 500)
  }

  // 取公开 URL（bucket 是 public 的）
  const { data: urlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(objectPath)

  // 写 vaults 记录
  const record = await prisma.vault.create({
    data: {
      userId: user.userId,
      filename: file.name,
      fileUrl: urlData.publicUrl,
      status: "pending",
    },
  })

  // 异步触发处理流水线（解析 + AI 生成计划/闪卡/题目）
  // 不 await，立即返回响应，前端通过轮询 status 接口拿进度
  setImmediate(() => {
    processVault(record.id).catch((e) =>
      console.error(`[vault.upload] processVault 异常: ${record.id}`, e),
    )
  })

  return c.json({
    success: true,
    vaultId: record.id,
    filename: record.filename,
    fileUrl: record.fileUrl,
    status: record.status,
  })
})

// GET /api/vault — 当前用户所有上传文件
vault.get("/", async (c) => {
  const user = c.get("user")
  const vaults = await prisma.vault.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      fileUrl: true,
      status: true,
      errorMsg: true,
      createdAt: true,
    },
  })
  return c.json({ vaults })
})

// GET /api/vault/:id — 单个文件详情
vault.get("/:id", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")

  const record = await prisma.vault.findFirst({
    where: { id, userId: user.userId },
    select: {
      id: true,
      filename: true,
      fileUrl: true,
      status: true,
      errorMsg: true,
      createdAt: true,
    },
  })

  if (!record) return c.json({ error: "文件不存在" }, 404)
  return c.json({ vault: record })
})

export default vault
