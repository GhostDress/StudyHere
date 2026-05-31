-- =====================================================
-- StudyHere v2.2 · Day 3 Migration
-- 内容：文档分片（chunks）表 + 向量列预留（pgvector）
-- 主笔：lilith（C 模块）
-- 日期：2026-05-31
-- 对接：D（后端接口主管，task D-002）
-- 前置：A 已开 pgvector extension（task A-003）
--
-- 设计原则：
--   - chunk 是 RAG 检索 + 溯源对照的统一基础设施（一个 chunk 同时服务两个用途）
--   - 按 vault 隔离查询，所有路径都带 vaultId 索引
--   - 跨页 chunk 用 pageStart / pageEnd 描述范围（PDF 抽屉跳页用 pageStart）
--   - orderIndex 在 vault 内全局递增（不是按 document 重置），方便保持原文顺序
--   - embedding 维度 = 1024，对齐智谱 embedding-3
--   - 本期不建向量索引（HNSW / IVFFlat），等 chunks 数 ≥ 10k 再加（全表扫描更快）
--   - text 字段不索引——RAG 不靠全文搜，只靠向量
--
-- 影响范围：
--   - 0 行老数据迁移（全新表）
--   - 0 个现有表破坏性变更
--   - 依赖 vector extension（A-003 已开）
--   - 新增 1 张表 + 3 个索引 + 2 个外键
--
-- 容量预估：
--   - 单 PDF（30 页）≈ 60 chunks（500 字/块，含 50 字重叠）
--   - 单 vault 多文档 ≈ 100-300 chunks
--   - 全平台 1k 用户 × 5 vault × 200 chunks ≈ 1M 行
--   - 向量列：1024 维 × 4 byte = 4KB/行，1M 行 ≈ 4GB（可控）
--
-- 回滚预案：ROLLBACK 部分见文末
-- =====================================================

-- 前置检查：pgvector 必须已开（A-003 完成后此句应该成功）
-- 如果失败，停下来 ping A 开 pgvector，本 migration 不要硬跑。
CREATE EXTENSION IF NOT EXISTS vector;

BEGIN;

-- ============================================
-- 1. chunks · 文档分片（RAG + 溯源的统一基础设施）
-- ============================================

CREATE TABLE IF NOT EXISTS chunks (
  id           text         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "vaultId"    text         NOT NULL,                              -- 按 vault 隔离
  "documentId" text,                                               -- 来自哪个 document（多资料宝库下区分）；主文件用 NULL（Vault.fileUrl 那份）
  text         text         NOT NULL,                              -- chunk 文本内容（500 字以内，含 50 字重叠）
  "pageStart"  integer      NOT NULL,                              -- 起始页（PDF 抽屉跳转用）
  "pageEnd"    integer      NOT NULL,                              -- 结束页（跨页 chunk 时 > pageStart）
  "orderIndex" integer      NOT NULL,                              -- vault 内全局顺序（不按 document 重置），保持原文流
  "charCount"  integer      NOT NULL,                              -- chunk 字符数，用于调试 chunking 质量
  embedding    vector(1024),                                       -- 智谱 embedding-3 输出向量；NULL 表示尚未算（首批可能为空）
  "embeddedAt" timestamp(3),                                       -- 向量算完时间，NULL = 待算
  "createdAt"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chunks_vault_id_fkey
    FOREIGN KEY ("vaultId") REFERENCES vaults(id) ON DELETE CASCADE,

  CONSTRAINT chunks_document_id_fkey
    FOREIGN KEY ("documentId") REFERENCES documents(id) ON DELETE CASCADE,

  CONSTRAINT chunks_page_range_check
    CHECK ("pageStart" >= 1 AND "pageEnd" >= "pageStart"),

  CONSTRAINT chunks_char_count_check
    CHECK ("charCount" > 0)
);

-- vault 维度过滤是绝对主路径（RAG 检索、溯源跳转、批量算向量都按 vault 走）
CREATE INDEX IF NOT EXISTS chunks_vault_id_idx
  ON chunks("vaultId");

-- vault 内按 orderIndex 拉全文（生成 plan / flashcard 时 AI 需要按顺序读全文）
CREATE INDEX IF NOT EXISTS chunks_vault_order_idx
  ON chunks("vaultId", "orderIndex");

-- 找待算向量的 chunks（embedding IS NULL）批处理用
CREATE INDEX IF NOT EXISTS chunks_pending_embedding_idx
  ON chunks("vaultId") WHERE embedding IS NULL;

-- 注：向量相似度索引（HNSW）本期不建——
-- 全平台 chunks < 10k 时全表扫描比 HNSW 快且准确度 100%；
-- 数据量上来后再 CREATE INDEX chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops)。

COMMENT ON TABLE  chunks IS 'v2.2 文档分片，RAG 检索 + 溯源对照统一基础设施（按 vault 隔离）';
COMMENT ON COLUMN chunks."documentId" IS '来源文档 ID，NULL 表示主文件（Vault.fileUrl）';
COMMENT ON COLUMN chunks.text IS 'chunk 文本（500 字内 + 50 字重叠，递归语义切分产出）';
COMMENT ON COLUMN chunks."pageStart" IS '起始页码（PDF 抽屉跳转目标）';
COMMENT ON COLUMN chunks."pageEnd" IS '结束页码（跨页 chunk 时 > pageStart）';
COMMENT ON COLUMN chunks."orderIndex" IS 'vault 内全局顺序，保持原文流（不按 document 重置）';
COMMENT ON COLUMN chunks.embedding IS '智谱 embedding-3 1024 维向量；NULL = 待算';
COMMENT ON COLUMN chunks."embeddedAt" IS '向量算完时间，NULL = 待算（批处理 cron 标的）';


-- ============================================
-- 2. 验证查询（D 跑完 migration 后可手动核对）
-- ============================================

-- 验证 extension 已开：
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 验证表已建：
-- \d chunks

-- 验证约束生效：
-- INSERT INTO chunks("vaultId", text, "pageStart", "pageEnd", "orderIndex", "charCount")
--   VALUES ('test', 'x', 0, 1, 0, 1);  -- 应失败（pageStart < 1）
-- INSERT INTO chunks("vaultId", text, "pageStart", "pageEnd", "orderIndex", "charCount")
--   VALUES ('test', 'x', 5, 3, 0, 1);  -- 应失败（pageEnd < pageStart）

-- 验证索引：
-- SELECT indexname FROM pg_indexes WHERE tablename = 'chunks';
-- 期望看到：chunks_vault_id_idx / chunks_vault_order_idx / chunks_pending_embedding_idx

COMMIT;


-- =====================================================
-- 回滚（若出问题在 1 分钟内可全部回滚）：
-- =====================================================
-- BEGIN;
-- DROP TABLE IF EXISTS chunks;
-- -- 注意：不要 DROP EXTENSION vector，可能还有别的表用
-- COMMIT;
