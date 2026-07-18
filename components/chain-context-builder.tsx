"use client"

/**
 * ChainContextBuilder — clean, step-by-step "building context" card shown while
 * a newly created linked document gathers the rolling context from its chain
 * (previous document + all earlier documents' accumulated brief) before the
 * document itself is generated.
 *
 * Presentational only. The parent owns the async work and flips `phase` to
 * "done" when the real context brief has been built.
 */

import { useEffect, useState } from "react"
import { Check, Loader2, Link2, FileText, Layers, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChainContextBuilderProps {
  parentType: string
  targetType: string
  /** "building" while the brief is being generated, "done" once it's ready. */
  phase: "building" | "done"
}

const STEPS = [
  { key: "read", label: "Reading the previous document", icon: FileText },
  { key: "understand", label: "Understanding the details and changes", icon: Sparkles },
  { key: "merge", label: "Merging the chain history", icon: Layers },
  { key: "finalize", label: "Finalizing accurate context", icon: Check },
] as const

function titleCase(t: string): string {
  const s = (t || "document").replace(/[_-]+/g, " ").trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function ChainContextBuilder({ parentType, targetType, phase }: ChainContextBuilderProps) {
  // Progressively light up the first N-1 steps on a timer while building; the
  // final step only completes when the parent flips phase to "done".
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (phase === "done") {
      setActiveStep(STEPS.length)
      return
    }
    // Advance through the first three steps; hold on the last until done.
    setActiveStep(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < STEPS.length; i++) {
      timers.push(setTimeout(() => setActiveStep(i), i * 900))
    }
    return () => timers.forEach(clearTimeout)
  }, [phase])

  return (
    <div className="flex justify-start w-full">
      <div
        className="w-full max-w-[88%] rounded-2xl bg-card border border-border/60 overflow-hidden"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {/* Header — the chain being linked */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Building context</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {titleCase(parentType)} → {titleCase(targetType)}
            </p>
          </div>
        </div>

        <div className="h-px bg-border/40" />

        {/* Steps */}
        <div className="px-4 py-3 space-y-2.5">
          {STEPS.map((step, i) => {
            const isDone = i < activeStep
            const isActive = i === activeStep && phase === "building"
            const Icon = step.icon
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200",
                    isDone ? "bg-emerald-500/15" : isActive ? "bg-primary/10" : "bg-muted/50",
                  )}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : isActive ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-muted-foreground/50" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[13px] transition-colors duration-200",
                    isDone ? "text-foreground/70" : isActive ? "text-foreground font-medium" : "text-muted-foreground/60",
                  )}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        <div className="px-4 pb-3.5">
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            Gathering everything from your previous documents so this one is accurate and consistent. Your document will be generated as soon as this finishes.
          </p>
        </div>
      </div>
    </div>
  )
}
