"use client"

/**
 * useContextDocuments
 *
 * Client hook for the reference-context feature. Lists the reference documents
 * visible to the current document (scoped by session/chain), tracks the
 * context-fill usage for the progress bar, and handles upload + delete.
 *
 * All requests go through authFetch (Bearer + CSRF + FormData aware).
 */

import { useCallback, useEffect, useState } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { toast } from "sonner"

export interface ContextDocument {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
  tokenCount: number
  chunkCount: number
  status: "processing" | "ready" | "failed"
  createdAt?: string
}

export interface ContextUsage {
  usedTokens: number
  maxTokens: number
  fillPercent: number
  isFull: boolean
  documentCount: number
  maxDocuments: number
  /** True when either the token budget OR the document-count limit is reached. */
  isAtLimit: boolean
}

const EMPTY_USAGE: ContextUsage = {
  usedTokens: 0,
  maxTokens: 40_000,
  fillPercent: 0,
  isFull: false,
  documentCount: 0,
  maxDocuments: 10,
  isAtLimit: false,
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]
const MAX_FILE_SIZE = 10 * 1024 * 1024

export function useContextDocuments(sessionId?: string | null) {
  const [documents, setDocuments] = useState<ContextDocument[]>([])
  const [usage, setUsage] = useState<ContextUsage>(EMPTY_USAGE)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setDocuments([])
      setUsage(EMPTY_USAGE)
      return
    }
    setLoading(true)
    try {
      const res = await authFetch(`/api/context/list?sessionId=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents ?? [])
        setUsage(data.usage ?? EMPTY_USAGE)
      }
    } catch {
      /* non-fatal — keep prior state */
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Keep multiple hook instances (editor panel + chat-bar dialog) in sync:
  // when one uploads/removes, others refresh.
  useEffect(() => {
    if (!sessionId) return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail || detail.sessionId === sessionId) refresh()
    }
    window.addEventListener("context-docs-changed", handler)
    return () => window.removeEventListener("context-docs-changed", handler)
  }, [sessionId, refresh])

  const notifyChanged = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("context-docs-changed", { detail: { sessionId } }))
    }
  }, [sessionId])

  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      if (!sessionId) {
        toast.error("Open a document first, then add reference context.")
        return false
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Unsupported file. Upload a PDF or image.")
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File too large. Maximum 10MB.")
        return false
      }
      if (usage.documentCount >= usage.maxDocuments) {
        toast.error(`You can attach up to ${usage.maxDocuments} reference documents. Remove one first.`)
        return false
      }
      if (usage.isFull) {
        toast.error("Context is full. Remove a document before adding more.")
        return false
      }

      setUploading(true)
      const toastId = toast.loading(`Reading "${file.name}"…`)
      try {
        const form = new FormData()
        form.append("file", file)
        form.append("sessionId", sessionId)

        const res = await authFetch("/api/context/upload", { method: "POST", body: form })
        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          toast.error(data.error || "Could not add this document.", { id: toastId })
          if (data.usage) setUsage(data.usage)
          return false
        }

        toast.success(`Added "${data.document?.fileName ?? file.name}" to context.`, { id: toastId })
        if (data.usage) setUsage(data.usage)
        await refresh()
        notifyChanged()
        return true
      } catch {
        toast.error("Upload failed. Please try again.", { id: toastId })
        return false
      } finally {
        setUploading(false)
      }
    },
    [sessionId, usage.documentCount, usage.maxDocuments, usage.isFull, refresh, notifyChanged],
  )

  const remove = useCallback(
    async (id: string): Promise<void> => {
      // Optimistic removal.
      const prev = documents
      setDocuments((d) => d.filter((doc) => doc.id !== id))
      try {
        const res = await authFetch(`/api/context/${id}`, { method: "DELETE" })
        if (!res.ok) {
          setDocuments(prev)
          toast.error("Could not remove the document.")
          return
        }
        toast.success("Reference document removed.")
        await refresh()
        notifyChanged()
      } catch {
        setDocuments(prev)
        toast.error("Could not remove the document.")
      }
    },
    [documents, refresh, notifyChanged],
  )

  return { documents, usage, loading, uploading, upload, remove, refresh }
}
