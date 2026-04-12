import Link from "next/link"

export interface RelatedLinksProps {
  relatedPages: { href: string; label: string }[]
  relatedBlogSlugs: string[]
}

export function RelatedLinks({ relatedPages, relatedBlogSlugs }: RelatedLinksProps) {
  if (relatedPages.length === 0 && relatedBlogSlugs.length === 0) {
    return null
  }

  return (
    <section className="mt-16 space-y-10">
      {relatedPages.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Related Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                {page.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {relatedBlogSlugs.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Related Articles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedBlogSlugs.map((slug) => (
              <Link
                key={slug}
                href={`/blog/${slug}`}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors capitalize"
              >
                {slug.replace(/-/g, " ")}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
