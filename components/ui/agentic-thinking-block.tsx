"use client"

import { useState, useEffect, useRef } from "react"
import {
  ChevronDown,
  Loader2,
  CheckCircle2,
  Brain,
  Search,
  FileText,
  Shield,
  Sparkles,
  Database,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type StepStatus = "pending" | "active" | "completed"
export type StepType = "thinking" | "tool" | "generating"

export interface AgenticStep {
  id: string
  label: string
  status: StepStatus
  type: StepType
  detail?: string
}

interface AgenticThinkingBlockProps {
  steps: AgenticStep[]
  isGenerating: boolean
  className?: string
}

const STEP_ICONS: Record<string, React.ElementType> = {
  analyze: Brain,
  compliance: Shield,
  search: Search,
  document: FileText,
  generate: Sparkles,
  database: Database,
}

function getStepIcon(step: AgenticStep) {
  // Match icon by keyword in the step id
  for (const [key, Icon] of Object.entries(STEP_ICONS)) {
    if (step.id.toLowerCase().includes(key)) return Icon
  }
  // Default by type
  if (step.type === "thinking") return Brain
  if (step.type === "tool") return Database
  return Sparkles
}

export function AgenticThinkingBlock({
  steps,
  isGenerating,
  className,
}: AgenticThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const hasAutoCollapsed = useRef(false)

  // Auto-collapse when generation finishes
  useEffect(() => {
    if (!isGenerating && steps.length > 0 && !hasAutoCollapsed.current) {
      const timer = setTimeout(() => {
        setIsExpanded(false)
        hasAutoCollapsed.current = true
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [isGenerating, steps.length])

  const completedCount = steps.filter((s) => s.status === "completed").length
  const activeStep = steps.find((s) => s.status === "active")
  const allDone = !isGenerating && completedCount === steps.length && steps.length > 0

  return (
    <div
      className={cn(
        "w-full rounded-2xl border bg-card overflow-hidden transition-all duration-300",
        isGenerating
          ? "border-border/60 shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
          : "border-border/40",
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        {/* Status indicator */}
        <div className="relative w-5 h-5 shrink-0 flex items-center justify-center">
          {allDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-in fade-in zoom-in duration-300" />
          ) : (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-foreground/10" />
              <div
                className="absolute inset-0 rounded-full border-2 border-foreground/60 border-t-transparent animate-spin"
                style={{ animationDuration: "1.2s" }}
              />
            </>
          )}
        </div>

        {/* Label */}
        <span className="flex-1 text-[13px] font-medium text-foreground/80 truncate">
          {allDone
            ? "Done"
            : activeStep
              ? activeStep.label
              : "Starting..."}
        </span>

        {/* Step counter */}
        <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
          {completedCount}/{steps.length}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Expandable content */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div ref={contentRef} className="px-4 pb-3">
            {/* Timeline */}
            <div className="relative ml-2.5">
              {steps.map((step, idx) => {
                const Icon = getStepIcon(step)
                const isLast = idx === steps.length - 1

                return (
                  <div key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {/* Vertical line */}
                    {!isLast && (
                      <div
                        className={cn(
                          "absolute left-[7px] top-[22px] w-[1.5px] bottom-0 transition-colors duration-500",
                          step.status === "completed"
                            ? "bg-foreground/15"
                            : "bg-border/60"
                        )}
                      />
                    )}

                    {/* Icon node */}
                    <div className="relative shrink-0 flex items-start pt-0.5">
                      <div
                        className={cn(
                          "w-[16px] h-[16px] rounded-full flex items-center justify-center transition-all duration-300",
                          step.status === "completed"
                            ? "bg-foreground/10"
                            : step.status === "active"
                              ? "bg-foreground/10"
                              : "bg-transparent"
                        )}
                      >
                        {step.status === "completed" ? (
                          <CheckCircle2 className="w-3 h-3 text-foreground/40" />
                        ) : step.status === "active" ? (
                          <Loader2
                            className="w-3 h-3 text-foreground/60 animate-spin"
                            style={{ animationDuration: "1.5s" }}
                          />
                        ) : (
                          <Icon className="w-3 h-3 text-muted-foreground/30" />
                        )}
                      </div>
                    </div>

                    {/* Label + detail */}
                    <div className="flex-1 min-w-0 pt-px">
                      <p
                        className={cn(
                          "text-[12px] leading-tight transition-colors duration-300",
                          step.status === "completed"
                            ? "text-muted-foreground/50"
                            : step.status === "active"
                              ? "text-foreground/70 font-medium"
                              : "text-muted-foreground/35"
                        )}
                      >
                        {step.label}
                      </p>
                      {step.detail && step.status === "active" && (
                        <p className="text-[11px] text-muted-foreground/40 mt-0.5 truncate animate-in fade-in duration-300">
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
