"use client"

/**
 * v2.3 slice 2 · PDF 抽屉（信任链路决策 1）
 *
 * 用途：用户随时可以打开原文对照 AI 提炼的内容。
 *
 * 使用方式：
 *   1. 在 RootLayout 包 <PdfDrawerProvider>
 *   2. 任意位置调 const { open } = usePdfDrawer(); open({ fileUrl, page: 12 })
 *
 * 设计：
 *   - SSR 安全：react-pdf 通过 dynamic import + ssr:false 加载
 *   - worker：用 pdfjs-dist 自带 worker（CDN 兜底）
 *   - 状态：纯 React Context，不引入 zustand
 *   - 视觉：右侧抽屉，60% 宽（PC）/ 100% 宽（移动）
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import dynamic from "next/dynamic"
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react"

// ============ Context 定义 ============

interface PdfDrawerOpenOptions {
  fileUrl: string
  page?: number          // 打开后跳到第几页（1-indexed）
  highlight?: string     // 可选：高亮的文字片段（暂未实现，预留）
}

interface PdfDrawerContextValue {
  open: (opts: PdfDrawerOpenOptions) => void
  close: () => void
  isOpen: boolean
}

const PdfDrawerContext = createContext<PdfDrawerContextValue | null>(null)

export function usePdfDrawer(): PdfDrawerContextValue {
  const ctx = useContext(PdfDrawerContext)
  if (!ctx) {
    throw new Error("usePdfDrawer 必须在 <PdfDrawerProvider> 内部使用")
  }
  return ctx
}

// ============ react-pdf 动态加载（避免 SSR 报错）============

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-[#9b9a97]">
      <Loader2 className="size-6 animate-spin mr-2" />
      <span className="text-sm">加载 PDF 渲染器…</span>
    </div>
  ),
})

// ============ Provider ============

export function PdfDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [opts, setOpts] = useState<PdfDrawerOpenOptions | null>(null)

  const open = useCallback((newOpts: PdfDrawerOpenOptions) => {
    setOpts(newOpts)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // 不立即清 opts，让退出动画跑完
    setTimeout(() => setOpts(null), 300)
  }, [])

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen, close])

  return (
    <PdfDrawerContext.Provider value={{ open, close, isOpen }}>
      {children}
      {/* 遮罩 */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={close}
        aria-hidden
      />
      {/* 抽屉 */}
      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-full md:w-[60vw] bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        {opts && <PdfDrawerBody opts={opts} onClose={close} />}
      </aside>
    </PdfDrawerContext.Provider>
  )
}

// ============ Drawer 主体 ============

interface PdfDrawerBodyProps {
  opts: PdfDrawerOpenOptions
  onClose: () => void
}

function PdfDrawerBody({ opts, onClose }: PdfDrawerBodyProps) {
  const [currentPage, setCurrentPage] = useState(opts.page ?? 1)
  const [totalPages, setTotalPages] = useState<number>(0)
  const [scale, setScale] = useState(1.0)
  const [pageInput, setPageInput] = useState(String(opts.page ?? 1))
  const lastOptsRef = useRef<PdfDrawerOpenOptions>(opts)

  // opts 变化时（同抽屉切换文件/页码）重置
  useEffect(() => {
    const changed =
      lastOptsRef.current.fileUrl !== opts.fileUrl ||
      lastOptsRef.current.page !== opts.page
    if (changed) {
      setCurrentPage(opts.page ?? 1)
      setPageInput(String(opts.page ?? 1))
      lastOptsRef.current = opts
    }
  }, [opts])

  const goPage = useCallback(
    (p: number) => {
      if (!totalPages) return
      const next = Math.max(1, Math.min(totalPages, p))
      setCurrentPage(next)
      setPageInput(String(next))
    },
    [totalPages]
  )

  const handlePageInputBlur = () => {
    const n = parseInt(pageInput, 10)
    if (Number.isFinite(n)) goPage(n)
    else setPageInput(String(currentPage))
  }

  return (
    <>
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between border-b border-[#e9e9e8] px-4 py-3 bg-white">
        <div className="flex items-center gap-2 text-sm text-[#37352f]">
          <button
            onClick={onClose}
            className="size-8 rounded-lg hover:bg-[#f4f4f3] flex items-center justify-center"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
          <span className="text-[12px] text-[#9b9a97] hidden md:inline">
            按 ESC 关闭
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => goPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="size-8 rounded-lg hover:bg-[#f4f4f3] disabled:opacity-30 flex items-center justify-center"
            aria-label="上一页"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex items-center gap-1 text-[13px]">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              onBlur={handlePageInputBlur}
              onKeyDown={(e) => e.key === "Enter" && handlePageInputBlur()}
              className="w-12 text-center border border-[#e9e9e8] rounded px-1 py-0.5 focus:outline-none focus:border-[#6940a5]"
            />
            <span className="text-[#9b9a97]">/ {totalPages || "—"}</span>
          </div>
          <button
            onClick={() => goPage(currentPage + 1)}
            disabled={!totalPages || currentPage >= totalPages}
            className="size-8 rounded-lg hover:bg-[#f4f4f3] disabled:opacity-30 flex items-center justify-center"
            aria-label="下一页"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="size-8 rounded-lg hover:bg-[#f4f4f3] flex items-center justify-center"
            aria-label="缩小"
          >
            <ZoomOut className="size-4" />
          </button>
          <span className="text-[12px] text-[#9b9a97] w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
            className="size-8 rounded-lg hover:bg-[#f4f4f3] flex items-center justify-center"
            aria-label="放大"
          >
            <ZoomIn className="size-4" />
          </button>
        </div>
      </div>

      {/* PDF 渲染区 */}
      <div className="flex-1 overflow-auto bg-[#f4f4f3]">
        <PdfViewer
          fileUrl={opts.fileUrl}
          page={currentPage}
          scale={scale}
          onLoadSuccess={(numPages) => setTotalPages(numPages)}
        />
      </div>
    </>
  )
}
