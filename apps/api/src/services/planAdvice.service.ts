// ============================================================
// StudyHere v2.3+ · Plan Advice Service
// ------------------------------------------------------------
// 第 8 个 AI 调用点（前 7 个见简历项目三《模型选型对接文档》）。
//
// 设计哲学：
//   v2.3 信任链路解决了「AI 提炼对不对」（原文对照、钉住、报错）。
//   但用户更深的怀疑是「这条 14 天的学习路径合不合理」——这是元问题，
//   不在原文里，需要 AI 把「原文摘要 + 当前 plan + 用户背景」一起进上下文。
//
//   关键设计：AI 不只回答「合不合理」，而是输出可执行的修改 action JSON，
//   前端能渲染「[应用] [先不]」按钮，一键调 regenerate 路由（仅重生建议改的天）。
//   这是 v2.3 信任链路在「计划层」的延伸，比 plan-confirm 单纯展示更进一步。
//
// 简历叙事：
//   「针对 AI 计划合理性的对话式校准机制：用户提出元问题（顺序/漏点/个性化）→
//    AI 基于原文 + 当前 plan + 用户背景三层上下文给可执行修改建议 →
//    用户一键应用走重生路径 → 用户每次微调都沉淀为偏好数据。」
// ============================================================

import { chatJSON } from "../lib/ai"

// ---- 三层上下文输入 ----

export interface PlanSnapshot {
  title: string
  totalDays: number
  days: Array<{
    day: number
    topics: string[]
    goals: string[]
    sourcePages?: number[]
  }>
}

export interface AdviceInput {
  question: string // 用户的元问题
  /** 原文截断版（前 N 字 + pageMap 标注，控 token） */
  textExcerpt: string
  /** 当前 plan 完整结构 */
  plan: PlanSnapshot
  /** 已展开的对话历史（可空），让追问能延续 */
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

// ---- 结构化 action 输出 ----
// 关键：让前端能渲染按钮、能一键调 regenerate

export type PlanAction =
  | {
      type: "regenerate_days" // 重生指定天数
      targetDays: number[] // 需要重生的 Day 序号
      hint: string // 给 AI 重生时的额外提示（写进 prompt）
      reason: string // 给用户看的人话理由
    }
  | {
      type: "reorder" // 调整顺序
      newOrder: number[] // 完整新顺序
      reason: string
    }
  | {
      type: "no_change" // AI 认为不用改
      reason: string
    }
  | {
      type: "need_more_info" // AI 需要用户先答某个问题
      question: string // 反问用户的问题
    }

export interface AdviceResult {
  /** 给用户看的 AI 自然语言回答（markdown 友好，可带列表） */
  answer: string
  /** 可执行 action（前端渲染"应用"按钮）。no_change/need_more_info 时按钮被禁掉 */
  action: PlanAction
}

// ---- prompt ----

const SYSTEM_PROMPT = `你是一名 AI 学习计划校准师。用户给你 3 样东西：
1) 一份原文资料的摘要（带 [P{n}] 页码 marker）
2) 当前 AI 为这份资料生成的 N 天学习计划
3) 用户对这个计划的元问题（比如"漏了什么"、"顺序对吗"、"我有 X 基础能不能跳"）

你的任务：
- 给出一个直白、不寒暄的回答（中文，3-6 句，可以分点）
- 同时输出一个可执行 action（JSON）告诉前端要怎么修改

【绝对规则】
1. 回答必须严格基于原文。原文里没说的事不要凭你训练数据的常识补充
   （比如原文没讲波特五力，你也别建议加波特五力，除非用户明确说要加）
2. 用户问"漏了什么"时：检查现有 days 是否覆盖了原文的所有主要章节。
   如果真漏了，target 是缺失主题对应的 Day 编号，hint 写明要补充什么
3. 用户问"顺序对吗"时：基于原文里的章节顺序判断，type 用 "reorder"
4. 用户说"我有 X 基础"时：建议把那些 Day 改成进阶/合并/跳过
5. 一切以"用户能学到东西"为最高准则，不为了显得 AI 智能而强行改

【action 类型】
- regenerate_days: 需要重新生成某几天。targetDays 是数组，hint 是给重生 AI 看的提示
- reorder: 调整顺序但不重生内容。newOrder 是完整的天序列重排
- no_change: 用户问题答了但不用动计划
- need_more_info: 反问用户更多信息（比如不知道用户基础，要先问清楚）

只输出 JSON，结构：
{
  "answer": "给用户看的人话回答...",
  "action": { "type": "regenerate_days", "targetDays": [3,5], "hint": "...", "reason": "..." }
}`

// ---- 主入口 ----

export async function generatePlanAdvice(input: AdviceInput): Promise<AdviceResult> {
  const { question, textExcerpt, plan, history = [] } = input

  // 拼用户 prompt：把三层上下文清晰隔开
  const planSerialized = plan.days
    .map(
      (d) =>
        `Day ${d.day}: ${d.topics.join(" / ")}${
          d.sourcePages?.length ? ` [原文 P${d.sourcePages.join(",")}]` : ""
        }`,
    )
    .join("\n")

  const historyBlock =
    history.length > 0
      ? `\n\n【已有对话历史，请延续语气】\n${history
          .map((m) => `${m.role === "user" ? "用户" : "你"}：${m.content}`)
          .join("\n")}`
      : ""

  const userPrompt = `【原文摘要】
${textExcerpt}

【当前 ${plan.totalDays} 天学习计划：${plan.title}】
${planSerialized}

【用户问题】
${question}${historyBlock}`

  const result = await chatJSON<AdviceResult>(SYSTEM_PROMPT, userPrompt)

  // 防御：AI 偶尔会漏字段或字段类型错，做兜底
  if (!result.answer || typeof result.answer !== "string") {
    throw new Error("AI 返回的 advice 缺少 answer 字段")
  }
  if (!result.action || typeof result.action !== "object") {
    // 没 action 就降级成 no_change，至少能展示回答
    return {
      answer: result.answer,
      action: { type: "no_change", reason: "AI 没给出可执行修改" },
    }
  }
  return result
}
