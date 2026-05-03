"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ThinkingBlockProps {
  reasoningText: string      // The actual reasoning content from DeepSeek
  isThinking: boolean        // true while reasoning tokens are still streaming
  durationMs?: number        // How long the thinking took
  className?: string
}

export function AgenticThinkingBlock({
  reasoningText,
  isThinking,
  durationMs,
  className,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasAutoExpanded = useRef(false)

  // Auto-expand when first reasoning text arrives
  useEffect(() => {
    if (reasoningText && !hasAutoExpanded.current) {
      setIsExpanded(true)
      hasAutoExpanded.current = true
    }
  }, [reasoningText])

  // Auto-collapse 600ms after thinking completes
  useEffect(() => {
    if (!isThinking && reasoningText) {
      const timer = setTimeout(() => {
        setIsExpanded(false)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [isThinking, reasoningText])

  // Format duration
  const durationLabel = useMemo(() => {
    if (!durationMs || durationMs < 500) return null
    const seconds = Math.round(durationMs / 1000)
    return `${seconds}s`
  }, [durationMs])

  // Header label
  const headerLabel = isThinking
    ? "Thinking..."
    : durationLabel
      ? `Thought for ${durationLabel}`
      : "Think"

  return (
    <div className={cn("w-full", className)}>
      {/* Header — bullet + label + chevron */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-1.5 text-left group cursor-pointer"
      >
        {/* Bullet */}
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />

        {/* Label */}
        <span className={cn(
          "flex-1 text-[13px] text-muted-foreground select-none",
          isThinking && "animate-pulse"
        )}>
          {headerLabel}
        </span>

        {/* Chevron */}
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-transform duration-200",
            isExpanded && "rotate-90"
          )}
        />
      </button>

      {/* Expandable reasoning content */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="pl-5 pr-2 pb-2 max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            <p className="text-[13px] text-muted-foreground/70 leading-relaxed whitespace-pre-wrap break-words">
              {reasoningText}
              {isThinking && (
                <span className="inline-block w-0.5 h-3 bg-muted-foreground/40 ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
