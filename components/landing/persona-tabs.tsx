"use client"

import { motion, AnimatePresence, MotionConfig } from "framer-motion"
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
        title: "Professional docs from day one",
        desc: "Generate compliant freelance invoices, internship contracts, and project proposals — no templates to fill, no tax rules to look up. Free tier included.",
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
        title: "Stop juggling 5 tools that don't talk to each other",
        desc: "Generate proposals, SOWs, contracts, and invoices from one prompt. No more copying client details between HoneyBook, Google Docs, and your payment processor.",
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
        title: "Precision legal drafting, fast",
        desc: "Draft NDAs, service contracts, and engagement letters with jurisdiction-specific clauses and e-signature built in. No Word template hunting, no formatting work.",
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
        title: "Ship code, not paperwork",
        desc: "Describe your project scope and Clorefy generates the SOW, contract, or invoice — with the right tax rules for your client's country, payment terms, and IP clauses included.",
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
        title: "Close deals faster",
        desc: "Generate quotes and proposals immediately after a discovery call. Client details auto-pulled from your profile, the right tax rates applied, ready to send.",
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
        title: "Get paid for your creative work",
        desc: "Invoice brands, generate sponsorship contracts, and send payment follow-ups — so you spend time creating, not chasing payments or figuring out tax.",
        chat: {
            prompt: "Invoice TechBrand $8,200 for 4 YouTube integrations, net-30",
            reply: "Done — invoice INV-2026-042 ready with payment link attached.",
        },
        doc: {
            kind: "invoice",
            brand: "Mira Sen · Creator",
            number: "INV-2026-042",
            date: "12 May 2026",
            title: "INVOICE",
            fromName: "Mira Sen",
            fromMeta: "Creator · hello@mirastudio.com",
            toName: "TechBrand Agency",
            toMeta: "Brand partnerships · brand@techbrand.io",
            items: [
                { desc: "YouTube integration — 4 × 60-sec mid-roll", qty: "4", rate: "1,500.00", amount: "6,000.00" },
                { desc: "Paid media repurpose rights — 60 days", qty: "1", rate: "1,800.00", amount: "1,800.00" },
                { desc: "Instagram stories — 3 posts per video", qty: "12", rate: "33.33", amount: "400.00" },
            ],
            currencyLabel: "USD",
            subtotal: "8,200.00",
            taxLabel: "Tax —",
            taxAmount: "0.00",
            total: "$ 8,200.00",
            footerNote: "Net-30 · Wire / PayPal accepted",
        },
    },
    {
        id: "consultants",
        label: "Consultants",
        title: "From scoping call to signed contract",
        desc: "Generate service agreements, project proposals, and change orders from one prompt. Tax rules for your client's country are applied automatically.",
        chat: {
            prompt: "Brand strategy retainer for Nexus Group, 3 months, £4,500/mo",
            reply: "Service agreement drafted — retainer scope, monthly terms, and confidentiality clause included.",
        },
        doc: {
            kind: "contract",
            brand: "Priya M. · Strategy",
            number: "CTR-2026-014",
            date: "12 May 2026",
            title: "SERVICE AGREEMENT",
            fromName: "Priya Mehta Consulting",
            fromMeta: "London, UK · VAT GB 123456789",
            toName: "Nexus Group",
            toMeta: "Strategy team · ops@nexusgroup.co.uk",
            items: [
                { desc: "1. Scope — brand positioning, market research, go-to-market strategy", qty: "—", rate: "—", amount: "—" },
                { desc: "2. Term — 3 months rolling, 30-day notice to terminate", qty: "—", rate: "—", amount: "—" },
                { desc: "3. Fees — £4,500/month, invoiced on the 1st of each month", qty: "—", rate: "—", amount: "—" },
                { desc: "4. IP & Confidentiality — all deliverables assigned to client on full payment", qty: "—", rate: "—", amount: "—" },
            ],
            currencyLabel: "",
            subtotal: "",
            taxLabel: "",
            taxAmount: "",
            total: "Ready to sign",
            footerNote: "E-signature enabled · UK law · 14 days to countersign",
        },
    },
    {
        id: "teams",
        label: "Teams",
        title: "Consistent documents across your whole team",
        desc: "Everyone generates invoices, contracts, and proposals in the same format — no version chaos, no copying client details between tools.",
        chat: {
            prompt: "MSA for our software dev services, Net-30, annual renewal, Delaware law",
            reply: "Master Services Agreement drafted — scope, payment, IP ownership, and renewal terms included.",
        },
        doc: {
            kind: "contract",
            brand: "Northwind · Ops",
            number: "MSA-2026-01",
            date: "12 May 2026",
            title: "MASTER SERVICES AGREEMENT",
            fromName: "Northwind Software",
            fromMeta: "Operations · ops@northwind.com",
            toName: "Enterprise Client",
            toMeta: "Procurement team",
            items: [
                { desc: "1. Scope of services & deliverables definition", qty: "—", rate: "—", amount: "—" },
                { desc: "2. Payment terms — Net-30, monthly invoicing cycle", qty: "—", rate: "—", amount: "—" },
                { desc: "3. IP ownership — all work product assigned on full payment", qty: "—", rate: "—", amount: "—" },
                { desc: "4. Term — 1 year, auto-renews unless cancelled 30 days prior", qty: "—", rate: "—", amount: "—" },
            ],
            currencyLabel: "",
            subtotal: "",
            taxLabel: "",
            taxAmount: "",
            total: "Ready to sign",
            footerNote: "E-signature enabled · Delaware law · Both parties",
        },
    },
]

