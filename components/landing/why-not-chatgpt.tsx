"use client"

import { useEffect, useState } from "react"
import {
  FileText,
  Mic,
  Paperclip,
  ArrowUp,
  CheckCircle2,
  Sparkles,
  Globe2,
  CreditCard,
  PenLine,
  UserSquare2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Cycling AI competitor names — keeps headline relatable & SEO-friendly
// without singling out one company.
const AI_NAMES = ["ChatGPT", "Claude", "Gemini", "Perplexity"] as const

// What Clorefy does that raw AI chatbots don't
const capabilities = [
  {
    icon: FileText,
    title: "Formatted PDF, ready to send",
    desc: "Real document layouts. Not raw text you reformat in Word.",
  },
  {
    icon: Globe2,
    title: "Country-correct tax rates",
    desc: "GST, VAT, sales tax — auto-applied for 190+ countries.",
  },
  {
    icon: UserSquare2,
    title: "Your business pre-filled",
    desc: "Logo, address, tax IDs, signature — every time.",
  },
  {
    icon: CreditCard,
    title: "Payment links built in",
    desc: "Razorpay link attached to every invoice. Get paid faster.",
  },
  {
    icon: PenLine,
    title: "E-signatures in one click",
    desc: "Send contracts and NDAs for signing. Legally tracked.",
  },
] as const

export function WhyNotChatGPT() {
  // Rotate through AI names every 2.6s
  const [aiIndex, setAiIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setAiIndex((i) => (i + 1) % AI_NAMES.length), 2600)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-10 bg-[#FAFAF9] relative overflow-hidden">
      {/* Subtle background grid — same texture as hero */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-14 lg:gap-16 items-center">

          {/* ════════════════════════════════════════════════════
              LEFT: AI Chat Card (the existing one — kept)
              ════════════════════════════════════════════════════ */}
          <div className="flex justify-center perspective-[2000px] order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, rotateY: -10, x: -30 }}
              whileInView={{ opacity: 1, rotateY: 0, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[500px] relative"
            >
              {/* Document popout preview */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: -60, opacity: 1 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-0 right-0 left-12 h-64 bg-white rounded-xl border-[2.5px] border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] -z-10 p-6 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-[#1C1A17] flex items-center justify-center text-white">
                    <FileText size={14} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1C1A17]">Invoice_AcmeCorp.pdf</h4>
                    <p className="text-xs text-[#86807B]">Generated · Ready to send</p>
                  </div>
                </div>
                <div className="flex-1 bg-[#FAFAF9] rounded-lg border border-black/5 p-4 relative overflow-hidden">
                  <div className="w-1/3 h-2 bg-black/10 rounded mb-4" />
                  <div className="w-full h-1 bg-black/5 rounded mb-2" />
                  <div className="w-5/6 h-1 bg-black/5 rounded mb-2" />
                  <div className="w-4/6 h-1 bg-black/5 rounded mb-6" />
                  <div className="w-full h-12 bg-white rounded border border-black/5 mb-2" />
                  <div className="w-full h-12 bg-white rounded border border-black/5" />
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#FAFAF9] to-transparent" />
                </div>
              </motion.div>

              <div className="bg-white rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] overflow-hidden border-[3px] border-[var(--landing-dark)] relative z-10">
                <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-5 border-b border-stone-100 bg-[#FAFAF9]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--landing-amber)] absolute -left-1 -top-1 animate-ping opacity-75" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--landing-amber)] shadow-[0_0_10px_rgba(198,122,60,0.4)]" />
                    </div>
                    <p className="text-[12px] font-bold text-[#1C1A17] uppercase tracking-widest flex-1">
                      Clorefy Copilot
                    </p>
                  </div>
                  <p className="text-[14px] sm:text-[15px] leading-[1.7] text-[#5B5550] font-medium">
                    Generating document for{" "}
                    <span className="text-[#1C1A17] font-bold bg-stone-200/50 px-1.5 py-0.5 rounded">Acme Corp</span>.
                    {" "}Extracting{" "}
                    <span className="text-[var(--landing-amber)] font-semibold">billing address</span> and
                    tax rules. Adding $5,000 line item. Formatting as PDF.
                  </p>
                </div>

                <div className="px-5 sm:px-6 py-4 sm:py-5 flex flex-wrap gap-2 sm:gap-2.5 border-b border-stone-100 bg-white">
                  {[
                    { text: "Auto-filled GSTIN", delay: 0.5 },
                    { text: "Calculated 18% Tax", delay: 0.7 },
                    { text: "Applied Net-30 Terms", delay: 0.9 },
                  ].map((pill, idx) => (
                    <motion.span
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: pill.delay, duration: 0.4, type: "spring" }}
                      className="inline-flex items-center gap-1.5 bg-[var(--landing-amber)]/10 text-[var(--landing-amber)] text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-[var(--landing-amber)]/20 shadow-sm"
                    >
                      <CheckCircle2 size={11} />
                      {pill.text}
                    </motion.span>
                  ))}
                </div>

                <div className="p-4 bg-white">
                  <div className="bg-[#FAFAF9] border border-stone-200 rounded-2xl p-2 relative shadow-inner">
                    <p className="text-[14px] sm:text-[15px] text-[#1C1A17] pl-3 pt-2 pb-6 font-medium">
                      &ldquo;Invoice Acme 5k for web design.&rdquo;
                    </p>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-1">
                        <button className="p-2 text-stone-400 hover:text-[#1C1A17] transition-colors rounded-lg hover:bg-stone-200/50" aria-label="Voice input">
                          <Mic size={18} />
                        </button>
                        <button className="p-2 text-stone-400 hover:text-[#1C1A17] transition-colors rounded-lg hover:bg-stone-200/50" aria-label="Attach file">
                          <Paperclip size={18} />
                        </button>
                      </div>
                      <button className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white shadow-sm hover:bg-black transition-all hover:scale-105 active:scale-95" aria-label="Send">
                        <ArrowUp size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ════════════════════════════════════════════════════
              RIGHT: Bold card matching left card's weight
              ════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="order-1 lg:order-2 flex justify-center lg:justify-start"
          >
            <div className="w-full max-w-[500px] relative">
              {/* Decorative floating "vs" badge — anchored top-left, peeks above the card */}
              <div className="absolute -top-4 sm:-top-5 left-6 sm:left-8 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--landing-dark)] border-[2.5px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(217,119,87,0.4)]">
                <Sparkles size={11} className="text-[var(--landing-amber)]" strokeWidth={2.5} />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  vs AI chatbots
                </span>
              </div>

              {/* Main card — matches left card's shadow + border DNA */}
              <div className="bg-white rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] border-[3px] border-[var(--landing-dark)] overflow-hidden relative">

                {/* Cream header section with headline */}
                <div className="px-6 sm:px-8 pt-7 sm:pt-9 pb-6 sm:pb-8 bg-gradient-to-br from-[#FAF7F2] to-[#F5F0E8] border-b-[2.5px] border-[var(--landing-dark)] relative">
                  {/* Decorative dots in corner */}
                  <div className="absolute top-4 right-5 flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)]/40" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)]/60" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)]" />
                  </div>

                  {/* Headline */}
                  <h2 className="font-display text-[2rem] xs:text-[2.25rem] sm:text-[2.5rem] lg:text-[2.75rem] font-semibold text-[#1C1A17] tracking-tighter leading-[1.05]">
                    <span className="block">Why not just</span>
                    <span
                      className="block relative font-serif italic"
                      style={{ minHeight: "1.15em" }}
                      aria-live="polite"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={AI_NAMES[aiIndex]}
                          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
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
                  </h2>

                  <p className="mt-4 text-[14px] sm:text-[15px] text-[#5B5550] leading-relaxed font-medium max-w-[400px]">
                    AI chatbots draft text. They don't know your tax rate, format real invoices,
                    or send anything. Clorefy does the actual work.
                  </p>
                </div>

                {/* Capabilities list — clean rows, modern SaaS pattern */}
                <div className="bg-white">
                  {capabilities.map((cap, i) => {
                    const Icon = cap.icon
                    const isLast = i === capabilities.length - 1
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                        className={`flex items-start gap-3.5 px-6 sm:px-8 py-4 ${!isLast ? "border-b border-stone-100" : ""} group hover:bg-[#FAFAF9] transition-colors`}
                      >
                        {/* Icon badge */}
                        <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--landing-amber)]/10 border border-[var(--landing-amber)]/20 flex items-center justify-center group-hover:bg-[var(--landing-amber)]/15 transition-colors">
                          <Icon size={16} className="text-[var(--landing-amber)] sm:w-[18px] sm:h-[18px]" strokeWidth={2.2} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13.5px] sm:text-[14px] font-bold text-[#1C1A17] leading-tight mb-0.5">
                            {cap.title}
                          </h3>
                          <p className="text-[12px] sm:text-[12.5px] text-[#86807B] leading-snug">
                            {cap.desc}
                          </p>
                        </div>

                        {/* Check */}
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" strokeWidth={2.5} />
                      </motion.div>
                    )
                  })}
                </div>

                {/* Footer strip — small reassurance */}
                <div className="px-6 sm:px-8 py-3.5 bg-[#FAFAF9] border-t-[2.5px] border-[var(--landing-dark)] flex items-center justify-between gap-3">
                  <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-[#86807B]">
                    All in one platform
                  </span>
                  <span className="font-serif italic text-[12px] sm:text-[13px] text-[var(--landing-amber)] font-bold">
                    No copy-paste needed
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
