import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod"
const JWT_EXPIRES_IN = "30d"

// v2.3：登录主键由 email 切到 phone。下游路由只用 userId，
// 这里把 email 换成 phone 与新的 signToken({ userId, phone }) 对齐。
export interface JwtPayload {
  userId: string
  phone: string | null
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}
