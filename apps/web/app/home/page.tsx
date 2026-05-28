"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Upload,
  FileText,
  FileType2,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  LogOut,
  ArrowRight,
  BookOpen,
} from "lucide-react"
import { vaultApi, planApi } from "@/lib/api"
import type { Vault, VaultStatus } from "@/lib/types"

const STATUS_META: Record<
  VaultStatus,
  { label: string; bg: string; text: string; icon: typeof Clock }
> = {
  pending: {
    label: "排队中",
    bg: "bg-[#f1f1ef]",
    text: "text-[#787774]",
    icon: Clock,
  },
  processing: {
    label: "AI 生成中",
    bg: "bg-[#f4efff]",
    text: "text-[#6940a5]",
    icon: Sparkles,
  },
  done: {
    label: "已完成",
    bg: "bg-[#eaf5ec]",
    text: "text-[#2d7a45]",
    icon: CheckCircle2,
  },
  failed: {
    label: "失败",
    bg: "bg-[#fbeae9]",
    text: "text-[#c4332e]",
    icon: AlertCircle,
  },
}

const SAMPLE_MATERIALS = [
  { title: "产品经理入门 30 讲", topic: "互联网产品", level: "初级", pages: 15 },
  { title: "Python 基础语法精解", topic: "编程", level: "初级", pages: 20 },
  { title: "PMP 备考精讲", topic: "项目管理", level: "中级", pages: 25 },
  { title: "商务英语 500 词", topic: "语言学习", level: "初级", pages: 20 },
  { title: "财务基础知识", topic: "财务", level: "初级", pages: 25 },
]

function fileIcon(filename: string) {
  const ext = filename.toLowerCase().split(".").pop()
  if (ext === "pdf") return FileText
  if (ext === "docx" || ext === "doc") return FileType2
  return FileText
}

export default function HomePage() {
  const router = useRouter()
  const [vaults, setVaults] = useState<Vault[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/")
      return
    }
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null")
      if (u?.email) setUserEmail(u.email)
    } catch {}
    refreshList()
  }, [router])

  useEffect(() => {
    const pendingIds = vaults
      .filter((v) => v.status === "pending" || v.status === "processing")
      .map((v) => v.id)
    if (pendingIds.length === 0) return

    const timer = setInterval(async () => {
      const updates = await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const res = await planApi.status(id)
            return { id, status: res.status, errorMsg: res.errorMsg }
          } catch {
            return null
          }
        }),
      )
      setVaults((prev) =>
        prev.map((v) => {
          const u = updates.find((x) => x?.id === v.id)
          return u ? { ...v, status: u.status, errorMsg: u.errorMsg } : v
        }),
      )
    }, 2000)
    return () => clearInterval(timer)
  }, [vaults])

  async function refreshList() {
    try {
      const res = await vaultApi.list()
      setVaults(res.vaults)
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败")
    }
  }

  async function handleUpload(file: File) {
    setError("")
    const allowed = [".pdf", ".docx", ".doc", ".txt"]
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError("仅支持 PDF / Word / TXT 文件")
      return
    }
    setUploading(true)
    try {
      const res = await vaultApi.upload(file)
      // v2.2 流程对齐 PRD v2.1 §6.2：
      // 上传 → /loading/[vaultId] 等待 AI 生成计划
      // → /plan-confirm/[planId] 用户确认 → /agent-settings/[vaultId] 选风格 → /plan/[id]
      router.push(`/loading/${res.vaultId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败")
      setUploading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/")
  }

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-[#e9e9e8] bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#37352f] text-white flex items-center justify-center font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-[#37352f] text-[15px]">
              StudyHere
            </span>
          </div>
          <div className="flex items-center gap-3 text-[13px] text-[#787774]">
            {userEmail && <span>{userEmail}</span>}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#f1f1ef] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              退出
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div>
          <h1 className="text-[28px] font-bold text-[#37352f] tracking-tight">
            我的资料库
          </h1>
          <p className="mt-1 text-[14px] text-[#787774]">
            上传 PDF / Word，AI 会自动生成学习计划、闪卡和题目
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleUpload(file)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-6 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200 ${
            dragOver
              ? "border-[#6940a5] bg-[#f4efff]"
              : "border-[#e9e9e8] bg-[#fbfbfa] hover:border-[#9b9a97] hover:bg-white"
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                uploading ? "bg-[#f4efff]" : "bg-white border border-[#e9e9e8]"
              }`}
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-[#6940a5] animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-[#37352f]" />
              )}
            </div>
            <div className="mt-4 text-[15px] font-medium text-[#37352f]">
              {uploading ? "上传中" : "拖拽文件到这里，或点击选择"}
            </div>
            <div className="mt-1 text-[13px] text-[#9b9a97]">
              PDF · Word · TXT · 单文件最大 10MB
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ""
              }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 px-4 py-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {vaults.length === 0 && (
          <div className="mt-12">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-[#37352f]">
                没有自己的资料？试试这些精选
              </h2>
              <span className="text-[12px] text-[#9b9a97]">5 份示范资料</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {SAMPLE_MATERIALS.map((m, i) => (
                <div
                  key={i}
                  className="nt-card p-4 hover:border-[#6940a5] hover:shadow-[0_2px_8px_rgba(105,64,165,0.06)] transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-[#f4efff] flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-[#6940a5]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-[#37352f] truncate">
                        {m.title}
                      </div>
                      <div className="text-[12px] text-[#9b9a97] mt-1 flex items-center gap-2">
                        <span>{m.topic}</span>
                        <span>·</span>
                        <span>{m.level}</span>
                        <span>·</span>
                        <span>{m.pages} 页</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-[#37352f]">
            历史上传
          </h2>
          <span className="text-[13px] text-[#9b9a97]">{vaults.length} 份</span>
        </div>

        <div className="mt-3 nt-card divide-y divide-[#e9e9e8]">
          {vaults.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-lg bg-[#f1f1ef] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#9b9a97]" />
              </div>
              <p className="mt-4 text-[14px] text-[#787774]">
                还没有上传过资料
              </p>
              <p className="mt-1 text-[13px] text-[#9b9a97]">
                拖一份你正在学的 PDF 进来试试
              </p>
            </div>
          ) : (
            vaults.map((v) => {
              const meta = STATUS_META[v.status]
              const StatusIcon = meta.icon
              const FileIcon = fileIcon(v.filename)
              return (
                <div
                  key={v.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-[#fbfbfa] transition-colors duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-md bg-[#f1f1ef] flex items-center justify-center flex-shrink-0">
                      <FileIcon className="w-4 h-4 text-[#37352f]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-medium text-[#37352f] truncate">
                        {v.filename}
                      </div>
                      <div className="text-[12px] text-[#9b9a97] mt-0.5">
                        {new Date(v.createdAt).toLocaleString("zh-CN", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {v.errorMsg && (
                        <div className="text-[12px] text-red-600 mt-1">
                          {v.errorMsg}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-medium ${meta.bg} ${meta.text}`}
                    >
                      <StatusIcon
                        className={`w-3 h-3 ${v.status === "processing" ? "animate-pulse" : ""}`}
                      />
                      {meta.label}
                    </span>
                    {v.status === "done" && (
                      <button
                        onClick={() => {
                          // v2.2 流程：若未设置过智能体人格则先去选风格
                          const stored = JSON.parse(
                            localStorage.getItem("vault_personalities") || "{}",
                          )
                          if (!stored[v.id]) {
                            router.push(`/agent-settings/${v.id}`)
                          } else {
                            router.push(`/plan/${v.id}`)
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#37352f] hover:text-[#6940a5] transition-colors"
                      >
                        去学习
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
