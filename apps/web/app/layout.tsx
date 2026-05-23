import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "StudyHere - AI 学习闭环平台",
  description: "帮你掌握任何知识和技能的 AI 学习闭环平台",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
