// ============================================================
// chunker 自检脚本（跑 `pnpm --filter api exec tsx src/lib/chunker.test.ts`）
// 不引入 vitest/jest，避免依赖膨胀。
// 通过 = 全部 PASS；失败 = throw + 非 0 退出码。
// ============================================================

import assert from "node:assert/strict"
import {
  chunkText,
  chunkTextWithPages,
  lookupPageRange,
  type PageMap,
} from "./chunker"

let testCount = 0
let passCount = 0

function test(name: string, fn: () => void) {
  testCount++
  try {
    fn()
    passCount++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

console.log("\n[chunker]\n")

test("空文本返回空数组", () => {
  assert.deepEqual(chunkText(""), [])
})

test("短文本（小于 maxSize）单 chunk", () => {
  const result = chunkText("这是一段短文本", { maxSize: 500 })
  assert.equal(result.length, 1)
  assert.equal(result[0].text, "这是一段短文本")
  assert.equal(result[0].startOffset, 0)
  assert.equal(result[0].index, 0)
})

test("长文本按段落切分（双换行）", () => {
  const text =
    "段落 1 内容".padEnd(200, "啊") +
    "\n\n" +
    "段落 2 内容".padEnd(200, "嗯") +
    "\n\n" +
    "段落 3 内容".padEnd(200, "哦")
  const result = chunkText(text, { maxSize: 250, overlap: 0, minSize: 50 })
  assert.ok(result.length >= 2, `期望 ≥2 chunks，实际 ${result.length}`)
  // 每个 chunk 不应超过 maxSize 太多
  for (const c of result) {
    assert.ok(c.text.length <= 280, `chunk 过长: ${c.text.length}`)
  }
})

test("超长无 separator 文本走强切兜底", () => {
  const text = "a".repeat(1500)
  const result = chunkText(text, { maxSize: 500, overlap: 0 })
  assert.ok(result.length >= 3, `期望 ≥3 chunks，实际 ${result.length}`)
})

test("offset 连续且覆盖全文（不丢字）", () => {
  const text =
    "第一段。".padEnd(180, "中") +
    "\n\n" +
    "第二段。".padEnd(180, "文") +
    "\n\n" +
    "第三段。".padEnd(180, "字")
  const result = chunkText(text, { maxSize: 200, overlap: 0 })
  // 主体 offset 加起来应该覆盖整个 text（允许末尾少量 trim 损失）
  const lastEnd = result[result.length - 1].endOffset
  assert.ok(
    lastEnd >= text.length - 5,
    `末 chunk endOffset=${lastEnd}，text.length=${text.length}`,
  )
  // 相邻 chunk 主体 offset 应连续（不重叠）
  for (let i = 1; i < result.length; i++) {
    assert.equal(
      result[i].startOffset,
      result[i - 1].endOffset,
      `chunk ${i} startOffset ≠ chunk ${i - 1} endOffset`,
    )
  }
})

test("overlap 让相邻 chunk 文本有交叠（offset 仍连续）", () => {
  const text = "句一。".padEnd(150, "甲") + "句二。".padEnd(150, "乙") + "句三。".padEnd(150, "丙")
  const result = chunkText(text, { maxSize: 200, overlap: 30, minSize: 50 })
  if (result.length >= 2) {
    // chunk[1] 的 text 应包含 chunk[0] 末尾的字符
    const lastCharsOfFirst = result[0].text.slice(-10)
    // chunk[1] 的 text 开头应该有重叠（含 chunk[0] 末尾）
    assert.ok(
      result[1].text.length > result[1].endOffset - result[1].startOffset,
      "overlap 后 text 长度应大于主体 offset 区间长度",
    )
  }
})

test("minSize 防碎屑（小片合并）", () => {
  // 大量短句，应该合并而不是产出大量碎片
  const text = ("句子。").repeat(100) // 300 字符，全是 3 字短句
  const result = chunkText(text, { maxSize: 200, overlap: 0, minSize: 100 })
  // 期望 ≤ 3 个 chunk（300/100），而不是 100 个碎片
  assert.ok(result.length <= 5, `合并不充分，得到 ${result.length} chunks`)
})

console.log("\n[lookupPageRange]\n")

test("chunk 完全在第 1 页", () => {
  const pageMap: PageMap = {
    pages: [
      { pageNumber: 1, startOffset: 0, endOffset: 500 },
      { pageNumber: 2, startOffset: 500, endOffset: 1000 },
    ],
  }
  assert.deepEqual(lookupPageRange(pageMap, 100, 400), {
    pageStart: 1,
    pageEnd: 1,
  })
})

test("chunk 跨页：第 1-2 页", () => {
  const pageMap: PageMap = {
    pages: [
      { pageNumber: 1, startOffset: 0, endOffset: 500 },
      { pageNumber: 2, startOffset: 500, endOffset: 1000 },
    ],
  }
  assert.deepEqual(lookupPageRange(pageMap, 400, 700), {
    pageStart: 1,
    pageEnd: 2,
  })
})

test("chunk 完全在末页", () => {
  const pageMap: PageMap = {
    pages: [
      { pageNumber: 1, startOffset: 0, endOffset: 500 },
      { pageNumber: 2, startOffset: 500, endOffset: 1000 },
      { pageNumber: 3, startOffset: 1000, endOffset: 1500 },
    ],
  }
  assert.deepEqual(lookupPageRange(pageMap, 1100, 1400), {
    pageStart: 3,
    pageEnd: 3,
  })
})

test("chunk 横跨 3 页", () => {
  const pageMap: PageMap = {
    pages: [
      { pageNumber: 1, startOffset: 0, endOffset: 200 },
      { pageNumber: 2, startOffset: 200, endOffset: 400 },
      { pageNumber: 3, startOffset: 400, endOffset: 600 },
    ],
  }
  assert.deepEqual(lookupPageRange(pageMap, 100, 500), {
    pageStart: 1,
    pageEnd: 3,
  })
})

console.log("\n[chunkTextWithPages 集成]\n")

test("chunks 自带 pageStart/pageEnd/charCount", () => {
  const text = "第一段。".padEnd(180, "甲") + "\n\n" + "第二段。".padEnd(180, "乙")
  const pageMap: PageMap = {
    pages: [
      { pageNumber: 1, startOffset: 0, endOffset: 180 },
      { pageNumber: 2, startOffset: 180, endOffset: text.length },
    ],
  }
  const result = chunkTextWithPages(text, pageMap, { maxSize: 250, overlap: 0 })
  for (const c of result) {
    assert.ok(c.pageStart >= 1, "pageStart 应 ≥ 1")
    assert.ok(c.pageEnd >= c.pageStart, "pageEnd 应 ≥ pageStart")
    assert.equal(c.charCount, c.text.length, "charCount 应等于 text.length")
  }
})

// ============================================================
console.log("")
if (process.exitCode) {
  console.log(`✗ ${testCount - passCount} / ${testCount} 失败`)
  process.exit(process.exitCode)
} else {
  console.log(`✓ ${passCount} / ${testCount} 全部通过`)
}
