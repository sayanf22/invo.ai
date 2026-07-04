"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"

const CATEGORY_LABELS: Record<string, string> = {
  guides: "Guides",
  templates: "Templates",
  country: "Country Guides",
  tips: "Tips & Best Practices",
  comparisons: "Comparisons",
  news: "News",
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
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
          !activeCategory
            ? "bg-[var(--landing-dark)] text-white shadow-sm"
            : "border border-stone-200/80 bg-white text-[var(--landing-text-muted)] hover:border-[var(--landing-amber)]/40 hover:text-[var(--landing-text-dark)]"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => handleSelect(cat)}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
            activeCategory === cat
              ? "bg-[var(--landing-dark)] text-white shadow-sm"
              : "border border-stone-200/80 bg-white text-[var(--landing-text-muted)] hover:border-[var(--landing-amber)]/40 hover:text-[var(--landing-text-dark)]"
          }`}
        >
          {CATEGORY_LABELS[cat] || cat}
        </button>
      ))}
    </div>
  )
}
