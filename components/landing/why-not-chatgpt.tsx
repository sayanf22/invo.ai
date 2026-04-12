"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

// Animated typing cursor
function Cursor() {
  return <span className="inline-block w-[2px] h-5 bg-[var(--landing-amber)] animate-pulse ml-0.5 align-text-bottom" />
}

// Animated brain SVG with pulse
function BrainIcon({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 48 48" fill="none" className={className}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path d="M24 8c-4 0-7.5 2-9 5.5S13 20 15 23c1.5 2.3 2 4.5 2 7h14c0-2.5.5-4.7 2-7 2-3 2.5-6.5 1-9.5S28 8 24 8z" fill="currentColor" opacity="0.12" />
      <path d="M19 30v3a5 5 0 0010 0v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 8v-2M24 30v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <circle cx="24" cy="20" r="3" fill="currentColor" opacity="0.3" />
    </motion.svg>
  )
}

export function WhyNotChatGPT() {
  const [activeDemo, setActiveDemo] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setActiveDemo(p => (p + 1) % 3), 7000)
    return () => clearInterval(timer)
  }, [])

  const demos = [
    { label: "ChatGPT", prompt: "Create an invoice for Acme Corp for $5,000 web design...", result: "Sure! Here's a basic invoice template:\n\n[You'll need to fill in: Your company name, address, GST number, bank details, payment terms...]", color: "text-stone-400" },
    { label: "Clorefy", prompt: "Invoice Acme Corp $5,000 web design", result: "✅ Invoice generated!\nFrom: AddMenu · GSTIN: 16XXXXX\nTo: Acme Corp\nWeb Design — $5,000\nGST 18% — $900\nTotal: $5,900\nDue: Net 30 · Bank: HDFC ****1234", color: "text-[var(--landing-amber)]" },
    { label: "Next month", prompt: "Same invoice for next month", result: "✅ New invoice created!\nAll details carried over from last month.\nInvoice #002 · Same client, same terms.\nReady to download.", color: "text-emerald-500" },
  ]

  return (
    <section className="py-16 sm:py-28 px-4 sm:px-6 lg:px-10" style={{ backgroundColor: "#1a1a1a" }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">

          {/* Left — Copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8 shadow-sm" style={{ backgroundColor: "rgba(224,123,57,0.15)", color: "#e07b39" }}>
              <span className="w-2 h-2 rounded-full bg-[var(--landing-amber)] animate-pulse" />
              The honest question
            </div>

            <h2 className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-[0.92] text-white">
              &ldquo;Why not just<br />
              <span className="font-serif italic" style={{ color: "#e07b39" }}>ChatGPT?</span>&rdquo;
            </h2>

            <p className="text-lg sm:text-xl text-white/50 mb-10 leading-relaxed max-w-lg">
              ChatGPT forgets you exist after every conversation. Clorefy remembers your business, your clients, and your country&apos;s tax rules — permanently.
            </p>

            {/* Key differentiators */}
            <div className="space-y-5">
              {[
                { num: "01", title: "Persistent memory", desc: "Business profile, tax IDs, bank details — saved once, auto-filled in every document." },
                { num: "02", title: "Country compliance", desc: "44 templates across 11 countries. GST, VAT, Sales Tax — auto-applied correctly." },
                { num: "03", title: "Document chains", desc: "Invoice → Contract → Quotation for the same client. Zero re-entry, ever." },
              ].map((item, i) => (
                <motion.div
                  key={item.num}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="flex gap-4 group"
                >
                  <span className="text-xs font-bold text-white/20 mt-1 shrink-0 tabular-nums">{item.num}</span>
                  <div>
                    <h4 className="text-base font-semibold text-white mb-0.5">{item.title}</h4>
                    <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right — Interactive demo */}
          <div className="relative">
            {/* Ambient glow — hidden on mobile to prevent overflow */}
            <div className="absolute -inset-10 rounded-full opacity-30 pointer-events-none hidden sm:block" style={{ background: "radial-gradient(circle, rgba(224,123,57,0.2) 0%, transparent 70%)" }} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 min-h-[380px] sm:min-h-[480px] flex flex-col"
              style={{ background: "linear-gradient(145deg, #232323 0%, #1f1f1f 50%, #1a1816 100%)", boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 40px 80px -20px rgba(0,0,0,0.5), 0 0 60px -10px rgba(224,123,57,0.08)" }}
            >
              {/* Tab switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-full mb-6" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                {demos.map((d, i) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setActiveDemo(i)}
                    className={`flex-1 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 ${activeDemo === i ? "bg-white/10 text-white shadow-sm" : "text-white/30 hover:text-white/50"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Chat simulation */}
              <div className="flex-1 flex flex-col gap-4">
                {/* User prompt */}
                <motion.div
                  key={`prompt-${activeDemo}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-end"
                >
                  <div className="max-w-[85%] rounded-2xl rounded-br-md px-5 py-3.5 text-sm leading-relaxed" style={{ backgroundColor: "rgba(224,123,57,0.15)", color: "#e07b39" }}>
                    {demos[activeDemo].prompt}
                  </div>
                </motion.div>

                {/* AI response */}
                <motion.div
                  key={`response-${activeDemo}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-start"
                >
                  <div className="max-w-[90%] rounded-2xl rounded-bl-md px-5 py-3.5 text-sm leading-relaxed whitespace-pre-line" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>
                    {demos[activeDemo].result}
                  </div>
                </motion.div>
              </div>

              {/* Bottom indicator */}
              <div className="flex items-center justify-center gap-2 mt-4">
                {demos.map((_, i) => (
                  <div
                    key={i}
                    className="h-1 rounded-full transition-all duration-500"
                    style={{
                      width: activeDemo === i ? 24 : 8,
                      backgroundColor: activeDemo === i ? "#e07b39" : "rgba(255,255,255,0.1)",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  )
}
