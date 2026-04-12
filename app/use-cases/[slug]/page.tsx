import { LandingLayout } from "@/components/landing/landing-layout"
import { AnimatedCard } from "@/components/landing/animated-card"
import { AnimatedHero } from "@/components/landing/animated-hero"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import { JsonLd } from "@/components/seo/json-ld"
import { notFound } from "next/navigation"
import { CheckCircle2, ArrowRight, Briefcase, Code2, GraduationCap, Scale, Palette, TrendingUp, Users } from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"

// ── Static use-case data ───────────────────────────────────────────────

type UseCaseData = {
    title: string
    tagline: string
    desc: string
    metaDescription: string
    iconName: string
    color: string
    benefits: string[]
    stats: { label: string; value: string }[]
    relatedTools: { href: string; label: string }[]
    faqs: { question: string; answer: string }[]
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Briefcase,
    Code2,
    GraduationCap,
    Scale,
    Palette,
    TrendingUp,
    Users,
}

const USE_CASES: Record<string, UseCaseData> = {
    freelancers: {
        title: "Clorefy for Freelancers",
        tagline: "Get paid faster, stress less",
        desc: "Stop spending hours formatting invoices. Describe your work, and Clorefy generates professional invoices with correct tax calculations, payment terms, and your branding — in seconds.",
        metaDescription: "Clorefy helps freelancers create professional invoices, contracts, and proposals in seconds. Auto tax calculations, multi-currency support, and branded exports.",
        iconName: "Briefcase",
        color: "from-orange-100 to-orange-50",
        benefits: ["Professional branded invoices", "Auto tax calculation", "Recurring invoice scheduling", "Payment tracking & reminders", "Multi-currency support", "Client portal for payments"],
        stats: [{ label: "Faster invoicing", value: "10×" }, { label: "Avg. saved per month", value: "8 hrs" }],
        relatedTools: [
            { href: "/tools/invoice-generator/india", label: "Invoice Generator for India" },
            { href: "/tools/invoice-generator/usa", label: "Invoice Generator for USA" },
            { href: "/tools/contract-generator/usa", label: "Contract Generator for USA" },
            { href: "/tools/quotation-generator/uk", label: "Quotation Generator for UK" },
        ],
        faqs: [
            { question: "How does Clorefy help freelancers invoice faster?", answer: "Clorefy uses AI to generate professional invoices from a simple description of your work. Just describe the project, client, and amount — Clorefy handles formatting, tax calculations, and branding automatically." },
            { question: "Can I track payments and send reminders with Clorefy?", answer: "Yes. Clorefy includes payment tracking so you can see which invoices are paid, pending, or overdue, and send automated reminders to clients." },
            { question: "Does Clorefy support multiple currencies for international freelance work?", answer: "Absolutely. Clorefy supports 11 countries and their currencies, automatically applying the correct tax rules and currency formatting for each." },
        ],
    },
    developers: {
        title: "Clorefy for Consultants",
        tagline: "Professional proposals in minutes",
        desc: "Create polished proposals, contracts, and invoices that win clients. AI handles the formatting and compliance so you can focus on delivering value.",
        metaDescription: "Clorefy helps consultants create AI-generated proposals, contracts, and invoices with country-specific tax compliance and e-signature workflows.",
        iconName: "Code2",
        color: "from-blue-100 to-blue-50",
        benefits: ["AI-generated proposals and SOWs", "Country-specific tax compliance", "E-signature workflow built in", "Multiple export formats", "Client-ready in seconds", "Version history and audit trail"],
        stats: [{ label: "Time saved per doc", value: "15 min" }, { label: "Client win rate", value: "+40%" }],
        relatedTools: [
            { href: "/tools/proposal-generator/usa", label: "Proposal Generator for USA" },
            { href: "/tools/contract-generator/india", label: "Contract Generator for India" },
            { href: "/tools/invoice-generator/uk", label: "Invoice Generator for UK" },
            { href: "/tools/quotation-generator/singapore", label: "Quotation Generator for Singapore" },
        ],
        faqs: [
            { question: "Can Clorefy generate proposals with country-specific compliance?", answer: "Yes. Clorefy automatically applies country-specific tax rules, legal requirements, and formatting standards for 11 supported countries when generating proposals and contracts." },
            { question: "Does Clorefy support e-signatures for consultant contracts?", answer: "Clorefy includes a built-in e-signature workflow so your clients can review and sign contracts directly, without needing a separate signing tool." },
            { question: "How does Clorefy help consultants win more clients?", answer: "By generating polished, professional proposals in minutes instead of hours, consultants can respond to opportunities faster and present a more professional image to prospective clients." },
        ],
    },
    students: {
        title: "Clorefy for Students",
        tagline: "Professional docs, student budget",
        desc: "Create polished project proposals, freelance invoices, and internship contracts. Free tier includes everything you need to start your professional journey.",
        metaDescription: "Clorefy offers students free professional document generation including invoices, proposals, and contracts with academic templates and 50% student discount.",
        iconName: "GraduationCap",
        color: "from-green-100 to-green-50",
        benefits: ["Free tier with 5 docs/month", "Professional templates", "Academic proposal formats", "Internship contract templates", "Portfolio-ready exports", "50% student discount on Pro"],
        stats: [{ label: "Student users", value: "50K+" }, { label: "Student discount", value: "50%" }],
        relatedTools: [
            { href: "/tools/proposal-generator/india", label: "Proposal Generator for India" },
            { href: "/tools/invoice-generator/india", label: "Invoice Generator for India" },
            { href: "/tools/contract-generator/usa", label: "Contract Generator for USA" },
        ],
        faqs: [
            { question: "Is Clorefy free for students?", answer: "Yes. Clorefy offers a free tier with 5 documents per month, which covers most student needs. Students also get a 50% discount on the Pro plan for higher volume." },
            { question: "Can I use Clorefy for academic project proposals?", answer: "Absolutely. Clorefy includes academic proposal formats designed for university projects, research proposals, and internship applications." },
            { question: "Does Clorefy help students create freelance invoices?", answer: "Yes. Students doing freelance work can generate professional invoices with correct tax calculations and branded exports, even on the free tier." },
        ],
    },
    lawyers: {
        title: "Clorefy for Lawyers",
        tagline: "Draft with precision, bill with ease",
        desc: "Generate contracts, quotations, and engagement letters with legal-grade accuracy. Built-in compliance checks, version tracking, and audit trails for every document.",
        metaDescription: "Clorefy helps lawyers draft contracts, engagement letters, and quotations with legal-grade accuracy, compliance checks, and audit trails.",
        iconName: "Scale",
        color: "from-indigo-100 to-indigo-50",
        benefits: ["Legal document templates", "Clause library & smart fill", "Version history & audit trail", "E-signature integration", "HIPAA-eligible infrastructure", "Jurisdiction-aware formatting"],
        stats: [{ label: "Faster drafting", value: "5×" }, { label: "Firms using Clorefy", value: "2,000+" }],
        relatedTools: [
            { href: "/tools/contract-generator/usa", label: "Contract Generator for USA" },
            { href: "/tools/contract-generator/uk", label: "Contract Generator for UK" },
            { href: "/tools/quotation-generator/india", label: "Quotation Generator for India" },
            { href: "/tools/invoice-generator/germany", label: "Invoice Generator for Germany" },
        ],
        faqs: [
            { question: "Is Clorefy suitable for drafting legal contracts?", answer: "Yes. Clorefy provides legal document templates with clause libraries, jurisdiction-aware formatting, and compliance checks designed for law firms and legal professionals." },
            { question: "Does Clorefy support compliance checks for legal documents?", answer: "Clorefy includes built-in compliance checks that validate documents against jurisdiction-specific requirements, helping lawyers catch issues before sending documents to clients." },
            { question: "Can lawyers track document versions and maintain audit trails?", answer: "Yes. Every document generated or edited in Clorefy has full version history and audit trail support, which is essential for legal record-keeping and compliance." },
        ],
    },
    agencies: {
        title: "Clorefy for Agencies",
        tagline: "Scale your client operations",
        desc: "Manage proposals, contracts, and invoices across all your clients from one dashboard. Brand each document per client, manage team access, and automate billing workflows.",
        metaDescription: "Clorefy helps agencies manage proposals, contracts, and invoices across clients with multi-brand support, team collaboration, and automated billing.",
        iconName: "Palette",
        color: "from-purple-100 to-purple-50",
        benefits: ["Multi-brand client management", "Proposal & SOW templates", "Team collaboration & permissions", "Automated billing workflows", "Client-specific pricing & terms", "White-label document exports"],
        stats: [{ label: "Agencies onboarded", value: "500+" }, { label: "Time saved on admin", value: "60%" }],
        relatedTools: [
            { href: "/tools/proposal-generator/usa", label: "Proposal Generator for USA" },
            { href: "/tools/invoice-generator/australia", label: "Invoice Generator for Australia" },
            { href: "/tools/contract-generator/canada", label: "Contract Generator for Canada" },
            { href: "/tools/quotation-generator/uae", label: "Quotation Generator for UAE" },
        ],
        faqs: [
            { question: "Can agencies manage multiple client brands in Clorefy?", answer: "Yes. Clorefy supports multi-brand document generation, so agencies can create invoices, proposals, and contracts with each client's branding from a single dashboard." },
            { question: "Does Clorefy support team collaboration for agencies?", answer: "Clorefy includes role-based access control and team collaboration features, allowing agency teams to work together on documents with proper permissions." },
            { question: "Can Clorefy automate recurring billing for agency clients?", answer: "Yes. Agencies can set up automated billing workflows with recurring invoices, custom payment terms, and client-specific pricing for each account." },
        ],
    },
    sales: {
        title: "Clorefy for Sales",
        tagline: "Close deals with speed",
        desc: "Generate proposals, quotes, and contracts instantly after meetings. Auto-fill client data, add custom terms, and get signatures — all from one workflow.",
        metaDescription: "Clorefy helps sales teams generate proposals, quotes, and contracts instantly with CRM auto-fill, custom pricing, and e-signature workflows.",
        iconName: "TrendingUp",
        color: "from-rose-100 to-rose-50",
        benefits: ["Instant proposal generation", "CRM data auto-fill", "Custom pricing & terms", "E-signature workflow", "Deal tracking dashboard", "Follow-up automation"],
        stats: [{ label: "Faster deal close", value: "3×" }, { label: "Proposals sent daily", value: "100K+" }],
        relatedTools: [
            { href: "/tools/proposal-generator/usa", label: "Proposal Generator for USA" },
            { href: "/tools/quotation-generator/india", label: "Quotation Generator for India" },
            { href: "/tools/contract-generator/singapore", label: "Contract Generator for Singapore" },
            { href: "/tools/invoice-generator/uk", label: "Invoice Generator for UK" },
        ],
        faqs: [
            { question: "How does Clorefy help sales teams close deals faster?", answer: "Clorefy generates proposals, quotes, and contracts instantly after meetings, so sales reps can send professional documents while the conversation is still fresh — reducing deal cycle time." },
            { question: "Can Clorefy auto-fill client data from a CRM?", answer: "Yes. Clorefy supports CRM data auto-fill, pulling client details directly into proposals and contracts so sales teams spend less time on manual data entry." },
            { question: "Does Clorefy include e-signatures for sales contracts?", answer: "Clorefy has a built-in e-signature workflow that lets clients review and sign contracts directly, streamlining the close process without switching tools." },
        ],
    },
    teams: {
        title: "Clorefy for Teams",
        tagline: "One platform, every document",
        desc: "Centralized document generation for your whole organization. Shared templates, consistent branding, usage dashboards, and enterprise-grade security.",
        metaDescription: "Clorefy for teams offers centralized document generation with shared templates, consistent branding, usage dashboards, and enterprise-grade security.",
        iconName: "Users",
        color: "from-teal-100 to-teal-50",
        benefits: ["Shared template library", "Consistent team branding", "Usage & analytics dashboard", "Role-based access control", "Centralized billing", "SSO & SCIM integration"],
        stats: [{ label: "Team adoption", value: "92%" }, { label: "Time saved per team", value: "40 hrs/mo" }],
        relatedTools: [
            { href: "/tools/invoice-generator/usa", label: "Invoice Generator for USA" },
            { href: "/tools/contract-generator/india", label: "Contract Generator for India" },
            { href: "/tools/proposal-generator/uk", label: "Proposal Generator for UK" },
            { href: "/tools/quotation-generator/australia", label: "Quotation Generator for Australia" },
        ],
        faqs: [
            { question: "How does Clorefy ensure consistent branding across a team?", answer: "Clorefy provides a shared template library with locked branding elements, so every document generated by any team member uses the same logos, colors, and formatting." },
            { question: "Does Clorefy offer role-based access control for teams?", answer: "Yes. Admins can set role-based permissions to control who can create, edit, approve, and export documents, ensuring proper governance across the organization." },
            { question: "Can teams track document usage and analytics in Clorefy?", answer: "Clorefy includes a usage and analytics dashboard that shows document generation volume, team activity, and cost tracking across the organization." },
        ],
    },
}

