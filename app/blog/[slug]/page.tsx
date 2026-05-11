import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getCombinedPostBySlug, getCombinedRelatedPosts, getCombinedPostsByHub, getAllCombinedSlugs } from "@/lib/blog-combined"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { ArrowLeft, Clock, ArrowRight, Calendar, Tag } from "lucide-react"
import { generateArticleSchema } from "@/lib/structured-data"
import { ReadingProgress } from "@/components/blog/reading-progress"
import { LandingLayout } from "@/components/landing/landing-layout"

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
    const slugs = await getAllCombinedSlugs()
    return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const post = await getCombinedPostBySlug(slug)
    if (!post) return { title: "Not Found" }

    const title = post.metaTitle ?? post.title
    const description = post.metaDescription ?? post.description

    return {
        title,
        description,
        keywords: [post.keyword, "Clorefy", "AI document generator", "invoice generator"],
        alternates: { canonical: `/blog/${post.slug}` },
        openGraph: {
            title: post.title,
            description,
            url: `https://clorefy.com/blog/${post.slug}`,
            type: "article",
            publishedTime: post.publishedAt,
            modifiedTime: post.updatedAt,
            authors: ["Clorefy"],
            siteName: "Clorefy",
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description,
        },
    }
}

const CATEGORY_LABELS: Record<string, string> = {
    guides: "Guide",
    templates: "Template",
    country: "Country Guide",
    tips: "Tips",
    comparisons: "Comparison",
    news: "News",
}

