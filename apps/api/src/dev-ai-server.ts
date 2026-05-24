// ============================================================
// dev-ai-server.ts
// ------------------------------------------------------------
// 给前端开发用的轻量 AI 服务（跳过数据库 / Supabase / 认证）
// 端口：3001
// ------------------------------------------------------------
// 启动：cd apps/api && npx tsx watch src/dev-ai-server.ts
// 用途：前端 Mock 模式关闭后调这个，验证 DeepSeek 真实闭环
// 与 D 的 src/index.ts 完全独立，不影响生产部署
// ============================================================

import "dotenv/config"
import { writeFile, mkdir, readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { parseFile } from "./services/parser.service"
import {
  generatePlan,
  generateFlashcards,
  generateQuestions,
  type StudyPlanResult,
  type FlashcardResult,
  type QuestionResult,
} from "./services/plan.service"

const PORT = 3001
const DEFAULT_PLAN_DAYS = 7   // 开发用 7 天，省 token + 等待时间短

// ---------- 内存缓存（dev only，重启即失） ----------
interface VaultRecord {
  id: string
  filename: string
  mimeType: string
  filePath: string
  status: "pending" | "processing" | "done" | "failed"
  errorMsg: string | null
  createdAt: string
  textContent?: string
  plan?: StudyPlanResult
  flashcards?: Array<FlashcardResult & { id: string; dayIndex: number; mastery: number }>
  questions?: Array<QuestionResult & { id: string; dayIndex: number }>
}

const vaults = new Map<string, VaultRecord>()

// ---------- 异步处理流水线 ----------
async function processVault(vaultId: string): Promise<void> {
  const vault = vaults.get(vaultId)
  if (!vault) return
  vault.status = "processing"
  try {
    console.log(`[Pipeline] ${vaultId} 开始解析文件: ${vault.filename}`)
    const textContent = await parseFile(vault.filePath, vault.mimeType)
    vault.textContent = textContent
    console.log(`[Pipeline] ${vaultId} 解析完成，文字长度: ${textContent.length}`)

    console.log(`[Pipeline] ${vaultId} 调用 DeepSeek 生成 ${DEFAULT_PLAN_DAYS} 天计划...`)
    const plan = await generatePlan(textContent, DEFAULT_PLAN_DAYS)
    vault.plan = plan
    console.log(`[Pipeline] ${vaultId} 计划生成完成：${plan.title}`)

    // 只为第一天生成 flashcards / questions，省 token + 加速
    const day1 = plan.days[0]
    if (day1) {
      const dayContent = `${day1.topics.join("、")}：${day1.goals.join("；")}`

      console.log(`[Pipeline] ${vaultId} 生成 Day1 闪卡...`)
      const flashcards = await generateFlashcards(dayContent, 4)
      vault.flashcards = flashcards.map((f, i) => ({
        ...f,
        id: `fc-${vaultId}-${i}`,
        dayIndex: 1,
        mastery: 0,
      }))

      console.log(`[Pipeline] ${vaultId} 生成 Day1 题目...`)
      const questions = await generateQuestions(dayContent, 3)
      vault.questions = questions.map((q, i) => ({
        ...q,
        id: `q-${vaultId}-${i}`,
        dayIndex: 1,
      }))
    }

    vault.status = "done"
    console.log(`[Pipeline] ✅ ${vaultId} 全部完成`)
  } catch (err) {
    vault.status = "failed"
    vault.errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Pipeline] ❌ ${vaultId} 失败:`, vault.errorMsg)
  }
}

// ---------- HTTP 服务 ----------
const app = new Hono()
app.use("*", logger())
app.use("*", cors({ origin: "*" }))

app.get("/health", (c) =>
  c.json({ status: "ok", time: new Date().toISOString(), vaultCount: vaults.size }),
)

// 上传：multipart/form-data, file 字段
app.post("/api/vault/upload", async (c) => {
  const form = await c.req.formData()
  const file = form.get("file") as File | null
  if (!file) return c.json({ error: "缺少 file 字段" }, 400)

  const id = `vlt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const tmpDir = path.join(tmpdir(), "studyhere-dev")
  await mkdir(tmpDir, { recursive: true })
  const filePath = path.join(tmpDir, `${id}-${file.name}`)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const record: VaultRecord = {
    id,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    filePath,
    status: "pending",
    errorMsg: null,
    createdAt: new Date().toISOString(),
  }
  vaults.set(id, record)

  // 异步处理，不阻塞 HTTP 响应
  processVault(id).catch((err) => console.error(`Pipeline crash ${id}:`, err))

  return c.json({
    success: true,
    vaultId: id,
    filename: record.filename,
    fileUrl: `local://${id}`,
    status: record.status,
  })
})

