'use client';

import { FileText, ScrollText, Sparkles } from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useTier } from "@/hooks/use-tier"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

const FREE_CATEGORIES = [
  { label: "Invoice",   icon: FileText,   type: "invoice"  },
  { label: "Contract",  icon: ScrollText, type: "contract" },
]

interface CategoryPillsProps {
  onSelect?: (category: string) => void
  selectedCategory?: string
}

export function CategoryPills({ onSelect, selectedCategory }: CategoryPillsProps) {
  const { requireAuth, isLoading } = useRequireAuth()
  const { allowedDocTypes, loading: tierLoading } = useTier()
  const router = useRouter()

  // Check if user has access to premium doc types (quotation/proposal)
  const hasPremium = !tierLoading && allowedDocTypes.includes("quotation")

  const handleSelect = (category: string) => {
    const authWrapped = requireAuth(() => {
      onSelect?.(category)
    })
    authWrapped()
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {FREE_CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat.label
        return (
          <button
            key={cat.label}
            type="button"
            onClick={() => handleSelect(cat.label)}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2.5 px-5 py-3 rounded-full border text-[15px] font-medium transition-all duration-200 btn-press",
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary hover:shadow-sm disabled:opacity-50"
            )}
          >
            <cat.icon className={cn("w-[18px] h-[18px]", isSelected ? "text-primary-foreground" : "text-primary")} />
            <span>{cat.label}</span>
          </button>
        )
      })}

      {/* Show premium doc types if user has access */}
      {hasPremium && (
        <>
          {[
            { label: "Quotation", icon: FileText, type: "quotation" },
            { label: "Proposal",  icon: FileText, type: "proposal"  },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.label
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => handleSelect(cat.label)}
                disabled={isLoading}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-3 rounded-full border text-[15px] font-medium transition-all duration-200 btn-press",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary hover:shadow-sm disabled:opacity-50"
                )}
              >
                <cat.icon className={cn("w-[18px] h-[18px]", isSelected ? "text-primary-foreground" : "text-primary")} />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </>
      )}

      {/* Upgrade CTA for free users */}
      {!hasPremium && !tierLoading && (
        <button
          type="button"
          onClick={() => router.push("/billing")}
          className="flex items-center gap-2 px-5 py-3 rounded-full text-[14px] font-medium text-muted-foreground border border-border/50 bg-secondary/30 hover:bg-secondary/80 hover:text-foreground transition-all duration-200"
        >
          <span>Upgrade to use more documents</span>
        </button>
      )}
    </div>
  )
}
