"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const CATEGORY_LABELS: Record<string, string> = {
  guides: "Guides",
  templates: "Templates",
  country: "Country Guides",
  tips: "Tips & Best Practices",
  comparisons: "Comparisons",
}

interface BlogCategoryFilterProps {
  categories: string[]
  activeCategory: string | null
}

export function BlogCategoryFilter({ categories, activeCategory }: BlogCategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSelect = useCallback(
    (category: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (category) {
        params.set("category", category)
      } else {
        params.delete("category")
      }
      const qs = params.toString()
      router.push(qs ? `/blog?${qs}` : "/blog", { scroll: false })
    },
    [router, searchParams]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
          !activeCategory
            ? "bg-primary text-primary-foreground shadow-sm"
            : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => handleSelect(cat)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            activeCategory === cat
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {CATEGORY_LABELS[cat] || cat}
        </button>
      ))}
    </div>
  )
}
