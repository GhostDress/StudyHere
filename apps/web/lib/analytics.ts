// ============================================================
// 落地页埋点 — MVP 阶段使用 console.log 占位
// 生产环境替换为 Mixpanel / GA / 自研事件管道
// ============================================================

type LandingEvent =
  | "landing_page_view"
  | "landing_cta_click"
  | "landing_feature_scroll"
  | "landing_faq_expand"

export function trackLandingEvent(
  event: LandingEvent,
  props: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
    referrer: document.referrer || "direct",
    ...props,
  }
  // MVP：打到 console，生产替换
  console.log("[Track]", payload)
  // 生产实现示例：
  // window.gtag?.("event", event, props)
  // window.mixpanel?.track(event, props)
}
