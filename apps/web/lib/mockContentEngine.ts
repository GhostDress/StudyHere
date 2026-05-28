// ============================================================
// StudyHere v2.2 · Mock 内容生成引擎
// ------------------------------------------------------------
// 解决问题：mock 数据是硬编码高数题，跟用户上传的资料 + 人格无关。
//
// 设计原则：
//   1. 根据 vaultName（用户上传的文件名）识别学科类别
//   2. 根据 personality 调整 Q 的问法 + A 的答法 + 选项干扰项设计
//   3. 提供"被这个引擎处理过的"闪卡/题目，让用户能直观感知差异
//
// 这是 mock 期的设计 —— 联调阶段会被真实 AI 调用替换，
// 但 prompt 的"反向约束 + 人格分流"逻辑跟这里一致。
// ============================================================

export type Personality = "student" | "cert" | "explorer" | "strict"

// 学科类别 - 根据文件名关键词识别
export type Subject =
  | "product"      // 产品 / SaaS / 互联网
  | "math"         // 数学 / 高数
  | "law"          // 法考
  | "pmp"          // PMP / 项目管理
  | "language"     // 英语 / 语言
  | "programming"  // 编程
  | "finance"      // 金融 / 财务
  | "general"      // 通用兜底

// v2.2.1：闪卡的结构化数据，每个人格的卡片自己渲染对应版式
export interface FlashcardCard {
  // 人格（用于前端按人格选 layout）
  personality: Personality
  // 问题面（始终展示）
  question: string
  // 答案面 · 结构化内容
  answer: FlashcardAnswer
  // 引用的学习科学理论
  theory: LearningTheory
  // v2.2.1 修订（再次）：可信度 = 真实溯源对象，不再是"AI 自查链路"
  credibility?: {
    /** 来源类型 —— 决定可信度等级和视觉权重 */
    sourceType: "user-doc" | "authority" | "ai-synthesis"
    /** 用户资料来源（sourceType=user-doc）*/
    userDocSource?: {
      quote: string        // 原文内容
      docName: string      // 用户上传的文件名
      location: string     // 章节 / 段落
      previewUrl?: string  // 可跳到资料预览（mock 期可为占位）
    }
    /** 权威外部引用（sourceType=authority）*/
    authoritySource?: {
      title: string        // 书名 / 论文标题
      author: string       // 作者
      year: number         // 出版年
      chapter?: string     // 章节定位
      quote?: string       // 引用原文（可选）
      externalUrl: string  // 真实可跳的链接（Wikipedia / 豆瓣）
    }
    /** AI 综合（sourceType=ai-synthesis）—— 没有直接原文支撑 */
    aiSynthesis?: {
      note: string         // 显式标注"这是 AI 综合归纳"
      suggestedReadings?: Array<{
        title: string
        author: string
        url?: string
      }>
    }
  }
}

export interface FlashcardAnswer {
  // 参考定义（所有人格都有）
  definition: string
  // 学生党：举例段
  example?: string
  // 学生党：易混点提示
  hint?: string
  // 考证型：考点频次
  examFrequency?: "high" | "mid" | "low"
  // 考证型：命题陷阱
  examTrap?: string
  // 考证型：记忆口诀
  mnemonic?: string
  // 兴趣探索：跨学科类比
  crossDomain?: string
  // 兴趣探索：反事实假设
  counterfactual?: string
  // 严苛教练：3 个递进反问
  socraticQuestions?: string[]
  // 严苛教练：每个反问的参考方向（旧字段，向后兼容）
  socraticReferences?: string[]
  // v2.2.1 修订：严苛教练以对话气泡形式给参考方向（更有教练人设）
  socraticDialogues?: Array<{
    bubbles: string[]  // 每个气泡是一句话
  }>
  // v2.2.1：结构化对比表（适合"X vs Y"类知识点）
  comparisonTable?: {
    title: string
    columns: string[]
    rows: string[][]
  }
}

export interface LearningTheory {
  name: string             // 理论名
  shortDesc: string        // 1 句话机制
  citation: string         // 来源（人名 + 年份）
}

// 4 个人格对应的真实教育学理论
const THEORIES: Record<Personality, LearningTheory> = {
  student: {
    name: "认知负荷理论 + 渐进披露",
    shortDesc: "通过限制信息密度 + 生活类比降低初学者的认知负荷",
    citation: "John Sweller, 1988",
  },
  cert: {
    name: "检索练习 + 间隔重复",
    shortDesc: "主动测验比被动阅读记得牢 50%；高频反复曝光强化长期记忆",
    citation: "Roediger & Karpicke, 2006",
  },
  explorer: {
    name: "远距离迁移 + 类比推理",
    shortDesc: "跨域类比促进概念抽象化，让知识在新场景下也能调用",
    citation: "Gick & Holyoak, 1980",
  },
  strict: {
    name: "生成效应 + 苏格拉底式提问",
    shortDesc: "主动生成答案比被动接受记得深 3 倍；反问触发深度加工",
    citation: "Slamecka & Graf, 1978",
  },
}

