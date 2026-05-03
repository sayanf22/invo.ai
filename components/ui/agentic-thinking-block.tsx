"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type StepStatus = "pending" | "active" | "completed"

export interface ThinkingStep {
  id: string
  label: string
  status: StepStatus
}

interface AgenticThinkingBlockProps {
  steps: ThinkingStep[]
  isComplete: boolean
  className?: string
}

export function AgenticThinkingBlock({
  steps,
  isComplete,
  className,
}: AgenticThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const hasAutoCollapsed = useRef(false)

  // Auto-collapse 800ms after isComplete becomes true
  useEffect(() => {
    if (isComplete && !hasAutoCollapsed.current) {
      const timer = setTimeout(() => {
        setIsExpanded(false)
        hasAutoCollapsed.current = true
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [isComplete])

  const completedCount = steps.filter((s) => s.status === "completed").length

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-1.5 text-left group"
      >
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />

        <span className="flex-1 text-[13px] text-muted-foreground truncate">
          Worked on your document
        </span>

        <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
        </span>
      </button>

      {/* Expandable content */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="pl-6 pb-1.5 space-y-1">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 py-0.5">
                {step.status === "active" ? (
                  <Loader2
                    className="w-3 h-3 text-foreground/70 animate-spin shrink-0"
                    style={{ animationDuration: "1.5s" }}
                  />
                ) : step.status === "completed" ? (
                  <Check className="w-3 h-3 text-muted-foreground shrink-0" />
                ) : (
                  <div className="w-3 h-3 shrink-0" />
                )}

                <span
                  className={cn(
                    "text-[12px] leading-tight",
                    step.status === "active"
                      ? "text-foreground/70"
                      : step.status === "completed"
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground/40"
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
