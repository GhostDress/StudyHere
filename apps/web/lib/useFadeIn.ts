"use client"

import { useEffect, useRef, useState } from "react"

/**
 * 元素进入视口时触发淡入 — 使用 IntersectionObserver
 * 用法：
 *   const { ref, visible } = useFadeIn()
 *   <div ref={ref} className={visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} />
 */
export function useFadeIn(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, visible }
}