interface FlashcardTemplate {
  front: string
  back: string
}

export type QType = "single" | "multi" | "true-false-explain"

export interface QuestionTemplate {
  type?: QType   // defaults to "single" when omitted
  content: string
  options: { A: string; B: string; C: string; D: string }
  /** single→"A"; multi→"A,B"; tf→"T"/"F" */
  correct: string
  explanation: string
  /** 严苛教练题：评判"理由"的关键词 */
  reasonKeywords?: string[]
}

// ============================================================
// 1. 文件名 → 学科分类
// ============================================================

export function detectSubject(filename: string): Subject {
  const f = filename.toLowerCase()
  if (/saas|产品|prd|brd|互联网|分销|管理系统|方案/.test(f)) return "product"
  if (/数学|微积分|线性|高数|代数|几何|概率/.test(f)) return "math"
  if (/法考|司法|民法|刑法|宪法|法律/.test(f)) return "law"
  if (/pmp|项目管理|敏捷/.test(f)) return "pmp"
  if (/英语|english|商务|toefl|ielts/.test(f)) return "language"
  if (/python|java|编程|代码|算法|数据结构|js|typescript/.test(f)) return "programming"
  if (/财务|金融|cfa|会计|投资/.test(f)) return "finance"
  return "general"
}

// ============================================================
// 2. 每个学科的"知识点池"（按 day 索引）
// ============================================================

const SUBJECT_TOPICS: Record<Subject, string[]> = {
  product: [
    "产品定位与目标用户",
    "用户画像与场景洞察",
    "MVP 与 PMF 验证",
    "竞品分析与差异化",
    "产品功能优先级（RICE / Kano）",
    "数据驱动迭代",
    "商业模式与变现路径",
  ],
  math: [
    "极限与连续",
    "导数与微分",
    "积分与应用",
    "级数与收敛",
    "多元微积分",
    "微分方程",
    "线性代数基础",
  ],
  law: [
    "民法总则与基本原则",
    "合同法核心条款",
    "物权与债权",
    "刑法构成要件",
    "诉讼时效",
    "侵权责任",
    "婚姻家庭",
  ],
  pmp: [
    "项目生命周期与五大过程组",
    "需求收集与范围管理",
    "进度计划与关键路径",
    "成本估算与挣值管理",
    "质量管理三件套",
    "干系人参与策略",
    "敏捷与混合方法",
  ],
  language: [
    "时态与语态",
    "商务邮件规范",
    "会议英语表达",
    "谈判常用句式",
    "汇报与展示",
    "电话沟通技巧",
    "跨文化沟通",
  ],
  programming: [
    "变量与数据类型",
    "条件与循环控制",
    "函数与作用域",
    "数据结构基础",
    "算法复杂度",
    "面向对象设计",
    "异步与并发",
  ],
  finance: [
    "财务三大报表",
    "现金流分析",
    "财务比率",
    "估值模型 DCF",
    "投资组合理论",
    "风险与收益",
    "宏观经济基础",
  ],
  general: [
    "核心概念与定义",
    "基础方法与流程",
    "典型应用场景",
    "常见误区与陷阱",
    "进阶技巧",
    "实战案例分析",
    "综合知识串联",
  ],
}

export function getTopicForDay(subject: Subject, dayIndex: number): string {
  const pool = SUBJECT_TOPICS[subject]
  return pool[(dayIndex - 1) % pool.length]
}

export function getGoalForDay(subject: Subject, dayIndex: number): string {
  const topic = getTopicForDay(subject, dayIndex)
  return `掌握「${topic}」的核心概念与典型应用`
}

// ============================================================
// 3. 闪卡模板（按学科 + 人格分流）
// ============================================================

/**
 * 给定 (subject, personality, dayIndex) 返回 3-5 张该天的闪卡
 * （旧版兼容，返回 front/back 字符串结构）
 */
export function generateFlashcards(
  subject: Subject,
  personality: Personality,
  dayIndex: number,
): FlashcardTemplate[] {
  const topic = getTopicForDay(subject, dayIndex)
  const baseQA = SUBJECT_QA_PAIRS[subject]?.[topic] ?? [
    {
      keyword: topic,
      definition: `${topic}是本章节的核心知识点之一`,
      example: "请结合资料具体内容理解",
    },
  ]
  return baseQA.slice(0, 4).map((qa) => wrapFlashcardByPersonality(qa, personality, subject))
}

/**
 * v2.2.1：新版结构化输出 —— 返回 FlashcardCard[]，前端按 personality 渲染对应版式
 */
