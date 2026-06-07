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

// 拖拽宽度配置（vw 百分比，跟 PlanAdvisor 风格一致）
const PDF_WIDTH_KEY = "pdf_drawer_width_px"
const PDF_DEFAULT_WIDTH = 720
const PDF_MIN_WIDTH = 480
const PDF_MAX_WIDTH = 1200

export function PdfDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [opts, setOpts] = useState<PdfDrawerOpenOptions | null>(null)
  const [width, setWidth] = useState<number>(PDF_DEFAULT_WIDTH)
  const [resizing, setResizing] = useState(false)

  // 恢复用户上次调过的宽度
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = parseInt(localStorage.getItem(PDF_WIDTH_KEY) || "", 10)
    if (
      Number.isFinite(stored) &&
      stored >= PDF_MIN_WIDTH &&
      stored <= PDF_MAX_WIDTH
    ) {
      setWidth(stored)
    }
  }, [])

  // 持久化宽度
  useEffect(() => {
    if (typeof window === "undefined" || resizing) return
    localStorage.setItem(PDF_WIDTH_KEY, String(width))
  }, [width, resizing])

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

  // 左边缘拖拽改宽
  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setResizing(true)
      const startX = e.clientX
      const startWidth = width
      const onMove = (ev: PointerEvent) => {
        // 抽屉在右侧：向左拖 = 加宽，向右拖 = 变窄
        const next = Math.max(
          PDF_MIN_WIDTH,
          Math.min(PDF_MAX_WIDTH, startWidth + (startX - ev.clientX)),
        )
        setWidth(next)
      }
      const onEnd = () => {
        setResizing(false)
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onEnd)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onEnd)
    },
    [width],
  )

  return (
    <PdfDrawerContext.Provider value={{ open, close, isOpen }}>
      {children}
      {/* 无遮罩：背后 Day 卡片仍可见可滚（v2.3 信任链路对照阅读原则）*/}
      {/* 抽屉 */}
      <aside
        className={`fixed top-0 right-0 z-50 h-screen bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] border-l border-[#e9e9e8] transition-transform duration-300 ease-out flex ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${resizing ? "select-none" : ""}`}
        style={{
          width: `${width}px`,
          maxWidth: "100vw", // 移动端不能超过视口
        }}
        aria-hidden={!isOpen}
      >
        {/* 左边缘拖拽手柄 */}
        <div
          onPointerDown={onResizeStart}
          className={`group absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#6940a5]/20 z-10 ${
            resizing ? "bg-[#6940a5]/30" : ""
          }`}
          title="拖拽调整宽度"
        />
        <div className="flex flex-col w-full pl-1.5">
          {opts && <PdfDrawerBody opts={opts} onClose={close} />}
        </div>
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
