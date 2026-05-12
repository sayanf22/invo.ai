"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

type Persona = {
    id: string
    label: string
    title: string
    desc: string
    preview: {
        docType: string       // "Invoice", "Proposal", "Contract"…
        badge: string         // small subtitle under title
        from: string
        to: string
        headline: string      // big bold document title
        lines: string[]       // 2–3 body lines
        total?: string        // optional total/amount
        totalLabel?: string   // "Amount Due", "Project Fee"…
        tag: string           // floating tag text
    }
}

const personas: Persona[] = [
    {
        id: "agencies",
        label: "Agencies",
        title: "Scale your client onboarding",
        desc: "Generate client proposals, service agreements, and quotations in seconds. Spend less time on paperwork, more time closing.",
        preview: {
            docType: "Proposal",
            badge: "Q2 2026 · Brand Campaign",
            from: "Studio Noir · New York",
            to: "Acme Corp",
            headline: "Brand Strategy Proposal",
            lines: [
                "Scope: Brand audit, identity system, launch assets",
                "Timeline: 6 weeks · 3 review rounds",
                "Deliverables: Logo, guidelines, 20 social templates",
            ],
            total: "$24,500",
            totalLabel: "Project Fee",
            tag: "Proposal sent",
        },
    },
    {
        id: "creators",
        label: "Creators",
        title: "Capture fleeting ideas",
        desc: "Don't let inspiration slip away. Record your creative bursts and get organized project briefs instantly.",
        preview: {
            docType: "Brief",
            badge: "Project · YouTube Series",
            from: "Mira · Creator Studio",
            to: "Sponsor Partner",
            headline: "Content Collaboration Brief",
            lines: [
                "Format: 4-part mini-series, 8–10 min each",
                "Deliverables: Master edits, 12 short clips",
                "Usage: 60 days paid, 12 months organic",
            ],
            total: "$8,200",
            totalLabel: "Campaign Fee",
            tag: "Draft ready",
        },
    },
    {
        id: "developers",
        label: "Developers",
        title: "Docs that write themselves",
        desc: "Describe your project scope, deliverables, and terms. Clorefy generates polished proposals and contracts instantly.",
        preview: {
            docType: "SOW",
            badge: "Engagement · Web App Build",
            from: "Kai Dev · Remote",
            to: "Finova Labs",
            headline: "Statement of Work",
            lines: [
                "Stack: Next.js 16 · Supabase · Stripe",
                "Milestones: Auth · Dashboard · Billing · QA",
                "Payment: 40% start / 30% beta / 30% ship",
            ],
            total: "$18,000",
            totalLabel: "Fixed Fee",
            tag: "Auto-drafted",
        },
    },
    {
        id: "lawyers",
        label: "Lawyers",
        title: "Precision legal drafting",
        desc: "The accuracy is astounding. It handles legal terminology perfectly and formats contracts exactly how you need them.",
        preview: {
            docType: "NDA",
            badge: "Mutual · 2 Parties",
            from: "Harwood Legal LLP",
            to: "BlueStone Ventures",
            headline: "Non-Disclosure Agreement",
            lines: [
                "1. Confidentiality: 3-year protection period",
                "2. Permitted Use: Evaluation of partnership",
                "3. Governing Law: State of Delaware, USA",
            ],
            total: "Signed",
            totalLabel: "Status",
            tag: "E-sign ready",
        },
    },
    {
        id: "leaders",
        label: "Leaders",
        title: "Communicate with clarity",
        desc: "Turn raw meeting notes into structured investor updates and strategy memos automatically.",
        preview: {
            docType: "Memo",
            badge: "Investor Update · May 2026",
            from: "CEO · Helix Inc.",
            to: "Board & Investors",
            headline: "Q2 Strategy Update",
            lines: [
                "Revenue: +42% QoQ · ARR at $2.1M",
                "Shipped: AI copilot, payments v2",
                "Next: EU expansion, Series A prep",
            ],
            total: "On track",
            totalLabel: "Plan Status",
            tag: "Auto-formatted",
        },
    },
    {
        id: "sales",
        label: "Sales",
        title: "Close deals with speed",
        desc: "Send customized proposals right after a discovery call while the lead is hot.",
        preview: {
            docType: "Quote",
            badge: "Pricing · Enterprise",
            from: "Ravi · North Sales",
            to: "Pinnacle Retail Ltd.",
            headline: "Annual Plan Quotation",
            lines: [
                "Seats: 50 users · SSO · Priority support",
                "Term: 12 months · Net-30 payment",
                "Rollout: 2-week onboarding included",
            ],
            total: "$36,000/yr",
            totalLabel: "Contract Value",
            tag: "Sent in 90s",
        },
    },
    {
        id: "students",
        label: "Students",
        title: "Professional docs, zero stress",
        desc: "Create internship contracts, project proposals, and freelance invoices. Free tier covers everything.",
        preview: {
            docType: "Invoice",
            badge: "Freelance · Logo Design",
            from: "Aarav S. · Student Freelancer",
            to: "Bright Cafe",
            headline: "Invoice #INV-0042",
            lines: [
                "Logo design — final files + 2 revisions",
                "Brand colors + simple usage guide",
                "Due: within 7 days · UPI / Card accepted",
            ],
            total: "₹6,500",
            totalLabel: "Amount Due",
            tag: "Payment link attached",
        },
    },
    {
        id: "teams",
        label: "Teams",
        title: "Unified document knowledge",
        desc: "Every generated document is stored, searchable, and reusable across your entire organization.",
        preview: {
            docType: "MSA",
            badge: "Master Services · Shared",
            from: "Northwind Ops Team",
            to: "All vendors",
            headline: "Master Services Agreement",
            lines: [
                "Reusable template — 14 signed this month",
                "Fields auto-fill from client directory",
                "Access: Legal + Ops roles only",
            ],
            total: "14 active",
            totalLabel: "In use",
            tag: "Shared library",
        },
    },
]