export function generateFlashcardCards(
  subject: Subject,
  personality: Personality,
  dayIndex: number,
): FlashcardCard[] {
  const topic = getTopicForDay(subject, dayIndex)
  const baseQA = SUBJECT_QA_PAIRS[subject]?.[topic] ?? [
    {
      keyword: topic,
      definition: `${topic}是本章节的核心知识点之一`,
      example: "请结合资料具体内容理解",
    },
  ]
  const theory = THEORIES[personality]

  return baseQA.slice(0, 4).map((qa) => buildStructuredCard(qa, personality, theory, dayIndex))
}

/**
 * v2.2.1 终版：基于知识点 keyword 决定来源类型 + 真实权威引用
 *
 * 设计原则：
 *   1. 用户资料引用永远是最优先（如果有）—— 但 mock 期没真实资料解析，所以标注"v2.3 接 RAG"
 *   2. 权威引用用真实书籍 + Wikipedia / 豆瓣链接，让用户能真跳出去验证
 *   3. AI 综合明确标注（最弱可信度）
 */
function generateCredibility(
  qa: CoreQA,
  dayIndex?: number,
): FlashcardCard["credibility"] {
  const keyword = qa.keyword

  // 1. 关键词命中权威引用库 → 用 authority
  const authority = AUTHORITY_LIBRARY[keyword]
  if (authority) {
    return {
      sourceType: "authority",
      authoritySource: authority,
    }
  }

  // 2. 部分核心概念给"用户资料" mock 引用（标注 v2.3 真接 RAG）
  if (qa.definition.length > 15) {
    return {
      sourceType: "user-doc",
      userDocSource: {
        quote: `「${qa.definition}。${qa.example}」`,
        docName: dayIndex ? `你上传的资料 · 第 ${Math.ceil(dayIndex / 2)} 章` : "你上传的资料",
        location: dayIndex ? `Day ${dayIndex} · 段落 ${(dayIndex - 1) * 3 + 1}` : "首章",
        previewUrl: "#mock-preview",  // mock 期占位
      },
    }
  }

  // 3. 没有原文支撑 → 标注 AI 综合
  return {
    sourceType: "ai-synthesis",
    aiSynthesis: {
      note: `本段为 AI 基于上下文综合归纳，未在你的资料中找到直接对应原文。`,
      suggestedReadings: SUGGESTED_READINGS_BY_KEYWORD[keyword] || [],
    },
  }
}

/**
 * 真实存在的权威引用库（书名 + 作者 + 真实 Wikipedia/豆瓣链接）
 */
const AUTHORITY_LIBRARY: Record<
  string,
  NonNullable<FlashcardCard["credibility"]>["authoritySource"]
> = {
  MVP: {
    title: "精益创业",
    author: "Eric Ries",
    year: 2011,
    chapter: "第 6 章 · 测试",
    quote: "MVP 是用最少投入验证最大假设的产品版本，关键在于学习而非完美。",
    externalUrl: "https://book.douban.com/subject/10945855/",
  },
  PMF: {
    title: "Crossing the Chasm（跨越鸿沟）",
    author: "Geoffrey Moore",
    year: 1991,
    chapter: "导论 · 早期市场",
    quote: "PMF 是产品在某一明确细分市场中获得有意义增长的状态。",
    externalUrl: "https://en.wikipedia.org/wiki/Product/market_fit",
  },
  "Kano 模型": {
    title: "Attractive Quality and Must-Be Quality",
    author: "Noriaki Kano",
    year: 1984,
    chapter: "原始论文",
    quote: "需求满足度与质量属性的关系非线性，因此需求应分基本 / 期望 / 兴奋三类。",
    externalUrl: "https://en.wikipedia.org/wiki/Kano_model",
  },
  "RICE 评分": {
    title: "Intercom on Product Management",
    author: "Sean McBride",
    year: 2017,
    chapter: "优先级方法论",
    quote: "RICE = Reach × Impact × Confidence ÷ Effort，平衡量化决策的工具。",
    externalUrl: "https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/",
  },
  "产品定位": {
    title: "Positioning（定位）",
    author: "Al Ries & Jack Trout",
    year: 1981,
    chapter: "全书核心论点",
    quote: "定位不是对产品本身做什么，而是在潜在顾客的心智中占据一个位置。",
    externalUrl: "https://book.douban.com/subject/4127092/",
  },
  "目标用户": {
    title: "About Face（交互设计精髓）",
    author: "Alan Cooper",
    year: 1995,
    chapter: "Persona 方法论",
    quote: "目标用户应通过虚构但具象的 Persona 来定义，而不是泛泛的人口统计学描述。",
    externalUrl: "https://book.douban.com/subject/26642337/",
  },
  "用户画像": {
    title: "About Face（交互设计精髓）",
    author: "Alan Cooper",
    year: 1995,
    chapter: "Persona 方法论",
    externalUrl: "https://book.douban.com/subject/26642337/",
  },
  "极限": {
    title: "高等数学（同济大学版）",
    author: "同济大学数学系",
    year: 2014,
    chapter: "第 1 章 · 函数与极限",
    quote: "当自变量的变化使函数值无限接近某个确定的数 A 时，称 A 为函数的极限。",
    externalUrl: "https://book.douban.com/subject/26465997/",
  },
  "导数": {
    title: "高等数学（同济大学版）",
    author: "同济大学数学系",
    year: 2014,
    chapter: "第 2 章 · 导数与微分",
    externalUrl: "https://book.douban.com/subject/26465997/",
  },
  "项目生命周期": {
    title: "PMBOK Guide（项目管理知识体系指南）",
    author: "PMI",
    year: 2021,
    chapter: "第 7 版 · 项目生命周期",
    externalUrl: "https://www.pmi.org/pmbok-guide-standards",
  },
  "五大过程组": {
    title: "PMBOK Guide（项目管理知识体系指南）",
    author: "PMI",
    year: 2017,
    chapter: "第 6 版 · 五大过程组",
    quote: "启动、规划、执行、监控、收尾是项目管理的五大标准过程组。",
    externalUrl: "https://www.pmi.org/pmbok-guide-standards",
  },
}

