"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import Link from "next/link"

type LineItem = { desc: string; qty: string; rate: string; amount: string }

type Persona = {
    id: string
    label: string
    title: string
    desc: string
    chat: {
        prompt: string          // what the user typed
        reply: string           // short AI reply line
    }
    doc: {
        kind: "invoice" | "contract" | "proposal" | "quotation"
        brand: string           // small top-left brand text
        number: string          // e.g. INV-0042
        date: string            // e.g. 12 May 2026
        title: string           // "INVOICE" / "PROPOSAL"…
        fromName: string
        fromMeta: string        // e.g. "GSTIN 29ABCDE1234F1Z5"
        toName: string
        toMeta: string
        items: LineItem[]
        currencyLabel: string   // "INR", "USD", "Total"
        subtotal: string
        taxLabel: string        // "GST 18%" / "VAT 20%" / "Sales Tax 8.25%" / "—"
        taxAmount: string
        total: string
        footerNote: string      // short terms / payment note
    }
}

const personas: Persona[] = [
    {
        id: "students",
        label: "Students",
        title: "Professional docs, zero stress",
        desc: "Create internship contracts, project proposals, and freelance invoices. Free tier covers everything.",
        chat: {
            prompt: "Invoice Bright Cafe 6500 for logo design, 7 day payment",
            reply: "Done — invoice INV-0042 ready with a UPI + card payment link attached.",
        },
        doc: {
            kind: "invoice",
            brand: "Aarav S. · Freelance",
            number: "INV-0042",
            date: "12 May 2026",
            title: "INVOICE",
            fromName: "Aarav Sharma",
            fromMeta: "Bangalore, IN · GSTIN 29ABCDE1234F1Z5",
            toName: "Bright Cafe",
            toMeta: "MG Road, Bangalore",
            items: [
                { desc: "Logo design — final files + 2 revisions", qty: "1", rate: "5,500.00", amount: "5,500.00" },
                { desc: "Brand colors + simple usage guide", qty: "1", rate: "1,000.00", amount: "1,000.00" },
            ],
            currencyLabel: "INR",
            subtotal: "6,500.00",
            taxLabel: "GST 0%",
            taxAmount: "0.00",
            total: "₹ 6,500.00",
            footerNote: "Due in 7 days · UPI / Card accepted",
        },
    },
    {
        id: "agencies",
        label: "Agencies",
        title: "Scale your client onboarding",
        desc: "Generate client proposals, service agreements, and quotations in seconds. Spend less time on paperwork, more time closing.",
        chat: {
            prompt: "Draft a brand strategy proposal for Acme, $24,500, 6 weeks",
            reply: "Proposal drafted — scope, timeline, and terms pulled from your studio profile.",
        },
        doc: {
            kind: "proposal",
            brand: "Studio Noir · New York",
            number: "PROP-2026-41",
            date: "12 May 2026",
            title: "PROPOSAL",
            fromName: "Studio Noir",
            fromMeta: "Brooklyn, NY · EIN 98-7654321",
            toName: "Acme Corp",
            toMeta: "Marketing team · contact@acme.co",
            items: [
                { desc: "Brand audit + positioning workshop", qty: "1", rate: "6,500.00", amount: "6,500.00" },
                { desc: "Identity system + guidelines", qty: "1", rate: "12,000.00", amount: "12,000.00" },
                { desc: "Launch assets — 20 social templates", qty: "1", rate: "6,000.00", amount: "6,000.00" },
            ],
            currencyLabel: "USD",
            subtotal: "24,500.00",
            taxLabel: "Sales Tax —",
            taxAmount: "0.00",
            total: "$ 24,500.00",
            footerNote: "50% on signing · 50% on delivery · Net-15",
        },
    },
    {
        id: "lawyers",
        label: "Lawyers",
        title: "Precision legal drafting",
        desc: "The accuracy is astounding. It handles legal terminology perfectly and formats contracts exactly how you need them.",
        chat: {
            prompt: "Draft a mutual NDA between Harwood Legal and BlueStone Ventures, 3 years, Delaware law",
            reply: "NDA drafted — mutual confidentiality, 3-year term, Delaware governing law.",
        },
        doc: {
            kind: "contract",
            brand: "Harwood Legal LLP",
            number: "NDA-2026-018",
            date: "12 May 2026",
            title: "NON-DISCLOSURE AGREEMENT",
            fromName: "Harwood Legal LLP",
            fromMeta: "Wilmington, DE · Attorneys at law",
            toName: "BlueStone Ventures",
            toMeta: "General counsel · legal@bluestone.vc",
            items: [
                { desc: "1. Confidential Information — scope and protections", qty: "—", rate: "—", amount: "—" },
                { desc: "2. Permitted Use — evaluation of partnership only", qty: "—", rate: "—", amount: "—" },
                { desc: "3. Term — 3 years from effective date", qty: "—", rate: "—", amount: "—" },
                { desc: "4. Governing Law — State of Delaware, USA", qty: "—", rate: "—", amount: "—" },
            ],
            currencyLabel: "",
            subtotal: "",
            taxLabel: "",
            taxAmount: "",
            total: "Ready to sign",
            footerNote: "Both parties · E-signature enabled",
        },
    },
    {
        id: "developers",
        label: "Developers",
        title: "Docs that write themselves",
        desc: "Describe your project scope, deliverables, and terms. Clorefy generates polished proposals and contracts instantly.",
        chat: {
            prompt: "Fixed-fee SOW for Finova web app, Next.js + Supabase + Stripe, $18k",
            reply: "Statement of Work drafted — milestones, payment schedule, and IP terms included.",
        },
        doc: {
            kind: "contract",
            brand: "Kai · Remote Engineering",
            number: "SOW-2026-09",
            date: "12 May 2026",
            title: "STATEMENT OF WORK",
            fromName: "Kai Dev",
            fromMeta: "Remote · ABN 12 345 678 901",
            toName: "Finova Labs",
            toMeta: "CTO · cto@finova.io",
            items: [
                { desc: "Auth + account system (Supabase)", qty: "1", rate: "4,500.00", amount: "4,500.00" },
                { desc: "Dashboard + core product flows", qty: "1", rate: "6,500.00", amount: "6,500.00" },
                { desc: "Billing + Stripe integration", qty: "1", rate: "4,000.00", amount: "4,000.00" },
                { desc: "QA, deployment, handover", qty: "1", rate: "3,000.00", amount: "3,000.00" },
            ],
            currencyLabel: "USD",
            subtotal: "18,000.00",
            taxLabel: "Tax —",
            taxAmount: "0.00",
            total: "$ 18,000.00",
            footerNote: "40% start · 30% beta · 30% ship",
        },
    },
    {
        id: "sales",
        label: "Sales",
        title: "Close deals with speed",
        desc: "Send customized proposals right after a discovery call while the lead is hot.",
        chat: {
            prompt: "Quote Pinnacle Retail: 50 seats, annual, Net-30",
            reply: "Quotation generated — annual plan with SSO and priority support.",
        },
        doc: {
            kind: "quotation",
            brand: "Ravi · North Sales",
            number: "QT-2026-214",
            date: "12 May 2026",
            title: "QUOTATION",
            fromName: "Northwind Software",
            fromMeta: "Enterprise Sales · GSTIN 07AAACN1234D1Z2",
            toName: "Pinnacle Retail Ltd.",
            toMeta: "Procurement · ops@pinnacle.co",
            items: [
                { desc: "Enterprise plan — 50 user seats", qty: "50", rate: "600.00", amount: "30,000.00" },
                { desc: "SSO + SAML add-on", qty: "1", rate: "3,600.00", amount: "3,600.00" },
                { desc: "Priority support — 12 months", qty: "1", rate: "2,400.00", amount: "2,400.00" },
            ],
            currencyLabel: "USD",
            subtotal: "36,000.00",
            taxLabel: "Sales Tax —",
            taxAmount: "0.00",
            total: "$ 36,000.00",
            footerNote: "Net-30 · Valid 30 days · 2-week onboarding",
        },
    },
    {
        id: "creators",
        label: "Creators",
        title: "Capture fleeting ideas",
        desc: "Don't let inspiration slip away. Record your creative bursts and get organized project briefs instantly.",
        chat: {
            prompt: "YouTube sponsorship, 4-part series, $8,200, 60 days paid usage",
            reply: "Brief drafted — scope, deliverables, and usage rights laid out.",
        },
        doc: {
            kind: "proposal",
            brand: "Mira · Creator Studio",
            number: "BRIEF-2026-12",
            date: "12 May 2026",
            title: "COLLABORATION BRIEF",
            fromName: "Mira Sen",
            fromMeta: "Creator · hello@mirastudio.com",
            toName: "Sponsor Partner",
            toMeta: "Brand marketing team",
            items: [
                { desc: "4-part mini-series · 8–10 min each", qty: "4", rate: "1,500.00", amount: "6,000.00" },
                { desc: "Short-form clips (12 total)", qty: "12", rate: "150.00", amount: "1,800.00" },
                { desc: "Usage — 60 days paid, 12 months organic", qty: "1", rate: "400.00", amount: "400.00" },
            ],
            currencyLabel: "USD",
            subtotal: "8,200.00",
            taxLabel: "Tax —",
            taxAmount: "0.00",
            total: "$ 8,200.00",
            footerNote: "50% start · 50% on delivery",
        },
    },
    {
        id: "leaders",
        label: "Leaders",
        title: "Communicate with clarity",
        desc: "Turn raw meeting notes into structured investor updates and strategy memos automatically.",
        chat: {
            prompt: "Draft a Q2 investor memo, revenue +42% QoQ, ARR $2.1M, EU expansion plan",
            reply: "Investor memo drafted — structured with metrics, shipped work, and next quarter focus.",
        },
        doc: {
            kind: "proposal",
            brand: "Helix Inc. · CEO",
            number: "MEMO-Q2-2026",
            date: "12 May 2026",
            title: "INVESTOR MEMO",
            fromName: "Helix Inc.",
            fromMeta: "Founder's office · investors@helix.com",
            toName: "Board & Investors",
            toMeta: "Quarterly update",
            items: [
                { desc: "Revenue — +42% QoQ, ARR $2.1M", qty: "—", rate: "—", amount: "—" },
                { desc: "Shipped — AI copilot, payments v2, admin dashboard", qty: "—", rate: "—", amount: "—" },
                { desc: "Next — EU expansion · Series A prep", qty: "—", rate: "—", amount: "—" },
            ],
            currencyLabel: "",
            subtotal: "",
            taxLabel: "",
            taxAmount: "",
            total: "On track",
            footerNote: "Prepared by CEO · Confidential",
        },
    },
    {
        id: "teams",
        label: "Teams",
        title: "Unified document knowledge",
        desc: "Every generated document is stored, searchable, and reusable across your entire organization.",
        chat: {
            prompt: "Create a reusable MSA we can send to all our vendors",
            reply: "Master Services Agreement drafted — clients auto-fill from your shared directory.",
        },
        doc: {
            kind: "contract",
            brand: "Northwind · Ops",
            number: "MSA-2026-01",
            date: "12 May 2026",
            title: "MASTER SERVICES AGREEMENT",
            fromName: "Northwind Software",
            fromMeta: "Operations · ops@northwind.com",
            toName: "{{ vendor.name }}",
            toMeta: "Auto-fills from client directory",
            items: [
                { desc: "Scope of services & deliverables", qty: "—", rate: "—", amount: "—" },
                { desc: "Payment terms — Net-30 unless agreed", qty: "—", rate: "—", amount: "—" },
                { desc: "Confidentiality & IP ownership", qty: "—", rate: "—", amount: "—" },
                { desc: "Term, termination & dispute resolution", qty: "—", rate: "—", amount: "—" },
            ],
            currencyLabel: "",
            subtotal: "",
            taxLabel: "",
            taxAmount: "",
            total: "Shared template",
            footerNote: "14 vendors signed this month · Ops + Legal only",
        },
    },
]

