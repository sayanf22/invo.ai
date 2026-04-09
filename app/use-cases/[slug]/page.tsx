"use client"

import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { notFound, useParams } from "next/navigation"
import { CheckCircle2, ArrowRight, Briefcase, Code2, GraduationCap, Scale, Palette, TrendingUp, Users } from "lucide-react"
import Link from "next/link"

type UseCaseData = {
    title: string
    tagline: string
    desc: string
    icon: any
    color: string
    benefits: string[]
    stats: { label: string; value: string }[]
}

const USE_CASES: Record<string, UseCaseData> = {
    freelancers: {
        title: "Invo for Freelancers",
        tagline: "Get paid faster, stress less",
        desc: "Stop spending hours formatting invoices. Describe your work, and Invo generates professional invoices with correct tax calculations, payment terms, and your branding — in seconds.",
        icon: Briefcase,
        color: "from-orange-100 to-orange-50",
        benefits: ["Professional branded invoices", "Auto tax calculation", "Recurring invoice scheduling", "Payment tracking & reminders", "Multi-currency support", "Client portal for payments"],
        stats: [{ label: "Faster invoicing", value: "10×" }, { label: "Avg. saved per month", value: "8 hrs" }]
    },
    developers: {
        title: "Invo for Consultants",
        tagline: "Professional proposals in minutes",
        desc: "Create polished proposals, contracts, and invoices that win clients. AI handles the formatting and compliance so you can focus on delivering value.",
        icon: Code2,
        color: "from-blue-100 to-blue-50",
        benefits: ["AI-generated proposals and SOWs", "Country-specific tax compliance", "E-signature workflow built in", "Multiple export formats", "Client-ready in seconds", "Version history and audit trail"],
        stats: [{ label: "Time saved per doc", value: "15 min" }, { label: "Client win rate", value: "+40%" }]
    },
    students: {
        title: "Invo for Students",
        tagline: "Professional docs, student budget",
        desc: "Create polished project proposals, freelance invoices, and internship contracts. Free tier includes everything you need to start your professional journey.",
        icon: GraduationCap,
        color: "from-green-100 to-green-50",
        benefits: ["Free tier with 5 docs/month", "Professional templates", "Academic proposal formats", "Internship contract templates", "Portfolio-ready exports", "50% student discount on Pro"],
        stats: [{ label: "Student users", value: "50K+" }, { label: "Student discount", value: "50%" }]
    },
    lawyers: {
        title: "Invo for Lawyers",
        tagline: "Draft with precision, bill with ease",
        desc: "Generate contracts, quotations, and engagement letters with legal-grade accuracy. Built-in compliance checks, version tracking, and audit trails for every document.",
        icon: Scale,
        color: "from-indigo-100 to-indigo-50",
        benefits: ["Legal document templates", "Clause library & smart fill", "Version history & audit trail", "E-signature integration", "HIPAA-eligible infrastructure", "Jurisdiction-aware formatting"],
        stats: [{ label: "Faster drafting", value: "5×" }, { label: "Firms using Invo", value: "2,000+" }]
    },
    agencies: {
        title: "Invo for Agencies",
        tagline: "Scale your client operations",
        desc: "Manage proposals, contracts, and invoices across all your clients from one dashboard. Brand each document per client, manage team access, and automate billing workflows.",
        icon: Palette,
        color: "from-purple-100 to-purple-50",
        benefits: ["Multi-brand client management", "Proposal & SOW templates", "Team collaboration & permissions", "Automated billing workflows", "Client-specific pricing & terms", "White-label document exports"],
        stats: [{ label: "Agencies onboarded", value: "500+" }, { label: "Time saved on admin", value: "60%" }]
    },
    sales: {
        title: "Invo for Sales",
        tagline: "Close deals with speed",
        desc: "Generate proposals, quotes, and contracts instantly after meetings. Auto-fill client data, add custom terms, and get signatures — all from one workflow.",
        icon: TrendingUp,
        color: "from-rose-100 to-rose-50",
        benefits: ["Instant proposal generation", "CRM data auto-fill", "Custom pricing & terms", "E-signature workflow", "Deal tracking dashboard", "Follow-up automation"],
        stats: [{ label: "Faster deal close", value: "3×" }, { label: "Proposals sent daily", value: "100K+" }]
    },
    teams: {
        title: "Invo for Teams",
        tagline: "One platform, every document",
        desc: "Centralized document generation for your whole organization. Shared templates, consistent branding, usage dashboards, and enterprise-grade security.",
        icon: Users,
        color: "from-teal-100 to-teal-50",
        benefits: ["Shared template library", "Consistent team branding", "Usage & analytics dashboard", "Role-based access control", "Centralized billing", "SSO & SCIM integration"],
        stats: [{ label: "Team adoption", value: "92%" }, { label: "Time saved per team", value: "40 hrs/mo" }]
    },
}

export default function UseCasePage() {
    const params = useParams()
    const slug = params.slug as string
    const data = USE_CASES[slug]

    if (!data) return notFound()

    const Icon = data.icon

    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="relative pt-32 pb-20 px-6 sm:px-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/30 via-transparent to-transparent opacity-60 pointer-events-none" />
                    <div className="max-w-5xl mx-auto text-center relative z-10">
                        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${data.color} font-semibold text-sm mb-8 border border-stone-200/30`}>
                                <Icon size={16} />
                                <span className="uppercase tracking-wider text-xs font-bold">{slug.replace(/-/g, ' ')}</span>
                            </div>
                            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight text-[var(--landing-text-dark)] mb-6 leading-[1.1]">
                                {data.title.replace("Invo for ", "")}<br />
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
                        </motion.div>
                    </div>
                </section>

                {/* Stats */}
                <section className="pb-20 px-6">
                    <div className="max-w-3xl mx-auto flex justify-center gap-12">
                        {data.stats.map((stat, i) => (
                            <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }} className="text-center">
                                <div className="text-5xl font-display font-bold text-[var(--landing-amber)] mb-2">{stat.value}</div>
                                <div className="text-sm text-[var(--landing-text-muted)] font-medium">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Benefits */}
                <section className="py-24 px-6 sm:px-10 bg-white rounded-t-[4rem]">
                    <div className="max-w-5xl mx-auto">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="font-display text-4xl font-bold mb-12 text-center"
                        >
                            Why {slug.replace(/-/g, ' ')} love Invo
                        </motion.h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {data.benefits.map((benefit, i) => (
                                <motion.div
                                    key={benefit}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.06, duration: 0.5 }}
                                    className="flex items-center gap-4 p-5 rounded-2xl bg-[var(--landing-cream)] border border-stone-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                                >
                                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                                        <CheckCircle2 size={18} />
                                    </div>
                                    <span className="font-medium">{benefit}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Other use cases */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-5xl mx-auto">
                        <h3 className="font-display text-2xl font-bold mb-8 text-center">Explore other use cases</h3>
                        <div className="flex flex-wrap justify-center gap-3">
                            {Object.entries(USE_CASES).filter(([key]) => key !== slug).map(([key, val]) => {
                                const OtherIcon = val.icon
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
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="max-w-4xl mx-auto bg-[var(--landing-dark)] rounded-[3rem] p-12 sm:p-20 text-center relative overflow-hidden"
                    >
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
                    </motion.div>
                </section>
            </div>
        </LandingLayout>
    )
}
