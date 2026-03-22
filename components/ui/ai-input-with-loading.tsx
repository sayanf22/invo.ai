"use client"

import { CornerRightUp, Square } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea"

interface AIInputWithLoadingProps {
  id?: string
  placeholder?: string
  minHeight?: number
  maxHeight?: number
  loadingDuration?: number
  onSubmit?: (value: string) => void | Promise<void>
  onStop?: () => void
  isLoading?: boolean
  disabled?: boolean
  className?: string
  statusText?: string
  value?: string
  onValueChange?: (value: string) => void
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
}: AIInputWithLoadingProps) {
  const [internalValue, setInternalValue] = useState("")
  const inputValue = controlledValue !== undefined ? controlledValue : internalValue

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
    if (!inputValue.trim() || isLoading) return
    await onSubmit?.(inputValue)
    setValue("")
    adjustHeight(true)
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="relative w-full">
        <div
          className={cn(
            "relative rounded-2xl border bg-card transition-all duration-200",
            isLoading
              ? "border-primary/40 shadow-[0_2px_16px_-2px_hsl(var(--primary)/0.15)]"
              : "border-border shadow-[0_1px_8px_-1px_rgba(0,0,0,0.08)] focus-within:border-primary/40 focus-within:shadow-[0_2px_16px_-2px_hsl(var(--primary)/0.15)]"
          )}
        >
          <Textarea
            id={id}
            placeholder={placeholder}
            className={cn(
              "w-full rounded-2xl border-none bg-transparent pl-5 pr-14 pt-4 pb-2",
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
            disabled={isLoading || disabled}
            autoFocus
          />
          <button
            onClick={isLoading ? onStop : handleSubmit}
            className={cn(
              "absolute right-3 bottom-3 flex items-center justify-center w-9 h-9 rounded-2xl transition-all duration-200 shrink-0",
              isLoading
                ? "bg-destructive/10 text-destructive hover:bg-destructive/15 cursor-pointer"
                : inputValue.trim()
                  ? "bg-foreground text-background hover:opacity-80 active:scale-90"
                  : "bg-muted/60 text-muted-foreground/30 cursor-not-allowed"
            )}
            type="button"
            disabled={!inputValue.trim() && !isLoading}
            aria-label={isLoading ? "Stop" : "Send"}
          >
            {isLoading ? (
              <Square className="w-3 h-3 fill-current" />
            ) : (
              <CornerRightUp
                className={cn(
                  "w-4 h-4 transition-opacity",
                  inputValue.trim() ? "opacity-100" : "opacity-30"
                )}
              />
            )}
          </button>
        </div>
        <p className="pl-2 pt-1.5 h-5 text-[11px] text-muted-foreground/50 select-none">
          {statusText || (isLoading ? "Generating..." : "Shift+Enter for new line")}
        </p>
      </div>
    </div>
  )
}
