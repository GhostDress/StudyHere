-- =====================================================
-- StudyHere v2.3 · 登录方式迁移：邮箱 OTP → 手机号短信验证码
-- 内容：users 加 phone 唯一列、email 改可空；otps 用 phone 替换 email
-- 日期：2026-06-03
-- 对接：D（后端）
--
-- 设计决策（已与产品确认）：
--   - 干净切换、不迁移历史数据（存量基本是测试账号）
--   - phone 作为新登录主键（唯一、可空——可空是为了兼容尚未绑定手机号的历史行）
--   - email 保留为可空唯一，仅供历史 SRS 邮件提醒兜底，新用户不再写入
--
-- 影响范围：
--   - users: email 由 NOT NULL → 可空；新增 phone 唯一列
--   - otps : 列 email → phone（含索引重建）；历史验证码行可安全清空
-- =====================================================

BEGIN;

-- 1) users 表：email 放开 NOT NULL 约束，新增 phone 唯一列
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users" ("phone");

-- 2) otps 表：废弃 email 维度，改为 phone
--    验证码是瞬时数据，历史行直接清空避免脏数据
DELETE FROM "otps";
DROP INDEX IF EXISTS "otps_email_code_idx";
ALTER TABLE "otps" DROP COLUMN IF EXISTS "email";
ALTER TABLE "otps" ADD COLUMN "phone" TEXT NOT NULL;
CREATE INDEX "otps_phone_code_idx" ON "otps" ("phone", "code");

COMMIT;
