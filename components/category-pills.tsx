'use client';

import { useState, useEffect, useRef, useMemo } from "react"
import {
  FileText, ScrollText, FileQuestion, Presentation,
  ClipboardList, Shield, GitMerge, ClipboardCheck,
  Bell, ChevronRight, Lock, Sparkles,
} from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useTier } from "@/hooks/use-tier"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { getDocumentTypeConfig, type DocumentType } from "@/lib/document-type-registry"

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

// ── Example prompts for each document type ───────────────────────────────────
// One prompt per doc type. Free tier sees only allowed types; paid tiers see all.
// Clicking fills the prompt input; the user reviews and presses Enter to send.

interface PillPrompt {
  type: DocumentType
  /** Short label shown in the pill (≤ 40 chars). */
  shortLabel: string
  /** Full prompt text injected into the input on click. */
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

// ── Auto-rotation timing ─────────────────────────────────────────────────────

/** How long each suggestion is shown before rotating (ms). */
const ROTATION_INTERVAL_MS = 4000

/** Cross-fade duration between suggestions (ms). */
const FADE_DURATION_MS = 300

interface CategoryPillsProps {
  /**
   * Called when the suggestion pill is clicked. Receives the FULL prompt text
   * so the parent can fill its prompt input. Parent should NOT auto-send;
   * the user reviews and presses Enter themselves.
   */
  onSelect?: (prompt: string) => void
}

/**
 * Auto-rotating prompt suggestion. Shows one example prompt at a time,
 * cycles every 4 seconds. Pauses while the user is hovering. Clicking the
 * pill fills the prompt input — the user then sends manually.
 *
 * Locked types (paid-tier only) are filtered out for free users so they
 * never see a suggestion they can't use.
 */
export function CategoryPills({ onSelect }: CategoryPillsProps) {
  const { requireAuth, isLoading } = useRequireAuth()
  const { allowedDocTypes, loading: tierLoading } = useTier()
  const router = useRouter()

  // Filter prompts down to the user's allowed types. While tier is loading,
  // we show the 4 always-allowed types so the surface never sits empty.
  const visiblePrompts = useMemo<PillPrompt[]>(() => {
    if (tierLoading) {
      return ALL_PROMPTS.filter((p) => ["invoice", "contract", "quote", "proposal"].includes(p.type))
    }
    const filtered = ALL_PROMPTS.filter((p) => allowedDocTypes.includes(p.type))
    // Defensive fallback — never render an empty rotator.
    return filtered.length > 0 ? filtered : ALL_PROMPTS.slice(0, 1)
  }, [allowedDocTypes, tierLoading])

  // Whether the user has the full set (used to surface a small "Upgrade for more" hint).
  const hasAllTypes = !tierLoading && allowedDocTypes.includes("sow")

  // ── Rotation state ─────────────────────────────────────────────────────────
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const pausedRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reset index if the visible list shrinks (e.g. tier downgrade).
  useEffect(() => {
    if (index >= visiblePrompts.length) setIndex(0)
  }, [visiblePrompts.length, index])

  useEffect(() => {
    if (visiblePrompts.length <= 1) return

    const tick = () => {
      if (pausedRef.current) return
      setFading(true)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % visiblePrompts.length)
        setFading(false)
      }, FADE_DURATION_MS)
    }

    intervalRef.current = setInterval(tick, ROTATION_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [visiblePrompts.length])

  // Pause rotation while user is hovering or has focused the pill.
  const handleMouseEnter = () => { pausedRef.current = true }
  const handleMouseLeave = () => { pausedRef.current = false }

  // Manually advance to the next suggestion (small "next" button).
  const handleNext = () => {
    setFading(true)
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % visiblePrompts.length)
      setFading(false)
    }, FADE_DURATION_MS)
  }

  const handleSelect = (prompt: string) => {
    const authWrapped = requireAuth(() => {
      onSelect?.(prompt)
    })
    authWrapped()
  }

  if (visiblePrompts.length === 0) return null

  const current = visiblePrompts[index]
  const config = getDocumentTypeConfig(current.type)
  const IconComponent = config ? (ICON_MAP[config.icon] ?? FileText) : FileText
  const isLocked = !hasAllTypes && !allowedDocTypes.includes(current.type)

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Try-prompt label */}
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" />
        Try a prompt
      </p>

      {/* Single auto-rotating suggestion */}
      <div
        className="relative flex items-center justify-center w-full max-w-md"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={handleMouseEnter}
        onBlurCapture={handleMouseLeave}
      >
        <button
          type="button"
          onClick={() => {
            if (isLocked) {
              router.push("/billing")
              return
            }
            handleSelect(current.fullPrompt)
          }}
          disabled={isLoading}
          title={isLocked ? `${config?.label} requires a paid plan` : current.fullPrompt}
          aria-label={isLocked ? `${config?.label} (locked) — upgrade to use` : `Use prompt: ${current.fullPrompt}`}
          aria-live="polite"
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-full border text-[14px] font-medium transition-all duration-300 btn-press max-w-full",
            "min-h-[44px]",
            fading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0",
            isLocked
              ? "border-dashed border-border/60 bg-card text-muted-foreground hover:border-primary/30"
              : "border-border/80 bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-secondary/60 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-sm"
          )}
        >
          {isLocked ? (
            <Lock className="w-[15px] h-[15px] opacity-60 shrink-0" />
          ) : (
            <IconComponent className="w-[16px] h-[16px] shrink-0 text-primary" />
          )}
          <span className="truncate">{current.shortLabel}</span>
        </button>

        {/* Manual "next" button — also resets the rotation timer. */}
        {visiblePrompts.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Show next example prompt"
            className="ml-2 w-9 h-9 rounded-full border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary/60 transition-all flex items-center justify-center shrink-0"
            title="Next example"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Subtle progress dots — visual hint that suggestions rotate. */}
      {visiblePrompts.length > 1 && (
        <div className="flex items-center gap-1 mt-1" aria-hidden="true">
          {visiblePrompts.map((_, i) => (
            <span
              key={i}
              className={cn(
                "w-1 h-1 rounded-full transition-all duration-300",
                i === index ? "bg-primary w-2" : "bg-muted-foreground/20"
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
