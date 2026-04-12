import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPostBySlug, getRelatedPosts, getPostsByHub, getAllSlugs } from "@/lib/blog-data"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { ArrowLeft, Clock, ArrowRight } from "lucide-react"

// Static generation — all blog posts are pre-rendered at build time
export function generateStaticParams() {
    return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    const post = getPostBySlug(slug)
    if (!post) return { title: "Not Found" }

    return {
        title: post.title,
        description: post.description,
        keywords: [post.keyword, "Clorefy", "AI document generator"],
        alternates: { canonical: `/blog/${post.slug}` },
        openGraph: {
            title: post.title,
            description: post.description,
            url: `https://clorefy.com/blog/${post.slug}`,
            type: "article",
            publishedTime: post.publishedAt,
            modifiedTime: post.updatedAt,
            authors: ["Clorefy"],
        },
        twitter: {
            card: "summary_large_image",
            title: post.title,
            description: post.description,
        },
    }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const post = getPostBySlug(slug)
    if (!post) notFound()

    // Build related posts: prioritize same-hub posts, then fall back to relatedSlugs
    let related = getRelatedPosts(slug)
    if (post.hub) {
        const hubPosts = getPostsByHub(post.hub).filter((p) => p.slug !== slug)
        // Merge: hub posts first, then remaining related posts (deduplicated)
        const hubSlugs = new Set(hubPosts.map((p) => p.slug))
        const nonHubRelated = related.filter((p) => !hubSlugs.has(p.slug))
        related = [...hubPosts.slice(0, 3), ...nonHubRelated].slice(0, 5)
    }

    // JSON-LD structured data for Article
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: { "@type": "Organization", name: "Clorefy", url: "https://clorefy.com" },
        publisher: {
            "@type": "Organization",
            name: "Clorefy",
            url: "https://clorefy.com",
            logo: { "@type": "ImageObject", url: "https://clorefy.com/favicon.png" },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": `https://clorefy.com/blog/${post.slug}` },
    }

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

            <div className="min-h-screen bg-background">
                <article className="max-w-3xl mx-auto px-6 py-12">
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

                    {/* Header */}
                    <header className="mb-10">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                            <time dateTime={post.publishedAt}>
                                {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                            </time>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> {post.readTime} min read
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">{post.title}</h1>
                        <p className="text-lg text-muted-foreground mt-4">{post.description}</p>
                    </header>

                    {/* Content */}
                    <div
                        className="prose prose-neutral dark:prose-invert max-w-none
                            prose-headings:font-semibold prose-headings:tracking-tight
                            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                            prose-p:leading-relaxed prose-p:text-[16px]
                            prose-li:text-[16px] prose-li:leading-relaxed
                            prose-strong:text-foreground
                            prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />

                    {/* Related Tool Pages */}
                    {post.relatedToolPages && post.relatedToolPages.length > 0 && (
                        <div className="mt-12 p-6 rounded-2xl border border-border bg-card">
                            <h3 className="text-lg font-semibold mb-3">Related Tools</h3>
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
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary/20 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                                        >
                                            {label}
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    <div className="mt-12 p-6 rounded-2xl bg-primary/5 border border-primary/20">
                        <h3 className="text-lg font-semibold">Try Clorefy Free</h3>
                        <p className="text-muted-foreground mt-1">
                            Generate professional invoices, contracts, and proposals with AI in seconds. No credit card required.
                        </p>
                        <Link href="/auth/signup"
                            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                            Get Started Free <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Related Posts */}
                    {related.length > 0 && (
                        <div className="mt-16">
                            <h2 className="text-xl font-semibold mb-6">Related Articles</h2>
                            <div className="grid gap-4">
                                {related.map((r) => (
                                    <Link key={r.slug} href={`/blog/${r.slug}`}
                                        className="group flex items-center justify-between p-4 border rounded-xl hover:shadow-sm transition-all">
                                        <div>
                                            <h3 className="font-medium group-hover:text-primary transition-colors">{r.title}</h3>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{r.description}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 ml-4 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Back to blog */}
                    <div className="mt-12 pt-8 border-t">
                        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back to all articles
                        </Link>
                    </div>
                </article>
            </div>
        </>
    )
}
