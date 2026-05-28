-- =====================================================
-- StudyHere v2.2 · Day 2 Migration
-- 内容：多资料宝库 + 智能体人格设置
-- 主笔：lilith（C 模块）
-- 日期：2026-05-26
-- 对接：D（后端接口主管）
--
-- 设计原则：渐进式重构
--   - Vault 主表保留所有 v0.1 字段（filename / fileUrl / textContent）
--     向后兼容现有用户数据
--   - Vault 新增 3 个可空字段（name / goal / agentPersonality）
--     不破坏老数据
--   - 新建 Document 子表承载额外上传文件
--     第 1 个上传文件仍写入 Vault 主字段；第 2-5 个写入 Document
--
-- 影响范围：
--   - 0 行老数据迁移（agentPersonality 有 DEFAULT，name / goal 可空）
--   - 0 个表破坏性变更
--   - 仅新增 1 张表 + Vault 加 3 字段
--
-- 回滚预案：ROLLBACK 部分见文末
-- =====================================================

BEGIN;

-- ============================================
-- 1. Vault 表新增字段
-- ============================================

ALTER TABLE vaults
  ADD COLUMN IF NOT EXISTS name              text,
  ADD COLUMN IF NOT EXISTS goal              text,
  ADD COLUMN IF NOT EXISTS "agentPersonality" text NOT NULL DEFAULT 'student';

-- 约束：agentPersonality 必须是 4 个合法值之一
ALTER TABLE vaults
  DROP CONSTRAINT IF EXISTS vaults_agent_personality_check;
ALTER TABLE vaults
  ADD CONSTRAINT vaults_agent_personality_check
  CHECK ("agentPersonality" IN ('student', 'cert', 'explorer', 'strict'));

COMMENT ON COLUMN vaults.name              IS '宝库名（用户自起，可空，空时回退用 filename）';
COMMENT ON COLUMN vaults.goal              IS '学习目标（用户自填）';
COMMENT ON COLUMN vaults."agentPersonality" IS '智能体人格：student=学生党 / cert=考证型 / explorer=兴趣探索 / strict=严苛教练';


-- ============================================
-- 2. Document 表（新建 · 多资料宝库的附加文件）
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
  id           text         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "vaultId"    text         NOT NULL,
  filename     text         NOT NULL,
  "fileUrl"    text         NOT NULL,
  "textContent" text,
  "pageCount"  integer,
  "fileSizeKb" integer,
  "createdAt"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT documents_vault_id_fkey
    FOREIGN KEY ("vaultId") REFERENCES vaults(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS documents_vault_id_idx ON documents("vaultId");

COMMENT ON TABLE documents IS 'v2.2 新增：宝库附加文件（主文件仍存 vaults 表向后兼容）';


-- ============================================
-- 3. 验证
-- ============================================

-- 验证 vaults 新字段已加：
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'vaults' AND column_name IN ('name', 'goal', 'agentPersonality');

-- 验证 documents 表已建：
-- \d documents

COMMIT;


-- =====================================================
-- 回滚（若出问题在 5 分钟内可全部回滚）：
-- =====================================================
-- BEGIN;
-- DROP TABLE IF EXISTS documents;
-- ALTER TABLE vaults
--   DROP CONSTRAINT IF EXISTS vaults_agent_personality_check,
--   DROP COLUMN IF EXISTS "agentPersonality",
--   DROP COLUMN IF EXISTS goal,
--   DROP COLUMN IF EXISTS name;
-- COMMIT;