const SUGGESTED_READINGS_BY_KEYWORD: Record<
  string,
  Array<{ title: string; author: string; url?: string }>
> = {
  // 未在主库的关键词可以加这里作为"推荐阅读"
}

function buildStructuredCard(
  qa: CoreQA,
  personality: Personality,
  theory: LearningTheory,
  dayIndex?: number,
): FlashcardCard {
  // v2.2.1 终版：基于知识点决定来源类型（用户资料 / 权威引用 / AI 综合）
  const credibility = generateCredibility(qa, dayIndex)

  switch (personality) {
    case "student":
      return {
        personality,
        question: `想象你在跟同学解释：什么是「${qa.keyword}」？`,
        answer: {
          definition: qa.definition,
          example: qa.example,
          hint: "提示：先理解概念本质，再去背定义。如果你能用自己的话给小学生讲懂，你才真懂了。",
          comparisonTable: qa.comparisonTable,
        },
        theory,
        credibility,
      }

    case "cert":
      // 假装的频次（mock 期由 keyword hash 决定，真生产环境基于历年真题数据）
      const freqMap: Record<number, "high" | "mid" | "low"> = { 0: "high", 1: "mid", 2: "low" }
      const frequency = freqMap[qa.keyword.length % 3] || "mid"
      return {
        personality,
        question: `【${frequency === "high" ? "🔥 高频" : frequency === "mid" ? "中频" : "低频"}考点】「${qa.keyword}」的标准定义？`,
        answer: {
          definition: qa.definition,
          examFrequency: frequency,
          examTrap: `常见命题陷阱：考官会用「${qa.example}」这种相近场景做干扰项，注意区分边界条件。`,
          mnemonic: `记忆口诀：抓核心词 → 抓关系 → 抓边界。「${qa.keyword}」三要素：${qa.definition.split("，")[0] || qa.definition.slice(0, 20)}…`,
          comparisonTable: qa.comparisonTable,
        },
        theory,
        credibility,
      }

    case "explorer":
      return {
        personality,
        question: `「${qa.keyword}」可以跟哪个其他领域的概念类比？为什么？`,
        answer: {
          definition: qa.definition,
          crossDomain: `跨界类比：${qa.example}。本质上这个概念回答的是「相同问题在不同领域的相同解法」—— 当你能在 3 个学科找到同源概念，你就真理解了它。`,
          counterfactual: `反事实追问：如果「${qa.keyword}」在某个极端场景不成立，会发生什么？这个边界本身比定义更值得思考。`,
          comparisonTable: qa.comparisonTable,
        },
        theory,
        credibility,
      }

    case "strict":
      return {
        personality,
        question: `用你自己的话，30 秒内解释「${qa.keyword}」。先在心里答完，再翻面对照。`,
        answer: {
          definition: qa.definition,
          socraticQuestions: [
            `你能举一个跟「${qa.example}」性质相反的反例吗？`,
            `这个概念在什么情况下不成立 / 会失效？`,
            `跟「${qa.keyword}」最容易被混淆的概念是什么？为什么？`,
          ],
          socraticReferences: [
            `参考方向：找一个跟「${qa.example}」核心属性正好相反的例子。`,
            `参考方向：每个概念都有边界条件。`,
            `参考方向：容易混淆的概念往往与「${qa.keyword}」在某些维度上相似，但在核心维度上不同。`,
          ],
          // v2.2.1 修订：以对话气泡形式 + 教练人设
          socraticDialogues: [
            {
              bubbles: [
                `不急，先告诉我你想到了什么。`,
                `如果你只是把「${qa.example}」里的词反过来，那不算反例 —— 你需要找的是**性质对立**的例子。`,
                `提示：原例强调 A，反例应该强调 ¬A。先在脑子里列 3 个候选，再挑最对立的那个。`,
              ],
            },
            {
              bubbles: [
                `好问题。「不成立」往往出现在边界条件被破坏时。`,
                `想 3 件事：① 这个概念的前提是什么？② 定义域 / 适用场景是什么？③ 如果其中一个前提消失，会发生什么？`,
                `当前提不成立时，「${qa.keyword}」通常会退化为另一个概念，或者直接失效。你能想到具体退化成什么吗？`,
              ],
            },
            {
              bubbles: [
                `这是最容易测试理解深度的问题。`,
                `容易混淆的概念往往在表面**相似**（共享一些特征），但在核心维度上**不同**。`,
                `策略：列出 1-2 个跟「${qa.keyword}」长得像的概念，然后找出它们的**核心边界**——那条边界就是「${qa.keyword}」的本质。`,
              ],
            },
          ],
        },
        theory,
        credibility,
      }
  }
}