// 列表
app.get("/api/vault", (c) => {
  const list = Array.from(vaults.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((v) => ({
      id: v.id,
      filename: v.filename,
      fileUrl: `local://${v.id}`,
      status: v.status,
      errorMsg: v.errorMsg,
      createdAt: v.createdAt,
    }))
  return c.json({ vaults: list })
})

// 查询状态（前端轮询用）
app.get("/api/plan/:id/status", (c) => {
  const id = c.req.param("id")
  const vault = vaults.get(id)
  if (!vault) return c.json({ status: "failed", errorMsg: "vault 不存在" }, 404)
  return c.json({
    vaultId: id,
    planId: vault.plan ? id : undefined,
    status: vault.status,
    errorMsg: vault.errorMsg,
  })
})

// 计划详情
app.get("/api/plan/:id", (c) => {
  const id = c.req.param("id")
  const vault = vaults.get(id)
  if (!vault) return c.json({ error: "vault 不存在" }, 404)
  if (!vault.plan) return c.json({ error: "计划尚未生成" }, 404)
  return c.json({
    plan: {
      id,
      title: vault.plan.title,
      totalDays: vault.plan.totalDays,
      vaultId: id,
      createdAt: vault.createdAt,
      planData: vault.plan,
    },
  })
})

// 闪卡
app.get("/api/flashcard", (c) => {
  const planId = c.req.query("planId")
  if (!planId) return c.json({ error: "缺少 planId" }, 400)
  const vault = vaults.get(planId)
  return c.json({ flashcards: vault?.flashcards ?? [] })
})

// 题目
app.get("/api/question", (c) => {
  const planId = c.req.query("planId")
  if (!planId) return c.json({ error: "缺少 planId" }, 400)
  const vault = vaults.get(planId)
  return c.json({ questions: vault?.questions ?? [] })
})

// 提交答案
app.post("/api/answer", async (c) => {
  const body = await c.req.json<{ questionId: string; userAnswer: string }>()
  // 在所有 vault 里找这个题
  for (const vault of vaults.values()) {
    const q = vault.questions?.find((x) => x.id === body.questionId)
    if (q) {
      return c.json({
        isCorrect: q.correct === body.userAnswer,
        correctAnswer: q.correct,
        explanation: q.explanation,
      })
    }
  }
  return c.json({ error: "题目不存在" }, 404)
})

// 闪卡 mastery（mock，不持久化）
app.patch("/api/flashcard/:id", async (c) => {
  const body = await c.req.json<{ mastery: number }>()
  return c.json({ flashcard: { id: c.req.param("id"), mastery: body.mastery } })
})

// 简化的登录（dev 用，不验证）
app.post("/api/auth/send-otp", () => Response.json({ success: true }))
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ email: string }>()
  return c.json({
    success: true,
    token: `dev-${Date.now()}`,
    user: { id: "dev-user", email: body.email, name: body.email.split("@")[0] },
  })
})

console.log(`🚀 dev-ai-server starting on http://localhost:${PORT}`)
console.log(`   AI Provider: ${process.env.AI_BASE_URL}`)
console.log(`   AI Model:    ${process.env.AI_MODEL}`)

serve({ fetch: app.fetch, port: PORT })
