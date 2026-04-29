"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

const BG = "#FBF7F0"
const DARK = "#121211"
const MUTED = "#7A7266"
const BORDER = "#E8DDD0"
const HIGHLIGHT_BG = "#F5EDE0"
const AMBER = "#C67A3C"
const GREEN = "#143326"

// ─── SVGs & Illustrations ────────────────────────────────────────────────────────

function IconCheck({ highlight }: { highlight?: boolean }) {
  const color = highlight ? AMBER : GREEN
  const opacity = highlight ? "0.15" : "0.06"
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill={color} fillOpacity={opacity} />
      <path d="M6 10.5L8.5 13L14 6.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#EF4444" fillOpacity="0.08" />
      <path d="M7 7L13 13M13 7L7 13" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconPartial() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#F59E0B" fillOpacity="0.1" />
      <path d="M6.5 10H13.5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// 1. Document Generation: Depicts AI creating a rich document
function DocSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="20" height="24" rx="3" fill="#E8A96A" fillOpacity="0.2"/>
      <path d="M6 10H16" stroke="#C67A3C" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 4V10H26" stroke="#C67A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="11" y1="16" x2="21" y2="16" stroke="#121211" strokeWidth="2" strokeLinecap="round"/>
      <line x1="11" y1="21" x2="17" y2="21" stroke="#121211" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="24" cy="24" r="6" fill="#143326"/>
      <path d="M24 20V28M20 24H28" stroke="#FBF7F0" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

// 2. Tax & Compliance: Depicts global reach and checked security
function GlobeSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="12" fill="#E8A96A" fillOpacity="0.2" stroke="#121211" strokeWidth="2"/>
      <ellipse cx="16" cy="16" rx="6" ry="12" stroke="#121211" strokeWidth="2"/>
      <path d="M4 16H28" stroke="#121211" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="24" cy="24" r="7" fill="#C67A3C"/>
      <path d="M21 24.5L23 26.5L27 21.5" stroke="#FBF7F0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// 3. Export & Design: Depicts a premium layout palette
function DesignSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="24" height="20" rx="4" fill="#143326"/>
      <rect x="8" y="10" width="16" height="12" rx="2" fill="#FBF7F0"/>
      <circle cx="12" cy="16" r="2.5" fill="#C67A3C"/>
      <circle cx="16" cy="16" r="2.5" fill="#121211"/>
      <circle cx="20" cy="16" r="2.5" fill="#E8A96A"/>
    </svg>
  )
}