interface CoreQA {
  keyword: string
  definition: string
  example: string
  // v2.2.1：可选的对比表（X vs Y / 分类清单 等结构化内容）
  comparisonTable?: {
    title: string
    columns: string[]
    rows: string[][]
  }
}

function wrapFlashcardByPersonality(
  qa: CoreQA,
  personality: Personality,
  subject: Subject,
): FlashcardTemplate {
  switch (personality) {
    case "student":
      return {
        front: `📖 想象你在跟同学解释：什么是「${qa.keyword}」？`,
        back: `通俗讲：${qa.definition}\n\n🌰 举个栗子：${qa.example}\n\n💡 记住要点：先理解概念，再背定义。`,
      }

    case "cert":
      return {
        front: `🔥【高频考点】「${qa.keyword}」的定义是什么？`,
        back: `标准答案：${qa.definition}\n\n⚠️ 命题套路：${qa.example}\n\n📌 记忆口诀：抓核心词、抓关系、抓边界条件。`,
      }

    case "explorer":
      return {
        front: `🌐 「${qa.keyword}」可以跟其他领域的什么概念类比？`,
        back: `本质上：${qa.definition}\n\n🔗 跨界联想：${qa.example}\n\n🤔 反问自己：如果换一个场景，这个概念还成立吗？`,
      }

    case "strict":
      return {
        front: `🎯 用你自己的话，30 秒内解释「${qa.keyword}」。\n\n（先在心里答，再翻面）`,
        back: `参考定义：${qa.definition}\n\n❓ 反问 1：你能举一个跟「${qa.example}」不同的例子吗？\n❓ 反问 2：这个概念在什么情况下不成立？\n❓ 反问 3：跟「${qa.keyword}」最容易混淆的概念是什么？`,
      }
  }
}

// ============================================================
// 4. 题目模板（按学科 + 人格分流）
// ============================================================

export function generateQuestions(
  subject: Subject,
  personality: Personality,
  dayIndex: number,
): QuestionTemplate[] {
  const topic = getTopicForDay(subject, dayIndex)
  const baseQs = SUBJECT_QUESTIONS[subject]?.[topic] ?? []

  if (baseQs.length === 0) {
    // 兜底：生成一个通用题
    return [
      {
        type: "single" as QType,
        content: `关于「${topic}」，下列说法正确的是？`,
        options: {
          A: `${topic}没有标准定义`,
          B: `${topic}的核心是理解关键概念之间的关系`,
          C: `${topic}只是理论，没有实际应用`,
          D: `${topic}与其他主题无关`,
        },
        correct: "B",
        explanation: `${topic}的本质是理解概念间的逻辑关系，B 正确。其他选项忽视了核心要点。`,
      },
    ]
  }

  return baseQs.slice(0, 3).map((q) => wrapQuestionByPersonality(q, personality))
}

/**
 * v2.2.1 修订：按人格教育学理论分化题型
 *   - 学生党 (CLT) → 单选 + 温和情景化
 *   - 考证型 (检索练习) → 单选 + 考点强干扰
 *   - 兴趣探索 (远距离迁移) → 多选（多个跨域类比都可能成立）
 *   - 严苛教练 (生成效应) → 判断 + 用户写理由
 */
