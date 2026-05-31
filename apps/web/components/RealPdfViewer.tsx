"use client"

/**
 * react-pdf 实际渲染层。
 * 仅在 PdfViewer 判定为真实 URL 时才会被 dynamic import 加载，
 * 避免 mock 模式 / SSR 阶段触发 pdfjs-dist 5.x 的 webpack 兼容问题。
 */

import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Loader2 } from "lucide-react"

// 配置 pdfjs worker（CDN 走 unpkg；npmmirror 不镜像 .mjs 文件）
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface RealPdfViewerProps {
  fileUrl: string
  page: number
  scale: number
  containerWidth: number
  onLoadSuccess: (numPages: number) => void
}

export default function RealPdfViewer({
  fileUrl,
  page,
  scale,
  containerWidth,
  onLoadSuccess,
}: RealPdfViewerProps) {
  const [error, setError] = useState<string | null>(null)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-[#c4332e] text-sm mb-2">PDF 加载失败</p>
        <p className="text-[12px] text-[#9b9a97]">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-4">
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
        onLoadError={(e) => setError(e.message)}
        loading={
          <div className="flex items-center justify-center py-12 text-[#9b9a97]">
            <Loader2 className="size-5 animate-spin mr-2" />
            <span className="text-sm">加载 PDF…</span>
          </div>
        }
      >
        <Page
          pageNumber={page}
          width={containerWidth * scale}
          renderTextLayer={true}
          renderAnnotationLayer={false}
          loading={
            <div className="flex items-center justify-center py-8 text-[#9b9a97]">
              <Loader2 className="size-4 animate-spin mr-2" />
              <span className="text-[12px]">渲染中…</span>
            </div>
          }
        />
      </Document>
    </div>
  )
}
