'use client';

import { FileText, ScrollText, ClipboardList, Lightbulb, Lock } from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"
import { useTier } from "@/hooks/use-tier"
import { cn } from "@/lib/utils"

const categories = [
  { label: "Invoice",   icon: FileText,      type: "invoice"   },
  { label: "Contract",  icon: ScrollText,    type: "contract"  },
  { label: "Quotation", icon: ClipboardList, type: "quotation" },
  { label: "Proposal",  icon: Lightbulb,     type: "proposal"  },
]

interface CategoryPillsProps {
  onSelect?: (category: string) => void
  selectedCategory?: string
}

export function CategoryPills({ onSelect, selectedCategory }: CategoryPillsProps) {
  const { requireAuth, isLoading } = useRequireAuth()
  const { allowedDocTypes, loading: tierLoading } = useTier()

  const handleSelect = (category: string, isLocked: boolean) => {
    if (isLocked) return
    const authWrapped = requireAuth(() => {
      onSelect?.(category)
    })
    authWrapped()
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.label
        const isLocked = !tierLoading && !allowedDocTypes.includes(cat.type)
        return (
          <button
            key={cat.label}
            type="button"
            onClick={() => handleSelect(cat.label, isLocked)}
            disabled={isLoading || isLocked}
            title={isLocked ? "Upgrade to Starter to unlock" : undefined}
            className={cn(
              "flex items-center gap-2.5 px-5 py-3 rounded-full border text-[15px] font-medium transition-all duration-200 btn-press",
              isLocked
                ? "border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed opacity-60"
                : isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary hover:shadow-sm disabled:opacity-50"
            )}
          >
            {isLocked
              ? <Lock className="w-[16px] h-[16px] text-muted-foreground/60" />
              : <cat.icon className={cn("w-[18px] h-[18px]", isSelected ? "text-primary-foreground" : "text-primary")} />
            }
            <span>{cat.label}</span>
            {isLocked && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ml-0.5">
                Pro
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
