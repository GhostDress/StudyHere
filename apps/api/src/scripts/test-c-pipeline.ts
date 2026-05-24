// ============================================================
// C 模块端到端冒烟测试
// ------------------------------------------------------------
// 用途：跳过数据库 / Supabase 上传，纯粹验证 C 的代码链路：
//   假文本 → generatePlan → generateFlashcards → generateQuestions
// 跑法：
//   cd apps/api && npx tsx src/scripts/test-c-pipeline.ts
// ============================================================

import "dotenv/config"
import {
  generatePlan,
  generateFlashcards,
  generateQuestions,
} from "../services/plan.service"

const SAMPLE_TEXT = `
机器学习入门讲义

第一章 什么是机器学习
机器学习是人工智能的一个分支，让计算机从数据中学习规律，而不是被显式编程。
传统编程：程序员写规则 → 输入数据 → 输出结果
机器学习：输入数据 + 输出结果 → 模型自动学出规则

第二章 监督学习 vs 无监督学习
监督学习需要带标签的数据，比如告诉模型这张图是猫、那张是狗，让它学会区分。
无监督学习不需要标签，模型自己在数据里找规律，比如把客户按行为分群。

第三章 过拟合与欠拟合
过拟合：模型在训练数据上表现极好，但在新数据上崩溃，说明它"死记硬背"了。
欠拟合：模型连训练数据都学不好，说明能力不够或特征不足。
解决方法包括正则化、增加数据、交叉验证等。

第四章 评估指标
分类任务常用准确率、精确率、召回率、F1 分数。
回归任务常用均方误差 MSE、平均绝对误差 MAE。
不同业务场景对指标的要求不同，比如医疗诊断更看重召回率。
`

async function main() {
  console.log("===== C 模块端到端测试 =====\n")

  // 1. 生成 3 天学习计划（先小数量，省 token）
  console.log("[1/3] 生成 3 天学习计划...")
  const plan = await generatePlan(SAMPLE_TEXT, 3)
  console.log(`  ✅ 计划标题：${plan.title}`)
  console.log(`  ✅ 共 ${plan.days.length} 天`)
  plan.days.forEach((d) =>
    console.log(`    Day ${d.day} (${d.date}): ${d.topics.join("、")}`),
  )

  // 2. 拿第一天内容生成 3 张闪卡
  console.log("\n[2/3] 为 Day 1 生成 3 张闪卡...")
  const day1 = plan.days[0]
  const dayContent = `${day1.topics.join("、")}：${day1.goals.join("；")}`
  const flashcards = await generateFlashcards(dayContent, 3)
  flashcards.forEach((f, i) => {
    console.log(`  ${i + 1}. Q: ${f.front}`)
    console.log(`     A: ${f.back}`)
  })

  // 3. 生成 2 道选择题
  console.log("\n[3/3] 为 Day 1 生成 2 道选择题...")
  const questions = await generateQuestions(dayContent, 2)
  questions.forEach((q, i) => {
    console.log(`  ${i + 1}. ${q.content}`)
    Object.entries(q.options).forEach(([k, v]) => console.log(`     ${k}. ${v}`))
    console.log(`     正确答案：${q.correct}`)
    console.log(`     解析：${q.explanation}`)
  })

  console.log("\n===== ✅ C 模块端到端跑通 =====")
}

main().catch((err) => {
  console.error("\n❌ 测试失败：", err)
  process.exit(1)
})
