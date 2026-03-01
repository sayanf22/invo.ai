"use client"

import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { Code2, ArrowRight, Zap, FileText, Globe, Bell } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const plannedFeatures = [
  { icon: FileText, title: "Document Generation API", desc: "Generate invoices, contracts, quotes, and proposals via REST API with a single call." },
  { icon: Globe, title: "Multi-country compliance", desc: "Built-in tax rules and legal requirements for all 11 supported countries, handled server-side." },
  { icon: Zap, title: "Webhooks", desc: "Real-time event notifications when documents are created, signed, or exported." },
  { icon: Code2, title: "SDKs", desc: "Official client libraries for JavaScript and Python to get you up and running fast." },
]

export default function DevelopersPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (email.trim()) setSubmitted(true)
  }

  return (
    <LandingLayout>
      <div className="min-h-screen" style={{ backgroundColor: "#faf8f5" }}>

        {/* Hero */}
        <section className="pt-36 pb-20 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 text-sm font-semibold shadow-sm">
              <Code2 size={14} style={{ color: "#e07b39" }} />
              <span className="text-stone-600">Developer API</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#fde8d8", color: "#c2622a" }}>Coming Soon</span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl font-medium tracking-tight leading-[1.08]" style={{ color: "#1a1a1a" }}>
              Build with<br />
              <span className="font-serif italic" style={{ color: "#e07b39" }}>Invo.ai API</span>
            </h1>

            <p className="text-lg text-stone-500 leading-relaxed max-w-lg mx-auto">
              We're building a developer API so you can generate compliant documents programmatically. Join the waitlist to get early access.
            </p>

            {/* Waitlist form */}
            {!submitted ? (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-5 py-3 rounded-full border border-stone-200 bg-white text-sm outline-none focus:border-stone-400 transition-colors"
                  style={{ color: "#1a1a1a" }}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: "#1a1a1a", color: "#ffffff" }}
                >
                  Join Waitlist <ArrowRight size={14} />
                </button>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-stone-200 text-sm font-semibold text-stone-600"
              >
                <Bell size={14} style={{ color: "#e07b39" }} />
                You're on the list — we'll notify you at launch
              </motion.div>
            )}

            <p className="text-xs text-stone-400">No spam. Just one email when the API launches.</p>
          </motion.div>
        </section>

        {/* What's planned */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-center mb-12"
            >
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#e07b39" }}>What we're building</p>
              <h2 className="font-display text-3xl sm:text-4xl font-medium" style={{ color: "#1a1a1a" }}>Planned API features</h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plannedFeatures.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="flex gap-4 p-6 rounded-2xl bg-white"
                  style={{ border: "1px solid #ebe8e3" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#faf8f5" }}>
                    <feat.icon size={18} style={{ color: "#e07b39" }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1" style={{ color: "#1a1a1a" }}>{feat.title}</p>
                    <p className="text-sm text-stone-400 leading-snug">{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Use the app in the meantime */}
        <section className="py-20 px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl mx-auto rounded-[2.5rem] p-12 text-center relative overflow-hidden"
            style={{ backgroundColor: "#1a1a1a" }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 0%, rgba(224,123,57,0.12) 0%, transparent 60%)" }} />
            <p className="text-xs font-bold uppercase tracking-widest mb-4 relative z-10" style={{ color: "#e07b39" }}>In the meantime</p>
            <h2 className="font-display text-3xl sm:text-4xl font-medium mb-3 relative z-10 leading-tight" style={{ color: "#faf8f5" }}>
              Use the web app<br />
              <span className="font-serif italic" style={{ color: "#e07b39" }}>right now</span>
            </h2>
            <p className="text-white/40 text-sm mb-8 relative z-10 max-w-sm mx-auto">
              Generate compliant documents in seconds through our conversational interface. Free to start, no credit card needed.
            </p>
            <Link
              href="/auth/signup"
              className="group relative z-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm hover:scale-105 transition-transform"
              style={{ backgroundColor: "#faf8f5", color: "#1a1a1a" }}
            >
              Get Started Free
              <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} />
            </Link>
          </motion.div>
        </section>

      </div>
    </LandingLayout>
  )
}
