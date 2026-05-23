// ============================================================
// Mock 模式开关 —— Mock-First 方法论的代码落地
// ------------------------------------------------------------
// 设计：前端不依赖后端在线就能开发完整页面
//   - mockMode = true：所有 API 调用走 mockData，2 秒模拟延迟
//   - mockMode = false：走真实后端（联调时切到 false）
// 切换方式：改下面的常量，或通过 .env 的 NEXT_PUBLIC_USE_MOCK
// ============================================================

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false"

/**
 * 模拟网络延迟，让 mock 模式更像真实接口
 */
export function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 生成 mock token —— 仅本地使用，无任何安全意义
 */
export function makeMockToken(): string {
  return `mock-token-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
