import "dotenv/config"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

const app = new Hono()

app.use("*", logger())
app.use("*", cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}))

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }))

// Routes will be mounted here
// app.route("/api/auth", authRoute)
// app.route("/api/vault", vaultRoute)
// app.route("/api/plan", planRoute)
// app.route("/api", practiceRoute)

const port = parseInt(process.env.PORT || "3001")
console.log(`🚀 StudyHere API running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
