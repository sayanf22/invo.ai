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

// A restrained two-tone badge system (brand green + amber) instead of a
// rainbow of unrelated colors per category — keeps the page calm and on-brand.
const CATEGORY_BADGE: Record<string, string> = {
    guides: "bg-[var(--landing-green)]/8 text-[var(--landing-green)]",
    templates: "bg-[var(--landing-amber)]/12 text-[var(--landing-amber)]",
    country: "bg-[var(--landing-green)]/8 text-[var(--landing-green)]",
    tips: "bg-[var(--landing-amber)]/12 text-[var(--landing-amber)]",
    comparisons: "bg-stone-900/6 text-stone-700",
    news: "bg-[var(--landing-green)]/8 text-[var(--landing-green)]",
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
            <div className="bg-[var(--landing-cream)]">
                {/* Header — generous vertical space, single focused message */}
                <header className="px-4 sm:px-6">
                    <div className="max-w-5xl mx-auto py-16 sm:py-24 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-stone-200/70 shadow-sm mb-6">
                            <BookOpen className="w-4 h-4 text-[var(--landing-green)]" />
                            <span className="text-xs font-bold text-[var(--landing-green)] uppercase tracking-widest">Clorefy Blog</span>
                        </div>
                        <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight text-[var(--landing-text-dark)] leading-[1.05] mb-5">
                            Invoicing, contracts<br className="hidden sm:block" />
                            <span className="font-serif italic text-[var(--landing-amber)]"> & business docs</span>
                        </h1>
                        <p className="text-base sm:text-lg text-[var(--landing-text-muted)] max-w-xl mx-auto leading-relaxed">
                            Practical guides for freelancers, agencies, and SMBs — get paid faster, stay tax-compliant, and automate your document workflow.
                        </p>
                    </div>
                </header>

                <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
                    {/* Category filter */}
                    <Suspense fallback={null}>
                        <div className="mb-10 sm:mb-14 flex justify-center">
                            <BlogCategoryFilter
                                categories={categories}
                                activeCategory={category || null}
                            />
                        </div>
                    </Suspense>

                    {allPosts.length === 0 ? (
                        <div className="text-center py-24 text-[var(--landing-text-muted)] rounded-3xl border border-dashed border-stone-300 bg-white/50">
                            No articles in this category yet.
                        </div>
                    ) : (
                        <div className="space-y-12 sm:space-y-16">
                            {/* Featured post — full width, roomy, calm */}
                            {featuredPost && !category && (
                                <Link
                                    href={`/blog/${featuredPost.slug}`}
                                    className="group block p-8 sm:p-12 rounded-[2rem] border border-stone-200/70 bg-white card-depth hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-8 sm:gap-12">
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-3 mb-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${CATEGORY_BADGE[featuredPost.category] ?? "bg-stone-100 text-stone-600"}`}>
                                                    {CATEGORY_LABELS[featuredPost.category] ?? featuredPost.category}
                                                </span>
                                                <span className="text-xs text-[var(--landing-text-muted)] font-bold uppercase tracking-widest">Featured</span>
                                            </div>
                                            <h2 className="font-display text-2xl sm:text-[2rem] font-semibold text-[var(--landing-text-dark)] group-hover:text-[var(--landing-amber)] transition-colors leading-[1.2] mb-4">
                                                {featuredPost.title}
                                            </h2>
                                            <p className="text-[var(--landing-text-muted)] leading-relaxed mb-6 max-w-2xl">
                                                {featuredPost.description}
                                            </p>
                                            <div className="flex items-center gap-5 text-sm text-[var(--landing-text-muted)]">
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
                                        <div className="shrink-0 self-start sm:self-center">
                                            <span className="inline-flex items-center gap-2 px-5 py-3 bg-[var(--landing-dark)] text-white rounded-full text-sm font-bold group-hover:bg-[var(--landing-amber)] transition-colors">
                                                Read article <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            )}

                            {/* Grid of remaining posts — generous gap, breathing room */}
                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                                {(category ? allPosts : restPosts).map((post) => (
                                    <Link
                                        key={post.slug}
                                        href={`/blog/${post.slug}`}
                                        className="group flex flex-col p-6 sm:p-7 rounded-[1.75rem] border border-stone-200/70 bg-white hover:-translate-y-1 card-depth transition-all duration-300"
                                    >
                                        <span className={`inline-flex items-center self-start px-3 py-1 rounded-full text-xs font-bold mb-4 ${CATEGORY_BADGE[post.category] ?? "bg-stone-100 text-stone-600"}`}>
                                            {CATEGORY_LABELS[post.category] ?? post.category}
                                        </span>
                                        <h2 className="text-base font-bold text-[var(--landing-text-dark)] group-hover:text-[var(--landing-amber)] transition-colors leading-snug mb-2.5 flex-1">
                                            {post.title}
                                        </h2>
                                        <p className="text-sm text-[var(--landing-text-muted)] line-clamp-2 leading-relaxed mb-5">
                                            {post.description}
                                        </p>
                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-stone-100">
                                            <div className="flex items-center gap-3 text-xs text-[var(--landing-text-muted)]">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {post.readTime} min
                                                </span>
                                                <span>
                                                    {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                                </span>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-[var(--landing-amber)] group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </LandingLayout>
    )
}
