'use client';

import { FileText, ScrollText, ClipboardList, Lightbulb } from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"

const categories = [
  { label: "Invoice", icon: FileText },
  { label: "Contract", icon: ScrollText },
  { label: "Quotation", icon: ClipboardList },
  { label: "Proposal", icon: Lightbulb },
]

interface CategoryPillsProps {
  onSelect?: (category: string) => void
  selectedCategory?: string
}

export function CategoryPills({ onSelect, selectedCategory }: CategoryPillsProps) {
  const { requireAuth, isLoading } = useRequireAuth()

  // Wrap onSelect with auth requirement
  const handleSelect = (category: string) => {
    const authWrapped = requireAuth(() => {
      onSelect?.(category)
    })
    authWrapped()
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat.label
        return (
          <button
            key={cat.label}
            type="button"
            onClick={() => handleSelect(cat.label)}
            disabled={isLoading}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-full border text-[15px] font-medium transition-all duration-200 disabled:opacity-50 btn-press ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary hover:shadow-sm"
            }`}
          >
            <cat.icon className={`w-[18px] h-[18px] ${isSelected ? "text-primary-foreground" : "text-primary"}`} />
            <span>{cat.label}</span>
          </button>
        )
      })}
    </div>
  )
}
