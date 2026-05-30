-- =====================================================
-- StudyHere v2.2 · Day 6 Migration
-- 内容：知识图谱（KG）实体表 + 关系表
-- 主笔：lilith（C 模块）
-- 日期：2026-05-28
-- 对接：D（后端接口主管，task D-003）
--
-- 设计原则：
--   - 按 vault 隔离（一个宝库一张图谱），所有查询都带 vaultId 索引
--   - 实体颗粒度统一（参考 prompt 约束"机器学习"级别，15-40 个/宝库）
--   - mastery_score 用 smallint(0-100)，便于前端直接映射颜色
--   - test_count 用于可视化节点大小映射
--   - sourcePages / sourceChunkIds 双重溯源：页码给用户读，chunkId 给 RAG 串联
--   - feedbackCount 预留 v2.3 阶段 B 使用（用户报错聚合标记 AI 提炼可信度）
--   - 关系表用复合唯一约束防同对实体重复抽取
--
-- 影响范围：
--   - 0 行老数据迁移（全新表）
--   - 0 个现有表破坏性变更
--   - 新增 2 张表 + 5 个索引 + 1 个外键
--
-- 容量预估：
--   - kg_entities：单 vault 20-40 行，全平台 1k 用户 × 5 vault × 30 = 150k 行
--   - kg_relations：单 vault 30-80 行，全平台 ~400k 行
--   - 完全在 PostgreSQL 单机舒适区
--
-- 回滚预案：ROLLBACK 部分见文末
-- =====================================================

BEGIN;

-- ============================================
-- 1. kg_entities · 知识图谱节点
-- ============================================

CREATE TABLE IF NOT EXISTS kg_entities (
  id              text         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "vaultId"       text         NOT NULL,
  name            text         NOT NULL,                              -- 实体名（如"MVP"）
  type            text         NOT NULL DEFAULT 'concept',            -- concept / method / person / tool / theory / other
  description     text,                                               -- 短解释（hover 浮层用，≤ 200 字）
  "masteryScore"  smallint     NOT NULL DEFAULT 0,                    -- 0-100，前端颜色映射：0-30 红 / 31-70 黄 / 71-100 绿
  "testCount"     integer      NOT NULL DEFAULT 0,                    -- 被考次数，可视化节点大小映射
  "sourcePages"   integer[]    NOT NULL DEFAULT '{}',                 -- 出现的原文页码，给 PDF 抽屉跳转
  "sourceChunkIds" text[]      NOT NULL DEFAULT '{}',                 -- 关联的 chunks.id（v2.2 RAG 串联，等 chunks 表上线后填）
  "feedbackCount" integer      NOT NULL DEFAULT 0,                    -- v2.3 阶段 B：用户报错累计次数，≥2 触发 AI 重生标记
  "lastFeedbackAt" timestamp(3),                                      -- 最后一次被报错时间，给 AI 重生决策用
  "createdAt"     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT kg_entities_vault_id_fkey
    FOREIGN KEY ("vaultId") REFERENCES vaults(id) ON DELETE CASCADE,

  CONSTRAINT kg_entities_mastery_range_check
    CHECK ("masteryScore" >= 0 AND "masteryScore" <= 100),

  CONSTRAINT kg_entities_type_check
    CHECK (type IN ('concept', 'method', 'person', 'tool', 'theory', 'other'))
);

-- 单 vault 内实体名不重复（同一宝库不应抽出两个"MVP"）
CREATE UNIQUE INDEX IF NOT EXISTS kg_entities_vault_name_uniq
  ON kg_entities("vaultId", name);

-- vault 维度过滤是绝对主路径
CREATE INDEX IF NOT EXISTS kg_entities_vault_id_idx
  ON kg_entities("vaultId");

-- 颜色面板"薄弱节点"排序用
CREATE INDEX IF NOT EXISTS kg_entities_mastery_idx
  ON kg_entities("vaultId", "masteryScore");

