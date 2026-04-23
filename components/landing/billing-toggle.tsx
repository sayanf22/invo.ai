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
      <section className="py-24 px-6 bg-white dark:bg-slate-950">
        <div className="max-w-4xl mx-auto">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-14"
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3 text-primary">The real cost</p>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              What are you actually<br />
              <span className="text-primary">paying right now?</span>
            </h2>
            <p className="mt-4 text-slate-500 dark:text-slate-400 text-[15px] max-w-md mx-auto">
              A freelancer spending 3 hours drafting one invoice at $50/hr loses $150 in billable time. Every single time.
            </p>
          </motion.div>

          {/* Comparison rows */}
          <div className="space-y-4">

            {/* Manual drafting */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-4 rounded-2xl px-6 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-500/10 text-red-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-white">Manual drafting</p>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Word, Google Docs, or from scratch</p>
              </div>
              <div className="hidden sm:flex items-center gap-10 shrink-0">
                <div className="text-right">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">2–4 hrs</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">per doc</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">$100–200</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">lost time</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">~$3,000+/mo</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">Ouch</p>
                </div>
              </div>
            </motion.div>

            {/* Hiring a VA */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-4 rounded-2xl px-6 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-white">Hiring a VA</p>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Virtual assistant at $15–25/hr</p>
              </div>
              <div className="hidden sm:flex items-center gap-10 shrink-0">
                <div className="text-right">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">1–2 hrs</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">per doc</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">$15–25</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">per doc</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-white">$450–750/mo</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Expensive</p>
                </div>
              </div>
            </motion.div>

            {/* Clorefy — featured row */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-4 rounded-2xl px-6 py-5 relative overflow-hidden bg-slate-900 border border-slate-800 shadow-xl"
            >
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-gradient-to-r from-primary/10 to-transparent" />
              
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative z-10 bg-primary/20 text-primary">
                <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
                </motion.svg>
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold text-white">Clorefy Pro</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-primary/20 text-primary">Recommended</span>
                </div>
                <p className="text-[13px] text-slate-400 mt-0.5">AI-generated, compliant, ready in seconds</p>
              </div>
              <div className="hidden sm:flex items-center gap-10 shrink-0 relative z-10">
                <div className="text-right">
                  <motion.p
                    className="text-[15px] font-bold text-white"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >&lt; 30s</motion.p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">per doc</p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-bold text-primary">~$0.13</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">per doc</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-[15px] font-bold text-white">{getPrice("pro", "yearly")}/mo</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">150 docs</p>
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
            className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {[
              { num: "99%", label: "Faster than manual" },
              { num: "$5,000+", label: "Saved annually" },
              { num: "30s", label: "Avg generation time" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35 + i * 0.07 }}
                className="rounded-2xl px-6 py-5 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">{stat.num}</div>
                <div className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto rounded-[2.5rem] p-14 sm:p-20 text-center relative overflow-hidden bg-slate-900 shadow-2xl"
        >
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/10 to-transparent" />
          <p className="text-xs font-bold uppercase tracking-widest mb-4 relative z-10 text-primary">Start today</p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 relative z-10 leading-tight text-white">
            Your first document<br />
            <span className="text-primary">in 30 seconds</span>
          </h2>
          <p className="text-slate-400 text-[15px] mb-10 relative z-10 max-w-md mx-auto">
            Free forever. No credit card. No setup. Just describe what you need.
          </p>
          <Link
            href={isLoggedIn ? "/choose-plan" : "/auth/signup"}
            className="group relative z-10 inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-[15px] bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
          </Link>
        </motion.div>
      </section>
    </>
  )
}
