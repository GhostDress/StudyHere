import "dotenv/config"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import authRoute from "./routes/auth.route"
import vaultRoute from "./routes/vault.route"
import planRoute from "./routes/plan.route"
import practiceRoute from "./routes/practice.route"
import { startSrsCron } from "./workers/srsNotifier"

const app = new Hono()

app.use("*", logger())
const allowedOrigins = [
  process.env.FRONTEND_URL || "https://studyhere.com.cn",
  "https://studyhere.com.cn",
  "http://localhost:3000",
  "http://localhost:3001",
]

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return allowedOrigins[0]
    // 允许所有 EdgeOne 预览域名（*.edgeone.cool）用于测试
    if (origin.endsWith(".edgeone.cool")) return origin
    return allowedOrigins.includes(origin) ? origin : null
  },
  credentials: true,
}))

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }))

app.route("/api/auth", authRoute)
app.route("/api/vault", vaultRoute)
app.route("/api/plan", planRoute)
app.route("/api", practiceRoute)

const port = parseInt(process.env.PORT || "3001")
console.log(`🚀 StudyHere API running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })

// 启动 SRS 每日提醒 Cron（A-002）
startSrsCron()
