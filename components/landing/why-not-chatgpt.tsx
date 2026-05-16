"use client"

import { useEffect, useState } from "react"
import {
  Globe2,
  Sparkles,
  ArrowUp,
  Mic,
  Paperclip,
  Database,
  Search,
  Brain,
  PenLine,
  ScanText,
  Layers,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Cycling AI competitor names — keeps headline relatable & SEO-friendly
const AI_NAMES = ["ChatGPT", "Claude", "Gemini", "Perplexity"] as const

// One full prompt → response cycle (mirrors the real Clorefy flow:
// user types → AI thinks via agentic block → document appears on right)
type Scene = {
  id: string
  prompt: string
  activities: { icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; label: string; detail: string }[]
  doc: {
    type: string
    number: string
    fromName: string
    fromMeta: string
    toName: string
    toMeta: string
    items: { desc: string; amount: string }[]
    subtotal: string
    taxLabel: string
    taxAmount: string
    total: string
    currency: string
    footer: string
  }
}

const scenes: Scene[] = [
  {
    id: "invoice",
    prompt: "Invoice Acme Corp $5,000 for web design, net-30",
    activities: [
      { icon: Database, label: "Reading profile", detail: "Studio Noir, EIN 98-7654321" },
      { icon: Search, label: "Looking up tax", detail: "US sales tax — services exempt" },
      { icon: Brain, label: "Composing", detail: "INV-0042 · Net-30" },
      { icon: PenLine, label: "Formatting PDF", detail: "Modern template" },
    ],
    doc: {
      type: "INVOICE",
      number: "INV-0042",
      fromName: "Studio Noir",
      fromMeta: "Brooklyn, NY · EIN 98-7654321",
      toName: "Acme Corp",
      toMeta: "Marketing · contact@acme.co",
      items: [
        { desc: "Web design — landing page", amount: "3,500.00" },
        { desc: "Brand assets package", amount: "1,500.00" },
      ],
      subtotal: "5,000.00",
      taxLabel: "Tax —",
      taxAmount: "0.00",
      total: "$ 5,000.00",
      currency: "USD",
      footer: "Net-30 · Stripe link attached",
    },
  },
  {
    id: "contract",
    prompt: "Service contract for Nexus, 3 months, £4,500/month",
    activities: [
      { icon: Database, label: "Reading profile", detail: "Priya Mehta Consulting" },
      { icon: ScanText, label: "Pulling clauses", detail: "UK service agreement" },
      { icon: Brain, label: "Composing", detail: "3-month retainer terms" },
      { icon: PenLine, label: "Adding signature block", detail: "Both parties · UK law" },
    ],
    doc: {
      type: "SERVICE AGREEMENT",
      number: "CTR-2026-014",
      fromName: "Priya Mehta Consulting",
      fromMeta: "London, UK · VAT GB123456789",
      toName: "Nexus Group",
      toMeta: "Strategy team",
      items: [
        { desc: "1. Scope — brand strategy retainer", amount: "—" },
        { desc: "2. Term — 3 months rolling", amount: "—" },
        { desc: "3. Fees — £4,500/month, Net-30", amount: "—" },
      ],
      subtotal: "",
      taxLabel: "",
      taxAmount: "",
      total: "Ready to sign",
      currency: "",
      footer: "E-signature enabled · 14 days to sign",
    },
  },
  {
    id: "quotation",
    prompt: "Quote 50 enterprise seats for Pinnacle Retail, annual",
    activities: [
      { icon: Database, label: "Reading profile", detail: "Northwind Software" },
      { icon: Layers, label: "Pricing tiers", detail: "Enterprise · 50 seats" },
      { icon: Brain, label: "Composing", detail: "Annual plan + add-ons" },
      { icon: PenLine, label: "Validity terms", detail: "30 days · Net-30" },
    ],
    doc: {
      type: "QUOTATION",
      number: "QT-2026-214",
      fromName: "Northwind Software",
      fromMeta: "Enterprise Sales · GSTIN 07AAACN1234D1Z2",
      toName: "Pinnacle Retail Ltd.",
      toMeta: "Procurement · ops@pinnacle.co",
      items: [
        { desc: "Enterprise plan — 50 seats", amount: "30,000.00" },
        { desc: "SSO + SAML add-on", amount: "3,600.00" },
        { desc: "Priority support — 12 months", amount: "2,400.00" },
      ],
      subtotal: "36,000.00",
      taxLabel: "Sales Tax —",
      taxAmount: "0.00",
      total: "$ 36,000.00",
      currency: "USD",
      footer: "Net-30 · Valid 30 days",
    },
  },
] as const

const SCENE_DURATION = 7000 // ms per full cycle
const EASE = [0.16, 1, 0.3, 1] as const

export function WhyNotChatGPT() {
  const [aiIndex, setAiIndex] = useState(0)
  const [sceneIndex, setSceneIndex] = useState(0)

  // Cycle headline AI names
  useEffect(() => {
    const id = setInterval(() => setAiIndex((i) => (i + 1) % AI_NAMES.length), 2600)
    return () => clearInterval(id)
  }, [])

  // Cycle scenes (full prompt → doc loop)
  useEffect(() => {
    const id = setInterval(() => setSceneIndex((i) => (i + 1) % scenes.length), SCENE_DURATION)
    return () => clearInterval(id)
  }, [])

  const scene = scenes[sceneIndex]
  const hasTable = scene.doc.subtotal !== ""

  return (
    <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-10 bg-[#FAFAF9] relative overflow-hidden">
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      {/* Soft amber glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[600px] rounded-[100%] opacity-30 pointer-events-none blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(224,123,57,0.18) 0%, transparent 60%)" }}
      />

      <div className="max-w-6xl mx-auto relative">

        {/* HEADER */}
        <div className="text-center mb-10 sm:mb-14 lg:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--landing-amber)]/10 border border-[var(--landing-amber)]/30 mb-5"
          >
            <Sparkles size={11} className="text-[var(--landing-amber)]" strokeWidth={2.5} />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--landing-amber)]">
              The honest difference
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="font-display text-[2.25rem] xs:text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-semibold text-[#1C1A17] tracking-tighter leading-[1.02]"
          >
            <span className="block" style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.06), 0 8px 24px rgba(26,26,26,0.04)" }}>
              Why not just
            </span>
            <span className="block relative font-serif italic" style={{ minHeight: "1.15em" }} aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={AI_NAMES[aiIndex]}
                  initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -14, filter: "blur(8px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="inline-block whitespace-nowrap"
                  style={{
                    backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {AI_NAMES[aiIndex]}?
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="mt-5 sm:mt-6 text-[15px] sm:text-lg md:text-xl text-[#5B5550] max-w-2xl mx-auto leading-relaxed font-medium"
          >
            AI chatbots draft text. Clorefy reads your business profile, applies the right tax rules,
            formats a real document, and attaches a payment link.
          </motion.p>
        </div>

        {/* MACBOOK MOCKUP */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: EASE }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="relative bg-white rounded-2xl sm:rounded-[2rem] border-[3px] sm:border-[4px] border-[var(--landing-dark)] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] sm:shadow-[12px_12px_0px_0px_rgba(26,26,26,1)] overflow-hidden">

            {/* Window chrome */}
            <div className="h-9 sm:h-11 bg-[#F5F2EC] border-b-[2px] border-[var(--landing-dark)] flex items-center px-3 sm:px-5 gap-2 sm:gap-3">
              <div className="flex gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f57] border border-black/10" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#febc2e] border border-black/10" />
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28c840] border border-black/10" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-white/70 border border-stone-200 text-[11px] font-mono text-stone-500 max-w-[280px]">
                  <Globe2 size={11} className="text-stone-400" />
                  <span className="truncate">clorefy.com / generate</span>
                </div>
                <div className="sm:hidden text-[10px] font-mono text-stone-500 truncate">clorefy.com</div>
              </div>
              <div className="w-[42px] sm:w-[58px] shrink-0" />
            </div>

            {/* Split: chat (40%) + document preview (60%) — like the real app */}
            <div className="grid grid-cols-1 md:grid-cols-[40%_60%] min-h-[520px] sm:min-h-[560px]">

              {/* ─────── LEFT: chat panel — mirrors invoice-chat.tsx ─────── */}
              <div className="bg-[#fbfbfa] border-b-2 md:border-b-0 md:border-r-2 border-stone-200 flex flex-col">
                {/* Header */}
                <div className="px-4 sm:px-5 py-3 border-b border-stone-200 flex items-center gap-2.5 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-[#1C1A17] flex items-center justify-center">
                    <Sparkles size={11} className="text-[var(--landing-amber)]" strokeWidth={2.5} />
                  </div>
                  <span className="text-[11.5px] font-bold text-[#1C1A17]">Clorefy</span>
                  <span className="ml-auto text-[10px] font-mono text-stone-400 tabular-nums">
                    {sceneIndex + 1} / {scenes.length}
                  </span>
                </div>

                {/* Messages — keyed on scene so each loop replays */}
                <div className="flex-1 px-4 sm:px-5 py-4 space-y-3 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={scene.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="space-y-3"
                    >
                      {/* User prompt bubble */}
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#1C1A17] text-white text-[12.5px] leading-snug font-medium shadow-md">
                          {scene.prompt}
                        </div>
                      </motion.div>

                      {/* Agentic activity block — looks like the real one */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.5, ease: EASE }}
                        className="rounded-xl border border-stone-200 bg-white overflow-hidden"
                      >
                        {/* Header */}
                        <div className="px-3 py-2 flex items-center gap-2 border-b border-stone-100">
                          <div className="w-4 h-4 rounded-md bg-[var(--landing-amber)]/15 flex items-center justify-center">
                            <Brain size={10} className="text-[var(--landing-amber)]" strokeWidth={2.5} />
                          </div>
                          <span className="text-[10.5px] font-bold text-[#1C1A17] uppercase tracking-wider">
                            Working
                          </span>
                          <span className="ml-auto flex gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" />
                            <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" style={{ animationDelay: "200ms" }} />
                            <span className="w-1 h-1 rounded-full bg-[var(--landing-amber)] animate-pulse" style={{ animationDelay: "400ms" }} />
                          </span>
                        </div>

                        {/* Activity rows */}
                        <div className="divide-y divide-stone-100">
                          {scene.activities.map((act, i) => {
                            const Icon = act.icon
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.35, delay: 0.9 + i * 0.5, ease: EASE }}
                                className="flex items-center gap-2.5 px-3 py-2"
                              >
                                <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center shrink-0">
                                  <Icon size={11} className="text-[#5B5550]" strokeWidth={2.2} />
                                </div>
                                <span className="text-[11px] font-semibold text-[#1C1A17] shrink-0">
                                  {act.label}
                                </span>
                                <span className="text-stone-300 text-[10px]">|</span>
                                <span className="text-[10.5px] text-[#86807B] truncate">
                                  {act.detail}
                                </span>
                              </motion.div>
                            )
                          })}
                        </div>
                      </motion.div>

                      {/* Final reply */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.9 + scene.activities.length * 0.5 + 0.2, ease: EASE }}
                        className="text-[11.5px] text-[#5B5550] leading-relaxed font-medium pl-1"
                      >
                        Done — <span className="text-[#1C1A17] font-bold">{scene.doc.number}</span> ready.
                        Payment link attached and saved.
                      </motion.div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Input bar */}
                <div className="px-4 pb-4 pt-2 shrink-0">
                  <div className="bg-white border border-stone-200 rounded-xl px-2.5 py-2 flex items-center gap-1.5 shadow-sm">
                    <button className="p-1 text-stone-400 rounded-md" aria-label="Voice">
                      <Mic size={14} />
                    </button>
                    <button className="p-1 text-stone-400 rounded-md" aria-label="Attach">
                      <Paperclip size={14} />
                    </button>
                    <span className="text-[11.5px] text-stone-400 flex-1 truncate">Ask Clorefy anything…</span>
                    <button className="w-6 h-6 rounded-md bg-[#1C1A17] flex items-center justify-center" aria-label="Send">
                      <ArrowUp size={12} className="text-white" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ─────── RIGHT: document preview — mirrors document-preview.tsx ─────── */}
              <div className="bg-[#F5F2EC] flex flex-col">
                {/* Toolbar */}
                <div className="px-4 sm:px-5 py-2.5 border-b border-stone-200 bg-white flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#86807B]">
                    Document
                  </span>
                  <span className="text-stone-300 text-[10px]">·</span>
                  <span className="text-[10.5px] font-mono text-[#5B5550]">{scene.doc.number}</span>
                  <div className="ml-auto flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)]" />
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--landing-amber)]">
                      Live
                    </span>
                  </div>
                </div>

                {/* Document — animated paper that swaps with each scene */}
                <div className="flex-1 p-4 sm:p-6 overflow-hidden flex items-start justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={scene.id}
                      initial={{ opacity: 0, y: 20, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.97 }}
                      transition={{ duration: 0.55, ease: EASE }}
                      className="w-full max-w-[420px] bg-white rounded-lg border border-stone-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5 sm:p-6 origin-top"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
                        <div className="min-w-0">
                          <div className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-[0.16em] text-stone-400 mb-1">
                            CLOREFY
                          </div>
                          <div className="font-serif text-[14px] sm:text-[16px] font-bold text-[#1C1A17] tracking-tight leading-tight">
                            {scene.doc.type}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[8px] uppercase tracking-wider text-stone-400">Ref</div>
                          <div className="text-[9.5px] font-mono font-semibold text-stone-700">
                            {scene.doc.number}
                          </div>
                          <div className="text-[8.5px] text-stone-400 mt-0.5">12 May 2026</div>
                        </div>
                      </div>

                      {/* From / To */}
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="min-w-0">
                          <div className="text-[8px] uppercase tracking-wider text-stone-400 mb-0.5">From</div>
                          <div className="text-[10.5px] font-semibold text-[#1C1A17] truncate">
                            {scene.doc.fromName}
                          </div>
                          <div className="text-[9px] text-stone-500 leading-snug truncate">
                            {scene.doc.fromMeta}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[8px] uppercase tracking-wider text-stone-400 mb-0.5">To</div>
                          <div className="text-[10.5px] font-semibold text-[#1C1A17] truncate">
                            {scene.doc.toName}
                          </div>
                          <div className="text-[9px] text-stone-500 leading-snug truncate">
                            {scene.doc.toMeta}
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mt-3">
                        {hasTable ? (
                          <>
                            <div className="grid grid-cols-[1fr_70px] gap-2 px-2 py-1.5 rounded-md bg-stone-50 border border-stone-200">
                              <div className="text-[8.5px] font-bold uppercase tracking-wider text-stone-500">
                                Description
                              </div>
                              <div className="text-[8.5px] font-bold uppercase tracking-wider text-stone-500 text-right">
                                Amount
                              </div>
                            </div>
                            <div className="divide-y divide-stone-100">
                              {scene.doc.items.map((it, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.35, delay: 0.2 + idx * 0.08 }}
                                  className="grid grid-cols-[1fr_70px] gap-2 px-2 py-2 items-start"
                                >
                                  <div className="text-[10px] text-stone-700 leading-snug">{it.desc}</div>
                                  <div className="text-[10px] text-stone-800 text-right tabular-nums font-medium">
                                    {it.amount}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="space-y-2 px-0.5">
                            {scene.doc.items.map((it, idx) => (
                              <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.35, delay: 0.2 + idx * 0.08 }}
                                className="text-[10.5px] text-stone-700 leading-snug"
                              >
                                {it.desc}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Totals / status */}
                      <div className="mt-3 pt-3 border-t border-stone-200 flex justify-end">
                        <div className="w-full max-w-[200px] space-y-1">
                          {hasTable && (
                            <>
                              <div className="flex justify-between text-[10px] text-stone-500">
                                <span>Subtotal</span>
                                <span className="tabular-nums">{scene.doc.subtotal}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-stone-500">
                                <span>{scene.doc.taxLabel}</span>
                                <span className="tabular-nums">{scene.doc.taxAmount}</span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between items-baseline pt-1.5 border-t border-stone-200">
                            <span className="text-[8.5px] uppercase tracking-wider text-stone-400 font-semibold">
                              {hasTable ? "Total" : "Status"}
                            </span>
                            <span className="font-serif text-[13px] font-bold text-[#1C1A17] tabular-nums">
                              {scene.doc.total}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-3 text-[9px] text-stone-400 text-center leading-relaxed">
                        {scene.doc.footer}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Scene indicator dots */}
                <div className="px-5 py-3 border-t border-stone-200 bg-white flex items-center justify-center gap-2 shrink-0">
                  {scenes.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setSceneIndex(i)}
                      className="group relative h-1.5 rounded-full transition-all"
                      style={{ width: i === sceneIndex ? "24px" : "6px" }}
                      aria-label={`Show scene ${i + 1}`}
                    >
                      <span
                        className={`absolute inset-0 rounded-full transition-colors ${
                          i === sceneIndex ? "bg-[var(--landing-amber)]" : "bg-stone-300 group-hover:bg-stone-400"
                        }`}
                      />
                      {/* Progress fill on active */}
                      {i === sceneIndex && (
                        <motion.span
                          key={`progress-${sceneIndex}`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: SCENE_DURATION / 1000, ease: "linear" }}
                          className="absolute inset-0 rounded-full bg-[var(--landing-dark)] origin-left"
                          style={{ mixBlendMode: "multiply" }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* MacBook stand */}
          <div className="hidden sm:block absolute -bottom-3 left-1/2 -translate-x-1/2 w-[60%] h-3 rounded-b-[1.5rem] bg-gradient-to-b from-[#1C1A17] to-[#2a2724] shadow-[0_8px_20px_rgba(26,26,26,0.25)]" />
        </motion.div>

      </div>
    </section>
  )
}
