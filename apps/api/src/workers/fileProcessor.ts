import { writeFile, mkdir, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { prisma } from "../lib/prisma"
import { supabaseAdmin, STORAGE_BUCKET } from "../lib/supabase"

// =====================================================
// C 的 AI 服务对接点（联调时由 C 实现这些函数，
// 在 apps/api/src/services/ 下放入对应 .ts，然后取消下面的注释）
// =====================================================
// import { parseFile } from "../services/parser.service"
// import { generatePlan, generateFlashcards, generateQuestions } from "../services/plan.service"
// =====================================================

const DEFAULT_PLAN_DAYS = 14
const FLASHCARDS_PER_DAY = 10
const QUESTIONS_PER_DAY = 5

/**
 * 文件处理流水线：上传 → 解析 → AI 生成计划 → 生成闪卡题目
 *
 * 状态机：pending → processing → done / failed
 *
 * 联调前：所有 AI 调用为占位符（控制台打印 TODO）
 * 联调后：由 C 实现的 AI 函数填入占位符位置
 */
export async function processVault(vaultId: string): Promise<void> {
  console.log(`[Worker] 开始处理 vault: ${vaultId}`)

  // 1. 查询 Vault 记录
  const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
  if (!vault) {
    console.error(`[Worker] vault 不存在: ${vaultId}`)
    return
  }
  if (vault.status === "done") {
    console.log(`[Worker] vault 已处理完成，跳过: ${vaultId}`)
    return
  }

  // 2. 标记为处理中
  await prisma.vault.update({
    where: { id: vaultId },
    data: { status: "processing", errorMsg: null },
  })

  let tmpFilePath: string | null = null

  try {
    // 3. 从 Supabase Storage 下载文件到 /tmp
    const objectPath = extractObjectPath(vault.fileUrl)
    if (!objectPath) {
      throw new Error(`无法解析文件路径: ${vault.fileUrl}`)
    }

    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(objectPath)
    if (dlErr || !blob) {
      throw new Error(`下载文件失败: ${dlErr?.message ?? "未知错误"}`)
    }

    const tmpDir = path.join(tmpdir(), "studyhere")
    await mkdir(tmpDir, { recursive: true })
    tmpFilePath = path.join(tmpDir, `${vaultId}-${vault.filename}`)
    const buffer = Buffer.from(await blob.arrayBuffer())
    await writeFile(tmpFilePath, buffer)
    console.log(`[Worker] 文件已下载到: ${tmpFilePath} (${buffer.length} bytes)`)

    // 4. 提取文字内容（C 联调时接入）
    // const textContent = await parseFile(tmpFilePath, blob.type)
    const textContent = await mockParseFile(tmpFilePath, vault.filename)
    console.log(`[Worker] 解析完成，文字长度: ${textContent.length}`)

    await prisma.vault.update({
      where: { id: vaultId },
      data: { textContent },
    })

    // 5. 生成学习计划（C 联调时接入）
    // const plan = await generatePlan(textContent, DEFAULT_PLAN_DAYS)
    const plan = mockGeneratePlan(textContent, DEFAULT_PLAN_DAYS, vault.filename)

    const studyPlan = await prisma.studyPlan.create({
      data: {
        userId: vault.userId,
        vaultId: vault.id,
        title: plan.title,
        totalDays: plan.totalDays,
        planData: plan as any,
      },
    })
    console.log(`[Worker] 学习计划已创建: ${studyPlan.id}`)

    // 6. 逐天生成闪卡 + 题目（C 联调时接入）
    for (const day of plan.days) {
      const dayContent = `${day.topics.join("、")}：${day.goals.join("；")}`

      // const flashcards = await generateFlashcards(dayContent, FLASHCARDS_PER_DAY)
      const flashcards = mockGenerateFlashcards(dayContent, FLASHCARDS_PER_DAY)
      if (flashcards.length > 0) {
        await prisma.flashcard.createMany({
          data: flashcards.map((f) => ({
            planId: studyPlan.id,
            front: f.front,
            back: f.back,
            dayIndex: day.day,
          })),
        })
      }

      // const questions = await generateQuestions(dayContent, QUESTIONS_PER_DAY)
      const questions = mockGenerateQuestions(dayContent, QUESTIONS_PER_DAY)
      if (questions.length > 0) {
        await prisma.question.createMany({
          data: questions.map((q) => ({
            planId: studyPlan.id,
            content: q.content,
            options: q.options as any,
            correct: q.correct,
            explanation: q.explanation,
            dayIndex: day.day,
          })),
        })
      }
    }
    console.log(`[Worker] 全部闪卡和题目生成完成`)

    // 7. 标记完成
    await prisma.vault.update({
      where: { id: vaultId },
      data: { status: "done" },
    })
    console.log(`[Worker] ✅ vault 处理完成: ${vaultId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Worker] ❌ vault 处理失败: ${vaultId}`, message)
    await prisma.vault.update({
      where: { id: vaultId },
      data: { status: "failed", errorMsg: message },
    })
  } finally {
    if (tmpFilePath) {
      await unlink(tmpFilePath).catch(() => {})
    }
  }
}

// 把 Supabase 公开 URL 转换为 bucket 内部路径
// 例：https://xxx.supabase.co/storage/v1/object/public/user-files/uid/123-file.pdf → uid/123-file.pdf
function extractObjectPath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}

