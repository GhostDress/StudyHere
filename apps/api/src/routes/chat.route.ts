// ============================================================
// StudyHere v2.2 · AI 对话 API
// ------------------------------------------------------------
// 路由：
//   POST /api/chat/:vaultId  — 基于 vault 的 chunks 做 RAG 问答
//
// 入参：{ question: string }
// 出参：RagAnswer = { answer, sources, notFound }
//
// 设计：
//   - vault 维度隔离（不会跨 vault 检索）
//   - 不存对话历史（本期 stateless，多轮对话留后续）
//   - 错误处理：智谱 / AI 报错返回 502 + 用户友好文案
// ============================================================

import { Hono } from "hono"
import { prisma } from "../lib/prisma"
import { authMiddleware, type AuthVariables } from "../middleware/auth"
import { ragAnswer } from "../services/rag.service"

const chat = new Hono<{ Variables: AuthVariables }>()

chat.use("*", authMiddleware)

// POST /api/chat/:vaultId — 问 AI（基于该 vault 的 chunks）
chat.post("/:vaultId", async (c) => {
  const user = c.get("user")
  const vaultId = c.req.param("vaultId")

  // 校验 vault 归属
  const vault = await prisma.vault.findFirst({
    where: { id: vaultId, userId: user.userId },
    select: { id: true, status: true },
  })
  if (!vault) {
    return c.json({ error: "资料不存在或无权访问" }, 404)
  }
  if (vault.status !== "done") {
    return c.json(
      { error: "资料还在处理中，请等待解析完成再提问" },
      409,
    )
  }

  // 解析请求
  const body = await c.req.json().catch(() => null)
  const question = body?.question
  if (typeof question !== "string" || !question.trim()) {
    return c.json({ error: "缺少 question 字段" }, 400)
  }
  if (question.length > 500) {
    return c.json({ error: "问题过长（限 500 字以内）" }, 400)
  }

  // 跑 RAG
  try {
    const result = await ragAnswer(vaultId, question.trim())
    return c.json(result)
  } catch (err) {
    console.error(`[chat] vault ${vaultId} RAG 失败:`, err)
    const msg = err instanceof Error ? err.message : "未知错误"
    return c.json(
      {
        error: "AI 暂时无法回答，请稍后再试",
        detail: msg.slice(0, 200),
      },
      502,
    )
  }
})

export default chat
