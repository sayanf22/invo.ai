"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"

// ─── Brand tokens (matching landing page) ────────────────────────────────────
const CREAM = "#FAF9F5"
const DARK = "#1A1A1A"
const AMBER = "#E07B39"
const MUTED = "#8C8B88"
const BORDER = "#EAE8E4"

// ─── Accurate pricing (verified April 2026) ──────────────────────────────────
// FreshBooks: $21/mo Lite, $38/mo Plus, $65/mo Premium — no free plan
// QuickBooks: $38/mo Simple Start, $75/mo Essentials, $115/mo Plus — no free plan
// Zoho Invoice: Free (invoicing only) — no contracts, proposals, AI
// Clorefy: Free plan + from $9/mo

// ─── SVG icons ───────────────────────────────────────────────────────────────

function IconCheck({ size = 16, color = "#16A34A" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.12" />
      <path d="M4.5 8L7 10.5L11.5 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#EF4444" fillOpacity="0.08" />
      <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconPartial({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#F59E0B" fillOpacity="0.1" />
      <path d="M5 8H11" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

type Val = true | false | "partial" | string

interface Row {
  label: string
  clorefy: Val
  freshbooks: Val
  quickbooks: Val
  bonsai: Val
  note?: string
}

interface Section {
  title: string
  icon: string
  rows: Row[]
}

const SECTIONS: Section[] = [
  {
    title: "Document Generation",
    icon: "📄",
    rows: [
      { label: "Invoices", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Contracts", clorefy: true, freshbooks: false, quickbooks: false, bonsai: true, note: "Clorefy: AI-generated" },
      { label: "Quotations / Estimates", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Business Proposals", clorefy: true, freshbooks: false, quickbooks: false, bonsai: true, note: "Clorefy: AI-generated" },
      { label: "AI generation from plain text", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false, note: "Clorefy exclusive" },
      { label: "Conversational editing", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false, note: "Clorefy exclusive" },
      { label: "No manual form filling", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false, note: "Clorefy exclusive" },
    ],
  },
  {
    title: "Tax & Compliance",
    icon: "🌍",
    rows: [
      { label: "India GST (CGST / SGST / IGST)", clorefy: true, freshbooks: false, quickbooks: "partial", bonsai: false, note: "QB India is separate" },
      { label: "US Sales Tax (all 50 states)", clorefy: true, freshbooks: true, quickbooks: true, bonsai: false },
      { label: "UK VAT", clorefy: true, freshbooks: true, quickbooks: true, bonsai: false },
      { label: "EU VAT (DE, FR, NL)", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Canada GST / HST / QST", clorefy: true, freshbooks: true, quickbooks: true, bonsai: false },
      { label: "Australia GST (ABN)", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Singapore GST", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "UAE VAT (TRN)", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Auto tax rate detection", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false, note: "Clorefy exclusive" },
    ],
  },
  {
    title: "Export & Design",
    icon: "🎨",
    rows: [
      { label: "PDF export", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "DOCX (Word) export", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Image export (PNG / JPG)", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Professional templates", clorefy: "9 templates", freshbooks: "Limited", quickbooks: "Limited", bonsai: "Limited" },
      { label: "Custom logo & branding", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Digital e-signatures", clorefy: true, freshbooks: "partial", quickbooks: false, bonsai: true, note: "FreshBooks add-on" },
    ],
  },
  {
    title: "Pricing & Value",
    icon: "💰",
    rows: [
      { label: "Free plan", clorefy: true, freshbooks: false, quickbooks: false, bonsai: false },
      { label: "Starting price / month", clorefy: "$9", freshbooks: "$21", quickbooks: "$38", bonsai: "$15" },
      { label: "No per-client limits", clorefy: true, freshbooks: false, quickbooks: true, bonsai: true, note: "FreshBooks Lite: 5 clients" },
      { label: "No accounting complexity", clorefy: true, freshbooks: false, quickbooks: false, bonsai: true },
      { label: "Payment reminders", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
      { label: "Online payment links", clorefy: true, freshbooks: true, quickbooks: true, bonsai: true },
    ],
  },
]

// ─── Cell ─────────────────────────────────────────────────────────────────────

function Cell({ val, highlight }: { val: Val; highlight?: boolean }) {
  if (val === true) return (
    <div className="flex justify-center items-center">
      <IconCheck size={18} color={highlight ? "#E07B39" : "#16A34A"} />
    </div>
  )
  if (val === false) return (
    <div className="flex justify-center items-center">
      <IconX size={18} />
    </div>
  )
  if (val === "partial") return (
    <div className="flex justify-center items-center">
      <IconPartial size={18} />
    </div>
  )
  // String
  return (
    <div className="flex justify-center items-center">
      <span
        className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={highlight
          ? { backgroundColor: "rgba(224,123,57,0.12)", color: AMBER }
          : { backgroundColor: "rgba(0,0,0,0.05)", color: MUTED }
        }
      >
        {val}
      </span>
    </div>
  )
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({ section, index }: { section: Section; index: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: BORDER, backgroundColor: "#FFFFFF" }}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 border-b"
        style={{ borderColor: BORDER, backgroundColor: CREAM }}
      >
        <span className="text-base">{section.icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: MUTED }}>
          {section.title}
        </span>
      </div>

      {/* Rows */}
      {section.rows.map((row, i) => (
        <div
          key={row.label}
          className="grid items-center"
          style={{
            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
            borderBottom: i < section.rows.length - 1 ? `1px solid ${BORDER}` : undefined,
            backgroundColor: i % 2 === 0 ? "#FFFFFF" : CREAM,
          }}
        >
          {/* Feature label */}
          <div className="px-5 py-3 flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: DARK }}>{row.label}</span>
            {row.note && (
              <span
                className="hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(224,123,57,0.1)", color: AMBER }}
              >
                {row.note}
              </span>
            )}
          </div>

          {/* Clorefy — highlighted */}
          <div
            className="px-3 py-3 border-l"
            style={{ borderColor: "rgba(224,123,57,0.2)", backgroundColor: "rgba(224,123,57,0.04)" }}
          >
            <Cell val={row.clorefy} highlight />
          </div>

          {/* Competitors */}
          {(["freshbooks", "quickbooks", "bonsai"] as const).map(key => (
            <div key={key} className="px-3 py-3 border-l" style={{ borderColor: BORDER }}>
              <Cell val={row[key]} />
            </div>
          ))}
        </div>
      ))}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ComparisonTable() {
  const headerRef = useRef(null)
  const headerInView = useInView(headerRef, { once: true, margin: "-40px" })

  const competitors = [
    { name: "FreshBooks", price: "from $21/mo", color: "#0075DD" },
    { name: "QuickBooks", price: "from $38/mo", color: "#2CA01C" },
    { name: "Bonsai", price: "from $15/mo", color: "#7C3AED" },
  ]

  return (
    <section style={{ backgroundColor: CREAM }} className="py-24 sm:py-32 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14"
        >
          {/* Eyebrow */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 border"
            style={{ backgroundColor: "rgba(224,123,57,0.08)", borderColor: "rgba(224,123,57,0.2)", color: AMBER }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill={AMBER} />
            </svg>
            Why Clorefy wins
          </div>

          <h2
            className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.1] mb-5"
            style={{ color: DARK }}
          >
            Built for documents,<br />
            <span className="font-serif italic" style={{ color: AMBER }}>not accounting</span>
          </h2>

          <p className="text-base leading-relaxed max-w-lg mx-auto" style={{ color: MUTED }}>
            FreshBooks starts at <strong style={{ color: DARK }}>$21/mo</strong>, QuickBooks at <strong style={{ color: DARK }}>$38/mo</strong>, and Bonsai at <strong style={{ color: DARK }}>$15/mo</strong> — none have AI generation or multi-country tax compliance.
            Clorefy starts at <strong style={{ color: AMBER }}>$9/mo</strong> with a free plan.
          </p>
        </motion.div>

        {/* ── Sticky column headers ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid mb-3 rounded-2xl overflow-hidden border"
          style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", borderColor: BORDER, backgroundColor: "#FFFFFF" }}
        >
          {/* Empty first cell */}
          <div className="px-5 py-4">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>Feature</span>
          </div>

          {/* Clorefy header — highlighted */}
          <div
            className="px-3 py-4 border-l flex flex-col items-center gap-1"
            style={{ borderColor: "rgba(224,123,57,0.2)", backgroundColor: "rgba(224,123,57,0.06)" }}
          >
            <div className="flex items-center gap-1.5">
              {/* Clorefy star logo */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z" fill={AMBER} />
              </svg>
              <span className="text-sm font-bold" style={{ color: DARK }}>Clorefy</span>
            </div>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: AMBER, color: "#FFFFFF" }}
            >
              from $9/mo
            </span>
          </div>

          {/* Competitor headers */}
          {competitors.map(c => (
            <div key={c.name} className="px-3 py-4 border-l flex flex-col items-center gap-1" style={{ borderColor: BORDER }}>
              <span className="text-sm font-semibold text-center leading-tight" style={{ color: DARK }}>{c.name}</span>
              <span className="text-[10px] font-medium" style={{ color: MUTED }}>{c.price}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Legend ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={headerInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center justify-end gap-5 mb-5"
        >
          {[
            { icon: <IconCheck size={14} />, label: "Included" },
            { icon: <IconPartial size={14} />, label: "Partial / Add-on" },
            { icon: <IconX size={14} />, label: "Not available" },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              {icon}
              <span className="text-[11px]" style={{ color: MUTED }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Sections ── */}
        <div className="space-y-3">
          {SECTIONS.map((section, i) => (
            <SectionBlock key={section.title} section={section} index={i} />
          ))}
        </div>

        {/* ── Bottom note ── */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center text-xs mt-6"
          style={{ color: MUTED }}
        >
          FreshBooks from $21/mo (Lite, 5 clients). QuickBooks from $38/mo (Simple Start). Bonsai from $15/mo. Prices verified April 2026.
        </motion.p>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 text-center"
        >
          <p className="text-sm mb-5" style={{ color: MUTED }}>
            Free plan available · No credit card required · Cancel anytime
          </p>
          <a
            href="/auth/signup"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.97]"
            style={{ backgroundColor: DARK }}
          >
            Start free — no card needed
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>

      </div>
    </section>
  )
}