const CATEGORY_COLORS: Record<string, string> = {
    guides: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    templates: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    country: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    tips: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    comparisons: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    news: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = await getCombinedPostBySlug(slug)
    if (!post) notFound()

    let related = await getCombinedRelatedPosts(slug)
    if (post.hub) {
        const hubPosts = (await getCombinedPostsByHub(post.hub)).filter((p) => p.slug !== slug)
        const hubSlugs = new Set(hubPosts.map((p) => p.slug))
        const nonHubRelated = related.filter((p) => !hubSlugs.has(p.slug))
        related = [...hubPosts.slice(0, 3), ...nonHubRelated].slice(0, 4)
    }

    const jsonLd = generateArticleSchema({
        headline: post.title,
        description: post.description,
        url: `https://clorefy.com/blog/${post.slug}`,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
    })

    const categoryLabel = CATEGORY_LABELS[post.category] ?? post.category
    const categoryColor = CATEGORY_COLORS[post.category] ?? "bg-muted text-muted-foreground"

    return (
        <LandingLayout>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <div className="bg-[#FAFAF9]">
                {/* Top progress bar — visual reading indicator */}
                <div className="fixed top-0 left-0 right-0 h-0.5 bg-stone-200 z-50">
                    <div
                        id="reading-progress"
                        className="h-full bg-[var(--landing-amber,#C67A3C)] transition-all duration-100"
                        style={{ width: "0%" }}
                    />
                </div>

                {/* Reading progress bar — client component handles scroll */}
                <ReadingProgress />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="flex gap-12 items-start">

                        {/* ── Main content column ── */}
                        <article className="flex-1 min-w-0 max-w-3xl">

                            {/* Breadcrumbs */}
                            <div className="mb-8">
                                <Breadcrumbs
                                    items={[
                                        { label: "Home", href: "/" },
                                        { label: "Blog", href: "/blog" },
                                        { label: post.title },
                                    ]}
                                />
                            </div>

                            {/* Article header */}
                            <header className="mb-10">
                                {/* Category + meta row */}
                                <div className="flex flex-wrap items-center gap-3 mb-5">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${categoryColor}`}>
                                        <Tag className="w-3 h-3" />
                                        {categoryLabel}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-sm text-stone-500">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <time dateTime={post.publishedAt}>
                                            {new Date(post.publishedAt).toLocaleDateString("en-US", {
                                                month: "long", day: "numeric", year: "numeric"
                                            })}
                                        </time>
                                    </span>
                                    <span className="flex items-center gap-1.5 text-sm text-stone-500">
                                        <Clock className="w-3.5 h-3.5" />
                                        {post.readTime} min read
                                    </span>
                                </div>

                                {/* Title */}
                                <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-bold tracking-tight leading-[1.15] text-[#1C1A17] mb-5">
                                    {post.title}
                                </h1>

                                {/* Description / deck */}
                                <p className="text-lg sm:text-xl text-stone-600 leading-relaxed border-l-4 border-[var(--landing-amber,#C67A3C)] pl-4">
                                    {post.description}
                                </p>
                            </header>

                            {/* Divider */}
                            <div className="border-t border-stone-200 mb-10" />

                            {/* Article body */}
                            <div
                                className="
                                    prose prose-stone max-w-none
                                    prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-[#1C1A17]
                                    prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-stone-100
                                    prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                                    prose-p:text-[17px] prose-p:leading-[1.85] prose-p:text-stone-700
                                    prose-li:text-[17px] prose-li:leading-[1.75] prose-li:text-stone-700
                                    prose-strong:text-[#1C1A17] prose-strong:font-semibold
                                    prose-a:text-[#C67A3C] prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                                    prose-blockquote:border-l-4 prose-blockquote:border-[#C67A3C] prose-blockquote:bg-amber-50 prose-blockquote:rounded-r-lg prose-blockquote:py-1
                                    prose-code:bg-stone-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                                    prose-pre:bg-[#1C1A17] prose-pre:rounded-xl
                                    prose-img:rounded-xl prose-img:shadow-md
                                    prose-ol:space-y-1 prose-ul:space-y-1
                                "
                                dangerouslySetInnerHTML={{ __html: post.content ?? "" }}
                            />

                            {/* Related Tool Pages */}
                            {post.relatedToolPages && post.relatedToolPages.length > 0 && (
                                <div className="mt-14 p-6 rounded-2xl border border-amber-200 bg-amber-50">
                                    <h3 className="text-base font-bold text-[#1C1A17] mb-4 flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[#C67A3C] flex items-center justify-center text-white text-xs">→</span>
                                        Try These Free Tools
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {post.relatedToolPages.map((toolPath) => {
                                            const label = toolPath
                                                .replace("/tools/", "")
                                                .split("/")
                                                .map((s) => s.replace(/-/g, " "))
                                                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                                                .join(" — ")
                                            return (
                                                <Link
                                                    key={toolPath}
                                                    href={toolPath}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-amber-200 text-sm font-medium text-[#C67A3C] hover:bg-amber-100 transition-colors shadow-sm"
                                                >
                                                    {label}
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* CTA box */}
                            <div className="mt-12 p-8 rounded-2xl bg-[#1C1A17] text-white">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-[#C67A3C] flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-white font-bold text-lg">C</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold mb-1">Generate this document in 30 seconds</h3>
                                        <p className="text-stone-400 text-sm leading-relaxed mb-4">
                                            Clorefy uses AI to create professional invoices, contracts, and proposals from a single sentence. GST, VAT, and sales tax handled automatically for 11 countries.
                                        </p>
                                        <Link
                                            href="/auth/signup"
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C67A3C] text-white rounded-xl text-sm font-semibold hover:bg-[#b56a2c] transition-colors"
                                        >
                                            Try Clorefy Free — No credit card
                                            <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Related Posts */}
                            {related.length > 0 && (
                                <div className="mt-16">
                                    <h2 className="text-xl font-bold text-[#1C1A17] mb-6">Keep Reading</h2>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {related.map((r) => (
                                            <Link
                                                key={r.slug}
                                                href={`/blog/${r.slug}`}
                                                className="group block p-5 border border-stone-200 rounded-2xl hover:border-[#C67A3C] hover:shadow-md transition-all bg-white"
                                            >
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mb-3 ${CATEGORY_COLORS[r.category] ?? "bg-muted text-muted-foreground"}`}>
                                                    {CATEGORY_LABELS[r.category] ?? r.category}
                                                </span>
                                                <h3 className="font-semibold text-[#1C1A17] group-hover:text-[#C67A3C] transition-colors leading-snug mb-2">
                                                    {r.title}
                                                </h3>
                                                <p className="text-sm text-stone-500 line-clamp-2">{r.description}</p>
                                                <span className="inline-flex items-center gap-1 text-xs text-[#C67A3C] font-medium mt-3">
                                                    Read article <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Back to blog */}
                            <div className="mt-12 pt-8 border-t border-stone-200">
                                <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-[#1C1A17] transition-colors font-medium">
                                    <ArrowLeft className="w-4 h-4" /> All articles
                                </Link>
                            </div>
                        </article>

                        {/* ── Sticky sidebar (desktop only) ── */}
                        <aside className="hidden xl:block w-72 shrink-0 sticky top-8">
                            {/* Author / brand card */}
                            <div className="p-5 rounded-2xl border border-stone-200 bg-white mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-[#1C1A17] flex items-center justify-center text-white font-bold">C</div>
                                    <div>
                                        <p className="text-sm font-semibold text-[#1C1A17]">Clorefy Team</p>
                                        <p className="text-xs text-stone-500">AI Document Experts</p>
                                    </div>
                                </div>
                                <p className="text-xs text-stone-500 leading-relaxed">
                                    We build AI tools that generate invoices, contracts, and proposals for 11 countries. This article is written by our team of document automation experts.
                                </p>
                            </div>

                            {/* Quick CTA */}
                            <div className="p-5 rounded-2xl bg-[#1C1A17] text-white mb-6">
                                <p className="text-sm font-semibold mb-2">Generate documents with AI</p>
                                <p className="text-xs text-stone-400 mb-4 leading-relaxed">
                                    Create professional invoices, contracts & proposals in 30 seconds. Free plan available.
                                </p>
                                <Link
                                    href="/auth/signup"
                                    className="block text-center px-4 py-2.5 bg-[#C67A3C] text-white rounded-xl text-sm font-semibold hover:bg-[#b56a2c] transition-colors"
                                >
                                    Start Free →
                                </Link>
                            </div>

                            {/* Related posts in sidebar */}
                            {related.length > 0 && (
                                <div className="p-5 rounded-2xl border border-stone-200 bg-white">
                                    <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-4">Related Articles</p>
                                    <div className="space-y-4">
                                        {related.slice(0, 3).map((r) => (
                                            <Link key={r.slug} href={`/blog/${r.slug}`} className="group block">
                                                <p className="text-sm font-medium text-[#1C1A17] group-hover:text-[#C67A3C] transition-colors leading-snug">
                                                    {r.title}
                                                </p>
                                                <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {r.readTime} min
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </aside>

                    </div>
                </div>
            </div>
        </LandingLayout>
    )
}