// 4. Pricing & Value: Depicts a rising ROI chart
function ValueSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="14" width="5" height="14" rx="1.5" fill="#121211"/>
      <rect x="13.5" y="9" width="5" height="19" rx="1.5" fill="#143326"/>
      <rect x="21" y="4" width="5" height="24" rx="1.5" fill="#C67A3C"/>
      <path d="M4 16L12 8L16 12L25 3" stroke="#E8A96A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="25" cy="3" r="3" fill="#E8A96A"/>
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
        className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
        style={highlight
          ? { backgroundColor: AMBER, color: "#FFFFFF", boxShadow: "0 2px 4px rgba(198,122,60,0.2)" }
          : { backgroundColor: "#FFFFFF", color: DARK, border: `1px solid ${BORDER}` }
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
      className="overflow-hidden rounded-2xl border card-depth"
      style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-3.5 px-6 py-4 border-b"
        style={{ borderColor: BORDER, backgroundColor: HIGHLIGHT_BG }}
      >
        <div className="flex items-center justify-center p-1.5 rounded-xl bg-white border shadow-sm" style={{ borderColor: BORDER }}>
            {section.icon}
        </div>
        <span className="text-sm font-bold uppercase tracking-widest" style={{ color: GREEN }}>
          {section.title}
        </span>
      </div>

      {/* Rows */}
      {section.rows.map((row, i) => (
        <div
          key={row.label}
          className="grid items-center min-h-[56px] transition-colors"
          style={{
            gridTemplateColumns: "minmax(220px, 2.5fr) 1fr 1fr 1fr 1fr",
            borderBottom: i < section.rows.length - 1 ? `1px solid ${BORDER}` : undefined,
            backgroundColor: i % 2 === 0 ? "#FFFFFF" : HIGHLIGHT_BG,
          }}
        >
          {/* Feature label (Sticky on mobile if scrolling horizontally) */}
          <div className="px-6 py-4 sticky left-0 z-10" style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : HIGHLIGHT_BG }}>
            <p className="text-sm font-semibold leading-snug" style={{ color: DARK }}>{row.label}</p>
            {row.sub && (
              <p className="text-[11px] mt-1 leading-snug" style={{ color: MUTED }}>{row.sub}</p>
            )}
          </div>

          {/* Clorefy Highlight Column */}
          <div
            className="px-3 py-4 border-l h-full flex items-center relative"
            style={{ 
              borderColor: "rgba(198,122,60,0.2)", 
              backgroundColor: "rgba(198,122,60,0.03)" 
            }}
          >
            <Cell val={row.clorefy} highlight />
          </div>

          {/* Competitors */}
          {(["freshbooks", "quickbooks", "bonsai"] as const).map((key, idx) => (
            <div key={key} className="px-3 py-4 border-l h-full flex items-center" style={{ borderColor: BORDER }}>
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
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest mb-6 shadow-md"
            style={{ backgroundColor: AMBER, color: "#FFFFFF" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            Why Clorefy Wins
          </div>

          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.15] mb-6" style={{ color: DARK }}>
            Built for documents,<br />
            <span className="font-serif italic" style={{ color: AMBER }}>not accounting</span>
          </h2>

          <p className="text-base leading-relaxed max-w-xl mx-auto" style={{ color: MUTED }}>
            FreshBooks starts at <strong className="font-semibold" style={{ color: DARK }}>$21/mo</strong>, QuickBooks at <strong className="font-semibold" style={{ color: DARK }}>$38/mo</strong>, Bonsai at <strong className="font-semibold" style={{ color: DARK }}>$15/mo</strong> — none have AI generation or 11-country tax compliance.
            Clorefy starts at <strong className="font-bold" style={{ color: AMBER }}>$9/mo</strong> with a free plan.
          </p>
        </motion.div>

        {/* Mobile Horizontal Scroll Container */}
        <div className="overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="min-w-[850px]">

            {/* Column headers */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={headerInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid mb-4 rounded-2xl overflow-hidden border shadow-sm"
              style={{ gridTemplateColumns: "minmax(220px, 2.5fr) 1fr 1fr 1fr 1fr", borderColor: BORDER, backgroundColor: "#FFFFFF" }}
            >
              <div className="px-6 py-5 flex items-end">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>Feature Comparison</span>
              </div>

              {/* Clorefy */}
              <div
                className="px-4 py-5 border-l flex flex-col items-center justify-center gap-2 relative"
                style={{ borderColor: "rgba(198,122,60,0.2)", backgroundColor: "rgba(198,122,60,0.05)" }}
              >
                {/* Top border highlight */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: AMBER }} />
                
                <div className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z" fill={AMBER} />
                  </svg>
                  <span className="text-base font-bold" style={{ color: DARK }}>Clorefy</span>
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full shadow-sm" style={{ backgroundColor: AMBER, color: "#FFFFFF" }}>
                  from $9/mo
                </span>
              </div>

              {competitors.map(c => (
                <div key={c.name} className="px-4 py-5 border-l flex flex-col items-center justify-center gap-1.5" style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}>
                  <span className="text-sm font-semibold text-center" style={{ color: DARK }}>{c.name}</span>
                  <span className="text-[12px] font-medium" style={{ color: MUTED }}>{c.price}</span>
                </div>
              ))}
            </motion.div>

            {/* Legend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={headerInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="flex items-center justify-end gap-6 mb-6"
            >
              {[
                { icon: <IconCheck />, label: "Included" },
                { icon: <IconPartial />, label: "Partial / Add-on" },
                { icon: <IconX />, label: "Not available" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
                  <span className="text-xs font-semibold" style={{ color: MUTED }}>{label}</span>
                </div>
              ))}
            </motion.div>

            {/* Sections */}
            <div className="space-y-6">
              {SECTIONS.map((section, i) => (
                <SectionBlock key={section.title} section={section} index={i} />
              ))}
            </div>
            
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-[13px] mt-8" style={{ color: MUTED }}>
          FreshBooks from $21/mo (Lite). QuickBooks from $38/mo (Simple Start). Bonsai from $15/mo. Prices verified April 2026.
        </p>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm mb-4 font-medium" style={{ color: GREEN }}>Free plan · No credit card · Cancel anytime</p>
          <a
            href="/auth/signup"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full text-sm font-bold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97] shadow-lg hover:shadow-xl"
            style={{ backgroundColor: GREEN }}
          >
            Start free — no card needed
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

      </div>
    </section>
  )
}
