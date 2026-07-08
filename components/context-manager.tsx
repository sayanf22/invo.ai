"use client"

/**
 * Context Manager UI
 *
 * Presentational components for the reference-context feature. State (the
 * useContextDocuments hook) is owned by the host so the editor panel and the
 * chat-bar dialog can each render a consistent view.
 *
 *  - ContextFillBar      : the "how full is my context" progress bar
 *  - ContextPanel        : upload area + document list + fill bar (inline)
 *  - ContextManagerDialog: ContextPanel wrapped in a responsive dialog
 *
 * Responsive: works in the narrow editor column, on phones, and in the dialog.
 */

import React, { useCallback, useRef, useState } from "react"
import {
  Library,
  Upload,
  FileText,
  ImageIcon,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useContextDocuments, type ContextDocument, type ContextUsage } from "@/hooks/use-context-documents"
import { useUserTier, isReferenceContextEnabled } from "@/hooks/use-user-tier"

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Fill bar ──────────────────────────────────────────────────────────────
export function ContextFillBar({ usage, className }: { usage: ContextUsage; className?: string }) {
  const pct = Math.min(100, usage.fillPercent)
  const docLimitReached = usage.documentCount >= usage.maxDocuments
  const tone =
    pct >= 100 || docLimitReached ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"
  const label =
    pct >= 100 ? "Full" : docLimitReached ? "Max files" : pct >= 80 ? "Almost full" : "Space available"

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">
          Context used
          <span className="text-muted-foreground font-normal"> · {usage.documentCount}/{usage.maxDocuments} files</span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {pct}% · {label}
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Context fill level"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        {pct >= 100 || docLimitReached
          ? "Remove a document to add more. Too much reference material reduces accuracy."
          : "The AI uses these to match how you write — retrieved only when relevant."}
      </p>
    </div>
  )
}

// ── Document row ────────────────────────────────────────────────────────────
function DocumentRow({
  doc,
  onRemove,
  disabled,
}: {
  doc: ContextDocument
  onRemove: (id: string) => void
  disabled?: boolean
}) {
  const Icon = doc.mimeType?.startsWith("image/") ? ImageIcon : FileText
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card">
      <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground truncate leading-tight">{doc.fileName}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {doc.status === "processing" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Processing…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          )}
          <span className="text-muted-foreground/40">·</span>
          <span>{formatBytes(doc.fileSize)}</span>
          {doc.chunkCount > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{doc.chunkCount} chunk{doc.chunkCount === 1 ? "" : "s"}</span>
            </>
          )}
        </p>
      </div>

      {confirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { setConfirming(false); onRemove(doc.id) }}
            disabled={disabled}
            className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={disabled}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={`Remove ${doc.fileName}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Inline panel ─────────────────────────────────────────────────────────────
export interface ContextPanelProps {
  documents: ContextDocument[]
  usage: ContextUsage
  uploading: boolean
  onUpload: (file: File) => void | Promise<unknown>
  onRemove: (id: string) => void | Promise<unknown>
  /** When true (no session yet), the panel explains the doc must be opened first. */
  disabledReason?: string | null
  className?: string
}

export function ContextPanel({
  documents,
  usage,
  uploading,
  onUpload,
  onRemove,
  disabledReason,
  className,
}: ContextPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const docLimitReached = usage.documentCount >= usage.maxDocuments
  const atLimit = usage.isFull || docLimitReached
  const uploadDisabled = !!disabledReason || uploading || atLimit

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      onUpload(files[0])
    },
    [onUpload],
  )

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ContextFillBar usage={usage} />

      {disabledReason ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
          <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); if (!uploadDisabled) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (!uploadDisabled) handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            "rounded-2xl border-2 border-dashed transition-colors px-4 py-6 text-center",
            uploadDisabled
              ? "border-border bg-muted/20 opacity-70"
              : dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/20 cursor-pointer",
          )}
          onClick={() => { if (!uploadDisabled) inputRef.current?.click() }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); if (e.target) e.target.value = "" }}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {uploading ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {docLimitReached ? "Maximum files reached" : usage.isFull ? "Context is full" : uploading ? "Processing document…" : "Upload a reference document"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {atLimit
                  ? "Remove one below to free up space"
                  : `Drop a PDF or image, or click to browse · max 10MB · up to ${usage.maxDocuments} files`}
              </p>
            </div>
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Reference documents ({documents.length})
          </p>
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} onRemove={onRemove} disabled={uploading} />
          ))}
        </div>
      )}

      {documents.length === 0 && !disabledReason && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add a previous contract, invoice, or proposal. The AI studies how you write —
          your structure, clauses, tone — and applies that style when you ask it to
          create documents &ldquo;like before&rdquo; or &ldquo;in my usual format&rdquo;.
        </p>
      )}
    </div>
  )
}

// ── Editor section (self-contained, owns its own hook) ──────────────────────
// A collapsible card matching the editor's Step visual style. Drop-in for any
// editor variant — just pass the current session id.
export function EditorContextSection({
  sessionId,
  disabled,
}: {
  sessionId?: string | null
  disabled?: boolean
}) {
  const { documents, usage, uploading, upload, remove } = useContextDocuments(sessionId)
  const [open, setOpen] = useState(false)
  const tier = useUserTier()

  // Reference context is a Pro-and-above feature — hide the section otherwise.
  if (!isReferenceContextEnabled(tier)) return null

  return (
    <div className={cn("border border-border rounded-2xl bg-card shadow-sm transition-all", open ? "ring-1 ring-primary/15" : "")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/40 transition-all rounded-2xl"
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-muted-foreground shrink-0">
          <Library className="w-3.5 h-3.5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-foreground">Reference Context</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">
            {usage.documentCount > 0
              ? `${usage.documentCount} document${usage.documentCount === 1 ? "" : "s"} · ${usage.fillPercent}% full`
              : "Teach the AI your document style"}
          </span>
        </span>
        {usage.documentCount > 0 && (
          <span
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              usage.fillPercent >= 100 ? "bg-destructive" : usage.fillPercent >= 80 ? "bg-amber-500" : "bg-primary",
            )}
          />
        )}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">
            <ContextPanel
              documents={documents}
              usage={usage}
              uploading={uploading}
              onUpload={upload}
              onRemove={remove}
              disabledReason={
                !sessionId
                  ? "Start or open a document first, then add reference context."
                  : disabled
                    ? "This document is locked — reference context can't be changed."
                    : null
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Dialog wrapper ───────────────────────────────────────────────────────────
export function ContextManagerDialog({
  open,
  onOpenChange,
  ...panelProps
}: ContextPanelProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            Reference context
          </DialogTitle>
          <DialogDescription>
            Teach the AI your document style by uploading examples of your past work.
          </DialogDescription>
        </DialogHeader>
        <ContextPanel {...panelProps} />
      </DialogContent>
    </Dialog>
  )
}
