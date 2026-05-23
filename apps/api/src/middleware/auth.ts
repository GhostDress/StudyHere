import type { Context, Next } from "hono"
import { verifyToken, type JwtPayload } from "../lib/jwt"

export type AuthVariables = {
  user: JwtPayload
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "未授权：缺少 Bearer token" }, 401)
  }

  const token = authHeader.slice(7)
  const payload = verifyToken(token)

  if (!payload) {
    return c.json({ error: "未授权：token 无效或已过期" }, 401)
  }

  c.set("user", payload)
  await next()
}
