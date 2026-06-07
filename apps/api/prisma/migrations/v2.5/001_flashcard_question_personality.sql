-- =====================================================
-- StudyHere v2.5 · Flashcard / Question 加 personality 字段
-- 日期：2026-06-07
-- 对接：D（后端）
--
-- 背景：
--   v2.2.1 设计了 4 人格 Agent（学生党 / 考证型 / 兴趣探索 / 严苛教练），
--   各自锚定一条教育学理论（Sweller / Roediger / Gick & Holyoak / Slamecka）。
--   前端 FlashcardAnswerCard.tsx 按 card.personality 切 4 种版式（举例 / 命题陷阱 /
--   跨界类比 / 苏格拉底反问）。
--
-- 已知问题（生产 bug · 6/7 lilith 发现）：
--   1. fileProcessor.ts 调 generateFlashcards / generateQuestions 时根本没传
--      vault.agentPersonality，所有调用都裸 composeSystemPrompt(null, ...) 回退
--      student 风格。
--   2. flashcards / questions 表本身没有 personality 列，即便生成时分了人格，
--      前端也读不到 → 永远走 student 兜底分支 → 4 人格界面一模一样。
--
-- 本次修复（schema 层）：
--   - flashcards 表加 personality TEXT NULL
--   - questions   表加 personality TEXT NULL
--   - 回填策略：把已生成的老 plan 的 flashcards / questions 一次性回填为
--     生成它们的 vault 的 agentPersonality（绝大多数老 plan 是 default "student"，
--     回填后跟原本兜底渲染结果一致，不会让历史用户看到诡异变化）
--   - 不加 NOT NULL：新生成走代码路径必填，老脏数据保留为 NULL，前端 fallback
--     处理（card.personality ?? prop.personality）
-- =====================================================

-- 1. 加列
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "personality" TEXT;
ALTER TABLE "questions"  ADD COLUMN IF NOT EXISTS "personality" TEXT;

-- 2. 回填：从 plan → vault.agentPersonality 反推
UPDATE "flashcards" f
SET "personality" = v."agentPersonality"
FROM "study_plans" p, "vaults" v
WHERE f."planId" = p."id"
  AND p."vaultId" = v."id"
  AND f."personality" IS NULL;

UPDATE "questions" q
SET "personality" = v."agentPersonality"
FROM "study_plans" p, "vaults" v
WHERE q."planId" = p."id"
  AND p."vaultId" = v."id"
  AND q."personality" IS NULL;
