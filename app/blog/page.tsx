import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { getAllPosts, getAllCategories, getPostsByCategory } from "@/lib/blog-data"
import { BlogCategoryFilter } from "@/components/blog/category-filter"
import { ArrowRight, Clock } from "lucide-react"

export const metadata: Metadata = {
    title: "Blog — Clorefy",
    description: "Tips, guides, and templates for invoicing, contracts, proposals, and business document automation. Learn how to get paid faster and work smarter.",
    alternates: { canonical: "/blog" },
    openGraph: {
        title: "Clorefy Blog — Invoicing, Contracts & Business Document Guides",
        description: "Tips, guides, and templates for invoicing, contracts, proposals, and business document automation.",
        url: "https://clorefy.com/blog",
    },
}

const CATEGORY_LABELS: Record<string, string> = {
    guides: "Guides",
    templates: "Templates",
    country: "Country Guides",
    tips: "Tips & Best Practices",
    comparisons: "Comparisons",
}

interface BlogPageProps {
    searchParams: Promise<{ category?: string }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
    const { category } = await searchParams
    const categories = getAllCategories()
    const posts = category ? getPostsByCategory(category) : getAllPosts()

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="max-w-5xl mx-auto px-6 py-16">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        ← Back to Clorefy
                    </Link>
                    <h1 className="text-4xl font-bold tracking-tight mt-6">Blog</h1>
                    <p className="text-lg text-muted-foreground mt-3 max-w-2xl">
                        Guides, templates, and tips for creating professional invoices, contracts, proposals, and quotations. Learn how to get paid faster.
                    </p>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-12">
                <Suspense fallback={null}>
                    <div className="mb-8">
                        <BlogCategoryFilter categories={categories} activeCategory={category || null} />
                    </div>
                </Suspense>

                <div className="grid gap-8">
                    {posts.map((post) => (
                        <Link key={post.slug} href={`/blog/${post.slug}`}
                            className="group block border rounded-2xl p-6 hover:shadow-md transition-all bg-card">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
                                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                    {CATEGORY_LABELS[post.category] || post.category}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" /> {post.readTime} min read
                                </span>
                                <span>{new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                            <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                                {post.title}
                            </h2>
                            <p className="text-muted-foreground mt-2 line-clamp-2">{post.description}</p>
                            <span className="inline-flex items-center gap-1 text-sm text-primary mt-4 font-medium">
                                Read more <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </Link>
                    ))}

                    {posts.length === 0 && (
                        <p className="text-center text-muted-foreground py-12">
                            No posts found in this category.
                        </p>
                    )}
                </div>
            </main>
        </div>
    )
}
