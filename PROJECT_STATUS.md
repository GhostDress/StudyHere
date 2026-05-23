# StudyHere 项目状态文档

**生成时间：** 2026-05-23
**当前进度：** 10 / 13 任务完成（A 角色 + D 角色 Sprint 1-2 全部完成）
**项目目的：** AI 学习闭环平台 MVP，目标中国市场

---

## 一、人员分工

| 角色 | 承担人 | 状态 |
|------|--------|------|
| A 架构师 | 当前用户（GhostDress）| 进行中 |
| D 后端工程师 | 当前用户（GhostDress）| 进行中 |
| B 前端工程师 | 队友 ymmccl1995-star | 等待中 |
| C AI 工程师 | 同 B（一人承担）| 等待中 |

---

## 二、技术栈定型

### 架构（生产环境）

```
┌──────────────────────────────────────────────────────────┐
│ 前端：EdgeOne Pages（腾讯云国内 CDN）                    │
│ https://studyhere.pages.edgeone.app  ← 已部署            │
└─────────────────┬────────────────────────────────────────┘
                  │ HTTPS
                  ▼
┌──────────────────────────────────────────────────────────┐
│ 后端：腾讯云轻量应用服务器（北京）                       │
│ http://82.156.128.150:3001  ← 已部署（PM2 守护进程）     │
│ Node.js 20 + Hono.js + Prisma + PM2                      │
└──────┬───────────────────┬───────────────────────────────┘
       │                   │
       ▼                   ▼
┌──────────────┐  ┌──────────────────────────────────────┐
│ Supabase     │  │ Supabase Storage                     │
│ PostgreSQL   │  │ bucket: user-files (public)          │
│ Singapore    │  │ Singapore                            │
└──────────────┘  └──────────────────────────────────────┘
```

### 仓库结构

```
StudyHere/
├── apps/
│   ├── web/          ← Next.js 14 + TS + Tailwind（B 负责）
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── api/          ← Hono.js + TS + Prisma（D 已完成）
│       ├── prisma/schema.prisma
│       └── src/
│           ├── index.ts
│           ├── lib/         (prisma, jwt, supabase)
│           ├── middleware/  (auth)
│           ├── routes/      (auth, vault, plan, practice)
│           ├── services/    (mailer)
│           └── workers/     (fileProcessor)
├── package.json      ← Turborepo + pnpm workspace
├── pnpm-workspace.yaml
├── .npmrc            ← 国内镜像（registry + prisma engines）
└── .env.example
```

### 关键依赖
- 包管理：pnpm 11
- monorepo：Turborepo 2
- 前端：Next.js 14, React 18, Tailwind, zustand, react-query, axios
- 后端：Hono.js 4, Prisma 5, jsonwebtoken, zod, resend, ws（修复 Supabase Realtime 用）
- AI：**待定**（绝对不能用 OpenAI，国内不可用；候选 DeepSeek / 通义千问 / Kimi，等 C 接入前决定）

---

## 三、资源 / 账户清单

### GitHub
- 仓库：https://github.com/GhostDress/StudyHere
- 主分支：`main`（含项目骨架）
- 开发分支：`feature/backend`（D 的全部后端代码）
- 协作者：ymmccl1995-star（已邀请）
- 用户：GhostDress（zzp986569496@gmail.com）
- PAT：已存 macOS 钥匙串（令牌不写入文档，防止泄露；**建议用完后在 GitHub Settings → Developer settings 撤销**）

### Supabase
- Project：StudyHere（Singapore）
- URL：`https://rcpwlkdofuymxyrkrcms.supabase.co`
- 数据库密码：`GQ5tq2SNFXB74oRM`（自动生成）
- Pooled URL：`postgresql://postgres.rcpwlkdofuymxyrkrcms:GQ5tq2SNFXB74oRM@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- Direct URL：`postgresql://postgres.rcpwlkdofuymxyrkrcms:GQ5tq2SNFXB74oRM@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
- Storage bucket：`user-files`（public, 50MB limit）
- 数据库表（8 张，snake_case）：users / otps / vaults / study_plans / flashcards / questions / answer_records / wrong_questions

