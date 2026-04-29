"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

const BG = "#FFFFFF"
const DARK = "#09090B" // Zinc 950
const MUTED = "#71717A" // Zinc 500
const BORDER = "#E4E4E7" // Zinc 200
const HIGHLIGHT_BG = "#F4F4F5" // Zinc 100

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck({ highlight }: { highlight?: boolean }) {
  const color = highlight ? DARK : "#52525B"
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill={color} fillOpacity={highlight ? "0.1" : "0.05"} />
      <path d="M6 10L8.5 12.5L14 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M7 7L13 13M13 7L7 13" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconPartial() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#71717A" fillOpacity="0.05" />
      <path d="M6.5 10H13.5" stroke="#71717A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function DocSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function GlobeSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function DesignSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m2 12 10-10" />
      <path d="m2 12 10 10" />
      <path d="m12 2 10 10" />
    </svg>
  )
}

function ValueSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

type Val = true | false | "partial" | string

interface Row {
  label: string
  sub?: string
  clorefy: Val
  freshbooks: Val
  quickbooks: Val
  bonsai: Val
}

interface Section {
  title: string
  icon: React.ReactNode
  rows: Row[]
}

const SECTIONS: Section[] = [
  {
    title: "Document Generation",
    icon: <DocSvg />,
    rows: [
      { label: "Invoices", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Contracts", sub: "AI-generated in seconds", clorefy: true, freshbooks: false, quickbooks: false, bonsai: true },
      { label: "Quotations & Estimates", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Business Proposals", sub: "AI-generated in seconds", clorefy: true, freshbooks: false, quickbooks: false, bonsai: true },
      { label: "AI from plain text", sub: "Just describe what you need", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Conversational editing", sub: "Edit by chatting with AI", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "No manual form filling", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
    ],
  },
  {
    title: "Tax & Compliance",
    icon: <GlobeSvg />,
    rows: [
      { label: "India GST", sub: "CGST / SGST / IGST auto-applied", clorefy: true, freshbooks: false, quickbooks: "partial", bonsai: false },
      { label: "US Sales Tax", sub: "All 50 states", clorefy: true, freshbooks: true, quickbooks: true, bonsai: false },
      { label: "UK VAT", clorefy: true, freshbooks: true, quickbooks: true, bonsai: false },
      { label: "EU VAT", sub: "Germany, France, Netherlands", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Canada GST / HST / QST", clorefy: true, freshbooks: true, quickbooks: true, bonsai: false },
      { label: "Australia GST (ABN)", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Singapore & UAE VAT", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Auto tax rate detection", sub: "Based on country + registration", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
    ],
  },
  {
    title: "Export & Design",
    icon: <DesignSvg />,
    rows: [
      { label: "PDF export", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Word (.docx) export", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Image export (PNG / JPG)", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Templates", clorefy: "9 designs", freshbooks: "Limited", quickbooks: "Limited", bonsai: "Limited" },
      { label: "Custom logo & branding", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Digital e-signatures", clorefy: true, freshbooks: "partial", quickbooks: false, bonsai: true },
    ],
  },
  {
    title: "Pricing & Value",
    icon: <ValueSvg />,
    rows: [
      { label: "Free plan", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Starting price / month", clorefy: "$9", freshbooks: "$21", quickbooks: "$38", bonsai: "$15" },
      { label: "No client limits", sub: "FreshBooks Lite: 5 clients max", clorefy: true, freshbooks: false, quickbooks: true, bonsai: true },
      { label: "No accounting required", clorefy: true, freshbooks: false, quickbooks: false, bonsai: true },
      { label: "Payment reminders", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Online payment links", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
    ],
  },
]

// ─── Cell ─────────────────────────────────────────────────────────────────────

function Cell({ val, highlight }: { val: Val; highlight?: boolean }) {
  if (val === true) return <div className="flex justify-center"><IconCheck highlight={highlight} /></div>
  if (val === false) return <div className="flex justify-center"><IconX /></div>
  if (val === "partial") return <div className="flex justify-center"><IconPartial /></div>
  return (
    <div className="flex justify-center">
      <span
        className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
        style={highlight
          ? { backgroundColor: DARK, color: "#FFFFFF" }
          : { backgroundColor: HIGHLIGHT_BG, color: MUTED }
        }
      >
        {val}
      </span>
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

function SectionBlock({ section, index }: { section: Section; index: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 border-b"
        style={{ borderColor: BORDER, backgroundColor: "#FAFAFA" }}
      >
        <div className="text-zinc-600 flex items-center justify-center p-1.5 rounded-md bg-white border border-zinc-200 shadow-sm">
            {section.icon}
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-800">
          {section.title}
        </span>
      </div>

      {/* Rows */}
      {section.rows.map((row, i) => (
        <div
          key={row.label}
          className="grid items-center min-h-[52px]"
          style={{
            gridTemplateColumns: "minmax(220px, 2.5fr) 1fr 1fr 1fr 1fr",
            borderBottom: i < section.rows.length - 1 ? `1px solid ${BORDER}` : undefined,
            backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
          }}
        >
          {/* Feature label (Sticky on mobile if scrolling horizontally) */}
          <div className="px-5 py-3.5 sticky left-0 z-10" style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
            <p className="text-sm font-medium leading-snug" style={{ color: DARK }}>{row.label}</p>
            {row.sub && (
              <p className="text-[11px] mt-0.5 leading-snug text-zinc-500">{row.sub}</p>
            )}
          </div>

          {/* Clorefy */}
          <div
            className="px-3 py-3.5 border-l h-full flex items-center bg-zinc-50/50"
            style={{ borderColor: BORDER }}
          >
            <Cell val={row.clorefy} highlight />
          </div>

          {/* Competitors */}
          {(["freshbooks", "quickbooks", "bonsai"] as const).map((key, idx) => (
            <div key={key} className="px-3 py-3.5 border-l h-full flex items-center" style={{ borderColor: BORDER }}>
              <Cell val={row[key]} />
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ComparisonTable() {
  const headerRef = useRef(null)
  const headerInView = useInView(headerRef, { once: true, margin: "-40px" })

  const competitors = [
    { name: "FreshBooks", price: "$21/mo" },
    { name: "QuickBooks", price: "$38/mo" },
    { name: "Bonsai", price: "$15/mo" },
  ]

  return (
    <section style={{ backgroundColor: BG }} className="py-24 sm:py-32 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 shadow-sm"
            style={{ backgroundColor: DARK, color: "#FFFFFF" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill="#FFFFFF" />
            </svg>
            Why Clorefy wins
          </div>

          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.1] mb-6 text-zinc-900">
            Built for documents,<br />
            <span className="font-serif italic text-zinc-500">not accounting</span>
          </h2>

          <p className="text-base leading-relaxed max-w-xl mx-auto text-zinc-500">
            FreshBooks starts at <strong className="text-zinc-900 font-semibold">$21/mo</strong>, QuickBooks at <strong className="text-zinc-900 font-semibold">$38/mo</strong>, Bonsai at <strong className="text-zinc-900 font-semibold">$15/mo</strong> — none have AI generation or 11-country tax compliance.
            Clorefy starts at <strong className="text-zinc-900 font-semibold">$9/mo</strong> with a free plan.
          </p>
        </motion.div>

        {/* Mobile Horizontal Scroll Container */}
        <div className="overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="min-w-[800px]">

            {/* Column headers */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={headerInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid mb-3 rounded-2xl overflow-hidden border shadow-sm"
              style={{ gridTemplateColumns: "minmax(220px, 2.5fr) 1fr 1fr 1fr 1fr", borderColor: BORDER, backgroundColor: "#FFFFFF" }}
            >
              <div className="px-5 py-4 flex items-end bg-white">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Feature</span>
              </div>

              {/* Clorefy */}
              <div
                className="px-3 py-4 border-l flex flex-col items-center justify-center gap-1.5"
                style={{ borderColor: BORDER, backgroundColor: "#FAFAFA" }}
              >
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z" fill={DARK} />
                  </svg>
                  <span className="text-sm font-bold" style={{ color: DARK }}>Clorefy</span>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: DARK }}>
                  from $9/mo
                </span>
              </div>

              {competitors.map(c => (
                <div key={c.name} className="px-3 py-4 border-l flex flex-col items-center justify-center gap-1 bg-white" style={{ borderColor: BORDER }}>
                  <span className="text-sm font-semibold text-center text-zinc-600">{c.name}</span>
                  <span className="text-[11px] text-zinc-400">{c.price}</span>
                </div>
              ))}
            </motion.div>

            {/* Legend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={headerInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex items-center justify-end gap-5 mb-5"
            >
              {[
                { icon: <IconCheck />, label: "Included" },
                { icon: <IconPartial />, label: "Partial / Add-on" },
                { icon: <IconX />, label: "Not available" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center">{icon}</div>
                  <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
                </div>
              ))}
            </motion.div>

            {/* Sections */}
            <div className="space-y-4">
              {SECTIONS.map((section, i) => (
                <SectionBlock key={section.title} section={section} index={i} />
              ))}
            </div>
            
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs mt-6 text-zinc-400">
          FreshBooks from $21/mo (Lite). QuickBooks from $38/mo (Simple Start). Bonsai from $15/mo. Prices verified April 2026.
        </p>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm mb-4 text-zinc-500">Free plan · No credit card · Cancel anytime</p>
          <a
            href="/auth/signup"
            className="inline-flex items-center gap-3 px-8 py-3.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97] shadow-md hover:shadow-lg"
            style={{ backgroundColor: DARK }}
          >
            Start free — no card needed
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

      </div>
    </section>
  )
}
