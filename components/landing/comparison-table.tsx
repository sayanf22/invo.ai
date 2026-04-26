"use client"

import { Check, X, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type CellValue = true | false | "partial" | string

interface ComparisonRow {
  feature: string
  category?: string // if set, this row is a section header
  clorefy: CellValue
  freshbooks: CellValue
  quickbooks: CellValue
  zoho: CellValue
  tip?: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const rows: ComparisonRow[] = [
  // Document Generation
  { feature: "Document Types", category: "Document Generation", clorefy: "", freshbooks: "", quickbooks: "", zoho: "" },
  { feature: "Invoices", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "Contracts", clorefy: true, freshbooks: false, quickbooks: false, zoho: "partial", tip: "Zoho Sign is a separate paid product" },
  { feature: "Quotations / Estimates", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "Business Proposals", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },
  { feature: "AI-generated from plain text", clorefy: true, freshbooks: false, quickbooks: false, zoho: false, tip: "Clorefy generates complete documents from a single sentence" },
  { feature: "No manual form filling", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },

  // Compliance
  { feature: "Tax Compliance", category: "Tax & Legal Compliance", clorefy: "", freshbooks: "", quickbooks: "", zoho: "" },
  { feature: "India GST (CGST/SGST/IGST)", clorefy: true, freshbooks: false, quickbooks: "partial", zoho: true, tip: "QuickBooks India is a separate product" },
  { feature: "US Sales Tax (all 50 states)", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "UK VAT", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "EU VAT (Germany, France, Netherlands)", clorefy: true, freshbooks: false, quickbooks: false, zoho: "partial" },
  { feature: "Canada GST/HST/PST/QST", clorefy: true, freshbooks: true, quickbooks: true, zoho: "partial" },
  { feature: "Australia GST (ABN)", clorefy: true, freshbooks: false, quickbooks: false, zoho: "partial" },
  { feature: "Singapore GST", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },
  { feature: "UAE VAT (TRN)", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },
  { feature: "Philippines VAT (BIR)", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },
  { feature: "Auto tax rate detection", clorefy: true, freshbooks: false, quickbooks: false, zoho: false, tip: "Clorefy auto-applies the correct rate based on country + registration status" },

  // Export & Formats
  { feature: "Export Formats", category: "Export & Formats", clorefy: "", freshbooks: "", quickbooks: "", zoho: "" },
  { feature: "PDF export", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "DOCX (Word) export", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },
  { feature: "Image export (PNG/JPG)", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },
  { feature: "Multiple design templates", clorefy: "9 templates", freshbooks: "Limited", quickbooks: "Limited", zoho: "Limited" },
  { feature: "Custom logo & branding", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },

  // AI & Automation
  { feature: "AI & Automation", category: "AI & Automation", clorefy: "", freshbooks: "", quickbooks: "", zoho: "" },
  { feature: "AI document generation", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },
  { feature: "Conversational editing", clorefy: true, freshbooks: false, quickbooks: false, zoho: false, tip: "Edit documents by chatting — 'change the rate to $500'" },
  { feature: "Auto-fill from business profile", clorefy: true, freshbooks: "partial", quickbooks: "partial", zoho: "partial" },
  { feature: "Payment reminder automation", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "Recurring invoices", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },

  // Payments
  { feature: "Payments", category: "Payments & Tracking", clorefy: "", freshbooks: "", quickbooks: "", zoho: "" },
  { feature: "Online payment links", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "Payment status tracking", clorefy: true, freshbooks: true, quickbooks: true, zoho: true },
  { feature: "Digital e-signatures", clorefy: true, freshbooks: "partial", quickbooks: false, zoho: "partial", tip: "FreshBooks & Zoho require add-ons for e-signatures" },
  { feature: "Document view tracking", clorefy: true, freshbooks: false, quickbooks: false, zoho: false },

  // Pricing
  { feature: "Pricing", category: "Pricing & Value", clorefy: "", freshbooks: "", quickbooks: "", zoho: "" },
  { feature: "Free plan available", clorefy: true, freshbooks: false, quickbooks: false, zoho: true },
  { feature: "Starting price / month", clorefy: "$9", freshbooks: "$23", quickbooks: "$30", zoho: "$15" },
  { feature: "No per-client limits", clorefy: true, freshbooks: false, quickbooks: true, zoho: true, tip: "FreshBooks Lite limits you to 5 billable clients" },
  { feature: "No accounting complexity", clorefy: true, freshbooks: false, quickbooks: false, zoho: false, tip: "QuickBooks & FreshBooks require learning accounting concepts" },
]

// ─── Cell renderer ────────────────────────────────────────────────────────────

function Cell({ value, highlight }: { value: CellValue; highlight?: boolean }) {
  if (value === true) return (
    <div className="flex justify-center">
      <div className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center",
        highlight ? "bg-emerald-500" : "bg-emerald-100 dark:bg-emerald-900/40"
      )}>
        <Check className={cn("w-3.5 h-3.5", highlight ? "text-white" : "text-emerald-600 dark:text-emerald-400")} strokeWidth={2.5} />
      </div>
    </div>
  )
  if (value === false) return (
    <div className="flex justify-center">
      <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
        <X className="w-3.5 h-3.5 text-red-400 dark:text-red-500" strokeWidth={2.5} />
      </div>
    </div>
  )
  if (value === "partial") return (
    <div className="flex justify-center">
      <div className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
        <Minus className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.5} />
      </div>
    </div>
  )
  if (value === "") return null
  // String value
  return (
    <div className="flex justify-center">
      <span className={cn(
        "text-[11px] font-semibold px-2 py-0.5 rounded-full",
        highlight
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      )}>
        {value}
      </span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ComparisonTable() {
  const competitors = [
    { key: "freshbooks", name: "FreshBooks", price: "$23/mo" },
    { key: "quickbooks", name: "QuickBooks", price: "$30/mo" },
    { key: "zoho", name: "Zoho Invoice", price: "$15/mo" },
  ] as const

  return (
    <section className="py-24 px-4 sm:px-6" style={{ backgroundColor: "#faf8f5" }}>
      <div className="max-w-6xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold mb-5">
            <Check className="w-3 h-3" />
            Why Clorefy wins
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight mb-4" style={{ color: "#1a1a1a" }}>
            The only tool built for<br />
            <span className="font-serif italic" style={{ color: "#e07b39" }}>document generation</span>
          </h2>
          <p className="text-stone-500 text-base max-w-xl mx-auto leading-relaxed">
            FreshBooks and QuickBooks are accounting tools that happen to have invoicing.
            Clorefy is built from the ground up to generate any business document — in seconds, with AI.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mb-8 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={2.5} />
            </div>
            Included
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-amber-50 flex items-center justify-center">
              <Minus className="w-2.5 h-2.5 text-amber-500" strokeWidth={2.5} />
            </div>
            Partial / Add-on
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center">
              <X className="w-2.5 h-2.5 text-red-400" strokeWidth={2.5} />
            </div>
            Not available
          </span>
        </div>

        {/* Table wrapper */}
        <div className="rounded-2xl border border-stone-200/80 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              {/* Header */}
              <thead>
                <tr>
                  <th className="text-left px-5 py-4 text-sm font-semibold text-stone-500 bg-white border-b border-stone-100 w-[40%]">
                    Feature
                  </th>
                  {/* Clorefy — highlighted */}
                  <th className="px-4 py-4 text-center bg-emerald-50 border-b border-emerald-100 border-l border-emerald-200/60 w-[15%]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-bold text-emerald-800">Clorefy</span>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">from $9/mo</span>
                    </div>
                  </th>
                  {competitors.map(c => (
                    <th key={c.key} className="px-4 py-4 text-center bg-white border-b border-stone-100 border-l border-stone-100 w-[15%]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-stone-700">{c.name}</span>
                        <span className="text-[10px] text-stone-400">{c.price}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, i) => {
                  // Section header row
                  if (row.category) {
                    return (
                      <tr key={`cat-${i}`}>
                        <td colSpan={5} className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-stone-400 bg-stone-50/80 border-t border-stone-100">
                          {row.category}
                        </td>
                      </tr>
                    )
                  }

                  const isEven = i % 2 === 0
                  return (
                    <tr key={`row-${i}`} className={cn(
                      "group transition-colors",
                      isEven ? "bg-white" : "bg-stone-50/40"
                    )}>
                      {/* Feature name */}
                      <td className="px-5 py-3.5 border-t border-stone-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-stone-700 font-medium">{row.feature}</span>
                          {row.tip && (
                            <span
                              className="hidden group-hover:inline-flex items-center text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full max-w-[200px] truncate"
                              title={row.tip}
                            >
                              {row.tip}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Clorefy cell — highlighted bg */}
                      <td className="px-4 py-3.5 border-t border-emerald-100 border-l border-emerald-200/60 bg-emerald-50/60">
                        <Cell value={row.clorefy} highlight />
                      </td>

                      {/* Competitor cells */}
                      {competitors.map(c => (
                        <td key={c.key} className="px-4 py-3.5 border-t border-stone-100 border-l border-stone-100">
                          <Cell value={row[c.key]} />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-stone-500 text-sm mb-5">
            No credit card required · Free plan available · Cancel anytime
          </p>
          <a
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "#1a1a1a" }}
          >
            Start free — no card needed
          </a>
        </div>

      </div>
    </section>
  )
}
