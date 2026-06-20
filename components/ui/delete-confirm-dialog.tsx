"use client"

import { Loader2, Trash2, AlertTriangle } from "lucide-react"
import { createPortal } from "react-dom"
import { useEffect, useState } from "react"

interface DeleteConfirmDialogProps {
  open: boolean
  title?: string
  description?: string
  /**
   * Optional list of consequence warnings shown as bullets.
   * When provided, the dialog shows an amber warning box listing what
   * will be lost/stopped so the user can make an informed decision.
   * Examples:
   *   ["Pending e-signature request will be cancelled"]
   *   ["Auto email reminders will stop"]
   *   ["Client can no longer accept/decline this proposal"]
   */
  warnings?: string[]
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
}

export function DeleteConfirmDialog({
  open,
  title = "Delete document?",
  description = "This action cannot be undone. The document will be permanently removed.",
  warnings,
  onCancel,
  onConfirm,
  loading = false,
}: DeleteConfirmDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onCancel() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, loading, onCancel])

  if (!open || !mounted) return null

  const hasWarnings = warnings && warnings.length > 0

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => { if (!loading) onCancel() }}
      />

      {/* Dialog panel */}
      <div className="relative w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Icon + text */}
        <div className="px-6 pt-6 pb-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Trash2 className="w-5 h-5 text-foreground/70" />
          </div>
          <h2 id="delete-dialog-title" className="text-base font-semibold text-foreground mb-1.5">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        {/* Consequence warnings — shown when document has active state */}
        {hasWarnings && (
          <div className="mx-6 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1.5">
                  Deleting will also:
                </p>
                <ul className="space-y-1">
                  {warnings!.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <span className="mt-1 w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-foreground bg-background hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
