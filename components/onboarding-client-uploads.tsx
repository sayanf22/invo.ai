"use client"

/**
 * OnboardingClientUploads — owner-facing list of files the client uploaded
 * natively (to R2) through the onboarding form. Renders nothing when there are
 * no files. Each file downloads via the authenticated /api/onboarding/files
 * endpoint. Shown inside the Client Onboarding Form editor.
 */

import { useCallback, useEffect, useState } from "react"
import { FileText, ImageIcon, Download, Loader2 } from "lucide-react"
import { authFetch } from "@/lib/auth-fetch"

interface UploadedFile {
  id: string
  fileName: string
  mimeType: string
  fileSize: number
}

function formatBytes(bytes: number): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function OnboardingClientUploads({ sessionId, alwaysShow }: { sessionId?: string; alwaysShow?: boolean }) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setLoading(true)
    authFetch(`/api/onboarding/files?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.ok ? r.json() : { files: [] })
      .then((d) => { if (!cancelled) setFiles(d.files ?? []) })
      .catch(() => { if (!cancelled) setFiles([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionId])

  const download = useCallback(async (file: UploadedFile) => {
    setDownloadingId(file.id)
    try {
      const res = await authFetch(`/api/onboarding/files?fileId=${encodeURIComponent(file.id)}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      /* non-fatal */
    } finally {
      setDownloadingId(null)
    }
  }, [])

  if (!sessionId) return null
  if (!alwaysShow && !loading && files.length === 0) return null

  return (
    <div className="border border-border rounded-2xl bg-card shadow-sm p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Client uploads {files.length > 0 && `(${files.length})`}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          No files uploaded yet. Your client can upload images or PDFs directly on the form — they&apos;ll appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => {
            const Icon = f.mimeType?.startsWith("image/") ? ImageIcon : FileText
            return (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background">
                <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate">{f.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">{formatBytes(f.fileSize)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => download(f)}
                  disabled={downloadingId === f.id}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors shrink-0 disabled:opacity-50"
                  aria-label={`Download ${f.fileName}`}
                >
                  {downloadingId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
