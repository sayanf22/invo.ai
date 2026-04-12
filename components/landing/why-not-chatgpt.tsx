"use client"

import { motion } from "framer-motion"
import { Brain, RefreshCcw, ShieldCheck, Zap, X, Check } from "lucide-react"

const comparisons = [
  {
    chatgpt: "Re-enter your business name, address, GST number every single time",
    clorefy: "Saved once during onboarding — auto-filled in every document, forever",
  },
  {
    chatgpt: "Copy-paste your client's details from old emails or spreadsheets",
    clorefy: "Client info carried over automatically across linked documents",
  },
  {
    chatgpt: "Hope the AI gets your country's tax rules right",
    clorefy: "44 compliance templates — correct tax rates, mandatory fields, legal requirements for 11 countries",
  },
  {
    chatgpt: "Manually format the output into a PDF that looks professional",
    clorefy: "9 PDF templates, live preview, export as PDF/DOCX/Image — ready to send",
  },
]

const pillars = [
  {
    icon: Brain,
    title: "Persistent Memory",
    desc: "Your business profile, tax IDs, payment terms, bank details — collected once, used in every document.",
  },
  {
    icon: ShieldCheck,
    title: "Country Compliance",
    desc: "GST for India, VAT for EU, Sales Tax for US — auto-applied based on your country. No guessing.",
  },
  {
    icon: RefreshCcw,
    title: "Document Chains",
    desc: "Invoice → Contract → Quotation for the same client. All details carry over. Zero re-entry.",
  },
  {
    icon: Zap,
    title: "One Prompt, Done",
    desc: "\"Invoice Acme Corp $5,000 for web design\" — complete document with your branding in 30 seconds.",
  },
]

export function WhyNotChatGPT() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-10 bg-[var(--landing-cream)]">
      <div className="max-w-5xl mx-auto">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--landing-amber)" }}>
            The honest question
          </p>
          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[0.95] mb-5" style={{ color: "var(--landing-text-dark)" }}>
            &ldquo;Why not just use<br />
            <span className="font-serif italic" style={{ color: "var(--landing-amber)" }}>ChatGPT?</span>&rdquo;
          </h2>
          <p className="text-base sm:text-lg text-[var(--landing-text-muted)] max-w-xl mx-auto leading-relaxed">
            ChatGPT doesn&apos;t know your GST number, your payment terms, or your last client&apos;s details. Clorefy does.
          </p>
        </motion.div>

        {/* Comparison rows */}
        <div className="space-y-3 mb-20">
          {comparisons.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
            >
              {/* ChatGPT side */}
              <div className="flex items-start gap-3 rounded-2xl px-5 py-4 bg-white border border-stone-200/60">
                <div className="mt-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <X size={10} className="text-red-500" strokeWidth={3} />
                </div>
                <p className="text-sm text-stone-500 leading-snug">{row.chatgpt}</p>
              </div>
              {/* Clorefy side */}
              <div className="flex items-start gap-3 rounded-2xl px-5 py-4 border border-stone-200/60"
                style={{ background: "linear-gradient(135deg, #faf8f5 0%, #f5f0e8 100%)" }}>
                <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(224,123,57,0.15)" }}>
                  <Check size={10} style={{ color: "#e07b39" }} strokeWidth={3} />
                </div>
                <p className="text-sm font-medium leading-snug" style={{ color: "var(--landing-text-dark)" }}>{row.clorefy}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pillar cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <h3 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--landing-text-dark)" }}>
            What makes Clorefy <span className="italic font-serif" style={{ color: "var(--landing-amber)" }}>different</span>
          </h3>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl p-6 bg-white border border-stone-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(224,123,57,0.1)" }}>
                <p.icon size={20} style={{ color: "#e07b39" }} />
              </div>
              <h4 className="text-base font-semibold mb-1.5" style={{ color: "var(--landing-text-dark)" }}>{p.title}</h4>
              <p className="text-sm text-[var(--landing-text-muted)] leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
