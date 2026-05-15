"use client"

import { useState } from "react"
import {
  FileText, ScrollText, ClipboardList, Lightbulb, Loader2,
  ChevronDown, FilePlus, Lock, GitMerge, Shield, Bell,
  ClipboardCheck, ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { InvoiceData } from "@/lib/invoice-types"
import { useTier } from "@/hooks/use-tier"

// All 9 document types with icons and tier requirements
const ALL_DOC_OPTIONS: Array<{
  type: string
  label: string
  icon: React.ElementType
  requiredTier: "free" | "starter"
}> = [
  { type: "invoice",               label: "Invoice",              icon: FileText,      requiredTier: "free" },
  { type: "contract",              label: "Contract",             icon: ScrollText,    requiredTier: "free" },
  { type: "quote",                 label: "Quote",                icon: ClipboardList, requiredTier: "free" },
  { type: "proposal",              label: "Proposal",             icon: Lightbulb,     requiredTier: "starter" },
  { type: "sow",                   label: "SOW",                  icon: GitMerge,      requiredTier: "starter" },
  { type: "nda",                   label: "NDA",                  icon: Shield,        requiredTier: "starter" },
  { type: "change_order",          label: "Change Order",         icon: ClipboardCheck,requiredTier: "starter" },
  { type: "client_onboarding_form",label: "Onboarding Form",      icon: ClipboardCheck,requiredTier: "starter" },
  { type: "payment_followup",      label: "Payment Reminder",     icon: Bell,          requiredTier: "starter" },
]

// Show first 3 by default; expand to show remaining 6
const DEFAULT_VISIBLE_COUNT = 3

interface NextStepsBarProps {
  clientName: string | null
  currentDocType: string
  parentSessionId: string
  onCreateLinked: (parentSessionId: string, targetType: string) => Promise<void>
  /** Slot for the Select Client button — rendered inline in the toolbar row */
  clientSelectorSlot?: React.ReactNode
  /** Invoice data — kept for API compatibility */
  invoiceData?: InvoiceData
  onPaymentLinkChange?: (shortUrl: string, status: string) => void
}

export function NextStepsBar({
  clientName,
  currentDocType,
  parentSessionId,
  onCreateLinked,
  clientSelectorSlot,
}: NextStepsBarProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loadingType, setLoadingType] = useState<string | null>(null)
  const { allowedDocTypes } = useTier()

  const currentType = currentDocType.toLowerCase()
  const visibleDocs = expanded ? ALL_DOC_OPTIONS : ALL_DOC_OPTIONS.slice(0, DEFAULT_VISIBLE_COUNT)
  const hasMore = ALL_DOC_OPTIONS.length > DEFAULT_VISIBLE_COUNT

  const handleClick = async (targetType: string, isLocked: boolean) => {
    if (loadingType || isLocked) return
    setLoadingType(targetType)
    try {
      await onCreateLinked(parentSessionId, targetType)
      setOpen(false)
      setExpanded(false)
    } finally {
      setLoadingType(null)
    }
  }

  const pillBase = cn(
    "inline-flex items-center gap-1.5",
    "h-9 px-3.5 rounded-xl",
    "text-[13px] font-medium text-foreground",
    "bg-card border border-border",
    "transition-all duration-150",
    "hover:bg-secondary/60 hover:border-border/80",
    "active:scale-[0.96] active:bg-secondary/80",
    "touch-manipulation select-none"
  )

  const pillShadow = "0 1px 2px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.10)"

  return (
    <div>
      {/* ── Toolbar row ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); if (!open) setExpanded(false) }}
          className={cn(pillBase, open && "bg-secondary/60 border-border/80")}
          style={{ boxShadow: pillShadow }}
          aria-expanded={open}
          aria-label="Create new document"
        >
          <FilePlus className="w-3.5 h-3.5 text-foreground/60 shrink-0" />
          <span>New Doc</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 text-foreground/40 shrink-0 transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]",
              open && "rotate-180"
            )}
          />
        </button>

        {clientSelectorSlot}
      </div>

      {/* ── Expandable doc-type panel ── */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-2">
            <div
              className="rounded-xl border border-border bg-card overflow-hidden"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.10)" }}
            >
              {/* Panel header */}
              <div className="px-3.5 py-2.5 border-b border-border/60 bg-secondary/20">
                <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider leading-none">
                  {clientName
                    ? <>Create for <span className="text-foreground/70 normal-case font-semibold">{clientName}</span></>
                    : "Create related document"
                  }
                </p>
              </div>

              {/* Document type grid — 2 columns, smooth expand/collapse */}
              <div className="grid grid-cols-2 gap-px bg-border/40">
                {visibleDocs.map(opt => {
                  const { type, label, icon: Icon } = opt
                  const isLoading = loadingType === type
                  const isCurrent = type === currentType
                  const isLocked = !allowedDocTypes.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleClick(type, isLocked)}
                      disabled={!!loadingType || isLocked}
                      title={isLocked ? "Upgrade to Starter to unlock" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 px-4 min-h-[44px]",
                        "text-[13px] font-medium",
                        "bg-card transition-colors duration-100",
                        isLocked
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-foreground hover:bg-secondary/50 active:bg-secondary/80",
                        "disabled:cursor-not-allowed",
                        "touch-manipulation select-none",
                        isCurrent && !isLocked && "bg-primary/5"
                      )}
                    >
                      {isLoading
                        ? <Loader2 className="w-4 h-4 animate-spin text-foreground/40 shrink-0" />
                        : isLocked
                          ? <Lock className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                          : <Icon className="w-4 h-4 text-foreground/50 shrink-0" />
                      }
                      <span className="flex-1 text-left">{label}</span>
                      {isCurrent && !isLocked && (
                        <span className="text-[10px] font-semibold text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-md shrink-0 leading-none">
                          current
                        </span>
                      )}
                      {isLocked && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                          Starter
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Expand / collapse button — smooth animation */}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setExpanded(v => !v)}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 py-2.5",
                    "text-[11px] font-semibold text-muted-foreground",
                    "bg-secondary/10 hover:bg-secondary/30 transition-colors duration-150",
                    "border-t border-border/40"
                  )}
                >
                  {expanded ? (
                    <><ChevronUp className="w-3 h-3" /> Show less</>
                  ) : (
                    <><ChevronDown className="w-3 h-3" /> {ALL_DOC_OPTIONS.length - DEFAULT_VISIBLE_COUNT} more types</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
