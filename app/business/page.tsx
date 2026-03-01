"use client"

import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { Shield, Lock, Users, Zap, CheckCircle, ArrowRight, Building2, BarChart3, BookTemplate, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
}

const teamFeatures = [
    {
        icon: BookTemplate,
        title: "Shared templates",
        desc: "Create once, use everywhere. Team-wide templates ensure consistency across every document your organization produces."
    },
    {
        icon: Users,
        title: "Shared snippets",
        desc: "Standard clauses, terms, and boilerplate that everyone can access. No more copy-pasting from old documents."
    },
    {
        icon: BarChart3,
        title: "Usage dashboards",
        desc: "See who's creating what, track adoption, and measure time saved across your entire organization."
    }
]

const faqs = [
    { q: "How do I try Invo with my team?", a: "Sign up for a free account and invite your team members. You can try the Starter plan with up to 5 users before upgrading." },
    { q: "Is there a minimum team size?", a: "No minimum. Whether you're a team of 2 or 2,000, Invo scales with you." },
    { q: "What if I already have a personal account?", a: "You can merge your personal account into a team workspace without losing any documents or templates." },
    { q: "How does billing work for teams?", a: "One centralized bill for your entire organization. Add or remove seats anytime — you only pay for active users." },
]

export default function BusinessPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="relative pt-32 pb-20 px-6 sm:px-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/40 via-transparent to-transparent opacity-60 pointer-events-none" />
                    <div className="max-w-5xl mx-auto text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100/80 text-[var(--landing-amber)] font-semibold text-sm mb-8 border border-orange-200/50">
                                <Building2 size={16} />
                                <span>Invo for Teams</span>
                            </div>
                            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight text-[var(--landing-text-dark)] mb-6 leading-[1.1]">
                                Get your whole team <br />
                                <span className="font-serif italic text-[var(--landing-amber)]">generating faster</span>
                            </h1>
                            <p className="text-xl sm:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto mb-12">
                                Powerful AI document generation for your whole team, with centralized security controls, shared templates, and better pricing.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href="/contact-sales" className="group px-8 py-4 rounded-full bg-[var(--landing-dark)] text-[var(--landing-cream)] font-bold text-lg hover:scale-105 transition-all shadow-xl hover:shadow-2xl inline-flex items-center gap-2">
                                    Talk to Sales <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                                </Link>
                                <Link href="/auth/register" className="px-8 py-4 rounded-full bg-white text-[var(--landing-text-dark)] font-bold text-lg border border-stone-200 hover:bg-stone-50 transition-all">
                                    Start Free Trial
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Security Badges */}
                <section className="py-24 px-6 sm:px-10">
                    <div className="max-w-5xl mx-auto">
                        <motion.div {...fadeUp} className="text-center mb-16">
                            <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
                                Startup-grade speed,<br />
                                <span className="text-[var(--landing-amber)]">enterprise-grade security.</span>
                            </h2>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { icon: Shield, title: "SOC 2 Type II", desc: "Independently audited and certified security controls for enterprise compliance." },
                                { icon: Lock, title: "HIPAA Compliance", desc: "HIPAA-eligible infrastructure for organizations handling sensitive data." },
                                { icon: CheckCircle, title: "ISO 27001", desc: "International standard for information security management systems." },
                            ].map((badge, i) => (
                                <motion.div
                                    key={badge.title}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1, duration: 0.5 }}
                                    className="p-8 rounded-[2rem] bg-white border border-stone-100 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center text-green-600 mx-auto mb-6">
                                        <badge.icon size={32} />
                                    </div>
                                    <h3 className="font-display text-2xl font-bold mb-3">{badge.title}</h3>
                                    <p className="text-[var(--landing-text-muted)] leading-relaxed">{badge.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Team Features */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-6xl mx-auto">
                        <motion.div {...fadeUp} className="text-center mb-16">
                            <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
                                Built for teams,<br /><span className="text-[var(--landing-amber)]">not just individuals</span>
                            </h2>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {teamFeatures.map((feat, i) => (
                                <motion.div
                                    key={feat.title}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1, duration: 0.6 }}
                                    className="group p-8 rounded-[2rem] bg-[var(--landing-cream)] border border-stone-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center text-[var(--landing-amber)] mb-6 group-hover:scale-110 transition-transform">
                                        <feat.icon size={28} />
                                    </div>
                                    <h3 className="font-display text-2xl font-bold mb-3">{feat.title}</h3>
                                    <p className="text-[var(--landing-text-muted)] leading-relaxed">{feat.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Admin Features Grid */}
                <section className="py-24 px-6 sm:px-10">
                    <div className="max-w-5xl mx-auto">
                        <motion.div {...fadeUp} className="text-center mb-16">
                            <h2 className="font-display text-4xl font-bold mb-4">Enterprise controls</h2>
                            <p className="text-lg text-[var(--landing-text-muted)]">Everything your IT team needs to stay in control.</p>
                        </motion.div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { icon: Users, name: "SSO & SCIM provisioning" },
                                { icon: Shield, name: "Data residency controls" },
                                { icon: Zap, name: "Centralized billing" },
                                { icon: BarChart3, name: "Usage & audit reports" },
                                { icon: Lock, name: "Role-based access control" },
                                { icon: Building2, name: "Dedicated success manager" },
                            ].map((item, i) => (
                                <motion.div
                                    key={item.name}
                                    initial={{ opacity: 0, y: 15 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center gap-4 p-5 rounded-2xl bg-white border border-stone-100 hover:shadow-md transition-all"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-orange-100/50 flex items-center justify-center text-[var(--landing-amber)] shrink-0">
                                        <item.icon size={20} />
                                    </div>
                                    <span className="font-semibold">{item.name}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-3xl mx-auto">
                        <motion.div {...fadeUp} className="text-center mb-16">
                            <h2 className="font-display text-4xl font-bold">Frequently asked questions</h2>
                        </motion.div>
                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <div key={i} className="border border-stone-200 rounded-2xl overflow-hidden">
                                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left font-semibold hover:bg-stone-50 transition-colors">
                                        {faq.q}
                                        <ChevronDown size={20} className={`transition-transform duration-300 shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`} />
                                    </button>
                                    <motion.div initial={false} animate={{ height: openFaq === i ? "auto" : 0, opacity: openFaq === i ? 1 : 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                                        <p className="px-6 pb-6 text-[var(--landing-text-muted)] leading-relaxed">{faq.a}</p>
                                    </motion.div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 px-6 sm:px-10">
                    <motion.div {...fadeUp} className="max-w-5xl mx-auto bg-[var(--landing-dark)] rounded-[3rem] p-12 sm:p-20 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-mesh-dark opacity-50" />
                        <h2 className="font-display text-4xl sm:text-6xl text-[var(--landing-cream)] mb-4 relative z-10">
                            Ready to bring Invo<br /><span className="text-[var(--landing-amber)] italic font-serif">to your team?</span>
                        </h2>
                        <p className="text-[var(--landing-text-dim)] text-lg mb-8 relative z-10 max-w-lg mx-auto">
                            Join hundreds of teams generating documents faster with Invo.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                            <Link href="/contact-sales" className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[var(--landing-cream)] text-[var(--landing-dark)] font-bold text-lg hover:scale-105 transition-transform">
                                Talk to Sales <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                            </Link>
                        </div>
                    </motion.div>
                </section>
            </div>
        </LandingLayout>
    )
}