COMMENT ON TABLE  kg_entities IS 'v2.2 知识图谱节点（按 vault 隔离）';
COMMENT ON COLUMN kg_entities.type IS '实体类型：concept=概念 / method=方法 / person=人物 / tool=工具 / theory=理论 / other=其他';
COMMENT ON COLUMN kg_entities."masteryScore" IS '掌握度 0-100，前端颜色映射 0-30 红 / 31-70 黄 / 71-100 绿';
COMMENT ON COLUMN kg_entities."testCount" IS '被考次数，KG 可视化节点大小映射';
COMMENT ON COLUMN kg_entities."sourcePages" IS '实体在原文出现的页码数组，给 PDF 抽屉跳转';
COMMENT ON COLUMN kg_entities."sourceChunkIds" IS '关联 chunks.id 数组（v2.2 RAG 串联，chunks 表上线后回填）';
COMMENT ON COLUMN kg_entities."feedbackCount" IS 'v2.3 阶段 B：用户报错累计，≥2 触发 AI 重生标记';
COMMENT ON COLUMN kg_entities."lastFeedbackAt" IS 'v2.3 阶段 B：最后一次被报错时间';


-- ============================================
-- 2. kg_relations · 知识图谱边
-- ============================================

CREATE TABLE IF NOT EXISTS kg_relations (
  id           text         PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "vaultId"    text         NOT NULL,                                 -- 冗余存 vault，便于跨表查询不 join
  "sourceId"   text         NOT NULL,                                 -- FK kg_entities.id
  "targetId"   text         NOT NULL,                                 -- FK kg_entities.id
  type         text         NOT NULL DEFAULT 'related_to',            -- prerequisite / contains / applies_to / similar_to / related_to
  weight       real         NOT NULL DEFAULT 1.0,                     -- 0.0-1.0，AI 抽出时的置信度，可视化边粗细
  description  text,                                                  -- 关系简述（可选，hover 用）
  "createdAt"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT kg_relations_vault_id_fkey
    FOREIGN KEY ("vaultId") REFERENCES vaults(id) ON DELETE CASCADE,

  CONSTRAINT kg_relations_source_id_fkey
    FOREIGN KEY ("sourceId") REFERENCES kg_entities(id) ON DELETE CASCADE,

  CONSTRAINT kg_relations_target_id_fkey
    FOREIGN KEY ("targetId") REFERENCES kg_entities(id) ON DELETE CASCADE,

  CONSTRAINT kg_relations_weight_range_check
    CHECK (weight >= 0.0 AND weight <= 1.0),

  CONSTRAINT kg_relations_type_check
    CHECK (type IN ('prerequisite', 'contains', 'applies_to', 'similar_to', 'related_to')),

  CONSTRAINT kg_relations_no_self_loop_check
    CHECK ("sourceId" <> "targetId")
);

-- 同对实体同类型关系不重复
CREATE UNIQUE INDEX IF NOT EXISTS kg_relations_triple_uniq
  ON kg_relations("sourceId", "targetId", type);

-- 单 vault 拉全图的主查询路径
CREATE INDEX IF NOT EXISTS kg_relations_vault_id_idx
  ON kg_relations("vaultId");

COMMENT ON TABLE  kg_relations IS 'v2.2 知识图谱边（按 vault 隔离 + 防自环 + 同三元组唯一）';
COMMENT ON COLUMN kg_relations.type IS '关系类型：prerequisite=前置 / contains=包含 / applies_to=应用于 / similar_to=相似 / related_to=相关（默认）';
COMMENT ON COLUMN kg_relations.weight IS '0.0-1.0 置信度，可视化边粗细映射';


-- ============================================
-- 3. 验证查询（D 跑完 migration 后可手动核对）
-- ============================================

-- 验证两张表已建：
-- \d kg_entities
-- \d kg_relations

-- 验证约束生效：
-- INSERT INTO kg_entities("vaultId", name, type) VALUES ('test', 'X', 'invalid_type'); -- 应失败
-- INSERT INTO kg_entities("vaultId", name, "masteryScore") VALUES ('test', 'X', 150);  -- 应失败

-- 验证索引：
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('kg_entities', 'kg_relations');
-- 期望看到：kg_entities_vault_name_uniq / kg_entities_vault_id_idx / kg_entities_mastery_idx
--          kg_relations_triple_uniq / kg_relations_vault_id_idx

COMMIT;


-- =====================================================
-- 回滚（若出问题在 1 分钟内可全部回滚）：
-- =====================================================
-- BEGIN;
-- DROP TABLE IF EXISTS kg_relations;
-- DROP TABLE IF EXISTS kg_entities;
-- COMMIT;