### 腾讯云
- 账号：100028755017（已实名）
- 轻量服务器：lhins-r2xbigio（北京）
- 配置：Ubuntu 24.04 / 2核 / 4GB / 70GB SSD / 6Mbps / 600GB流量
- 公网 IP：`82.156.128.150`
- SSH 用户：`ubuntu`
- 费用：¥360/年（首单 4 折，2026-05 至 2027-05）

### EdgeOne Pages
- 项目名：studyhere
- 域名：`studyhere.pages.edgeone.app`（具体子域待用户确认）
- 仓库：从 GitHub main 分支自动部署

---

## 四、已完成任务清单（10/13）

### Sprint 0（搭建期）
- ✅ **A-001** 创建 GitHub 仓库 + 推 Turborepo 骨架
- ✅ **A-002** 配置 Supabase 数据库
- ✅ **D-001** 配置本地后端环境 + 创建 feature/backend 分支

### Sprint 1-2（D 开发期）
- ✅ **D-002** Prisma schema 设计 8 张表 + push 到 Supabase
- ✅ **D-003** 用户认证接口
  - `POST /api/auth/send-otp`（6位验证码，1小时5次限流）
  - `POST /api/auth/login`（验证码登录，自动创建用户，签 JWT 30天）
  - `GET /api/auth/me`（需 Bearer Token）
  - 邮件双模式：无 RESEND_API_KEY 时打印控制台
- ✅ **D-004** 文件上传接口
  - `POST /api/vault/upload`（PDF/Word，≤50MB，存 Supabase Storage）
  - `GET /api/vault`、`GET /api/vault/:id`
- ✅ **D-005** 学习内容查询接口
  - 计划：`GET /api/plan`、`/:id`、`/:id/status`
  - 闪卡：`GET /api/flashcard?planId=`、`PATCH /api/flashcard/:id`
  - 题目：`GET /api/question?planId=`、`POST /api/answer`
  - 错题：`GET /api/wrong-question`
- ✅ **D-006** 文件处理流水线 `workers/fileProcessor.ts`
  - 状态机 pending → processing → done/failed
  - 4 个 Mock 函数（parseFile / generatePlan / generateFlashcards / generateQuestions）等 C 接入

### Sprint 0（部署期）
- ✅ **A-003** 部署前端到 EdgeOne Pages
- ✅ **A-004** 部署后端到腾讯云轻量服务器
  - Node 20 + pnpm + PM2 已装
  - PM2 进程名 `studyhere-api`，监听 3001
  - 防火墙规则待开 3001 端口

---

## 五、剩余任务（3/13）

| 任务 | 状态 | 阻塞原因 |
|------|------|---------|
| **A-005** Sprint 3 联调协调 | 待 | 等 B/C 队友完工 |
| **D-007** 后端联调上线 | 待 | 同上 |
| **A-006** 上线 + 发布 | 待 | 联调后才能做 |

---

## 六、重大决策与原因

### 1. 前端部署：放弃 Vercel，改 EdgeOne Pages
- 原因：Vercel 触发风控（中国 IP），申诉要 1-7 天
- EdgeOne Pages 国内 CDN，免费，部署成功

### 2. 后端部署：放弃 Render（海外），改腾讯云轻量
- 原因：用户目标中国市场，Render Singapore 跨境延迟 + 海外不稳定
- 用户要"一次定型不返工"，宁可付 ¥360/年也不要返工
- 不绑自定义域名 = 不需要 ICP 备案

### 3. 数据库：保留 Supabase（不迁移）
- 原因：跨境延迟 100-200ms 对学习类产品可接受
- 真有大流量再迁移到腾讯云 PostgreSQL
- 节省一周开发时间

### 4. AI 模型：必须改国产（推迟到 C 接入前决定）
- 原因：OpenAI 国内开发者无法注册 + API 被墙
- 候选：DeepSeek（推荐，API 兼容 OpenAI）/ 通义千问 / Kimi
- 影响 C 队友的 AI 服务接入代码

### 5. 验证码：保留邮箱 + 双模式
- 原因：国内短信需企业实名 + 签名审核 3-7 天，卡进度
- Mock 模式：开发期把验证码打印到控制台
- 真上线时再决定接 Resend 邮件或阿里云短信

