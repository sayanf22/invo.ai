import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { getAllCombinedPosts, getAllCombinedCategories, getCombinedPostsByCategory } from "@/lib/blog-combined"
import { BlogCategoryFilter } from "@/components/blog/category-filter"
import { ArrowRight, Clock, Calendar, BookOpen } from "lucide-react"
import { LandingLayout } from "@/components/landing/landing-layout"

export const metadata: Metadata = {
    title: "Blog — Invoicing, Contracts & Business Document Guides | Clorefy",
    description: "Practical guides on invoicing, contracts, proposals, and business document automation. Learn GST compliance, how to chase unpaid invoices, contract templates, and more.",
    alternates: { canonical: "/blog" },
    openGraph: {
        title: "Clorefy Blog — Invoicing, Contracts & Business Document Guides",
        description: "Practical guides on invoicing, contracts, proposals, and business document automation.",
        url: "https://clorefy.com/blog",
    },
}

export const revalidate = 600

const CATEGORY_LABELS: Record<string, string> = {
    guides: "Guides",
    templates: "Templates",
    country: "Country Guides",
    tips: "Tips",
    comparisons: "Comparisons",
    news: "News",
}

const CATEGORY_COLORS: Record<string, string> = {
    guides: "bg-blue-100 text-blue-700",
    templates: "bg-purple-100 text-purple-700",
    country: "bg-green-100 text-green-700",
    tips: "bg-amber-100 text-amber-700",
    comparisons: "bg-rose-100 text-rose-700",
    news: "bg-sky-100 text-sky-700",
}

interface BlogPageProps {
    searchParams: Promise<{ category?: string }>
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
    const { category } = await searchParams
    const categories = await getAllCombinedCategories()
    const allPosts = category
        ? await getCombinedPostsByCategory(category)
        : await getAllCombinedPosts()

    const featuredPost = allPosts[0]
    const restPosts = allPosts.slice(1)

    return (
        <LandingLayout>
            <div className="bg-[#FAFAF9]">
                {/* Header */}
                <header className="border-b border-stone-200 bg-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
                    <div className="flex items-start justify-between gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <BookOpen className="w-5 h-5 text-[#C67A3C]" />
                                <span className="text-sm font-semibold text-[#C67A3C] uppercase tracking-wider">Clorefy Blog</span>
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1C1A17] leading-tight">
                                Invoicing, Contracts<br />& Business Docs
                            </h1>
                            <p className="text-lg text-stone-500 mt-4 max-w-xl leading-relaxed">
                                Practical guides for freelancers, agencies, and SMBs. Learn how to get paid faster, stay tax-compliant, and automate your document workflow.
                            </p>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
                            <div className="text-3xl font-bold text-[#1C1A17]">{allPosts.length}</div>
                            <div className="text-sm text-stone-500">articles published</div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                {/* Category filter */}
                <Suspense fallback={null}>
                    <div className="mb-10">
                        <BlogCategoryFilter
                            categories={categories}
                            activeCategory={category || null}
                        />
                    </div>
                </Suspense>

                {allPosts.length === 0 ? (
                    <div className="text-center py-20 text-stone-400">
                        No articles in this category yet.
                    </div>
                ) : (
                    <>
                        {/* Featured post (first one, full width) */}
                        {featuredPost && !category && (
                            <Link
                                href={`/blog/${featuredPost.slug}`}
                                className="group block mb-10 p-8 rounded-2xl border border-stone-200 bg-white hover:border-[#C67A3C] hover:shadow-lg transition-all"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-3 mb-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[featuredPost.category] ?? "bg-muted text-muted-foreground"}`}>
                                                {CATEGORY_LABELS[featuredPost.category] ?? featuredPost.category}
                                            </span>
                                            <span className="text-xs text-stone-400 font-medium uppercase tracking-wider">Featured</span>
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1A17] group-hover:text-[#C67A3C] transition-colors leading-tight mb-3">
                                            {featuredPost.title}
                                        </h2>
                                        <p className="text-stone-600 leading-relaxed mb-5 max-w-2xl">
                                            {featuredPost.description}
                                        </p>
                                        <div className="flex items-center gap-4 text-sm text-stone-400">
                                            <span className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(featuredPost.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {featuredPost.readTime} min read
                                            </span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 self-center">
                                        <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C1A17] text-white rounded-xl text-sm font-semibold group-hover:bg-[#C67A3C] transition-colors">
                                            Read article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Grid of remaining posts */}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(category ? allPosts : restPosts).map((post) => (
                                <Link
                                    key={post.slug}
                                    href={`/blog/${post.slug}`}
                                    className="group flex flex-col p-6 border border-stone-200 rounded-2xl bg-white hover:border-[#C67A3C] hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[post.category] ?? "bg-muted text-muted-foreground"}`}>
                                            {CATEGORY_LABELS[post.category] ?? post.category}
                                        </span>
                                    </div>
                                    <h2 className="text-base font-bold text-[#1C1A17] group-hover:text-[#C67A3C] transition-colors leading-snug mb-2 flex-1">
                                        {post.title}
                                    </h2>
                                    <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed mb-4">
                                        {post.description}
                                    </p>
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-stone-100">
                                        <div className="flex items-center gap-3 text-xs text-stone-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {post.readTime} min
                                            </span>
                                            <span>
                                                {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                            </span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-[#C67A3C] group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </main>
            </div>
        </LandingLayout>
    )
}