function wrapQuestionByPersonality(
  q: QuestionTemplate,
  personality: Personality,
): QuestionTemplate {
  // q 默认是 type=single 的题目模板
  switch (personality) {
    case "student":
      // 学生党：单选 + 情景化 + 温和提示
      return {
        ...q,
        type: "single",
        content: `${q.content}\n💡（提示：回到资料中找一个具体例子来对应思考）`,
        explanation: `先理解再记忆：${q.explanation}`,
      }

    case "cert":
      // 考证型：单选 + 考点强调 + 命题陷阱
      return {
        ...q,
        type: "single",
        content: `【考点】${q.content}`,
        explanation: `命题陷阱：${q.explanation}`,
      }

    case "explorer":
      // 兴趣探索：多选 — 同源概念在多个领域映射，可能多个答案都对
      // 把 correct 从 "B" → "B,C"（mock：加一个跨域类比为成立的选项）
      const altCorrect = q.correct === "A" ? "B" : q.correct === "B" ? "A" : "B"
      return {
        ...q,
        type: "multi",
        content: `${q.content}\n🔀（多选题：选出所有你认为成立的选项 —— 远距离迁移看到的是"同源解法"）`,
        correct: `${q.correct},${altCorrect}`,  // 多选答案
        explanation: `跨域映射视角：${q.explanation}\n\n这道题不止一个答案——能跨场景成立的概念，更可能是真理。`,
      }

    case "strict":
      // 严苛教练：判断+理由 — 把单选改为对其中一个选项做判断
      const statement = q.options[q.correct as "A"|"B"|"C"|"D"]
      return {
        ...q,
        type: "true-false-explain",
        content: `判断下列陈述是否正确：\n\n「${statement}」\n\n⚡ 先在心里答 → 再写一句话说出你的理由（30 字以内）`,
        correct: "T",  // 该陈述是正确选项的内容，判断为 T
        // 关键词同时来自陈述句 + 解析，确保有可命中的词
        reasonKeywords: extractKeywords(`${statement}。${q.explanation}`),
        explanation: `参考理由：${q.explanation}\n\n生成效应：你写的理由比 4 选 1 更能加深理解。`,
      }
  }
}

/**
 * v2.2.1 修复：抽核心词作为评判关键词
 *
 * 策略：
 *   1. 优先抽取"专业名词候选" —— 2-4 字的实词
 *   2. 过滤虚词 / 助词 / 连接词
 *   3. 优先保留高信息密度的词（如「连续」「极限」「函数」）
 */
const STOPWORDS = new Set([
  "下列", "关于", "正确", "错误", "说法", "选项", "下面",
  "因此", "所以", "因为", "如果", "只要", "可以", "应该",
  "存在", "等于", "对于", "任意", "每一", "其中", "这样",
  "什么", "为什么", "怎么", "哪个", "哪些", "一定", "可能",
  "并且", "或者", "但是", "然后", "不过", "虽然",
  "我们", "你们", "他们", "这个", "那个", "这种", "那种",
])

function extractKeywords(text: string): string[] {
  // 用正则切分中文短词（2-4 字）
  const candidates: string[] = []
  const cleaned = text.replace(/[，。、；：！？""''（）\(\)\[\]【】「」\s]+/g, " ")

  // 抽 2-4 字片段
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= cleaned.length - len; i++) {
      const word = cleaned.slice(i, i + len)
      if (/^[一-龥]+$/.test(word) && !STOPWORDS.has(word)) {
        candidates.push(word)
      }
    }
  }

  // 频次统计 → 取 top 5 不重叠词
  const freq: Record<string, number> = {}
  for (const c of candidates) freq[c] = (freq[c] || 0) + 1
  const sorted = Object.keys(freq).sort((a, b) => freq[b] - freq[a])

  // 去掉互相是子串的词（保留较长的）
  const result: string[] = []
  for (const w of sorted) {
    if (result.length >= 5) break
    if (!result.some((r) => r.includes(w) || w.includes(r))) {
      result.push(w)
    }
  }
  return result
}

// ============================================================
// 5. 各学科的"知识点 → 核心 QA"映射
// ============================================================

