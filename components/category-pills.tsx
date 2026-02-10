'use client';

import { FileText, ScrollText, ShieldCheck, Handshake } from "lucide-react"
import { useRequireAuth } from "@/hooks/use-require-auth"

const categories = [
  { label: "Invoice", icon: FileText },
  { label: "Contract", icon: ScrollText },
  { label: "NDA", icon: ShieldCheck },
  { label: "Agreement", icon: Handshake },
]

interface CategoryPillsProps {
  onSelect?: (category: string) => void
}

export function CategoryPills({ onSelect }: CategoryPillsProps) {
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
      {categories.map((cat) => (
        <button
          key={cat.label}
          type="button"
          onClick={() => handleSelect(cat.label)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:border-primary/40 hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <cat.icon className="w-4 h-4 text-primary" />
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  )
}
