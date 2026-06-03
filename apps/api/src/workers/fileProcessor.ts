import { writeFile, mkdir, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { prisma } from "../lib/prisma"
import { supabaseAdmin, STORAGE_BUCKET } from "../lib/supabase"

import { parseFileWithPages } from "../services/parser.service"
import { generatePlan, generateFlashcards, generateQuestions } from "../services/plan.service"
import { buildChunksFromText, embedChunksForVault } from "../services/chunk.service"

// v2.4：传给 generatePlan 的天数现在是"上限"，AI 在 5-N 间根据原文复杂度自决。
// 上限设 21 而非 14，给系统教材一些空间；简单资料 AI 自己会缩到 5-10 天。
const DEFAULT_PLAN_DAYS = 21
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

    // 4. 提取文字内容 + 页码映射（v2.3 slice 2 改造）
    const mimeType = blob.type || guessMimeByFilename(vault.filename)
    const { text: textContent, pageMap } = await parseFileWithPages(
      tmpFilePath,
      mimeType,
    )
    console.log(
      `[Worker] 解析完成，文字 ${textContent.length} 字符 · ${pageMap.pages.length} 页`,
    )

    await prisma.vault.update({
      where: { id: vaultId },
      data: { textContent },
    })

    // 4.1 v2.3 slice 2：切 chunks 入库 + 算向量（RAG 基础设施）
    //    入库即可触发 plan 生成（chunks 已就绪，等向量算完才能 RAG 检索，
    //    但 plan/flashcard 生成只需要 text 不需要向量，所以先 commit 后跑 embed）
    await buildChunksFromText({
      vaultId: vault.id,
      documentId: null,
      text: textContent,
      pageMap,
      startOrderIndex: 0,
    })

    // 异步算向量（不 await，让 plan 流程先跑——算 1k 向量约 5 秒，平行干）
    // 注意：异步抛错不能炸主流程，单独 catch 记日志
    embedChunksForVault(vault.id).catch((e) => {
      console.error(
        `[Worker] ⚠️ vault ${vault.id} 向量回填失败（不阻塞主流程）:`,
        e instanceof Error ? e.message : e,
      )
    })

    // 5. 生成学习计划
    // v2.3 slice 2：传 pageMap 给 generatePlan，让 AI 输出 sourcePages
    const plan = await generatePlan(textContent, DEFAULT_PLAN_DAYS, {
      pageMap,
    })

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

    // 6. 立即标记完成 —— plan-confirm 页只读 planData.days，不依赖闪卡/题目。
    //    ⚠️ 关键修复：以前要等 28 次串行 DeepSeek 调用（10 闪卡 + 5 题 ×14 天）
    //    全部跑完才标 done，期间前端一直转圈，AI 一慢就「无限转圈」。
    //    现在 plan 一生成就标 done，前端立刻跳转；闪卡/题目放后台慢慢补。
    await prisma.vault.update({
      where: { id: vaultId },
      data: { status: "done" },
    })
    console.log(`[Worker] ✅ vault 处理完成（plan 就绪，闪卡/题目后台生成）: ${vaultId}`)

    // 7. 后台懒生成闪卡 + 题目（不 await，不阻塞主流程，单独 catch 不炸）
    generateCardsInBackground(studyPlan.id, plan.days).catch((e) => {
      console.error(
        `[Worker] ⚠️ plan ${studyPlan.id} 闪卡/题目后台生成失败（不影响计划使用）:`,
        e instanceof Error ? e.message : e,
      )
    })
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

/**
 * 后台逐天生成闪卡 + 题目。
 * 每天独立 try/catch：某一天某一类失败不影响其它天，尽量多补一点是一点。
 * 这个函数在 vault 标记 done 之后才被 fire-and-forget 调用，不阻塞用户进入计划页。
 */
async function generateCardsInBackground(
  planId: string,
  days: { day: number; topics: string[]; goals: string[] }[],
): Promise<void> {
  for (const day of days) {
    const dayContent = `${day.topics.join("、")}：${day.goals.join("；")}`

    try {
      const flashcards = await generateFlashcards(dayContent, FLASHCARDS_PER_DAY)
      if (flashcards.length > 0) {
        await prisma.flashcard.createMany({
          data: flashcards.map((f) => ({
            planId,
            front: f.front,
            back: f.back,
            dayIndex: day.day,
          })),
        })
      }
    } catch (e) {
      console.error(
        `[Worker] ⚠️ 第 ${day.day} 天闪卡生成失败（跳过）:`,
        e instanceof Error ? e.message : e,
      )
    }

    try {
      const questions = await generateQuestions(dayContent, QUESTIONS_PER_DAY)
      if (questions.length > 0) {
        await prisma.question.createMany({
          data: questions.map((q) => ({
            planId,
            content: q.content,
            options: q.options as any,
            correct: q.correct,
            explanation: q.explanation,
            dayIndex: day.day,
          })),
        })
      }
    } catch (e) {
      console.error(
        `[Worker] ⚠️ 第 ${day.day} 天题目生成失败（跳过）:`,
        e instanceof Error ? e.message : e,
      )
    }
  }
  console.log(`[Worker] 📚 plan ${planId} 全部闪卡和题目后台生成完成`)
}

// 把 Supabase 公开 URL 转换为 bucket 内部路径
// 例：https://xxx.supabase.co/storage/v1/object/public/user-files/uid/123-file.pdf → uid/123-file.pdf
function extractObjectPath(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  return publicUrl.slice(idx + marker.length)
}

// 根据文件名猜测 MIME 类型（兜底）
function guessMimeByFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "application/pdf"
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (ext === "doc") return "application/msword"
  if (ext === "txt") return "text/plain"
  return "application/octet-stream"
}