const SUBJECT_QA_PAIRS: Partial<Record<Subject, Record<string, CoreQA[]>>> = {
  product: {
    "产品定位与目标用户": [
      {
        keyword: "产品定位",
        definition: "明确产品为「谁」解决「什么」问题，以及与其他选择相比的核心价值差异",
        example: "Notion 定位为「all-in-one workspace」，区别于纯文档（Google Docs）和纯协作（Slack）",
      },
      {
        keyword: "目标用户",
        definition: "产品最先服务的特定人群，应有共同的核心痛点和支付意愿",
        example: "StudyHere 的目标用户：备考人群（PMP / CFA / 法考）—— 痛点强、付费意愿明确",
      },
      {
        keyword: "用户旅程",
        definition: "用户从认知到完成核心任务的完整路径，每一步都可能流失",
        example: "电商：浏览 → 搜索 → 详情 → 加购 → 结算 → 支付 → 复购",
      },
      {
        keyword: "用户场景",
        definition: "用户在「什么时间、什么地点、什么状态」下使用产品",
        example: "通勤地铁上 5 分钟刷闪卡 vs 周末书桌前 1 小时模考",
      },
    ],
    "用户画像与场景洞察": [
      {
        keyword: "用户画像",
        definition: "一个虚拟的代表性用户档案，含人口属性 + 行为 + 痛点 + 目标",
        example: "「Lily，28 岁，备考 PMP 的产品经理，痛点是没时间整理资料、上下班 1 小时通勤」",
      },
      {
        keyword: "需求分层",
        definition: "区分用户的「显性需求」「隐性需求」「未来需求」",
        example: "显性：上传资料看摘要；隐性：希望被监督；未来：跟其他考生比较",
      },
    ],
    "MVP 与 PMF 验证": [
      {
        keyword: "MVP",
        definition: "Minimum Viable Product，能验证核心假设的最小功能集",
        example: "StudyHere MVP 只做学练考纠核心闭环，砍掉社区、智能体设置等",
        comparisonTable: {
          title: "MVP vs Prototype vs PoC 三者区别",
          columns: ["维度", "MVP", "Prototype", "PoC"],
          rows: [
            ["目的", "验证市场需求", "验证用户体验", "验证技术可行"],
            ["受众", "真实用户", "设计团队", "工程团队"],
            ["可用性", "可上线", "通常不可用", "demo 级"],
            ["产出", "上线数据", "交互方案", "技术结论"],
          ],
        },
      },
      {
        keyword: "PMF",
        definition: "Product-Market Fit，产品满足真实市场需求且用户愿意持续使用并推荐",
        example: "PMF 信号：留存高、自然增长、用户问'什么时候上 XX 功能'",
        comparisonTable: {
          title: "PMF 的 4 个关键信号",
          columns: ["信号", "指标", "门槛"],
          rows: [
            ["留存", "D30 留存率", "≥ 25%"],
            ["增长", "自然增长占比", "≥ 40%"],
            ["NPS", "推荐意愿", "≥ 50"],
            ["定性", "Sean Ellis 测试", "≥ 40% 用户表示'离开会很失望'"],
          ],
        },
      },
    ],
    "竞品分析与差异化": [
      {
        keyword: "竞品分析",
        definition: "拆解竞品的目标用户 / 核心场景 / 关键功能 / 商业模式 / 优劣势",
        example: "StudyHere 对标 Quizlet（卡片）+ NotebookLM（资料处理）+ Anki（间隔重复）",
      },
      {
        keyword: "差异化",
        definition: "找到竞品的盲区或弱项，建立用户难以替代的认知/能力壁垒",
        example: "Notion 差异化：all-in-one 模块化（vs Google Docs 纯文档）",
      },
    ],
    "产品功能优先级（RICE / Kano）": [
      {
        keyword: "RICE 评分",
        definition: "Reach（触达）× Impact（影响）× Confidence（信心）÷ Effort（投入）",
        example: "新功能 A：影响 1000 人，提升 30%，70% 信心，开发 2 周 → RICE = 1000×0.3×0.7÷2 = 105",
      },
      {
        keyword: "Kano 模型",
        definition: "把需求分为基本型、期望型、兴奋型、无差异型、反向型 5 类",
        example: "微信视频通话清晰度 = 基本型；红包功能 = 兴奋型",
        comparisonTable: {
          title: "Kano 模型 · 5 类需求",
          columns: ["类型", "有时反应", "没有时反应", "举例"],
          rows: [
            ["基本型", "理所应当", "强烈不满", "通话清晰度"],
            ["期望型", "满意↑", "失望↑", "更长续航"],
            ["兴奋型", "惊喜", "无感", "红包功能"],
            ["无差异", "无感", "无感", "次要花哨"],
            ["反向型", "反感", "无感", "强制弹窗"],
          ],
        },
      },
    ],
  },

  math: {
    "极限与连续": [
      {
        keyword: "极限",
        definition: "当自变量无限接近某个值时，函数值无限接近的那个数",
        example: "当 x → 0 时，sin(x)/x 的极限是 1",
      },
      {
        keyword: "连续",
        definition: "函数在某点的极限等于该点的函数值，即 lim f(x) = f(a)",
        example: "f(x) = x² 处处连续；f(x) = 1/x 在 x = 0 不连续",
      },
      {
        keyword: "间断点",
        definition: "函数不连续的点，分为可去间断、跳跃间断、无穷间断",
        example: "f(x) = sin(x)/x 在 x = 0 是可去间断点",
      },
    ],
    "导数与微分": [
      {
        keyword: "导数",
        definition: "函数在某点的瞬时变化率，几何意义是切线斜率",
        example: "(x²)' = 2x，意味着曲线 y = x² 在 x = 1 处切线斜率为 2",
      },
      {
        keyword: "可导与连续",
        definition: "可导一定连续，连续不一定可导（如 |x| 在 0 处）",
        example: "|x| 在 x = 0 处连续但不可导（左右导数不等）",
      },
    ],
  },

  pmp: {
    "项目生命周期与五大过程组": [
      {
        keyword: "五大过程组",
        definition: "启动、规划、执行、监控、收尾，是 PMI 项目管理的核心框架",
        example: "启动出项目章程，规划出项目计划，执行出可交付物，监控出变更，收尾签字归档",
      },
      {
        keyword: "项目生命周期",
        definition: "项目从启动到收尾的完整阶段划分，可以是预测型/迭代型/敏捷型",
        example: "盖楼 = 预测型（先全设计再施工）；做 App = 敏捷型（边做边迭代）",
      },
    ],
  },

  law: {
    "民法总则与基本原则": [
      {
        keyword: "民事法律行为",
        definition: "民事主体通过意思表示设立、变更、终止民事法律关系的行为",
        example: "签合同、立遗嘱、赠与都是民事法律行为",
      },
      {
        keyword: "代理",
        definition: "代理人在代理权限内以被代理人名义实施民事法律行为，后果归被代理人",
        example: "律师代理客户打官司、家长代孩子签合同",
      },
    ],
  },
}

