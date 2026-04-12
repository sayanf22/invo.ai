"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, Minus, ArrowRight, Sparkles, Clock, Zap, Lock } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { COUNTRY_PRICING, detectCountryFromTimezone, formatPrice, DEFAULT_COUNTRY, type CountryPricing } from "@/lib/pricing"
import { createClient } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanFeature {
  text: string
  tip: string | null
}

export interface PlanData {
  id: string
  name: string
  badge: string | null
  monthly: number
  yearly: number
  desc: string
  valueHint: string
  cta: string
  ctaNote: string
  href: string
  featured: boolean
  comingSoon: boolean
  features: PlanFeature[]
  missing: string[]
}

export interface BillingToggleProps {
  plans: PlanData[]
}

// ─── Animations ───────────────────────────────────────────────────────────────

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureRow({ text, tip, featured }: { text: string; tip: string | null; featured: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ${featured ? "bg-amber-500" : "bg-stone-100"}`}>
        <Check size={10} className={featured ? "text-white" : "text-stone-500"} strokeWidth={3} />
      </div>
      <span className={`text-sm leading-snug ${featured ? "text-white/80" : "text-stone-600"}`}>
        {text}
        {tip && <span className={`ml-1.5 text-xs ${featured ? "text-white/35" : "text-stone-400"}`}>({tip})</span>}
      </span>
    </div>
  )
}

function MissingRow({ text, featured }: { text: string; featured: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ${featured ? "bg-white/8" : "bg-stone-50"}`}>
        <Minus size={8} className={featured ? "text-white/25" : "text-stone-300"} strokeWidth={3} />
      </div>
      <span className={`text-sm leading-snug ${featured ? "text-white/25" : "text-stone-350"}`} style={{ color: featured ? undefined : "#c4bfba" }}>{text}</span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BillingToggle({ plans }: BillingToggleProps) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly")
  const [cp, setCp] = useState<CountryPricing>(COUNTRY_PRICING[DEFAULT_COUNTRY])
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const detected = detectCountryFromTimezone()
    setCp(COUNTRY_PRICING[detected] || COUNTRY_PRICING[DEFAULT_COUNTRY])

    // Check if user is logged in to adjust CTA links
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session)
    })
  }, [])

  // Helper to get localized price for a plan
  const getPrice = (planId: string, cycle: "monthly" | "yearly") => {
    if (planId === "free") return "Free"
    const p = planId as "starter" | "pro" | "agency"
    if (!cp[p]) return ""
    return formatPrice(cp[p][cycle], cp)
  }

  return (
    <>
      {/* ── Billing toggle ── */}
      <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-white border border-stone-200 shadow-sm">
        <button
          onClick={() => setBilling("monthly")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${billing === "monthly" ? "text-white shadow-sm" : "text-stone-400 hover:text-stone-700"}`}
          style={billing === "monthly" ? { backgroundColor: "#1a1a1a" } : {}}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling("yearly")}
          className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${billing === "yearly" ? "text-white shadow-sm" : "text-stone-400 hover:text-stone-700"}`}
          style={billing === "yearly" ? { backgroundColor: "#1a1a1a" } : {}}
        >
          Yearly
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full transition-all"
            style={billing === "yearly"
              ? { backgroundColor: "#e07b39", color: "#fff" }
              : { backgroundColor: "#fde8d8", color: "#c2622a" }}
          >
            Save ~20%
          </span>
        </button>
      </div>

      {/* ── Cards ── */}
      <section className="pb-20 px-4 sm:px-8 pt-16">
        <motion.div
          className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
          variants={gridVariants}
          initial="hidden"
          animate="visible"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              variants={cardVariants}
              className={`relative flex flex-col rounded-3xl transition-all duration-300 ${
                plan.comingSoon ? "opacity-70" : plan.featured ? "" : "hover:-translate-y-1"
              }`}
              style={plan.featured
                ? {
                    background: "linear-gradient(145deg, #232323 0%, #1a1a1a 60%, #1f1c18 100%)",
                    boxShadow: "0 0 0 1px rgba(224,123,57,0.35), 0 24px 48px -8px rgba(0,0,0,0.45), 0 0 80px -20px rgba(224,123,57,0.15)",
                  }
                : plan.comingSoon
                ? { backgroundColor: "#f5f3f0", border: "1px solid #e8e4de" }
                : { backgroundColor: "#ffffff", border: "1px solid #ebe8e3", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }
              }
            >
              {/* Featured glow ring */}
              {plan.featured && (
                <div
                  className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{
                    background: "linear-gradient(145deg, rgba(224,123,57,0.12) 0%, transparent 50%)",
                  }}
                />
              )}

              {/* Badge */}
              {plan.badge && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-md whitespace-nowrap text-white z-10"
                  style={{ backgroundColor: plan.badge === "Most Popular" ? "#e07b39" : "#78716c" }}
                >
                  {plan.badge === "Most Popular" && <Sparkles size={9} />}
                  {plan.badge === "Coming Soon" && <Clock size={9} />}
                  {plan.badge}
                </div>
              )}

              <div className="p-6 flex flex-col flex-1 relative z-10">
                {/* Plan name */}
                <div className={`text-[11px] font-bold uppercase tracking-widest mb-4 ${plan.featured ? "text-amber-400" : "text-stone-400"}`}>
                  {plan.name}
                </div>

                {/* Price */}
                <div className="mb-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${plan.id}-${billing}`}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-baseline gap-1"
                    >
                      <span
                        className={`font-semibold leading-none tracking-tight ${plan.featured ? "text-white" : plan.comingSoon ? "text-stone-300" : "text-stone-900"}`}
                        style={{ fontSize: plan.comingSoon ? "1.5rem" : plan.monthly === 0 ? "2.75rem" : "2.5rem", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}
                      >
                        {plan.monthly === 0 ? "Free" : plan.comingSoon ? "Coming Soon" : getPrice(plan.id, billing)}
                      </span>
                      {plan.monthly > 0 && !plan.comingSoon && (
                        <span className={`text-sm font-medium ${plan.featured ? "text-white/35" : "text-stone-400"}`}>/mo</span>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {plan.monthly > 0 && !plan.comingSoon && billing === "yearly" && (
                    <p className={`text-xs mt-1.5 font-medium ${plan.featured ? "text-amber-400/80" : "text-emerald-600"}`}>
                      Save ~20% vs monthly
                    </p>
                  )}
                  {plan.monthly > 0 && !plan.comingSoon && billing === "monthly" && (
                    <p className={`text-xs mt-1.5 ${plan.featured ? "text-white/30" : "text-stone-400"}`}>
                      or {getPrice(plan.id, "yearly")}/mo billed yearly
                    </p>
                  )}
                  {plan.monthly === 0 && (
                    <p className="text-xs mt-1.5 text-stone-400">forever free</p>
                  )}
                  {plan.comingSoon && (
                    <p className="text-xs mt-1.5 text-stone-400">price announced at launch</p>
                  )}
                </div>

                {/* Value hint */}
                <div
                  className="text-xs font-medium mb-3 px-2.5 py-1 rounded-full inline-block w-fit"
                  style={plan.featured
                    ? { backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                    : { backgroundColor: "#f5f3f0", color: "#a09890" }
                  }
                >
                  {plan.valueHint}
                </div>

                <p className={`text-sm mb-5 leading-snug ${plan.featured ? "text-white/55" : "text-stone-400"}`}>
                  {plan.desc}
                </p>

                {/* CTA */}
                <div className="mb-6">
                  <Link
                    href={plan.comingSoon ? "#" : isLoggedIn ? `/choose-plan?billing=${billing}&plan=${plan.id}` : plan.href}
                    className={`block w-full text-center py-3 rounded-2xl font-semibold text-sm transition-all duration-200 ${
                      plan.comingSoon
                        ? "cursor-default"
                        : plan.featured
                        ? "hover:opacity-90 active:scale-[0.98]"
                        : "hover:opacity-90 active:scale-[0.98]"
                    }`}
                    style={plan.comingSoon
                      ? { backgroundColor: "#ede9e4", color: "#b5afa8" }
                      : plan.featured
                      ? { backgroundColor: "#ffffff", color: "#1a1a1a" }
                      : { backgroundColor: "#1a1a1a", color: "#ffffff" }
                    }
                  >
                    {plan.cta}
                  </Link>
                  <p className={`text-center text-xs mt-2 ${plan.featured ? "text-white/25" : "text-stone-400"}`}>
                    {plan.ctaNote}
                  </p>
                </div>

                {/* Divider */}
                <div className={`h-px mb-5 ${plan.featured ? "bg-white/8" : "bg-stone-100"}`} />

                {/* Features */}
                <div className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <FeatureRow key={f.text} text={f.text} tip={f.tip} featured={plan.featured} />
                  ))}
                  {plan.missing.map((f) => (
                    <MissingRow key={f} text={f} featured={plan.featured} />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="max-w-xl mx-auto mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-stone-400"
        >
          <span className="flex items-center gap-1.5"><Lock size={11} /> SSL encrypted</span>
          <span className="flex items-center gap-1.5"><Check size={11} /> No hidden fees</span>
          <span className="flex items-center gap-1.5"><Zap size={11} /> Cancel anytime</span>
          <span className="flex items-center gap-1.5"><Clock size={11} /> 14-day free trial</span>
        </motion.div>
      </section>

      {/* ── Value comparison ── */}
      <section className="py-24 px-6" style={{ backgroundColor: "#ffffff" }}>
        <div className="max-w-4xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-14"
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#e07b39" }}>The real cost</p>
            <h2 className="font-display text-4xl sm:text-5xl font-medium leading-tight" style={{ color: "#1a1a1a" }}>
              What are you actually<br />
              <span className="font-serif italic" style={{ color: "#e07b39" }}>paying right now?</span>
            </h2>
            <p className="mt-4 text-stone-400 text-base max-w-md mx-auto">
              A freelancer spending 3 hours drafting one invoice at $50/hr loses $150 in billable time. Every single time.
            </p>
          </motion.div>

          {/* Comparison rows */}
          <div className="space-y-3">

            {/* Manual drafting */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-4 rounded-2xl px-6 py-5 bg-white"
              style={{ border: "1px solid #ebe8e3" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#fee2e2" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
                  <polyline points="12,6 12,12 16,14" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Manual drafting</p>
                <p className="text-xs text-stone-400 mt-0.5">Word, Google Docs, or from scratch</p>
              </div>
              <div className="hidden sm:flex items-center gap-8 shrink-0">
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-red-500">2–4 hrs</p>
                  <p className="text-xs text-stone-400">per doc</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-red-500">$100–200</p>
                  <p className="text-xs text-stone-400">lost time</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-stone-500">~$3,000+/mo</p>
                  <span className="text-xs px-2 py-0.5 rounded-full text-red-500" style={{ backgroundColor: "#fee2e2" }}>ouch</span>
                </div>
              </div>
            </motion.div>

            {/* Hiring a VA */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-4 rounded-2xl px-6 py-5 bg-white"
              style={{ border: "1px solid #ebe8e3" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#ffedd5" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#f97316" strokeWidth="2"/>
                  <circle cx="9" cy="7" r="4" stroke="#f97316" strokeWidth="2"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Hiring a VA</p>
                <p className="text-xs text-stone-400 mt-0.5">Virtual assistant at $15–25/hr</p>
              </div>
              <div className="hidden sm:flex items-center gap-8 shrink-0">
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-orange-500">1–2 hrs</p>
                  <p className="text-xs text-stone-400">per doc</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-orange-500">$15–25</p>
                  <p className="text-xs text-stone-400">per doc</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-stone-500">$450–750/mo</p>
                  <span className="text-xs px-2 py-0.5 rounded-full text-orange-500" style={{ backgroundColor: "#ffedd5" }}>expensive</span>
                </div>
              </div>
            </motion.div>

            {/* Clorefy — featured row */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-4 rounded-2xl px-6 py-5 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #232323 0%, #1a1a1a 100%)",
                boxShadow: "0 0 0 1px rgba(224,123,57,0.3), 0 8px 32px -8px rgba(0,0,0,0.3)",
              }}
            >
              {/* Subtle glow */}
              <div className="absolute top-0 left-0 w-32 h-full pointer-events-none" style={{ background: "linear-gradient(90deg, rgba(224,123,57,0.08) 0%, transparent 100%)" }} />

              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative z-10" style={{ backgroundColor: "rgba(224,123,57,0.2)" }}>
                <motion.svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#e07b39"/>
                </motion.svg>
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">Clorefy Pro</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(224,123,57,0.2)", color: "#e07b39" }}>recommended</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>AI-generated, compliant, ready in seconds</p>
              </div>
              <div className="hidden sm:flex items-center gap-8 shrink-0 relative z-10">
                <div className="text-center">
                  <motion.p
                    className="font-display text-lg font-bold text-white"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >&lt; 30s</motion.p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>per doc</p>
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-bold" style={{ color: "#e07b39" }}>~$0.13</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>per doc</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">{getPrice("pro", "yearly")}/mo</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(224,123,57,0.15)", color: "#e07b39" }}>150 docs</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-8 grid grid-cols-3 gap-3"
          >
            {[
              { num: "99%", label: "faster than manual" },
              { num: "$5,000+", label: "saved annually" },
              { num: "30s", label: "avg generation time" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35 + i * 0.07 }}
                className="rounded-2xl px-5 py-4 text-center"
                style={{ backgroundColor: "#faf8f5", border: "1px solid #ebe8e3" }}
              >
                <div className="font-display text-2xl font-bold mb-0.5" style={{ color: "#1a1a1a" }}>{stat.num}</div>
                <div className="text-xs text-stone-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-white">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl mx-auto rounded-[2.5rem] p-14 sm:p-20 text-center relative overflow-hidden"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 0%, rgba(224,123,57,0.12) 0%, transparent 60%)" }} />
          <p className="text-xs font-bold uppercase tracking-widest mb-4 relative z-10" style={{ color: "#e07b39" }}>Start today</p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium mb-4 relative z-10 leading-tight" style={{ color: "#faf8f5" }}>
            Your first document<br />
            <span className="font-serif italic" style={{ color: "#e07b39" }}>in 30 seconds</span>
          </h2>
          <p className="text-white/40 text-sm mb-8 relative z-10 max-w-sm mx-auto">
            Free forever. No credit card. No setup. Just describe what you need.
          </p>
          <Link
            href={isLoggedIn ? "/choose-plan" : "/auth/signup"}
            className="group relative z-10 inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm hover:scale-105 transition-transform"
            style={{ backgroundColor: "#faf8f5", color: "#1a1a1a" }}
          >
            Get Started Free
            <ArrowRight className="transition-transform group-hover:translate-x-1" size={16} />
          </Link>
        </motion.div>
      </section>
    </>
  )
}
