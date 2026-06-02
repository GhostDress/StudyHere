"use client"

/**
 * PDF 渲染层。
 *
 * v2.3 slice 2 阶段：暂用浏览器原生 iframe + PDF 插件渲染。
 *   为什么不用 react-pdf：
 *     - pdfjs-dist 5.x 在 Next.js 14 webpack 主线程被 import 时会炸
 *       「TypeError: Object.defineProperty called on non-object」
 *     - 之前用 dynamic import + ssr:false 包了一层，但开发模式下偶发回归
 *     - 当前阶段功能优先级是「能看原文核对」，PDF 高级交互（高亮、标注）
 *       要等 v2.4 上 react-pdf 真稳了再切回去
 *
 * mock URL / 已失效 URL 走演示态占位，不加载 iframe。
 */

import { useEffect, useState } from "react"
import { FileText, ExternalLink } from "lucide-react"

const MOCK_PAGE_COUNT = 30

interface PdfViewerProps {
  fileUrl: string
  page: number
  scale: number
  onLoadSuccess: (numPages: number) => void
}

// 判断是否走演示态（不加载 iframe）：
//   - 空 URL
//   - mock:// 开头（mock 上传产生的）
//   - file:// 本地路径（CORS 也会炸）
//
// 注：之前在这里加过 rcpwlkdofuymxyrkrcms.supabase.co 黑名单 —— 错误判断！
// 那个域名其实是项目的真生产 Supabase（D 在那建的 chunks/KG 表）。
// 真用户上传的 PDF 也存在那个 bucket，所以必须放行。
function isUnloadableUrl(url: string): boolean {
  if (!url) return true
  if (url.startsWith("mock://")) return true
  if (url.startsWith("file://")) return true
  return false
}

export default function PdfViewer({ fileUrl, page, scale, onLoadSuccess }: PdfViewerProps) {
  const [containerWidth, setContainerWidth] = useState<number>(800)

  const isMockUrl = isUnloadableUrl(fileUrl)

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
              这是 mock 演示页面 — 当前 vault 的 fileUrl 失效或处于 mock 状态。
              真上传的 PDF 在这里会渲染实际原文。
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
            {page} / {MOCK_PAGE_COUNT}  ·  {!fileUrl ? "no-url" : "mock"}
          </div>
        </div>
      </div>
    )
  }

  // 真 URL：iframe 直接显示 PDF（浏览器原生 PDF 插件）
  // iframe 加载完成时无法知道总页数（浏览器没暴露 API），
  // 给抽屉一个保守的"100 页"假设让翻页 UI 能用
  // 实际渲染由浏览器自己控制，#page=N 锚点让它跳到那页
  return (
    <div className="w-full h-full bg-[#f4f4f3] relative">
      <iframe
        key={`${fileUrl}#${page}`}
        src={`${fileUrl}#page=${page}&zoom=${Math.round(scale * 100)}`}
        className="w-full h-full border-0"
        title="PDF 原文"
        onLoad={() => onLoadSuccess(100)}
      />
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/90 border border-[#e9e9e8] px-2 py-1 text-[11px] text-[#6940a5] hover:bg-white"
      >
        <ExternalLink className="size-3" />
        新窗口打开
      </a>
    </div>
  )
}
