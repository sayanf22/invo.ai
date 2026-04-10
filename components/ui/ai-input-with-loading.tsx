"use client"

import { CornerRightUp, Square, Paperclip, X, FileText, ImageIcon, Loader2 } from "lucide-react"
import { useState, useRef, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon
  return FileText
}

function getFileLabel(type: string): string {
  if (type === "application/pdf") return "PDF"
  if (type.startsWith("image/png")) return "PNG"
  if (type.startsWith("image/jpeg") || type.startsWith("image/jpg")) return "JPG"
  if (type.startsWith("image/webp")) return "WEBP"
  if (type.startsWith("image/")) return "IMG"
  return "FILE"
}

interface AIInputWithLoadingProps {
  id?: string
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  onSubmit?: (value: string) => void | Promise<void>
  onStop?: () => void
  isLoading?: boolean
  disabled?: boolean
  className?: string
  statusText?: string
  value?: string
  onValueChange?: (value: string) => void
  /** File attachment support */
  stagedFile?: File | null
  onFileSelect?: (file: File) => void
  onFileRemove?: () => void
  showAttachButton?: boolean
  isUploading?: boolean
}

export function AIInputWithLoading({
  id = "ai-input-with-loading",
  placeholder = "Ask me anything!",
  minHeight = 52,
  maxHeight = 160,
  onSubmit,
  onStop,
  isLoading = false,
  disabled = false,
  className,
  statusText,
  value: controlledValue,
  onValueChange,
  stagedFile,
  onFileSelect,
  onFileRemove,
  showAttachButton = false,
  isUploading = false,
}: AIInputWithLoadingProps) {
  const [internalValue, setInternalValue] = useState("")
  const inputValue = controlledValue !== undefined ? controlledValue : internalValue
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  })

  const setValue = useCallback(
    (v: string) => {
      if (onValueChange) onValueChange(v)
      else setInternalValue(v)
    },
    [onValueChange]
  )

  const handleSubmit = async () => {
    if ((!inputValue.trim() && !stagedFile) || isLoading) return
    await onSubmit?.(inputValue)
    setValue("")
    adjustHeight(true)
  }

  const hasContent = inputValue.trim() || stagedFile
  const FileIcon = stagedFile ? getFileIcon(stagedFile.type) : FileText

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full">
        <div
          className={cn(
            "relative rounded-2xl border bg-card transition-all duration-300",
            isLoading || isUploading
              ? "border-primary/40 shadow-[0_2px_16px_-2px_hsl(var(--primary)/0.15)]"
              : "border-border shadow-[0_1px_8px_-1px_rgba(0,0,0,0.08)] focus-within:border-primary/40 focus-within:shadow-[0_2px_16px_-2px_hsl(var(--primary)/0.15)]"
          )}
        >
          {/* Staged file card — inside the input area */}
          {stagedFile && (
            <div className="px-3 pt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="inline-flex items-center gap-3 px-3 py-2.5 bg-muted/60 rounded-xl border border-border/50 max-w-[220px] group">
                <div className="w-10 h-10 rounded-lg bg-background border border-border/60 flex flex-col items-center justify-center shrink-0">
                  <FileIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[8px] font-bold text-muted-foreground mt-0.5 leading-none">{getFileLabel(stagedFile.type)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-foreground truncate leading-tight">{stagedFile.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatFileSize(stagedFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={onFileRemove}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <Textarea
            id={id}
            placeholder={stagedFile ? "Add a message about this file..." : placeholder}
            className={cn(
              "w-full rounded-2xl border-none bg-transparent pr-14 pt-3 pb-2",
              showAttachButton ? "pl-12" : "pl-5",
              "text-[15px] text-foreground placeholder:text-muted-foreground/40",
              "resize-none leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0",
              "overflow-y-auto"
            )}
            style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px`, scrollbarWidth: "thin" }}
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              setValue(e.target.value)
              adjustHeight()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            disabled={isLoading || isUploading || disabled}
            autoFocus
          />

          {/* Attach button — bottom left inside the input */}
          {showAttachButton && (
            <>
              <input
                ref={fileInputRef}
                id={`${id}-file-input`}
                type="file"
                accept="image/*,application/pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && onFileSelect) onFileSelect(file)
                  if (e.target) e.target.value = ""
                }}
              />
              <label
                htmlFor={!(isLoading || isUploading || disabled) ? `${id}-file-input` : undefined}
                className={cn(
                  "absolute left-3 bottom-3 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200",
                  isLoading || isUploading || disabled
                    ? "opacity-40 cursor-not-allowed text-muted-foreground"
                    : "cursor-pointer text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
                )}
                aria-label="Attach file"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </label>
            </>
          )}

          {/* Send / Stop button — bottom right */}
          <button
            onClick={isLoading ? onStop : handleSubmit}
            className={cn(
              "absolute right-3 bottom-3 flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200 shrink-0",
              isLoading
                ? "bg-destructive/10 text-destructive hover:bg-destructive/15 cursor-pointer"
                : hasContent
                  ? "bg-foreground text-background hover:opacity-80 active:scale-90"
                  : "bg-muted/60 text-muted-foreground/30 cursor-not-allowed"
            )}
            type="button"
            disabled={!hasContent && !isLoading}
            aria-label={isLoading ? "Stop" : "Send"}
          >
            {isLoading ? (
              <Square className="w-3 h-3 fill-current" />
            ) : (
              <CornerRightUp
                className={cn(
                  "w-4 h-4 transition-opacity",
                  hasContent ? "opacity-100" : "opacity-30"
                )}
              />
            )}
          </button>
        </div>
        <p className="pl-2 pt-1.5 h-5 text-[11px] text-muted-foreground/50 select-none">
          {statusText || (isUploading ? "Analyzing file..." : isLoading ? "Generating..." : "Shift+Enter for new line")}
        </p>
      </div>
    </div>
  )
}