const BASE_URL = "https://clorefy.com"

// ── Static params for all 7 use-case slugs ─────────────────────────────

export function generateStaticParams() {
    return Object.keys(USE_CASES).map((slug) => ({ slug }))
}

// ── Per-slug metadata ──────────────────────────────────────────────────

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const data = USE_CASES[slug]

    if (!data) {
        return { title: "Use Case Not Found | Clorefy" }
    }

    const url = `${BASE_URL}/use-cases/${slug}`

    return {
        title: `${data.title} — ${data.tagline} | Clorefy`,
        description: data.metaDescription,
        alternates: { canonical: url },
        openGraph: {
            title: `${data.title} — ${data.tagline}`,
            description: data.metaDescription,
            url,
            siteName: "Clorefy",
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title: `${data.title} — ${data.tagline}`,
            description: data.metaDescription,
        },
    }
}

// ── Page component ─────────────────────────────────────────────────────

export default async function UseCasePage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const data = USE_CASES[slug]

    if (!data) return notFound()

    const Icon = ICON_MAP[data.iconName] ?? Briefcase

    const audienceType = data.title.replace("Clorefy for ", "")
    const pageUrl = `${BASE_URL}/use-cases/${slug}`

    const webPageJsonLd = {
        "@type": "WebPage",
        name: data.title,
        description: data.metaDescription,
        url: pageUrl,
        audience: {
            "@type": "Audience",
            audienceType,
        },
        isPartOf: {
            "@type": "WebSite",
            name: "Clorefy",
            url: BASE_URL,
        },
    }

    const faqPageJsonLd = {
        "@type": "FAQPage",
        mainEntity: data.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    }

    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Structured Data */}
                <JsonLd data={webPageJsonLd} />
                <JsonLd data={faqPageJsonLd} />

                {/* Breadcrumbs */}
                <div className="max-w-5xl mx-auto pt-28 px-6 sm:px-10">
                    <Breadcrumbs
                        items={[
                            { label: "Home", href: "/" },
                            { label: "Use Cases", href: "/use-cases" },
                            { label: data.title.replace("Clorefy for ", "") },
                        ]}
                    />
                </div>

                {/* Hero */}
                <section className="relative pt-6 pb-20 px-6 sm:px-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/30 via-transparent to-transparent opacity-60 pointer-events-none" />
                    <div className="max-w-5xl mx-auto text-center relative z-10">
                        <AnimatedHero>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${data.color} font-semibold text-sm mb-8 border border-stone-200/30`}>
                                <Icon size={16} />
                                <span className="uppercase tracking-wider text-xs font-bold">{slug.replace(/-/g, " ")}</span>
                            </div>
                            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight text-[var(--landing-text-dark)] mb-6 leading-[1.1]">
                                {data.title.replace("Clorefy for ", "")}<br />
                                <span className="font-serif italic text-[var(--landing-amber)]">{data.tagline}</span>
                            </h1>
                            <p className="text-xl text-[var(--landing-text-muted)] max-w-2xl mx-auto mb-10">
                                {data.desc}
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href="/auth/signup" className="group px-8 py-4 rounded-full bg-[var(--landing-dark)] text-white font-bold text-lg hover:scale-105 transition-all shadow-xl inline-flex items-center gap-2">
                                    Get Started Free <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                                </Link>
                            </div>
                        </AnimatedHero>
                    </div>
                </section>

                {/* Stats */}
                <section className="pb-20 px-6">
                    <div className="max-w-3xl mx-auto flex justify-center gap-12">
                        {data.stats.map((stat, i) => (
                            <AnimatedCard key={stat.label} delay={0.3 + i * 0.1}>
                                <div className="text-center">
                                    <div className="text-5xl font-display font-bold text-[var(--landing-amber)] mb-2">{stat.value}</div>
                                    <div className="text-sm text-[var(--landing-text-muted)] font-medium">{stat.label}</div>
                                </div>
                            </AnimatedCard>
                        ))}
                    </div>
                </section>

                {/* Benefits */}
                <section className="py-24 px-6 sm:px-10 bg-white rounded-t-[4rem]">
                    <div className="max-w-5xl mx-auto">
                        <AnimatedCard>
                            <h2 className="font-display text-4xl font-bold mb-12 text-center">
                                Why {slug.replace(/-/g, " ")} love Clorefy
                            </h2>
                        </AnimatedCard>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {data.benefits.map((benefit, i) => (
                                <AnimatedCard key={benefit} delay={i * 0.06}>
                                    <div className="flex items-center gap-4 p-5 rounded-2xl bg-[var(--landing-cream)] border border-stone-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                                            <CheckCircle2 size={18} />
                                        </div>
                                        <span className="font-medium">{benefit}</span>
                                    </div>
                                </AnimatedCard>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Related Tools — internal links to /tools/* programmatic SEO pages */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-5xl mx-auto">
                        <AnimatedCard>
                            <h2 className="font-display text-2xl font-bold mb-8 text-center">
                                Explore tools for {slug.replace(/-/g, " ")}
                            </h2>
                        </AnimatedCard>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                            {data.relatedTools.map((tool) => (
                                <AnimatedCard key={tool.href}>
                                    <Link
                                        href={tool.href}
                                        className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-[var(--landing-cream)] border border-stone-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                                    >
                                        <span className="font-medium text-sm">{tool.label}</span>
                                        <ArrowRight size={16} className="text-[var(--landing-amber)] transition-transform group-hover:translate-x-1" />
                                    </Link>
                                </AnimatedCard>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Other use cases */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-5xl mx-auto">
                        <h3 className="font-display text-2xl font-bold mb-8 text-center">Explore other use cases</h3>
                        <div className="flex flex-wrap justify-center gap-3">
                            {Object.entries(USE_CASES)
                                .filter(([key]) => key !== slug)
                                .map(([key, val]) => {
                                    const OtherIcon = ICON_MAP[val.iconName] ?? Briefcase
                                    return (
                                        <Link
                                            key={key}
                                            href={`/use-cases/${key}`}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--landing-cream)] border border-stone-200 text-sm font-semibold hover:bg-stone-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                                        >
                                            <OtherIcon size={16} />
                                            {key.charAt(0).toUpperCase() + key.slice(1)}
                                        </Link>
                                    )
                                })}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 px-6 sm:px-10">
                    <AnimatedCard>
                        <div className="max-w-4xl mx-auto bg-[var(--landing-dark)] rounded-[3rem] p-12 sm:p-20 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-mesh-dark opacity-50" />
                            <h2 className="font-display text-4xl sm:text-5xl text-[var(--landing-cream)] mb-4 relative z-10">
                                Start generating <span className="text-[var(--landing-amber)] italic font-serif">today</span>
                            </h2>
                            <p className="text-[var(--landing-text-dim)] text-lg mb-8 relative z-10">
                                Professional documents in seconds. Free to get started.
                            </p>
                            <Link href="/auth/signup" className="group relative z-10 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-lg hover:scale-105 transition-transform">
                                Get Started Free <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                            </Link>
                        </div>
                    </AnimatedCard>
                </section>
            </div>
        </LandingLayout>
    )
}
