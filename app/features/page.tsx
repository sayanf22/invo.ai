import { LandingLayout } from "@/components/landing/landing-layout"
import { FeatureTabNav, type TabData, type TabContentData } from "@/components/landing/feature-tab-nav"
import { AnimatedCard } from "@/components/landing/animated-card"
import { Breadcrumbs } from "@/components/seo/breadcrumbs"
import {
    FileText, Wand2, Globe, Zap, Shield, Palette,
    CheckCircle, ArrowRight, Sparkles, Languages,
    Stamp, Calculator, PenTool, Users
} from "lucide-react"
import Link from "next/link"

const tabs: TabData[] = [
    { id: "generate", label: "Generate", icon: "Wand2" },
    { id: "customize", label: "Customize", icon: "Palette" },
    { id: "comply", label: "Comply", icon: "Shield" },
    { id: "export", label: "Export", icon: "FileText" },
    { id: "integrate", label: "Integrate", icon: "Zap" },
]

const tabContent: Record<string, TabContentData> = {
    generate: {
        title: "AI-powered document generation",
        desc: "Describe what you need in plain language. Clorefy generates professional invoices, contracts, quotations, and proposals in seconds.",
        features: [
            { icon: "Sparkles", name: "Smart AI drafting", detail: "Turn a few sentences into a complete, formatted document" },
            { icon: "FileText", name: "Multiple document types", detail: "Invoices, contracts, quotations, proposals, and more" },
            { icon: "Globe", name: "Multi-currency support", detail: "Generate documents in any currency with correct formatting" },
        ]
    },
    customize: {
        title: "Make every document yours",
        desc: "Your brand, your rules. Customize colors, fonts, layouts, and create reusable templates that match your identity.",
        features: [
            { icon: "Palette", name: "Brand customization", detail: "Upload logos, set brand colors, choose fonts that match your identity" },
            { icon: "PenTool", name: "Template library", detail: "Save custom templates and reuse them across documents" },
            { icon: "Users", name: "Team consistency", detail: "Shared templates ensure every document looks professional" },
        ]
    },
    comply: {
        title: "Stay compliant, automatically",
        desc: "Built-in tax calculations, jurisdiction-aware clauses, and regulatory compliance checks — so you never miss a detail.",
        features: [
            { icon: "Calculator", name: "Auto tax calculation", detail: "GST, VAT, sales tax — calculated automatically based on location" },
            { icon: "Shield", name: "Legal compliance", detail: "Jurisdiction-aware clauses that update as regulations change" },
            { icon: "Stamp", name: "Audit trail", detail: "Every document version is tracked and verifiable" },
        ]
    },
    export: {
        title: "Export & share instantly",
        desc: "Professional PDFs, shareable links, e-signatures — everything you need to close deals faster.",
        features: [
            { icon: "FileText", name: "Perfect PDFs", detail: "Pixel-perfect PDF exports with your branding" },
            { icon: "Globe", name: "Shareable links", detail: "Send documents via link — no attachments needed" },
            { icon: "PenTool", name: "E-signatures", detail: "Built-in signing workflow for contracts and proposals" },
        ]
    },
    integrate: {
        title: "Connects to your workflow",
        desc: "Export, share, and collaborate on documents with your team. Multiple formats, shareable links, and version history built in.",
        features: [
            { icon: "Zap", name: "Instant Export", detail: "Download as PDF, DOCX, or image in one click" },
            { icon: "Languages", name: "Version History", detail: "Track every change with full document version history" },
            { icon: "Globe", name: "Shareable Links", detail: "Send documents via link — clients view and sign online" },
        ]
    }
}

const featureGrid = [
    { icon: Wand2, name: "AI Generation", desc: "Natural language to documents" },
    { icon: Palette, name: "Custom Branding", desc: "Your logo, colors, and style" },
    { icon: Calculator, name: "Auto Tax", desc: "GST, VAT, sales tax calculated" },
    { icon: Globe, name: "Multi-Currency", desc: "150+ currencies supported" },
    { icon: Languages, name: "Multi-Language", desc: "Generate in 50+ languages" },
    { icon: Shield, name: "E-Signatures", desc: "Built-in signing workflow" },
    { icon: FileText, name: "PDF Export", desc: "Pixel-perfect documents" },
    { icon: Zap, name: "Quick Export", desc: "PDF, DOCX, and images" },
    { icon: Users, name: "Team Sharing", desc: "Collaborate on templates" },
    { icon: Stamp, name: "Audit Trail", desc: "Version tracking & history" },
    { icon: CheckCircle, name: "Compliance", desc: "Legal-ready documents" },
    { icon: Sparkles, name: "Smart Templates", desc: "Learn from your patterns" },
]

export default function FeaturesPage() {
    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Breadcrumbs */}
                <div className="max-w-5xl mx-auto pt-28 px-6 sm:px-10">
                    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Features" }]} />
                </div>

                {/* Hero */}
                <section className="relative pt-6 pb-20 px-6 sm:px-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/40 via-transparent to-transparent opacity-60 pointer-events-none" />
                    <div className="max-w-5xl mx-auto text-center relative z-10">
                        <AnimatedCard>
                            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight text-[var(--landing-text-dark)] mb-6 leading-[1.1]">
                                Do more with <br />
                                <span className="font-serif italic text-[var(--landing-amber)]">intelligent documents</span>
                            </h1>
                            <p className="text-xl sm:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto mb-10">
                                AI-powered document creation that turns your ideas into professional invoices, contracts, and proposals.
                            </p>
                        </AnimatedCard>

                        {/* Tab Navigation */}
                        <AnimatedCard delay={0.2}>
                            <FeatureTabNav tabs={tabs} tabContent={tabContent} />
                        </AnimatedCard>
                    </div>
                </section>

                {/* All Features Grid */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-6xl mx-auto">
                        <AnimatedCard>
                            <div className="text-center mb-16">
                                <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">Everything you need</h2>
                                <p className="text-lg text-[var(--landing-text-muted)] max-w-xl mx-auto">
                                    A complete document platform built for modern businesses.
                                </p>
                            </div>
                        </AnimatedCard>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {featureGrid.map((item, i) => (
                                <AnimatedCard key={item.name} delay={i * 0.05}>
                                    <div className="p-6 rounded-2xl bg-[var(--landing-cream)] border border-stone-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                                        <item.icon size={22} className="text-[var(--landing-amber)] mb-3" />
                                        <p className="font-bold text-sm mb-1">{item.name}</p>
                                        <p className="text-xs text-[var(--landing-text-muted)]">{item.desc}</p>
                                    </div>
                                </AnimatedCard>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 px-6 sm:px-10">
                    <AnimatedCard>
                        <div className="max-w-4xl mx-auto bg-[var(--landing-dark)] rounded-[3rem] p-12 sm:p-20 text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-mesh-dark opacity-50" />
                            <h2 className="font-display text-4xl sm:text-5xl text-[var(--landing-cream)] mb-4 relative z-10">
                                Ready to <span className="text-[var(--landing-amber)] italic font-serif">flow</span>?
                            </h2>
                            <p className="text-[var(--landing-text-dim)] text-lg mb-8 relative z-10">
                                Start creating professional documents in seconds, not hours.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                                <Link
                                    href="/auth/signup"
                                    className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-lg hover:scale-105 transition-transform"
                                >
                                    Get Started Free
                                    <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                                </Link>
                            </div>
                        </div>
                    </AnimatedCard>
                </section>
            </div>
        </LandingLayout>
    )
}
