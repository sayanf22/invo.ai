'use client';

import { useState, useEffect, useRef } from "react"
import {
  FileText, ScrollText, FileQuestion, Presentation,
  ClipboardList, Shield, GitMerge, ClipboardCheck,
  Bell, ChevronRight, Lock,
} from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useTier } from "@/hooks/use-tier"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { getDocumentTypeConfig, type DocumentType } from "@/lib/document-type-registry"
import { AnimatePresence, motion } from "framer-motion"

// ── Icon map matching document-type-registry icon names ──────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  FileCheck: ScrollText,
  FileQuestion,
  Presentation,
  ClipboardList,
  Shield,
  GitMerge,
  ClipboardCheck,
  Bell,
}

// ── Example prompts for each document type ────────────────────────────────────
interface PillPrompt {
  type: DocumentType
  shortLabel: string
  fullPrompt: string
}

const ALL_PROMPTS: PillPrompt[] = [
  {
    type: "invoice",
    shortLabel: "Invoice for $1,500 web design",
    fullPrompt: "Create an invoice for $1,500 web design work for Acme Corp",
  },
  {
    type: "contract",
    shortLabel: "3-month consulting contract",
    fullPrompt: "Draft a 3-month consulting contract with a new client",
  },
  {
    type: "quote",
    shortLabel: "Quote for 50 branded t-shirts",
    fullPrompt: "Quote for 50 branded t-shirts for a corporate event",
  },
  {
    type: "proposal",
    shortLabel: "Website redesign proposal",
    fullPrompt: "Write a proposal for a website redesign project",
  },
  {
    type: "sow",
    shortLabel: "SOW for 6-week mobile app build",
    fullPrompt: "SOW for a 6-week mobile app build with 3 milestones",
  },
  {
    type: "nda",
    shortLabel: "Mutual NDA for product roadmap",
    fullPrompt: "Mutual NDA before sharing product roadmap with a partner",
  },
  {
    type: "change_order",
    shortLabel: "Change order: add 2 features",
    fullPrompt: "Change order adding two new features to the existing SOW",
  },
  {
    type: "client_onboarding_form",
    shortLabel: "Onboarding form for web client",
    fullPrompt: "Onboarding form for a new web design client",
  },
  {
    type: "payment_followup",
    shortLabel: "Reminder for overdue INV-001",
    fullPrompt: "Polite reminder for invoice INV-001 that's 2 weeks overdue",
  },
]

const ROTATION_INTERVAL_MS = 4000

interface CategoryPillsProps {
  /**
   * Called when a suggestion is clicked. Receives the full prompt text
   * to fill the parent's input. Parent should NOT auto-send —
   * user reviews and presses Enter.
   */
  onSelect?: (prompt: string) => void
}

/**
 * Auto-rotating prompt suggestion carousel.
 * - Shows ALL 9 document type prompts (locked ones navigate to /billing).
 * - Slides horizontally when transitioning between suggestions.
 * - Pauses auto-rotation on hover.
 * - Clicking fills the prompt input; user sends manually.
 */
export function CategoryPills({ onSelect }: CategoryPillsProps) {
  const { requireAuth, isLoading } = useRequireAuth()
  const { allowedDocTypes, loading: tierLoading } = useTier()
  const router = useRouter()

  const [index, setIndex] = useState(0)
  // direction: 1 = sliding forward (right→left), -1 = sliding backward (left→right)
  const [direction, setDirection] = useState(1)
  const pausedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-rotate every 4 seconds
  useEffect(() => {
    const tick = () => {
      if (pausedRef.current) return
      setDirection(1)
      setIndex(prev => (prev + 1) % ALL_PROMPTS.length)
    }
    intervalRef.current = setInterval(tick, ROTATION_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const handleNext = () => {
    setDirection(1)
    setIndex(prev => (prev + 1) % ALL_PROMPTS.length)
  }

  const handleDotClick = (i: number) => {
    setDirection(i > index ? 1 : -1)
    setIndex(i)
  }

  const handleSelect = (prompt: string) => {
    requireAuth(() => { onSelect?.(prompt) })()
  }

  const current = ALL_PROMPTS[index]
  const config = getDocumentTypeConfig(current.type)
  const IconComponent = config ? (ICON_MAP[config.icon] ?? FileText) : FileText
  // A prompt is "locked" only if tier is loaded and the type isn't allowed
  const isLocked = !tierLoading && !allowedDocTypes.includes(current.type)

  // Slide variants: enter from the right, exit to the left (and vice-versa)
  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 36 : -36,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -36 : 36,
      opacity: 0,
    }),
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">

      {/* Section label — no star icon, just clean uppercase text */}
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40 select-none">
        Try a prompt
      </p>

      {/* Sliding pill row */}
      <div
        className="flex items-center gap-2 w-full max-w-[420px]"
        onMouseEnter={() => { pausedRef.current = true }}
        onMouseLeave={() => { pausedRef.current = false }}
        onFocusCapture={() => { pausedRef.current = true }}
        onBlurCapture={() => { pausedRef.current = false }}
      >
        {/* Clipping container so exiting pill doesn't overflow */}
        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.button
              key={index}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              type="button"
              onClick={() => {
                if (isLocked) { router.push("/billing"); return }
                handleSelect(current.fullPrompt)
              }}
              disabled={isLoading}
              title={isLocked ? `${config?.label ?? current.type} requires a paid plan` : current.fullPrompt}
              aria-label={
                isLocked
                  ? `${config?.label ?? current.type} (locked) — upgrade to unlock`
                  : `Try: ${current.fullPrompt}`
              }
              className={cn(
                // Base shape
                "flex items-center gap-2.5 w-full px-4 py-2.5 rounded-2xl border",
                "text-[13.5px] font-medium text-left whitespace-nowrap min-h-[44px]",
                "transition-colors duration-150",
                // State variants
                isLocked
                  ? "border-dashed border-border/50 bg-card/60 text-muted-foreground hover:border-primary/20 cursor-pointer"
                  : "border-border/70 bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-secondary/40 hover:shadow disabled:opacity-50"
              )}
            >
              {/* Doc-type icon — muted color so it doesn't fight the text */}
              <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                {isLocked
                  ? <Lock className="w-3.5 h-3.5 text-muted-foreground/40" />
                  : <IconComponent className="w-[15px] h-[15px] text-muted-foreground/70" />
                }
              </span>
              <span className="truncate">{current.shortLabel}</span>
            </motion.button>
          </AnimatePresence>
        </div>

        {/* Manual "next" button */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next prompt suggestion"
          className={cn(
            "w-8 h-8 rounded-xl border border-border/60 bg-card shrink-0",
            "flex items-center justify-center",
            "text-muted-foreground/60 hover:text-foreground hover:border-border",
            "transition-all duration-150"
          )}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress dots — clickable, show all 9 positions */}
      <div className="flex items-center gap-[5px] mt-0.5" aria-hidden="true">
        {ALL_PROMPTS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleDotClick(i)}
            className={cn(
              "rounded-full transition-all duration-300 focus:outline-none",
              i === index
                ? "w-[14px] h-[4px] bg-foreground/25"
                : "w-[4px] h-[4px] bg-muted-foreground/15 hover:bg-muted-foreground/30"
            )}
          />
        ))}
      </div>

    </div>
  )
}
