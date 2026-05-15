'use client';

import { useState } from "react"
import {
  FileText, ScrollText, FileQuestion, Presentation,
  ClipboardList, Shield, GitMerge, ClipboardCheck,
  Bell, RefreshCw, ChevronDown, ChevronUp, Lock,
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
  RefreshCw,
}

// ── Primary pills (top 6 shown by default) ───────────────────────────────────

const PRIMARY_TYPES: DocumentType[] = [
  "invoice",
  "contract",
  "quote",
  "proposal",
  "sow",
  "nda",
]

// ── Extended pills (shown when "All types" is toggled on) ─────────────────────

const EXTENDED_TYPES: DocumentType[] = [
  "change_order",
  "client_onboarding_form",
  "payment_followup",
  "recurring_invoice",
]

interface CategoryPillsProps {
  onSelect?: (category: string) => void
  selectedCategory?: string
}

export function CategoryPills({ onSelect, selectedCategory }: CategoryPillsProps) {
  const { requireAuth, isLoading } = useRequireAuth()
  const { allowedDocTypes, loading: tierLoading } = useTier()
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)

  const hasAllTypes = !tierLoading && allowedDocTypes.includes("sow")

  const handleSelect = (category: string) => {
    const authWrapped = requireAuth(() => {
      onSelect?.(category)
    })
    authWrapped()
  }

  const renderPill = (type: DocumentType) => {
    const config = getDocumentTypeConfig(type)
    if (!config) return null

    const IconComponent = ICON_MAP[config.icon] ?? FileText
    // Capitalize for display and for passing to the parent (matches existing selectedCategory pattern)
    const label = config.label
    const isSelected = selectedCategory === label
    const isLocked = !hasAllTypes && !allowedDocTypes.includes(type)

    return (
      <button
        key={type}
        type="button"
        onClick={() => {
          if (isLocked) {
            router.push("/billing")
            return
          }
          handleSelect(label)
        }}
        disabled={isLoading}
        title={isLocked ? `${label} requires a paid plan` : config.description}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full border text-[14px] font-medium transition-all duration-300 btn-press relative",
          isSelected
            ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
            : isLocked
              ? "border-dashed border-border/60 bg-card text-muted-foreground opacity-70 hover:opacity-90 hover:border-primary/30"
              : "border-border/80 bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-secondary/60 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
        )}
      >
        {isLocked ? (
          <Lock className="w-[15px] h-[15px] opacity-60 shrink-0" />
        ) : (
          <IconComponent
            className={cn(
              "w-[16px] h-[16px] shrink-0",
              isSelected ? "text-primary-foreground" : "text-primary"
            )}
          />
        )}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {/* Primary pills */}
      {PRIMARY_TYPES.map(renderPill)}

      {/* Extended pills — revealed when showAll is true */}
      {showAll && EXTENDED_TYPES.map(renderPill)}

      {/* All types toggle */}
      <button
        type="button"
        onClick={() => setShowAll(v => !v)}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2.5 rounded-full border text-[14px] font-medium transition-all duration-300 btn-press",
          showAll
            ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-dashed border-border/70 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-secondary/40"
        )}
        aria-expanded={showAll}
        aria-label={showAll ? "Show fewer document types" : "Show all document types"}
      >
        {showAll ? (
          <>
            <ChevronUp className="w-[14px] h-[14px]" />
            <span>Less</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-[14px] h-[14px]" />
            <span>All types</span>
          </>
        )}
      </button>
    </div>
  )
}
