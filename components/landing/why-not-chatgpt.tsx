"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { FileText, Mic, Paperclip, ArrowUp, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Cycling AI competitor names — keeps headline relatable & SEO-friendly
// without singling out one company (safer legally, broader appeal).
const AI_NAMES = ["ChatGPT", "Claude", "Gemini", "Perplexity"] as const

// Differentiators — what raw AI can't do, what Clorefy adds.
// Kept terse so each line reads at a glance.
const differentiators = [
  { lacking: "Raw text only", clorefy: "Formatted PDF, ready to send" },
  { lacking: "Guesses tax rates", clorefy: "Country-correct rates, auto-applied" },
  { lacking: "Forgets your business", clorefy: "Your details pre-filled" },
  { lacking: "No payment link", clorefy: "Razorpay link on every invoice" },
  { lacking: "No e-signatures", clorefy: "Send for signature in one click" },
] as const

export function WhyNotChatGPT() {
  // Rotate through AI names every 2.4s — adds movement, conveys breadth
  const [aiIndex, setAiIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setAiIndex((i) => (i + 1) % AI_NAMES.length)
    }, 2400)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-10 bg-[#FAFAF9] relative overflow-hidden">
      {/* Subtle background grid — same texture as hero */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* LEFT: AI Chat Card (kept — user said it looks great) */}
          <div className="w-full lg:w-1/2 flex justify-center perspective-[2000px]">
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

              {/* Main AI chat interface */}
              <div className="bg-white rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)] overflow-hidden border-[3px] border-[var(--landing-dark)] relative z-10">
                <div className="px-6 pt-6 pb-5 border-b border-stone-100 bg-[#FAFAF9]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--landing-amber)] absolute -left-1 -top-1 animate-ping opacity-75" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--landing-amber)] shadow-[0_0_10px_rgba(198,122,60,0.4)]" />
                    </div>
                    <p className="text-[12px] font-bold text-[#1C1A17] uppercase tracking-widest flex-1">
                      Clorefy Copilot
                    </p>
                  </div>
                  <p className="text-[15px] leading-[1.75] text-[#5B5550] font-medium">
                    Generating document for{" "}
                    <span className="text-[#1C1A17] font-bold bg-stone-200/50 px-1.5 py-0.5 rounded">Acme Corp</span>.
                    {" "}Extracting{" "}
                    <span className="text-[var(--landing-amber)] font-semibold">billing address</span> and
                    tax rules. Adding $5,000 line item. Formatting as PDF.
                  </p>
                </div>

                <div className="px-6 py-5 flex flex-wrap gap-2.5 border-b border-stone-100 bg-white">
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
                      className="inline-flex items-center gap-1.5 bg-[var(--landing-amber)]/10 text-[var(--landing-amber)] text-xs font-bold px-3 py-1.5 rounded-full border border-[var(--landing-amber)]/20 shadow-sm"
                    >
                      <CheckCircle2 size={12} />
                      {pill.text}
                    </motion.span>
                  ))}
                </div>

                <div className="p-4 bg-white">
                  <div className="bg-[#FAFAF9] border border-stone-200 rounded-2xl p-2 relative shadow-inner">
                    <p className="text-[15px] text-[#1C1A17] pl-3 pt-2 pb-6 font-medium">
                      &ldquo;Invoice Acme 5k for web design.&rdquo;
                    </p>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-1">
                        <button className="p-2 text-stone-400 hover:text-[#1C1A17] transition-colors rounded-lg hover:bg-stone-200/50">
                          <Mic size={18} />
                        </button>
                        <button className="p-2 text-stone-400 hover:text-[#1C1A17] transition-colors rounded-lg hover:bg-stone-200/50">
                          <Paperclip size={18} />
                        </button>
                      </div>
                      <button className="w-9 h-9 rounded-xl bg-[#1a1a1a] flex items-center justify-center text-white shadow-sm hover:bg-black transition-all hover:scale-105 active:scale-95">
                        <ArrowUp size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Headline + comparison rows + CTAs — themed to match landing */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:w-1/2 flex flex-col items-start"
          >
            {/* Eyebrow tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--landing-amber)]/10 border border-[var(--landing-amber)]/30 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-amber)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--landing-amber)]">
                The honest difference
              </span>
            </div>

            {/* Headline — cycles through major AI names */}
            <h2 className="font-display text-4xl sm:text-5xl lg:text-[3.75rem] font-semibold text-[#1C1A17] mb-5 tracking-tighter leading-[1.05]">
              Why not just{" "}
              <span className="relative inline-block align-baseline" style={{ minWidth: "5.5ch" }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={AI_NAMES[aiIndex]}
                    initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="font-serif italic inline-block whitespace-nowrap"
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

            <p className="text-[#5B5550] text-base sm:text-lg leading-relaxed mb-8 max-w-md font-medium">
              Any AI chatbot can draft text. None of them know your tax rate, format a real
              invoice, attach a payment link, or actually send it.
            </p>

            {/* Differentiator rows — neo-brutalist cards in landing theme */}
            <div className="w-full max-w-[520px] flex flex-col gap-2.5 mb-8">
              {differentiators.map((row, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2.5"
                >
                  {/* Left: AI alone */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-stone-100/80 border border-stone-200/80">
                    <span className="text-stone-400 text-base leading-none shrink-0">−</span>
                    <span className="text-[12.5px] sm:text-[13px] text-stone-500 leading-snug font-medium line-through decoration-stone-300/80">
                      {row.lacking}
                    </span>
                  </div>

                  {/* Arrow connector */}
                  <div className="flex items-center px-1">
                    <div className="font-serif italic text-[15px] text-[var(--landing-amber)] font-bold">→</div>
                  </div>

                  {/* Right: Clorefy */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border-[1.5px] border-[var(--landing-dark)] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                    <CheckCircle2 size={14} className="text-[var(--landing-amber)] shrink-0" strokeWidth={2.5} />
                    <span className="text-[12.5px] sm:text-[13px] text-[#1C1A17] font-semibold leading-snug">
                      {row.clorefy}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Honest disclaimer — small, italic, matches editorial tone */}
            <p className="text-[12px] text-stone-500 mb-7 max-w-md leading-relaxed font-serif italic border-l-2 border-stone-300 pl-3">
              Clorefy uses leading AI APIs. The value is the workflow built around them — your
              business profile, country tax rules, formatting, and delivery — all in one place.
            </p>

            {/* CTAs — match hero button styling */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                href="/auth/signup"
                className="group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-[1rem] bg-[var(--landing-dark)] text-white font-bold text-[15px] sm:text-base transition-all border-[2px] sm:border-[2.5px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] sm:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[5px_5px_0px_0px_rgba(26,26,26,1)] sm:hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] w-full sm:w-auto overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10 flex items-center gap-2">
                  <FileText size={16} className="sm:w-[18px] sm:h-[18px]" />
                  Try Clorefy Free
                </span>
              </Link>
              <a
                href="https://www.youtube.com/@Clorefy"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-7 py-3.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-[1rem] bg-white text-[var(--landing-dark)] font-bold text-[15px] sm:text-base border-[2px] sm:border-[2.5px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] sm:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:shadow-[5px_5px_0px_0px_rgba(26,26,26,1)] sm:hover:shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] transition-all w-full sm:w-auto"
              >
                Watch Demo
              </a>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