export function PersonaTabs() {
    const [active, setActive] = useState(0)
    const current = personas[active]

    return (
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-[1400px] mx-auto bg-[var(--landing-dark)] rounded-[2.5rem] sm:rounded-[3.5rem] p-8 sm:p-14 lg:p-20 relative overflow-hidden shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] border-[3px] border-[var(--landing-dark)]">

                <div className="flex flex-col lg:flex-row gap-16 lg:gap-20 items-start">

                    {/* Left side: Content & Pills */}
                    <div className="w-full lg:w-1/2 relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="font-serif text-5xl sm:text-6xl lg:text-7xl font-medium text-[#F4F0EB] mb-4 tracking-tight leading-tight"
                            >
                                Made for the <br /> way <span className="italic text-[#c6a3db]">you</span> work
                            </motion.h2>
                            <p className="text-[var(--landing-text-muted)] text-sm sm:text-base font-semibold tracking-wide uppercase mb-10">
                                Tap a role — see the document Clorefy drafts for them.
                            </p>

                            <div className="flex flex-wrap gap-2.5 mb-16 max-w-xl">
                                {personas.map((persona, i) => (
                                    <button
                                        key={persona.id}
                                        onClick={() => setActive(i)}
                                        className={`px-5 py-2 rounded-full border-[1.5px] text-sm sm:text-base font-bold transition-all duration-300 ${
                                            active === i
                                            ? 'bg-white text-[var(--landing-dark)] border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]'
                                            : 'bg-transparent text-white border-white/20 hover:border-white/50'
                                        }`}
                                    >
                                        {persona.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={active}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <h3 className="font-serif text-3xl text-white mb-3">{current.title}.</h3>
                                    <p className="text-[var(--landing-text-muted)] text-base sm:text-lg mb-8 max-w-md leading-relaxed">
                                        {current.desc}
                                    </p>
                                </motion.div>
                            </AnimatePresence>

                            <Link
                                href="/auth/signup"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#f1d0f5] text-[var(--landing-dark)] font-bold text-sm sm:text-base transition-all hover:-translate-y-0.5 active:translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(241,208,245,0.5)]"
                            >
                                Get Started Free
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>

                    {/* Right side: Persona-specific document preview */}
                    <div className="w-full lg:w-1/2 relative h-[440px] lg:h-[600px] lg:-my-10 flex items-center justify-center">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(198,163,219,0.1)_0%,transparent_60%)] pointer-events-none" />

                        <motion.div
                            className="relative w-full max-w-[460px] aspect-[4/3]"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        >
                            {/* Document surface */}
                            <div className="absolute inset-0 bg-[#fbf9f6] rounded-2xl shadow-2xl border-2 border-stone-200 overflow-hidden flex flex-col z-10">
                                {/* Window chrome */}
                                <div className="h-10 border-b border-stone-200 bg-white flex items-center px-4 justify-between shrink-0">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                                    </div>
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={current.id + "-chrome"}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="text-[10px] font-mono uppercase tracking-wider text-stone-400"
                                        >
                                            clorefy.com/doc · {current.preview.docType}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Document body */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={current.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                        className="flex-1 p-5 sm:p-7 flex flex-col gap-3.5 relative overflow-hidden"
                                    >
                                        {/* Top row: doc type + badge */}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--landing-amber)] mb-1">
                                                    {current.preview.docType}
                                                </div>
                                                <div className="text-[10px] text-stone-400 font-medium">
                                                    {current.preview.badge}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] text-stone-400 uppercase tracking-wider mb-0.5">From</div>
                                                <div className="text-[11px] font-semibold text-stone-700 leading-tight max-w-[140px] truncate">
                                                    {current.preview.from}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Document headline */}
                                        <h4 className="font-serif text-[18px] sm:text-[22px] font-semibold text-[#1C1A17] leading-tight tracking-tight -mb-0.5">
                                            {current.preview.headline}
                                        </h4>

                                        {/* Billed to */}
                                        <div className="flex items-baseline gap-2 text-[10.5px]">
                                            <span className="text-stone-400 uppercase tracking-wider">To</span>
                                            <span className="font-semibold text-stone-700">{current.preview.to}</span>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px bg-stone-200" />

                                        {/* Body lines */}
                                        <div className="space-y-2">
                                            {current.preview.lines.map((line, idx) => (
                                                <div key={idx} className="flex items-start gap-2 text-[11px] sm:text-[12px] text-stone-600 leading-relaxed">
                                                    <span className="text-[var(--landing-amber)] shrink-0 mt-0.5">•</span>
                                                    <span className="flex-1">{line}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Spacer */}
                                        <div className="flex-1" />

                                        {/* Footer: total + CTA */}
                                        <div className="border-t border-stone-200 pt-3 flex justify-between items-center">
                                            <div>
                                                <div className="text-[9px] text-stone-400 uppercase tracking-wider">
                                                    {current.preview.totalLabel}
                                                </div>
                                                <div className="text-[15px] sm:text-[17px] font-bold text-[#1C1A17] font-serif">
                                                    {current.preview.total}
                                                </div>
                                            </div>
                                            <div className="px-3 py-1.5 rounded-md bg-[var(--landing-amber)] text-white text-[10px] font-bold uppercase tracking-wider">
                                                Send
                                            </div>
                                        </div>

                                        {/* Typing cursor */}
                                        <motion.div
                                            className="absolute right-7 bottom-[88px] w-[2px] h-3.5 bg-[var(--landing-amber)]"
                                            animate={{ opacity: [1, 0, 1] }}
                                            transition={{ duration: 1, repeat: Infinity }}
                                        />
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Floating "Generating / Auto-drafted" tag */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={current.id + "-tag"}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1, y: [0, -8, 0], rotate: [0, 2, 0] }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{
                                        opacity: { duration: 0.25 },
                                        scale: { duration: 0.25 },
                                        y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                                        rotate: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                                    }}
                                    className="absolute -right-3 top-[18%] bg-[var(--landing-dark)] text-white px-3.5 py-2 rounded-xl shadow-xl border border-stone-700 z-20 flex items-center gap-2"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                                        {current.preview.tag}
                                    </span>
                                </motion.div>
                            </AnimatePresence>

                            {/* Floating status card */}
                            <motion.div
                                className="absolute -left-6 bottom-[22%] bg-white p-2.5 rounded-2xl shadow-xl border border-stone-200 z-20 flex items-center gap-2.5"
                                animate={{ y: [0, 8, 0], rotate: [0, -2, 0] }}
                                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                            >
                                <div className="w-7 h-7 rounded-full bg-[var(--landing-amber)]/10 flex items-center justify-center shrink-0">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--landing-amber)]">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <div className="pr-1">
                                    <div className="text-[10px] font-semibold text-stone-700">Saved to profile</div>
                                    <div className="text-[9px] text-stone-400">Auto-fills next time</div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
    )
}