function DocumentPreviewCard({ persona }: { persona: Persona }) {
    const d = persona.doc
    const hasTable = d.currencyLabel !== ""
    return (
        <div className="h-full flex flex-col bg-white">
            {/* Page */}
            <div className="flex-1 flex flex-col p-5 sm:p-6 min-h-0">
                {/* Doc header: brand + ref */}
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-stone-200">
                    <div className="min-w-0">
                        <div className="text-[8.5px] font-bold uppercase tracking-[0.18em] text-stone-400 mb-1 truncate">
                            {d.brand}
                        </div>
                        <div className="font-serif text-[15px] sm:text-[17px] font-bold text-[#1C1A17] tracking-tight leading-tight truncate">
                            {d.title}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-[8.5px] uppercase tracking-wider text-stone-400">Ref</div>
                        <div className="text-[10px] font-mono font-semibold text-stone-700">{d.number}</div>
                        <div className="text-[9px] text-stone-400 mt-0.5">{d.date}</div>
                    </div>
                </div>

                {/* From / To */}
                <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="min-w-0">
                        <div className="text-[8.5px] uppercase tracking-wider text-stone-400 mb-1">From</div>
                        <div className="text-[11px] font-semibold text-[#1C1A17] truncate">{d.fromName}</div>
                        <div className="text-[9.5px] text-stone-500 leading-snug truncate">{d.fromMeta}</div>
                    </div>
                    <div className="min-w-0">
                        <div className="text-[8.5px] uppercase tracking-wider text-stone-400 mb-1">To</div>
                        <div className="text-[11px] font-semibold text-[#1C1A17] truncate">{d.toName}</div>
                        <div className="text-[9.5px] text-stone-500 leading-snug truncate">{d.toMeta}</div>
                    </div>
                </div>

                {/* Items table or clause list */}
                <div className="mt-3.5 flex-1 min-h-0">
                    {hasTable ? (
                        <>
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_32px_72px_80px] gap-2 px-2 py-1.5 rounded-md bg-stone-50 border border-stone-200">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Description</div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500 text-right">Qty</div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500 text-right">Rate</div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500 text-right">Amount</div>
                            </div>
                            <div className="divide-y divide-stone-100">
                                {d.items.map((it, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_32px_72px_80px] gap-2 px-2 py-2 items-start">
                                        <div className="text-[10.5px] text-stone-700 leading-snug">{it.desc}</div>
                                        <div className="text-[10.5px] text-stone-500 text-right tabular-nums">{it.qty}</div>
                                        <div className="text-[10.5px] text-stone-500 text-right tabular-nums">{it.rate}</div>
                                        <div className="text-[10.5px] text-stone-800 text-right tabular-nums font-medium">{it.amount}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2 px-0.5">
                            {d.items.map((it, idx) => (
                                <div key={idx} className="text-[11px] text-stone-700 leading-snug">
                                    {it.desc}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Totals / status */}
                <div className="mt-3 pt-3 border-t border-stone-200 flex justify-end">
                    <div className="w-full max-w-[220px] space-y-1.5">
                        {hasTable && (
                            <>
                                <div className="flex justify-between text-[10.5px] text-stone-500">
                                    <span>Subtotal</span>
                                    <span className="tabular-nums">{d.subtotal}</span>
                                </div>
                                <div className="flex justify-between text-[10.5px] text-stone-500">
                                    <span>{d.taxLabel}</span>
                                    <span className="tabular-nums">{d.taxAmount}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between items-baseline pt-2 border-t border-stone-200">
                            <span className="text-[9px] uppercase tracking-wider text-stone-400 font-semibold">
                                {hasTable ? "Total" : "Status"}
                            </span>
                            <span className="font-serif text-[14px] font-bold text-[#1C1A17] tabular-nums">{d.total}</span>
                        </div>
                    </div>
                </div>

                {/* Footer note */}
                <div className="mt-2.5 text-[9px] text-stone-400 text-center leading-relaxed">
                    {d.footerNote}
                </div>
            </div>
        </div>
    )
}

export function PersonaTabs() {
    const [active, setActive] = useState(0)
    const current = personas[active]

    return (
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-[1400px] mx-auto bg-[var(--landing-dark)] rounded-[2.5rem] sm:rounded-[3.5rem] p-8 sm:p-14 lg:p-20 relative overflow-hidden shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] border-[3px] border-[var(--landing-dark)]">

                <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">

                    {/* Left side: Content & Pills */}
                    <div className="w-full lg:w-[44%] relative z-10 flex flex-col">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="font-serif text-5xl sm:text-6xl lg:text-7xl font-medium text-[#F4F0EB] mb-4 tracking-tight leading-tight"
                        >
                            Made for the <br /> way <span className="italic text-[#c6a3db]">you</span> work
                        </motion.h2>
                        <p className="text-[var(--landing-text-muted)] text-sm sm:text-base font-semibold tracking-wide uppercase mb-8">
                            Tap a role — see the document Clorefy drafts for them.
                        </p>

                        {/* Persona pills */}
                        <div className="flex flex-wrap gap-2.5 mb-10 max-w-xl">
                            {personas.map((persona, i) => (
                                <button
                                    key={persona.id}
                                    onClick={() => setActive(i)}
                                    className={`px-5 py-2 rounded-full border-[1.5px] text-sm sm:text-base font-bold transition-all duration-300 ${
                                        active === i
                                            ? "bg-white text-[var(--landing-dark)] border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]"
                                            : "bg-transparent text-white border-white/20 hover:border-white/50"
                                    }`}
                                >
                                    {persona.label}
                                </button>
                            ))}
                        </div>

                        {/* Persona headline + desc */}
                        <div className="min-h-[140px] relative">
                            <motion.div
                                key={active}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <h3 className="font-serif text-3xl text-white mb-3">{current.title}.</h3>
                                <p className="text-[var(--landing-text-muted)] text-base sm:text-lg mb-6 max-w-md leading-relaxed">
                                    {current.desc}
                                </p>
                            </motion.div>

                            <Link
                                href="/auth/signup"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#f1d0f5] text-[var(--landing-dark)] font-bold text-sm sm:text-base transition-all hover:-translate-y-0.5 active:translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(241,208,245,0.5)]"
                            >
                                Get Started Free
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>

                    {/* Right side: Actual platform mockup — chat + document preview */}
                    <div className="w-full lg:w-[56%]">
                        <div className="relative rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-2xl">
                            {/* Window chrome — matches the app's split layout */}
                            <div className="h-9 border-b border-stone-200 bg-[#fbfbfa] flex items-center px-3.5 gap-2 shrink-0">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                                </div>
                                <motion.div
                                    key={current.id + "-url"}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex-1 flex justify-center"
                                >
                                    <div className="text-[10.5px] font-mono text-stone-400 truncate max-w-[70%]">
                                        clorefy.com · {current.doc.kind}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Split pane — chat left · document preview right */}
                            <motion.div
                                key={current.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                className="grid grid-cols-[40%_60%] h-[420px] sm:h-[480px]"
                            >
                                    {/* Chat panel */}
                                    <div className="flex flex-col bg-[#fbfbfa] border-r border-stone-200 min-w-0">
                                        <div className="px-3.5 py-2.5 border-b border-stone-200 flex items-center gap-2 shrink-0">
                                            <div className="w-5 h-5 rounded-full bg-[#1C1A17] flex items-center justify-center">
                                                <span className="text-white text-[9px] font-bold">C</span>
                                            </div>
                                            <span className="text-[10.5px] font-semibold text-stone-700">Clorefy</span>
                                        </div>

                                        <div className="flex-1 overflow-hidden px-3 py-3 space-y-2.5">
                                            {/* User prompt bubble */}
                                            <div className="flex justify-end">
                                                <div className="max-w-[90%] px-3 py-2 rounded-2xl rounded-br-sm bg-[#1C1A17] text-white text-[10.5px] leading-snug">
                                                    {current.chat.prompt}
                                                </div>
                                            </div>

                                            {/* Status label — no icon */}
                                            <div className="px-1">
                                                <span className="text-[9.5px] font-medium text-stone-500">Drafted from your profile</span>
                                            </div>

                                            {/* AI reply bubble */}
                                            <div className="flex justify-start">
                                                <div className="max-w-[95%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white border border-stone-200 text-[10.5px] text-stone-700 leading-snug">
                                                    {current.chat.reply}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mock input */}
                                        <div className="px-3 py-2.5 border-t border-stone-200 shrink-0">
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-stone-200 bg-white">
                                                <div className="flex-1 text-[10px] text-stone-400">Ask Clorefy anything…</div>
                                                <div className="w-5 h-5 rounded-full bg-[var(--landing-amber)] flex items-center justify-center">
                                                    <ArrowRight size={10} className="text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Document preview panel */}
                                    <div className="bg-[#f4f3ef] p-3 sm:p-4 min-w-0 overflow-hidden">
                                        <div className="h-full rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden">
                                            <DocumentPreviewCard persona={current} />
                                        </div>
                                    </div>
                            </motion.div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    )
}
