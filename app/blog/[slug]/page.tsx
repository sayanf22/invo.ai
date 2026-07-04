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

// A restrained two-tone badge system (brand green + amber) — matches the
// listing page instead of a rainbow of unrelated colors per category.
const CATEGORY_BADGE: Record<string, string> = {
    guides: "bg-[var(--landing-green)]/8 text-[var(--landing-green)]",
    templates: "bg-[var(--landing-amber)]/12 text-[var(--landing-amber)]",
    country: "bg-[var(--landing-green)]/8 text-[var(--landing-green)]",
    tips: "bg-[var(--landing-amber)]/12 text-[var(--landing-amber)]",
    comparisons: "bg-stone-900/6 text-stone-700",
    news: "bg-[var(--landing-green)]/8 text-[var(--landing-green)]",
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
    const categoryBadge = CATEGORY_BADGE[post.category] ?? "bg-stone-100 text-stone-600"

    return (
        <LandingLayout>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <div className="bg-[var(--landing-cream)]">
                {/* Reading progress bar — the navbar floats with a top-6 margin, leaving an
                    empty strip at the very top of the viewport, so a bar at top-0 with a
                    lower z-index sits in that gap rather than overlapping the nav. */}
                <div className="fixed top-0 left-0 right-0 h-0.5 bg-stone-200/60 z-40">
                    <div
                        id="reading-progress"
                        className="h-full bg-[var(--landing-amber)] transition-all duration-100"
                        style={{ width: "0%" }}
                    />
                </div>
                <ReadingProgress />

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
                    <div className="flex gap-10 lg:gap-14 items-start">

                        {/* ── Main content column ── */}
                        <article className="flex-1 min-w-0 max-w-[42rem]">

                            <div className="mb-8">
                                <Breadcrumbs
                                    items={[
                                        { label: "Home", href: "/" },
                                        { label: "Blog", href: "/blog" },
                                        { label: post.title },
                                    ]}
                                />
                            </div>

                            {/* Article header — calm, generous spacing */}
                            <header className="mb-10 sm:mb-12">
                                <div className="flex flex-wrap items-center gap-3 mb-6">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${categoryBadge}`}>
                                        <Tag className="w-3 h-3" />
                                        {categoryLabel}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-sm text-[var(--landing-text-muted)]">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <time dateTime={post.publishedAt}>
                                            {new Date(post.publishedAt).toLocaleDateString("en-US", {
                                                month: "long", day: "numeric", year: "numeric"
                                            })}
                                        </time>
                                    </span>
                                    <span className="flex items-center gap-1.5 text-sm text-[var(--landing-text-muted)]">
                                        <Clock className="w-3.5 h-3.5" />
                                        {post.readTime} min read
                                    </span>
                                </div>

                                <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-[1.15] text-[var(--landing-text-dark)] mb-6">
                                    {post.title}
                                </h1>

                                <p className="text-lg sm:text-xl text-[var(--landing-text-muted)] leading-relaxed border-l-[3px] border-[var(--landing-amber)] pl-5">
                                    {post.description}
                                </p>
                            </header>

                            <div className="border-t border-stone-200/70 mb-10 sm:mb-12" />

                            {/* Article body — now that @tailwindcss/typography is installed,
                                these prose classes actually apply spacing/hierarchy (they were
                                previously silent no-ops, which was the #1 cause of clutter). */}
                            <div
                                className="
                                    prose prose-stone max-w-none
                                    prose-headings:font-display prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[var(--landing-text-dark)] prose-headings:scroll-mt-24
                                    prose-h2:text-[1.6rem] prose-h2:mt-14 prose-h2:mb-5 prose-h2:pb-3 prose-h2:border-b prose-h2:border-stone-200/70
                                    prose-h3:text-[1.2rem] prose-h3:mt-9 prose-h3:mb-3
                                    prose-p:text-[17px] prose-p:leading-[1.85] prose-p:text-stone-700 prose-p:my-5
                                    prose-li:text-[17px] prose-li:leading-[1.75] prose-li:text-stone-700
                                    prose-ul:my-6 prose-ol:my-6 prose-ul:space-y-2 prose-ol:space-y-2
                                    prose-strong:text-[var(--landing-text-dark)] prose-strong:font-semibold
                                    prose-a:text-[var(--landing-amber)] prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                                    prose-blockquote:not-italic prose-blockquote:font-normal prose-blockquote:border-l-[3px] prose-blockquote:border-[var(--landing-amber)] prose-blockquote:bg-[var(--landing-cream-deep)] prose-blockquote:rounded-r-xl prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:my-8
                                    prose-code:bg-stone-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[0.85em] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
                                    prose-pre:bg-[var(--landing-dark)] prose-pre:rounded-2xl
                                    prose-img:rounded-2xl prose-img:shadow-md prose-img:my-8
                                    prose-hr:border-stone-200/70 prose-hr:my-12
                                    prose-table:my-8 prose-table:text-[15px] prose-table:border prose-table:border-stone-200/80 prose-table:rounded-xl prose-table:overflow-hidden
                                    prose-thead:bg-[var(--landing-cream-deep)]
                                    prose-th:font-bold prose-th:text-[var(--landing-text-dark)] prose-th:px-4 prose-th:py-3 prose-th:text-left
                                    prose-td:px-4 prose-td:py-3 prose-td:border-t prose-td:border-stone-200/70
                                "
                                dangerouslySetInnerHTML={{ __html: post.content ?? "" }}
                            />

                            {/* Related Tool Pages */}
                            {post.relatedToolPages && post.relatedToolPages.length > 0 && (
                                <div className="mt-14 p-6 sm:p-7 rounded-[1.75rem] border border-[var(--landing-amber)]/25 bg-[var(--landing-amber)]/[0.05]">
                                    <h3 className="text-base font-bold text-[var(--landing-text-dark)] mb-4 flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[var(--landing-amber)] flex items-center justify-center text-white text-xs shrink-0">→</span>
                                        Try These Free Tools
                                    </h3>
                                    <div className="flex flex-wrap gap-2.5">
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
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-[var(--landing-amber)]/25 text-sm font-medium text-[var(--landing-amber)] hover:bg-[var(--landing-amber)] hover:text-white hover:border-[var(--landing-amber)] transition-colors shadow-sm"
                                                >
                                                    {label}
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </Link>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* CTA box — brand dark ink, matches landing page CTA styling */}
                            <div className="mt-10 p-7 sm:p-8 rounded-[1.75rem] bg-[var(--landing-dark)] text-white">
                                <div className="flex items-start gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-[var(--landing-amber)] flex items-center justify-center shrink-0">
                                        <span className="text-white font-bold text-lg">C</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold mb-2">Generate this document in 30 seconds</h3>
                                        <p className="text-white/60 text-sm leading-relaxed mb-5">
                                            Clorefy uses AI to create professional invoices, contracts, and proposals from a single sentence. GST, VAT, and sales tax handled automatically for every country worldwide.
                                        </p>
                                        <Link
                                            href="/auth/signup"
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--landing-amber)] text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
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
                                    <h2 className="font-display text-xl font-semibold text-[var(--landing-text-dark)] mb-6">Keep Reading</h2>
                                    <div className="grid sm:grid-cols-2 gap-5">
                                        {related.map((r) => (
                                            <Link
                                                key={r.slug}
                                                href={`/blog/${r.slug}`}
                                                className="group block p-5 border border-stone-200/70 rounded-[1.5rem] hover:-translate-y-0.5 card-depth transition-all bg-white"
                                            >
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-3 ${CATEGORY_BADGE[r.category] ?? "bg-stone-100 text-stone-600"}`}>
                                                    {CATEGORY_LABELS[r.category] ?? r.category}
                                                </span>
                                                <h3 className="font-semibold text-[var(--landing-text-dark)] group-hover:text-[var(--landing-amber)] transition-colors leading-snug mb-2">
                                                    {r.title}
                                                </h3>
                                                <p className="text-sm text-[var(--landing-text-muted)] line-clamp-2">{r.description}</p>
                                                <span className="inline-flex items-center gap-1 text-xs text-[var(--landing-amber)] font-medium mt-3">
                                                    Read article <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-12 pt-8 border-t border-stone-200/70">
                                <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-[var(--landing-text-muted)] hover:text-[var(--landing-text-dark)] transition-colors font-medium">
                                    <ArrowLeft className="w-4 h-4" /> All articles
                                </Link>
                            </div>
                        </article>

                        {/* ── Sticky sidebar (desktop only) — quieter, more air between cards ── */}
                        <aside className="hidden xl:block w-72 shrink-0 sticky top-28 space-y-6">
                            <div className="p-5 rounded-[1.5rem] border border-stone-200/70 bg-white">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-[var(--landing-green)] flex items-center justify-center text-white font-bold">C</div>
                                    <div>
                                        <p className="text-sm font-semibold text-[var(--landing-text-dark)]">Clorefy Team</p>
                                        <p className="text-xs text-[var(--landing-text-muted)]">AI Document Experts</p>
                                    </div>
                                </div>
                                <p className="text-xs text-[var(--landing-text-muted)] leading-relaxed">
                                    We build AI tools that generate invoices, contracts, and proposals for every country worldwide.
                                </p>
                            </div>

                            <div className="p-5 rounded-[1.5rem] bg-[var(--landing-dark)] text-white">
                                <p className="text-sm font-semibold mb-2">Generate documents with AI</p>
                                <p className="text-xs text-white/55 mb-4 leading-relaxed">
                                    Create professional invoices, contracts & proposals in 30 seconds. Free plan available.
                                </p>
                                <Link
                                    href="/auth/signup"
                                    className="block text-center px-4 py-2.5 bg-[var(--landing-amber)] text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Start Free →
                                </Link>
                            </div>

                            {related.length > 0 && (
                                <div className="p-5 rounded-[1.5rem] border border-stone-200/70 bg-white">
                                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--landing-text-muted)] mb-4">Related Articles</p>
                                    <div className="space-y-4">
                                        {related.slice(0, 3).map((r) => (
                                            <Link key={r.slug} href={`/blog/${r.slug}`} className="group block">
                                                <p className="text-sm font-medium text-[var(--landing-text-dark)] group-hover:text-[var(--landing-amber)] transition-colors leading-snug">
                                                    {r.title}
                                                </p>
                                                <p className="text-xs text-[var(--landing-text-muted)] mt-1 flex items-center gap-1">
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
