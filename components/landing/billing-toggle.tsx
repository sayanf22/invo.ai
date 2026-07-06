"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check, Minus, ArrowRight, Clock, Zap, Lock } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { COUNTRY_PRICING, detectCountryFromTimezone, formatPrice, DEFAULT_COUNTRY, type CountryPricing, getValueHint } from "@/lib/pricing"
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
  children?: React.ReactNode
}

// ─── Animations ───────────────────────────────────────────────────────────────

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureRow({ text, tip, featured }: { text: string; tip: string | null; featured: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-[3px] w-[16px] h-[16px] rounded-full flex items-center justify-center shrink-0 ${
        featured ? "bg-[var(--landing-amber)]" : "bg-stone-900"
      }`}>
        <Check size={9} className="text-white" strokeWidth={3.5} />
      </div>
      <span className={`text-[13px] leading-snug ${featured ? "text-white/85" : "text-stone-700"}`}>
        {text}
        {tip && (
          <span className={`ml-1 text-[11px] ${featured ? "text-white/40" : "text-stone-400"}`}>
            ({tip})
          </span>
        )}
      </span>
    </div>
  )
}

function MissingRow({ text, featured }: { text: string; featured: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-[3px] w-[16px] h-[16px] rounded-full flex items-center justify-center shrink-0 ${
        featured ? "bg-white/8" : "bg-stone-100"
      }`}>
        <Minus size={8} className={featured ? "text-white/30" : "text-stone-400"} strokeWidth={3} />
      </div>
      <span className={`text-[13px] leading-snug ${featured ? "text-white/30" : "text-stone-400"}`}>
        {text}
      </span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BillingToggle({ plans, children }: BillingToggleProps) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly")
  const [cp, setCp] = useState<CountryPricing>(COUNTRY_PRICING[DEFAULT_COUNTRY])
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    // Step 1: Set timezone-based pricing instantly (no latency)
    const tzCountry = detectCountryFromTimezone()
    setCp(COUNTRY_PRICING[tzCountry] ?? COUNTRY_PRICING[DEFAULT_COUNTRY])

    // Step 2: Refine with IP-based detection (Cloudflare cf-ipcountry, more accurate)
    import('@/lib/pricing').then(({ detectCountryFromIP }) => {
      detectCountryFromIP().then((ipCountry) => {
        if (ipCountry && COUNTRY_PRICING[ipCountry]) {
          setCp(COUNTRY_PRICING[ipCountry])
        }
      })
    })

    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session)
    })
  }, [])

  const getPrice = (planId: string, cycle: "monthly" | "yearly") => {
    if (planId === "free") return "Free"
    const p = planId as "starter" | "pro" | "agency"
    if (!cp[p]) return ""
    return formatPrice(cp[p][cycle], cp)
  }

  return (
    <>
      {/* ── Billing toggle — landing style with offset shadow ── */}
      <div className="flex flex-col items-center gap-3 mb-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white border-[2px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(18,18,17,1)]">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
              billing === "monthly"
                ? "bg-[var(--landing-dark)] text-white"
                : "text-[var(--landing-text-muted)] hover:text-[var(--landing-text-dark)]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
              billing === "yearly"
                ? "bg-[var(--landing-dark)] text-white"
                : "text-[var(--landing-text-muted)] hover:text-[var(--landing-text-dark)]"
            }`}
          >
            Yearly
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                billing === "yearly"
                  ? "bg-[var(--landing-amber)] text-white"
                  : "bg-[var(--landing-amber)]/15 text-[var(--landing-amber)]"
              }`}
            >
              Save 20%
            </span>
          </button>
        </div>
        {/* Country indicator */}
        {cp.countryCode !== DEFAULT_COUNTRY && (
          <p className="text-[11px] text-[var(--landing-text-muted)] font-medium">
            Showing prices for <span className="font-bold text-[var(--landing-text-dark)]">{cp.country}</span>
            {" · "}
            <span className="text-[var(--landing-amber)] font-semibold">{cp.currency}</span>
          </p>
        )}
        {cp.countryCode === DEFAULT_COUNTRY && (
          <p className="text-[11px] text-[var(--landing-text-muted)] font-medium">
            Prices in <span className="font-bold text-[var(--landing-text-dark)]">Indian Rupees (₹)</span>
            {" · "}Shown based on your location
          </p>
        )}
      </div>

      {/* ── Cards ── */}
      <section className="pb-20 px-4 sm:px-8 pt-12 sm:pt-16">
        <motion.div
          className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5"
          variants={gridVariants}
          initial="hidden"
          animate="visible"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              variants={cardVariants}
              className={`relative flex flex-col rounded-[1.5rem] transition-all duration-300 ${
                plan.comingSoon ? "opacity-75" : "hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(18,18,17,1)]"
              }`}
              style={
                plan.featured
                  ? {
                      backgroundColor: "var(--landing-dark)",
                      border: "3px solid var(--landing-dark)",
                      boxShadow: "4px 4px 0px 0px rgba(18,18,17,1)",
                    }
                  : plan.comingSoon
                    ? {
                        backgroundColor: "#f5f3ef",
                        border: "3px solid #e8e4de",
                        boxShadow: "2px 2px 0px 0px rgba(18,18,17,0.15)",
                      }
                    : {
                        backgroundColor: "#ffffff",
                        border: "3px solid var(--landing-dark)",
                        boxShadow: "4px 4px 0px 0px rgba(18,18,17,1)",
                      }
              }
            >
              {/* Featured — warm amber glow inside the dark card */}
              {plan.featured && (
                <div
                  className="absolute inset-0 rounded-[1.2rem] pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(198,122,60,0.18) 0%, transparent 70%)",
                  }}
                />
              )}

              {/* Badge — landing style with offset shadow */}
              {plan.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap z-10 border-[2px] border-[var(--landing-dark)] ${
                    plan.badge === "Most Popular"
                      ? "bg-[var(--landing-amber)] text-white shadow-[2px_2px_0px_0px_rgba(18,18,17,1)]"
                      : "bg-white text-[var(--landing-text-muted)] shadow-[2px_2px_0px_0px_rgba(18,18,17,1)]"
                  }`}
                >
                  {plan.badge === "Most Popular" && <Zap size={9} strokeWidth={2.5} />}
                  {plan.badge === "Coming Soon" && <Clock size={9} strokeWidth={2.5} />}
                  {plan.badge}
                </div>
              )}

              <div className="p-6 flex flex-col flex-1 relative z-10">
                {/* Plan name */}
                <div
                  className={`text-[11px] font-bold uppercase tracking-[0.15em] mb-4 ${
                    plan.featured ? "text-[var(--landing-amber-light)]" : "text-[var(--landing-text-muted)]"
                  }`}
                >
                  {plan.name}
                </div>

                {/* Price — use display font to match landing */}
                <div className="mb-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${plan.id}-${billing}`}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-baseline gap-1"
                    >
                      <span
                        className={`font-sans font-semibold leading-none tracking-tight ${
                          plan.featured ? "text-white" : plan.comingSoon ? "text-stone-400" : "text-[var(--landing-text-dark)]"
                        }`}
                        style={{
                          fontSize: plan.comingSoon ? "1.75rem" : plan.monthly === 0 ? "2.5rem" : "2.25rem",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {plan.monthly === 0
                          ? "Free"
                          : plan.comingSoon
                            ? "Soon"
                            : getPrice(plan.id, billing)}
                      </span>
                      {plan.monthly > 0 && !plan.comingSoon && (
                        <span className={`text-sm font-medium ${plan.featured ? "text-white/45" : "text-stone-400"}`}>
                          /mo
                        </span>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  <div className="mt-1.5 min-h-[18px]">
                    {plan.monthly > 0 && !plan.comingSoon && billing === "yearly" && (
                      <p className={`text-xs font-semibold ${plan.featured ? "text-[var(--landing-amber-light)]" : "text-emerald-700"}`}>
                        Save 20% vs monthly
                      </p>
                    )}
                    {plan.monthly > 0 && !plan.comingSoon && billing === "monthly" && (
                      <p className={`text-xs ${plan.featured ? "text-white/40" : "text-stone-500"}`}>
                        or {getPrice(plan.id, "yearly")}/mo billed yearly
                      </p>
                    )}
                    {plan.monthly === 0 && (
                      <p className="text-xs text-stone-500 font-medium">Forever free</p>
                    )}
                    {plan.comingSoon && (
                      <p className="text-xs text-stone-500">Price announced at launch</p>
                    )}
                  </div>
                </div>

                {/* Value hint pill — matches landing pill style */}
                <div
                  className="inline-flex text-[11px] font-semibold mb-3 px-2.5 py-1 rounded-full w-fit border"
                  style={
                    plan.featured
                      ? { backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.1)" }
                      : { backgroundColor: "#faf7f2", color: "var(--landing-text-muted)", borderColor: "#ebe6dd" }
                  }
                >
                  {plan.id === "free" || plan.comingSoon
                    ? plan.valueHint
                    : getValueHint(plan.id as "starter" | "pro" | "agency", cp)}
                </div>

                <p className={`text-sm mb-5 leading-relaxed ${plan.featured ? "text-white/60" : "text-[var(--landing-text-muted)]"}`}>
                  {plan.desc}
                </p>

                {/* CTA — matches landing page button style */}
                <div className="mb-5">
                  <Link
                    href={plan.comingSoon ? "#" : isLoggedIn ? `/choose-plan?billing=${billing}&plan=${plan.id}` : plan.href}
                    className={`block w-full text-center py-3 rounded-xl font-bold text-sm border-[2px] transition-all duration-150 active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(18,18,17,1)] ${
                      plan.comingSoon
                        ? "cursor-default bg-stone-200 text-stone-400 border-stone-300"
                        : plan.featured
                          ? "bg-white text-[var(--landing-dark)] border-white hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.25)] shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]"
                          : "bg-[var(--landing-dark)] text-white border-[var(--landing-dark)] hover:-translate-y-[1px] hover:shadow-[3px_3px_0px_0px_rgba(18,18,17,1)] shadow-[2px_2px_0px_0px_rgba(18,18,17,1)]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                  <p className={`text-center text-[11px] mt-2 font-medium ${plan.featured ? "text-white/40" : "text-stone-500"}`}>
                    {plan.ctaNote}
                  </p>
                </div>

                {/* Divider */}
                <div className={`h-px mb-5 ${plan.featured ? "bg-white/10" : "bg-stone-200/70"}`} />

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

        {/* Trust strip — inline with landing editorial feel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="max-w-2xl mx-auto mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-[var(--landing-text-muted)] font-medium"
        >
          <span className="flex items-center gap-1.5"><Lock size={11} strokeWidth={2.5} /> SSL encrypted</span>
          <span className="w-1 h-1 rounded-full bg-stone-300" />
          <span className="flex items-center gap-1.5"><Check size={11} strokeWidth={2.5} /> No hidden fees</span>
          <span className="w-1 h-1 rounded-full bg-stone-300" />
          <span className="flex items-center gap-1.5"><Zap size={11} strokeWidth={2.5} /> Cancel anytime</span>
          <span className="w-1 h-1 rounded-full bg-stone-300" />
          <span className="flex items-center gap-1.5"><Clock size={11} strokeWidth={2.5} /> 14-day free trial</span>
        </motion.div>
      </section>

      {/* ── "Real cost" comparison section — editorial landing style ── */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 bg-[var(--landing-cream)] relative overflow-hidden">
        {/* Grid pattern matching landing */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-14"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 text-[var(--landing-amber)]">
              The Real Cost
            </p>
            <h2
              className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-[var(--landing-text-dark)] leading-[1.05]"
              style={{ textShadow: "2px 2px 0px rgba(26,26,26,0.06), 0 6px 20px rgba(26,26,26,0.04)" }}
            >
              What are you actually<br />
              <span
                className="font-serif italic"
                style={{
                  backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                paying right now?
              </span>
            </h2>
            <p className="mt-5 text-[var(--landing-text-muted)] text-base max-w-lg mx-auto leading-relaxed">
              A freelancer spending 3 hours on one invoice at $50/hr loses $150 in billable time. Every single time.
            </p>
          </motion.div>

          {/* Rows — with landing offset-shadow treatment */}
          <div className="space-y-4">
            {/* Manual drafting */}
            <ComparisonRow
              delay={0}
              title="Manual drafting"
              desc="Word, Google Docs, or from scratch"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
              stats={[
                { value: "2–4 hrs", label: "per doc" },
                { value: "$100–200", label: "lost time" },
              ]}
              total="~$3k/mo"
              totalLabel="Ouch"
              variant="plain"
            />

            {/* Hiring a VA */}
            <ComparisonRow
              delay={0.1}
              title="Hiring a VA"
              desc="Virtual assistant at $15–25/hr"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              }
              stats={[
                { value: "1–2 hrs", label: "per doc" },
                { value: "$15–25", label: "per doc" },
              ]}
              total="$450/mo"
              totalLabel="Expensive"
              variant="plain"
            />

            {/* Clorefy Pro — dark featured row */}
            <ComparisonRow
              delay={0.2}
              title="Clorefy Pro"
              badge="Recommended"
              desc="AI-generated, compliant, ready in seconds"
              icon={
                <motion.svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  animate={{ rotate: 180 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <path d="M12 2L12.5 11.5L22 12L12.5 12.5L12 22L11.5 12.5L2 12L11.5 11.5L12 2Z" fill="currentColor" />
                </motion.svg>
              }
              stats={[
                { value: "< 30s", label: "per doc", animated: true },
                { value: "~$0.13", label: "per doc", highlight: true },
              ]}
              total={`${formatPrice(cp.pro.yearly, cp)}/mo`}
              totalLabel="150 docs"
              variant="featured"
            />
          </div>

          {/* Stat strip — landing-style cards */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {[
              { num: "99%", label: "Faster than manual" },
              { num: "$5,000+", label: "Saved annually" },
              { num: "30s", label: "Avg generation time" },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white border-[2.5px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(18,18,17,1)]"
              >
                <div className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--landing-text-dark)] leading-none mb-1.5">
                  {stat.num}
                </div>
                <div className="text-[12px] font-medium text-[var(--landing-text-muted)]">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Injected content (e.g. ComparisonTable) ── */}
      {children}

      {/* ── Bottom CTA — editorial landing style with offset shadow ── */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 bg-[var(--landing-cream)]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto rounded-[2rem] p-10 sm:p-16 text-center relative overflow-hidden bg-white border-[3px] border-[var(--landing-dark)]"
          style={{ boxShadow: "6px 6px 0px 0px rgba(18,18,17,1)" }}
        >
          {/* Subtle amber glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(198,122,60,0.1) 0%, transparent 70%)",
            }}
          />

          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 relative z-10 text-[var(--landing-amber)]">
            Start Today
          </p>
          <h2
            className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-5 relative z-10 leading-[1.05] text-[var(--landing-text-dark)]"
            style={{ textShadow: "2px 2px 0px rgba(26,26,26,0.06), 0 6px 20px rgba(26,26,26,0.04)" }}
          >
            Your first document<br />
            <span
              className="font-serif italic"
              style={{
                backgroundImage: "linear-gradient(120deg, #d97757 0%, #e07b39 45%, #b8421c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              in 30 seconds
            </span>
          </h2>
          <p className="text-[var(--landing-text-muted)] text-base mb-8 relative z-10 max-w-md mx-auto leading-relaxed">
            Free forever. No credit card. No setup. Just describe what you need.
          </p>
          <Link
            href={isLoggedIn ? "/choose-plan" : "/auth/signup"}
            className="group relative z-10 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-[15px] bg-[var(--landing-dark)] text-white border-[2.5px] border-[var(--landing-dark)] shadow-[4px_4px_0px_0px_rgba(18,18,17,1)] hover:shadow-[6px_6px_0px_0px_rgba(18,18,17,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(18,18,17,1)] transition-all duration-150"
          >
            Get Started Free
            <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
          </Link>
        </motion.div>
      </section>
    </>
  )
}

// ─── ComparisonRow helper ─────────────────────────────────────────────────────

function ComparisonRow({
  delay,
  title,
  desc,
  icon,
  stats,
  total,
  totalLabel,
  variant,
  badge,
}: {
  delay: number
  title: string
  desc: string
  icon: React.ReactNode
  stats: Array<{ value: string; label: string; animated?: boolean; highlight?: boolean }>
  total: string
  totalLabel: string
  variant: "plain" | "featured"
  badge?: string
}) {
  const isFeatured = variant === "featured"

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 rounded-2xl px-5 sm:px-7 py-5 sm:py-6 transition-all ${
        isFeatured
          ? "bg-[var(--landing-dark)] border-[2.5px] border-[var(--landing-dark)]"
          : "bg-white border-[2.5px] border-[var(--landing-dark)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(18,18,17,1)]"
      }`}
      style={{
        boxShadow: isFeatured
          ? "4px 4px 0px 0px rgba(198,122,60,1)"
          : "3px 3px 0px 0px rgba(18,18,17,1)",
      }}
    >
      {isFeatured && (
        <div
          className="absolute inset-0 rounded-[1.3rem] pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(198,122,60,0.12) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Icon */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 relative z-10 ${
          isFeatured
            ? "bg-[var(--landing-amber)]/15 text-[var(--landing-amber-light)]"
            : "bg-stone-100 text-stone-500"
        }`}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-base font-bold ${isFeatured ? "text-white" : "text-[var(--landing-text-dark)]"}`}>
            {title}
          </p>
          {badge && (
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em] bg-[var(--landing-amber)]/20 text-[var(--landing-amber-light)] border border-[var(--landing-amber)]/25">
              {badge}
            </span>
          )}
        </div>
        <p className={`text-[13px] mt-0.5 ${isFeatured ? "text-white/60" : "text-[var(--landing-text-muted)]"}`}>
          {desc}
        </p>
      </div>

      {/* Stats */}
      <div
        className={`flex items-center justify-between sm:justify-end gap-6 sm:gap-10 shrink-0 relative z-10 pt-3 sm:pt-0 mt-3 sm:mt-0 ${
          isFeatured ? "border-t border-white/10" : "border-t border-stone-200/70"
        } sm:border-0`}
      >
        {stats.map((stat, i) => (
          <div key={i} className="text-left sm:text-right">
            {stat.animated ? (
              <motion.p
                className={`text-[15px] font-bold ${isFeatured ? "text-white" : "text-[var(--landing-text-dark)]"}`}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                {stat.value}
              </motion.p>
            ) : (
              <p
                className={`text-[15px] font-bold ${
                  stat.highlight
                    ? "text-[var(--landing-amber)]"
                    : isFeatured
                      ? "text-white"
                      : "text-[var(--landing-text-dark)]"
                }`}
              >
                {stat.value}
              </p>
            )}
            <p className={`text-[10px] font-bold uppercase tracking-[0.1em] mt-0.5 ${
              isFeatured ? "text-white/50" : "text-stone-400"
            }`}>
              {stat.label}
            </p>
          </div>
        ))}
        <div className="text-right w-24 sm:w-28">
          <p className={`text-[15px] font-bold ${isFeatured ? "text-white" : "text-[var(--landing-text-dark)]"}`}>
            {total}
          </p>
          <p className={`text-[10px] font-bold uppercase tracking-[0.1em] mt-0.5 ${
            isFeatured ? "text-[var(--landing-amber-light)]" : "text-[var(--landing-amber)]"
          }`}>
            {totalLabel}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
