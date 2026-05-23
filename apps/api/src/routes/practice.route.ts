import { Hono } from "hono"
import { z } from "zod"
import { prisma } from "../lib/prisma"
import { authMiddleware, type AuthVariables } from "../middleware/auth"

const practice = new Hono<{ Variables: AuthVariables }>()

practice.use("*", authMiddleware)

// 校验：plan 属于当前用户
async function assertPlanOwner(planId: string, userId: string) {
  const p = await prisma.studyPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  })
  return !!p
}

// ---------- 闪卡 ----------

// GET /api/flashcard?planId=xxx
practice.get("/flashcard", async (c) => {
  const user = c.get("user")
  const planId = c.req.query("planId")
  if (!planId) return c.json({ error: "缺少 planId 参数" }, 400)
  if (!(await assertPlanOwner(planId, user.userId))) {
    return c.json({ error: "学习计划不存在或无权访问" }, 404)
  }

  const flashcards = await prisma.flashcard.findMany({
    where: { planId },
    orderBy: [{ dayIndex: "asc" }, { id: "asc" }],
  })
  return c.json({ flashcards })
})

// PATCH /api/flashcard/:id
const masterySchema = z.object({ mastery: z.number().int().min(0).max(5) })

practice.patch("/flashcard/:id", async (c) => {
  const user = c.get("user")
  const id = c.req.param("id")
  const body = await c.req.json().catch(() => null)
  const parsed = masterySchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "mastery 必须为 0-5 的整数" }, 400)

  // 校验所属用户
  const card = await prisma.flashcard.findFirst({
    where: { id, plan: { userId: user.userId } },
    select: { id: true },
  })
  if (!card) return c.json({ error: "闪卡不存在" }, 404)

  const updated = await prisma.flashcard.update({
    where: { id },
    data: { mastery: parsed.data.mastery },
  })
  return c.json({ flashcard: updated })
})

// ---------- 题目 ----------

// GET /api/question?planId=xxx — 随机返回 20 道
practice.get("/question", async (c) => {
  const user = c.get("user")
  const planId = c.req.query("planId")
  if (!planId) return c.json({ error: "缺少 planId 参数" }, 400)
  if (!(await assertPlanOwner(planId, user.userId))) {
    return c.json({ error: "学习计划不存在或无权访问" }, 404)
  }

  // PostgreSQL 用 ORDER BY random() 取随机 20 条
  const questions = await prisma.$queryRaw<
    Array<{
      id: string
      content: string
      options: unknown
      correct: string
      explanation: string
      dayIndex: number
    }>
  >`
    SELECT id, content, options, correct, explanation, "dayIndex"
    FROM questions
    WHERE "planId" = ${planId}
    ORDER BY random()
    LIMIT 20
  `

  return c.json({ questions })
})

// POST /api/answer — 提交答题，错则写错题本
const answerSchema = z.object({
  questionId: z.string().uuid("questionId 必须是 UUID"),
  userAnswer: z.string().min(1, "答案不能为空"),
})

practice.post("/answer", async (c) => {
  const user = c.get("user")
  const body = await c.req.json().catch(() => null)
  const parsed = answerSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.errors[0].message }, 400)

  const { questionId, userAnswer } = parsed.data

  // 校验题目所属用户
  const question = await prisma.question.findFirst({
    where: { id: questionId, plan: { userId: user.userId } },
  })
  if (!question) return c.json({ error: "题目不存在或无权访问" }, 404)

  const isCorrect = question.correct === userAnswer

  // 记答题
  await prisma.answerRecord.create({
    data: { userId: user.userId, questionId, userAnswer, isCorrect },
  })

  // 错题本（upsert：第一次创建，后续递增计数）
  if (!isCorrect) {
    await prisma.wrongQuestion.upsert({
      where: {
        userId_questionId: { userId: user.userId, questionId },
      },
      create: { userId: user.userId, questionId, wrongCount: 1 },
      update: {
        wrongCount: { increment: 1 },
        lastWrongAt: new Date(),
      },
    })
  }

  return c.json({
    isCorrect,
    correctAnswer: question.correct,
    explanation: question.explanation,
  })
})

// ---------- 错题本 ----------

// GET /api/wrong-question
practice.get("/wrong-question", async (c) => {
  const user = c.get("user")

  const items = await prisma.wrongQuestion.findMany({
    where: { userId: user.userId },
    orderBy: { wrongCount: "desc" },
    include: {
      question: {
        select: {
          id: true,
          content: true,
          options: true,
          correct: true,
          explanation: true,
        },
      },
    },
  })

  return c.json({ wrongQuestions: items })
})

export default practice