// =====================================================
// Mock 实现（联调前用，C 接入后会被真实 AI 函数取代）
// =====================================================

async function mockParseFile(_filePath: string, filename: string): Promise<string> {
  console.log(`[Mock] parseFile 占位实现 - 等 C 接入真实 parser`)
  return `[MOCK] ${filename} 的解析占位内容。联调时由 C 的 parseFile 提供真实文字。`
}

interface MockPlanDay {
  day: number
  date: string
  topics: string[]
  goals: string[]
  estimatedMinutes: number
}

interface MockPlan {
  title: string
  totalDays: number
  days: MockPlanDay[]
}

function mockGeneratePlan(_content: string, days: number, filename: string): MockPlan {
  console.log(`[Mock] generatePlan 占位实现 - 等 C 接入 OpenAI`)
  const today = new Date()
  const planDays: MockPlanDay[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return {
      day: i + 1,
      date: d.toISOString().slice(0, 10),
      topics: [`Day ${i + 1} 主题占位`],
      goals: [`完成 Day ${i + 1} 内容学习（占位）`],
      estimatedMinutes: 60,
    }
  })
  return {
    title: `${filename.replace(/\.[^.]+$/, "")} · 学习计划（占位）`,
    totalDays: days,
    days: planDays,
  }
}

interface MockFlashcard {
  front: string
  back: string
}

function mockGenerateFlashcards(content: string, count: number): MockFlashcard[] {
  console.log(`[Mock] generateFlashcards 占位实现 - 等 C 接入`)
  return Array.from({ length: count }, (_, i) => ({
    front: `[占位] ${content.slice(0, 20)} - 问题 ${i + 1}`,
    back: `[占位] 联调后由 C 的 AI 生成真实答案`,
  }))
}

interface MockQuestion {
  content: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
}

function mockGenerateQuestions(content: string, count: number): MockQuestion[] {
  console.log(`[Mock] generateQuestions 占位实现 - 等 C 接入`)
  return Array.from({ length: count }, (_, i) => ({
    content: `[占位题目 ${i + 1}] 关于 ${content.slice(0, 20)} 的内容，下列说法正确的是？`,
    options: {
      A: "占位选项 A",
      B: "占位选项 B",
      C: "占位选项 C",
      D: "占位选项 D",
    },
    correct: "A" as const,
    explanation: "[占位] 联调后由 C 的 AI 生成真实解析",
  }))
}
