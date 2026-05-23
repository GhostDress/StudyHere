"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { vaultApi, planApi } from "@/lib/api"
import type { Vault, VaultStatus } from "@/lib/types"

const STATUS_LABEL: Record<VaultStatus, { text: string; color: string }> = {
  pending: { text: "等待中", color: "bg-slate-100 text-slate-600" },
  processing: { text: "AI 处理中", color: "bg-amber-100 text-amber-700" },
  done: { text: "已完成", color: "bg-emerald-100 text-emerald-700" },
  failed: { text: "失败", color: "bg-red-100 text-red-700" },
}

export default function VaultPage() {
  const router = useRouter()
  const [vaults, setVaults] = useState<Vault[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/login")
      return
    }
    refreshList()
  }, [router])

  // 轮询所有未完成的 vault 状态
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
      await vaultApi.upload(file)
      await refreshList()
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败")
    } finally {
      setUploading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <span className="font-semibold text-slate-900">StudyHere</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            退出
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900">我的资料库</h1>
        <p className="mt-1 text-slate-500 text-sm">
          上传 PDF / Word 文件，AI 会自动生成 14 天学习计划 + 闪卡 + 题目
        </p>

        {/* 上传区 */}
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
          className={`mt-6 rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition ${
            dragOver
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/30"
          }`}
        >
          <div className="text-4xl mb-3">{uploading ? "⏳" : "📥"}</div>
          <div className="text-slate-900 font-medium">
            {uploading ? "上传中..." : "拖拽文件到这里，或点击选择"}
          </div>
          <div className="text-slate-400 text-sm mt-1">
            支持 PDF / Word / TXT，单文件最大 10MB
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

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Vault 列表 */}
        <h2 className="mt-10 text-lg font-semibold text-slate-900">
          历史上传 ({vaults.length})
        </h2>
        <div className="mt-4 space-y-3">
          {vaults.length === 0 && (
            <div className="text-center text-slate-400 py-12 text-sm">
              还没有上传过资料，开始上传你的第一份吧
            </div>
          )}
          {vaults.map((v) => {
            const status = STATUS_LABEL[v.status]
            return (
              <div
                key={v.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:border-indigo-300 transition"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="text-2xl flex-shrink-0">📄</div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {v.filename}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(v.createdAt).toLocaleString("zh-CN")}
                    </div>
                    {v.errorMsg && (
                      <div className="text-xs text-red-600 mt-1">
                        {v.errorMsg}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.color}`}
                  >
                    {v.status === "processing" && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
                    )}
                    {status.text}
                  </span>
                  {v.status === "done" && (
                    <button
                      onClick={() => router.push(`/plan/pln-001`)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      去学习 →
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
