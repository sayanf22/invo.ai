"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, X, Loader2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"

// ── Constants ──────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const

const DEFAULT_MAX_SIZE_MB = 5

// ── Exported validation (pure, testable) ───────────────────────────────

export function validateLogoFile(
  file: { type: string; size: number },
  maxSizeMB: number = DEFAULT_MAX_SIZE_MB
): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return { valid: false, error: "Invalid file type. Please upload PNG, JPEG, WebP, or GIF." }
  }
  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    return { valid: false, error: `File too large. Maximum size is ${maxSizeMB}MB.` }
  }
  return { valid: true }
}

// ── Types ──────────────────────────────────────────────────────────────

type UploadState = "idle" | "previewing" | "uploading" | "complete"

export interface LogoUploaderProps {
  currentLogoKey?: string | null
  onUploadComplete: (objectKey: string) => void
  onRemove?: () => void
  maxSizeMB?: number
}

// ── Component ──────────────────────────────────────────────────────────

export function LogoUploader({
  currentLogoKey,
  onUploadComplete,
  onRemove,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
}: LogoUploaderProps) {
  const [state, setState] = useState<UploadState>(currentLogoKey ? "complete" : "idle")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [currentDisplayUrl, setCurrentDisplayUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch current logo presigned URL ─────────────────────────────────

  useEffect(() => {
    if (!currentLogoKey) {
      setCurrentDisplayUrl(null)
      return
    }

    let cancelled = false

    async function fetchLogoUrl() {
      try {
        const res = await authFetch(`/api/storage/image?key=${encodeURIComponent(currentLogoKey!)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.dataUrl) {
          setCurrentDisplayUrl(data.dataUrl)
        }
      } catch {
        // Silently fail — logo just won't display
      }
    }

    fetchLogoUrl()
    return () => { cancelled = true }
  }, [currentLogoKey])

  // ── Cleanup preview URL on unmount ───────────────────────────────────

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // ── File selection handler ───────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateLogoFile({ type: file.type, size: file.size }, maxSizeMB)
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }

    // Revoke previous preview
    if (previewUrl) URL.revokeObjectURL(previewUrl)

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    setSelectedFile(file)
    setState("previewing")
  }, [maxSizeMB, previewUrl])

  // ── Upload handler ───────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return

    setState("uploading")

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("category", "logos")

      const res = await authFetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Upload failed.")
      }

      const { objectKey } = await res.json()

      setState("complete")
      setCurrentDisplayUrl(previewUrl)
      setSelectedFile(null)
      onUploadComplete(objectKey)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again."
      toast.error(message)
      setState("previewing")
    }
  }, [selectedFile, previewUrl, onUploadComplete])

  // ── Drag and drop handlers ───────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    e.target.value = ""
  }, [handleFileSelect])

  // ── Remove handler ───────────────────────────────────────────────────

  const handleRemove = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setCurrentDisplayUrl(null)
    setSelectedFile(null)
    setState("idle")
    onRemove?.()
  }, [previewUrl, onRemove])

  // ── Derived state ────────────────────────────────────────────────────

  const displayUrl = previewUrl || currentDisplayUrl
  const showDropZone = state === "idle" && !displayUrl
  const showPreview = !!displayUrl
  const isUploading = state === "uploading"

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Single hidden file input shared across states */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {showDropZone && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleBrowseClick() }}
          aria-label="Upload logo image"
          className={cn(
            "relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
            isDragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
              isDragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {isDragOver ? "Drop image here" : "Upload your logo"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Drag & drop or{" "}
                <span className="text-primary underline underline-offset-2">browse</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, WebP, or GIF — up to {maxSizeMB}MB
            </p>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Logo preview */}
            <div className="w-16 h-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayUrl!}
                alt="Logo preview"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex-1 min-w-0">
              {state === "previewing" && (
                <p className="text-sm text-muted-foreground">Ready to upload</p>
              )}
              {isUploading && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading…
                </p>
              )}
              {state === "complete" && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">Logo uploaded</p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {state === "previewing" && (
                <Button size="sm" onClick={handleUpload} className="gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </Button>
              )}

              {!isUploading && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRemove}
                  aria-label="Remove logo"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Change logo — click to browse again */}
          {state === "complete" && (
            <button
              type="button"
              onClick={handleBrowseClick}
              className="mt-2 text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              Change logo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