function DocumentPreviewCard({ persona }: { persona: Persona }) {
    const d = persona.doc
    const hasTable = d.currencyLabel !== ""
    return (
        <div className="h-full flex flex-col bg-white">
            {/* Page */}
            <div className="flex-1 flex flex-col p-4 sm:p-6 min-h-0">
                {/* Doc header: brand + ref */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
                    <div className="min-w-0">
                        <div className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-stone-400 mb-1 truncate">
                            {d.brand}
                        </div>
                        <div className="font-serif text-[14px] sm:text-[17px] font-bold text-[#1C1A17] tracking-tight leading-tight truncate">
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
                <div className="grid grid-cols-2 gap-3 mt-3">
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
                <div className="mt-3 flex-1 min-h-0">
                    {hasTable ? (
                        <>
                            {/* Table header — responsive: hide Qty/Rate on narrow widths */}
                            <div className="grid grid-cols-[1fr_70px] sm:grid-cols-[1fr_32px_72px_80px] gap-2 px-2 py-1.5 rounded-md bg-stone-50 border border-stone-200">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Description</div>
                                <div className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-stone-500 text-right">Qty</div>
                                <div className="hidden sm:block text-[9px] font-bold uppercase tracking-wider text-stone-500 text-right">Rate</div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500 text-right">Amount</div>
                            </div>
                            <div className="divide-y divide-stone-100">
                                {d.items.map((it, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_70px] sm:grid-cols-[1fr_32px_72px_80px] gap-2 px-2 py-2 items-start">
                                        <div className="text-[10.5px] text-stone-700 leading-snug">{it.desc}</div>
                                        <div className="hidden sm:block text-[10.5px] text-stone-500 text-right tabular-nums">{it.qty}</div>
                                        <div className="hidden sm:block text-[10.5px] text-stone-500 text-right tabular-nums">{it.rate}</div>
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

    // Shared smooth easing — long, gentle, no jitter
    const EASE = [0.22, 1, 0.36, 1] as const
    const DUR_IN = 0.55
    const DUR_OUT = 0.35
    const LAYOUT_SPRING = { type: "spring" as const, stiffness: 220, damping: 32, mass: 0.9 }

    return (
        <MotionConfig reducedMotion="user">
        <section className="py-12 sm:py-24 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
            <div className="max-w-[1400px] mx-auto bg-[var(--landing-dark)] rounded-[1.75rem] sm:rounded-[3.5rem] p-5 sm:p-14 lg:p-20 relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] sm:shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] border-[2px] sm:border-[3px] border-[var(--landing-dark)]">

                <div className="flex flex-col xl:flex-row gap-8 xl:gap-16 items-start">

                    {/* Left side: Content & Pills */}
                    <div className="w-full xl:w-[44%] relative z-10 flex flex-col">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="font-serif text-[2.5rem] leading-[1.02] sm:text-5xl lg:text-6xl xl:text-7xl font-medium text-[#F4F0EB] mb-3 sm:mb-4 tracking-tight"
                        >
                            Made for the way <span className="italic text-[#c6a3db]">you</span> work
                        </motion.h2>
                        <p className="text-[var(--landing-text-muted)] text-[11px] sm:text-[13px] font-semibold tracking-wide uppercase mb-6 sm:mb-8">
                            Tap a role — see the doc we draft.
                        </p>

                        {/* Persona pills — sliding active indicator via layoutId */}
                        <div className="flex flex-wrap gap-2 sm:gap-2.5 mb-6 sm:mb-10 max-w-xl">
                            {personas.map((persona, i) => (
                                <button
                                    key={persona.id}
                                    onClick={() => setActive(i)}
                                    aria-pressed={active === i}
                                    className={`relative px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full border-[1.5px] text-[13px] sm:text-base font-bold transition-colors duration-300 ${
                                        active === i
                                            ? "text-[var(--landing-dark)] border-white"
                                            : "bg-transparent text-white border-white/20 hover:border-white/50"
                                    }`}
                                >
                                    {active === i && (
                                        <motion.span
                                            layoutId="persona-active-pill"
                                            className="absolute inset-0 bg-white rounded-full shadow-[2px_2px_0px_0px_rgba(255,255,255,0.3)]"
                                            transition={LAYOUT_SPRING}
                                        />
                                    )}
                                    <span className="relative z-10">{persona.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Persona headline + desc — soft cross-fade with popLayout */}
                        <motion.div
                            layout
                            transition={LAYOUT_SPRING}
                            className="relative min-h-[120px] sm:min-h-[160px]"
                        >
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.div
                                    key={active}
                                    initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, y: -8, filter: "blur(6px)", transition: { duration: DUR_OUT, ease: EASE } }}
                                    transition={{ duration: DUR_IN, ease: EASE, delay: 0.05 }}
                                >
                                    <h3 className="font-serif text-2xl sm:text-3xl text-white mb-2 sm:mb-3">{current.title}.</h3>
                                    <p className="text-[var(--landing-text-muted)] text-[14px] sm:text-lg mb-5 sm:mb-6 max-w-md leading-relaxed">
                                        {current.desc}
                                    </p>
                                </motion.div>
                            </AnimatePresence>

                            <Link
                                href="/auth/signup"
                                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[#f1d0f5] text-[var(--landing-dark)] font-bold text-sm sm:text-base transition-all hover:-translate-y-0.5 active:translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(241,208,245,0.5)]"
                            >
                                Get Started Free
                                <ArrowRight size={16} />
                            </Link>
                        </motion.div>
                    </div>

                    {/* Right side: Actual platform mockup — chat + document preview */}
                    <div className="w-full xl:w-[56%] relative">
                        <motion.div
                            layout
                            transition={LAYOUT_SPRING}
                            className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-2xl"
                        >
                            {/* Window chrome — matches the app's split layout */}
                            <div className="h-8 sm:h-9 border-b border-stone-200 bg-[#fbfbfa] flex items-center px-3 sm:px-3.5 gap-2 shrink-0">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#ff5f57]" />
                                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#febc2e]" />
                                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#28c840]" />
                                </div>
                                <div className="flex-1 flex justify-center">
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        <motion.div
                                            key={current.id + "-url"}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4, transition: { duration: 0.25, ease: EASE } }}
                                            transition={{ duration: 0.45, ease: EASE }}
                                            className="text-[9.5px] sm:text-[10.5px] font-mono text-stone-400 truncate max-w-[80%]"
                                        >
                                            clorefy.com · {current.doc.kind}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Split pane — stacked flex on mobile (strip + doc), 2-col grid on md+ */}
                            <div className="flex flex-col md:grid md:grid-cols-[40%_60%] h-[460px] sm:h-[480px]">
                                {/* Chat panel — md+ only */}
                                <div className="hidden md:flex flex-col bg-[#fbfbfa] border-r border-stone-200 min-w-0">
                                    <div className="px-3.5 py-2.5 border-b border-stone-200 flex items-center gap-2 shrink-0">
                                        <div className="w-5 h-5 rounded-full bg-[#1C1A17] flex items-center justify-center">
                                            <span className="text-white text-[9px] font-bold">C</span>
                                        </div>
                                        <span className="text-[10.5px] font-semibold text-stone-700">Clorefy</span>
                                    </div>

                                    <div className="flex-1 overflow-hidden px-3 py-3 relative">
                                        <AnimatePresence mode="popLayout" initial={false}>
                                            <motion.div
                                                key={current.id + "-chat"}
                                                initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                                exit={{ opacity: 0, y: -8, filter: "blur(6px)", transition: { duration: DUR_OUT, ease: EASE } }}
                                                transition={{ duration: DUR_IN, ease: EASE, delay: 0.08 }}
                                                className="space-y-2.5"
                                            >
                                                {/* User prompt bubble */}
                                                <div className="flex justify-end">
                                                    <div className="max-w-[90%] px-3 py-2 rounded-2xl rounded-br-sm bg-[#1C1A17] text-white text-[10.5px] leading-snug">
                                                        {current.chat.prompt}
                                                    </div>
                                                </div>

                                                {/* Status label */}
                                                <div className="px-1">
                                                    <span className="text-[9.5px] font-medium text-stone-500">Drafted from your profile</span>
                                                </div>

                                                {/* AI reply bubble */}
                                                <div className="flex justify-start">
                                                    <div className="max-w-[95%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white border border-stone-200 text-[10.5px] text-stone-700 leading-snug">
                                                        {current.chat.reply}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </AnimatePresence>
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

                                {/* Mobile/Tablet: compact chat prompt strip above the doc */}
                                <div className="md:hidden flex items-start gap-2 px-3 py-2.5 border-b border-stone-200 bg-[#fbfbfa] shrink-0">
                                    <div className="w-5 h-5 rounded-full bg-[#1C1A17] flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="text-white text-[9px] font-bold">C</span>
                                    </div>
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        <motion.div
                                            key={current.id + "-mobile-chat"}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4, transition: { duration: 0.25, ease: EASE } }}
                                            transition={{ duration: 0.45, ease: EASE }}
                                            className="flex-1 min-w-0 text-[11px] text-stone-600 leading-snug line-clamp-2"
                                        >
                                            <span className="font-semibold text-stone-700">You:</span> {current.chat.prompt}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Document preview panel — full width on mobile */}
                                <div className="flex-1 min-h-0 bg-[#f4f3ef] p-3 sm:p-4 min-w-0 overflow-hidden relative">
                                    <div className="h-full rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden relative">
                                        <AnimatePresence mode="popLayout" initial={false}>
                                            <motion.div
                                                key={current.id + "-doc"}
                                                initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                                exit={{ opacity: 0, y: -10, filter: "blur(8px)", transition: { duration: DUR_OUT, ease: EASE } }}
                                                transition={{ duration: DUR_IN + 0.05, ease: EASE, delay: 0.12 }}
                                                className="absolute inset-0"
                                            >
                                                <DocumentPreviewCard persona={current} />
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                </div>
            </div>
        </section>
        </MotionConfig>
    )
}