---

## 七、已踩坑 + 解决方案（避免重复踩）

| 问题 | 解决 |
|------|------|
| pnpm install 在国内超时 | 配 `.npmrc` 用 `registry.npmmirror.com` |
| Prisma 引擎二进制下载失败 | 加 `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma` |
| GitHub HTTPS clone 在腾讯云北京 SSL timeout | 用代理前缀 `https://ghfast.top/https://github.com/...` |
| Supabase JS SDK v2.106+ 在 Node 20 报 WebSocket 不支持 | `pnpm add ws` + `createClient({ realtime: { transport: WebSocket } })` |
| EdgeOne Pages 项目名只能小写 | `StudyHere` → `studyhere` |
| 用户首次创建仓库选错 Public（应 Private） | 不影响功能但仓库公开，后续可改 |

---

## 八、未做的环境变量 / 端口配置（待 A-004 收尾）

### 腾讯云防火墙
- 需开放 TCP 3001 端口（来源 0.0.0.0/0）
- 操作位置：lighthouse 控制台 → 服务器详情 → 防火墙 → 添加规则

### 服务器环境变量（已写入 `~/StudyHere/apps/api/.env`）
```env
DATABASE_URL=...                  (Supabase pooled, 已填)
DIRECT_URL=...                    (Supabase direct, 已填)
SUPABASE_URL=...                  (已填)
SUPABASE_ANON_KEY=eyJ...          (已填)
SUPABASE_SERVICE_KEY=eyJ...       (已填)
JWT_SECRET=studyhere-prod-2026... (已填)
OPENAI_API_KEY=                   (待 C 接入时填，可能换 DEEPSEEK_API_KEY)
RESEND_API_KEY=                   (留空 = mock 模式)
FRONTEND_URL=https://studyhere.pages.edgeone.app
PORT=3001
```

---

## 九、给队友 B / C 的交接信息

```
仓库：https://github.com/GhostDress/StudyHere
后端 API 基址：http://82.156.128.150:3001
前端 URL：https://studyhere.pages.edgeone.app

B（前端）需要：
1. clone 仓库，切 main 分支
2. cd apps/web && pnpm dev
3. 全程用 lib/mockData.ts 假数据开发
4. Sprint 3 联调时把 NEXT_PUBLIC_API_URL 改成 http://82.156.128.150:3001

C（AI）需要：
1. 不要用 OpenAI（国内不可用），改 DeepSeek / 通义千问 / Kimi 等
2. 在 apps/api/src/services/ 下新建 parser.service.ts 和 plan.service.ts
3. 联调时在 workers/fileProcessor.ts 顶部取消 4 行 import 注释
4. 把 4 处 mockXxx() 调用替换为真实的 AI 函数
```

---

## 十、关键命令速查

### 本地（Mac）
```bash
# 进项目
cd /Users/zhangzhipeng/Desktop/StudyHere

# 启后端开发
cd apps/api && pnpm dev

# 启前端开发
cd apps/web && pnpm dev

# 推送
git add . && git commit -m "..." && git push
```

### 服务器（腾讯云）
```bash
# 进入 WebShell 后
cd ~/StudyHere

# 拉代码（用代理）
git pull https://ghfast.top/https://github.com/GhostDress/StudyHere.git feature/backend

# 重建 + 重启
cd apps/api && pnpm install && pnpm build
pm2 restart studyhere-api
pm2 logs studyhere-api --lines 20 --nostream

# 查状态
pm2 status
```

### 验证（本地或浏览器）
```bash
curl http://82.156.128.150:3001/health
# 期望：{"status":"ok","timestamp":"..."}
```

---

## 十一、提交记录

```
44e9df1 fix(api): 修复 Node.js 20 下 Supabase Realtime WebSocket 报错
9322869 feat(api): D-004/005/006 文件上传 + 学习接口 + 处理流水线
6f9cfde feat(api): D-002/D-003 数据库 schema + 用户认证接口
f3bad12 feat: 初始化 StudyHere 项目骨架
```

分支：`feature/backend`（HEAD 在 44e9df1）
未合并到 main，按团队规则等 Sprint 3 联调统一合并。
