"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function VaultRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/home")
  }, [router])
  return null
}
