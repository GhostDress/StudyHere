"use client"

/**
 * PDF 渲染分两层：
 *   - PdfViewer (本文件)：上层壳，识别 mock URL 走演示态；只有真实 URL 才动态加载 react-pdf
 *   - RealPdfViewer (动态 import)：真正用 react-pdf 渲染，pdfjs-dist 只在此文件被加载
 *
 * 为什么分层：
 *   pdfjs-dist 5.x 在 next.js webpack 主线程被 import 时会触发
 *   "TypeError: Object.defineProperty called on non-object"（pdfjs 用了只在 worker
 *   context 才有的 global 拓展）。把 react-pdf import 推到二级 dynamic import 后，
 *   它只在用户真要看真实 PDF 时才加载，mock 模式完全不碰 pdfjs。
 */

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { FileText, Loader2 } from "lucide-react"

const MOCK_PAGE_COUNT = 30

// react-pdf 只在真实 URL 渲染时动态加载，避开 SSR + webpack 主线程加载 pdfjs 报错
const RealPdfViewer = dynamic(() => import("./RealPdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12 text-[#9b9a97]">
      <Loader2 className="size-5 animate-spin mr-2" />
      <span className="text-sm">加载 PDF 渲染器…</span>
    </div>
  ),
})

interface PdfViewerProps {
  fileUrl: string
  page: number
  scale: number
  onLoadSuccess: (numPages: number) => void
}

export default function PdfViewer({ fileUrl, page, scale, onLoadSuccess }: PdfViewerProps) {
  const [containerWidth, setContainerWidth] = useState<number>(800)

  const isMockUrl = !fileUrl || fileUrl.startsWith("mock://")

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth >= 768 ? window.innerWidth * 0.6 : window.innerWidth
      setContainerWidth(Math.max(400, w - 40))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  // Mock 模式：通知抽屉"假装有 30 页"
  useEffect(() => {
    if (isMockUrl) onLoadSuccess(MOCK_PAGE_COUNT)
  }, [isMockUrl, onLoadSuccess])

  if (isMockUrl) {
    const pageWidth = Math.min(containerWidth * scale, containerWidth)
    const pageHeight = pageWidth * 1.414
    return (
      <div className="flex flex-col items-center py-4">
        <div
          className="bg-white shadow-md border border-[#e9e9e8] flex flex-col"
          style={{ width: pageWidth, height: pageHeight }}
        >
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <FileText className="size-12 text-[#c4c4c2] mb-4" />
            <div className="text-2xl font-bold text-[#37352f] mb-2">第 {page} 页</div>
            <div className="text-[13px] text-[#9b9a97] mb-6 max-w-xs">
              这是 mock 演示页面 — 后端接入 Supabase Storage 真实 PDF 后，
              这里会渲染实际原文内容。
            </div>
            <div className="rounded-lg bg-[#f4efff] text-[#6940a5] px-3 py-2 text-[12px] font-medium">
              💡 你现在可以测试：翻页 / 跳页 / 缩放 / 关闭
            </div>
            <div className="mt-8 w-full max-w-xs space-y-2">
              <div className="h-2 bg-[#e9e9e8] rounded w-full" />
              <div className="h-2 bg-[#e9e9e8] rounded w-5/6" />
              <div className="h-2 bg-[#e9e9e8] rounded w-4/6" />
              <div className="h-2 bg-[#e9e9e8] rounded w-full" />
              <div className="h-2 bg-[#e9e9e8] rounded w-3/4" />
            </div>
          </div>
          <div className="border-t border-[#e9e9e8] py-2 text-center text-[11px] text-[#c4c4c2]">
            {page} / {MOCK_PAGE_COUNT}  ·  mock://demo
          </div>
        </div>
      </div>
    )
  }

  return (
    <RealPdfViewer
      fileUrl={fileUrl}
      page={page}
      scale={scale}
      containerWidth={containerWidth}
      onLoadSuccess={onLoadSuccess}
    />
  )
}
