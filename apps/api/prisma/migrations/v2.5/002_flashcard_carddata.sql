-- =====================================================
-- StudyHere v2.5+ · Flashcard 加 cardData JSON 字段
-- 日期：2026-06-07
--
-- 背景：
--   v2.5 已经把 personality 字段加到 Flashcard 并让 fileProcessor
--   把 personality 透传给 generateFlashcards。但前端 FlashcardAnswerCard
--   依赖的是「FlashcardCard 嵌套结构」（带 answer.example/hint/examTrap/
--   socraticDialogues 等差异化字段），而旧 prompt 只让 AI 输出 { front, back }
--   两个字段，前端拿到后走 fallback 分支只显示一行 back 文本 → 4 人格
--   生成的卡片在 UI 上完全看不出差异。
--
-- 本次修复（schema 层）：
--   - flashcards 表加 cardData JSONB NULL
--   - 不回填老数据（老 plan 没有结构化 JSON，让前端走 back 字段兜底）
--   - 新生成的卡走结构化 prompt，cardData 字段必填
-- =====================================================

ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "cardData" JSONB;