// ============================================================
// 6. 各学科的题目库（核心干扰项设计）
// ============================================================

const SUBJECT_QUESTIONS: Partial<Record<Subject, Record<string, QuestionTemplate[]>>> = {
  product: {
    "产品定位与目标用户": [
      {
        content: "下列对「产品定位」描述最准确的是？",
        options: {
          A: "产品的功能列表",
          B: "产品为谁解决什么问题，与其他选择相比的核心价值差异",
          C: "产品的视觉风格和品牌色",
          D: "产品的售价区间",
        },
        correct: "B",
        explanation: "定位的核心是「目标用户 + 核心价值 + 差异化」，不是功能堆砌（A）、视觉（C）或价格（D）。",
      },
      {
        content: "选择目标用户群体时，最不应该优先考虑的因素是？",
        options: {
          A: "他们的痛点是否强烈",
          B: "他们的付费意愿是否清晰",
          C: "他们的人数是否最多",
          D: "他们的群体是否具有共性",
        },
        correct: "C",
        explanation: "MVP 阶段宁要 100 个爱你的用户，也不要 1000 个无关用户。人数不是核心，痛点 + 付费意愿 + 共性才是。",
      },
      {
        content: "下列哪个不属于「用户场景」？",
        options: {
          A: "通勤地铁上 5 分钟",
          B: "周末书桌前 1 小时",
          C: "用户是 28 岁的女性",
          D: "睡前关灯后躺床上",
        },
        correct: "C",
        explanation: "C 是用户画像（人口属性），不是场景。场景 = 时间 + 地点 + 状态。",
      },
    ],
    "MVP 与 PMF 验证": [
      {
        content: "MVP 阶段最重要的是？",
        options: {
          A: "功能尽可能完整",
          B: "界面尽可能精美",
          C: "验证核心假设是否成立",
          D: "用户数尽可能多",
        },
        correct: "C",
        explanation: "MVP 是「最小可行」—— 关键在于验证「这个市场需要这个解决方案」的假设，其他都是干扰。",
      },
    ],
    "竞品分析与差异化": [
      {
        content: "做竞品分析时，下列哪项最不重要？",
        options: {
          A: "竞品的目标用户",
          B: "竞品的核心功能",
          C: "竞品的 logo 设计",
          D: "竞品的盲区与弱项",
        },
        correct: "C",
        explanation: "logo 设计是视觉层，不是产品本质。其他三项都直接影响差异化策略。",
      },
    ],
  },

  math: {
    "极限与连续": [
      {
        content: "下列关于极限的说法，正确的是？",
        options: {
          A: "极限值一定存在",
          B: "函数在某点有极限，则在该点连续",
          C: "函数在某点连续，则在该点极限存在且等于函数值",
          D: "极限与函数值无关",
        },
        correct: "C",
        explanation: "连续的定义即：lim f(x) = f(a)，所以 C 正确。",
      },
      {
        content: "函数 f(x) = |x| 在 x = 0 处？",
        options: {
          A: "连续且可导",
          B: "不连续",
          C: "连续但不可导",
          D: "既不连续也不可导",
        },
        correct: "C",
        explanation: "f(x) = |x| 在 x = 0 连续，但左导数 -1 ≠ 右导数 1，不可导。",
      },
    ],
  },

  pmp: {
    "项目生命周期与五大过程组": [
      {
        content: "PMP 五大过程组的正确顺序是？",
        options: {
          A: "启动 → 执行 → 规划 → 监控 → 收尾",
          B: "启动 → 规划 → 执行 → 监控 → 收尾",
          C: "规划 → 启动 → 执行 → 监控 → 收尾",
          D: "启动 → 规划 → 监控 → 执行 → 收尾",
        },
        correct: "B",
        explanation: "标准顺序：启动 → 规划 → 执行 → 监控 → 收尾。监控贯穿执行始终。",
      },
    ],
  },
}
