"use client"

import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { Code2, Terminal, Webhook, FileJson, ArrowRight, Shield, Zap, Globe, BookOpen } from "lucide-react"
import Link from "next/link"

const fadeUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
}

const codeExample = `// Generate an invoice with one API call
const invoice = await invo.documents.create({
  type: "invoice",
  client: { name: "Acme Corp", email: "billing@acme.com" },
  items: [
    { description: "API Integration", qty: 1, rate: 5000 },
    { description: "Custom Templates", qty: 3, rate: 1500 },
  ],
  currency: "USD",
  tax_rate: 0.08,
  due_date: "2026-03-15",
});

// Returns signed PDF URL + metadata
console.log(invoice.pdf_url);
console.log(invoice.total); // 9,720.00`

export default function DevelopersPage() {
    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="relative pt-32 pb-20 px-6 sm:px-10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/30 via-transparent to-transparent opacity-60 pointer-events-none" />
                    <div className="max-w-5xl mx-auto text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/80 text-blue-600 font-semibold text-sm mb-8 border border-blue-200/50">
                                <Code2 size={16} />
                                <span>API & Integrations</span>
                            </div>
                            <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight text-[var(--landing-text-dark)] mb-6 leading-[1.1]">
                                Document API <br />
                                <span className="font-serif italic text-[var(--landing-amber)]">built for developers</span>
                            </h1>
                            <p className="text-xl sm:text-2xl text-[var(--landing-text-muted)] max-w-2xl mx-auto mb-12">
                                Generate invoices, contracts, and documents programmatically. Ship billing and legal workflows in minutes, not months.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href="/auth/register" className="group px-8 py-4 rounded-full bg-[var(--landing-dark)] text-white font-bold text-lg hover:scale-105 transition-all shadow-xl inline-flex items-center gap-2">
                                    Get API Key <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} />
                                </Link>
                                <Link href="/docs" className="px-8 py-4 rounded-full bg-white text-[var(--landing-text-dark)] font-bold text-lg border border-stone-200 hover:bg-stone-50 transition-all inline-flex items-center gap-2">
                                    <BookOpen size={18} /> Read Docs
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Code Example */}
                <section className="py-24 px-6 sm:px-10">
                    <div className="max-w-5xl mx-auto">
                        <motion.div {...fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="font-display text-4xl font-bold mb-6">
                                    One API call.<br />
                                    <span className="text-[var(--landing-amber)]">Complete documents.</span>
                                </h2>
                                <p className="text-lg text-[var(--landing-text-muted)] mb-8 leading-relaxed">
                                    No templates to manage, no rendering engines to maintain. Send your data, get back a professional PDF with correct formatting, tax calculations, and compliance checks — all handled server-side.
                                </p>
                                <div className="space-y-4">
                                    {[
                                        "Auto tax calculation based on jurisdiction",
                                        "Multi-currency with real-time conversion",
                                        "Idempotent requests for safe retries",
                                        "Webhook notifications on document events"
                                    ].map((item) => (
                                        <div key={item} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                                                <Zap size={14} />
                                            </div>
                                            <span className="text-sm font-medium">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-[2rem] bg-[#1E1E1E] p-6 overflow-hidden shadow-2xl">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                    <span className="text-xs text-gray-400 ml-3 font-mono">generate-invoice.ts</span>
                                </div>
                                <pre className="text-sm text-gray-300 font-mono leading-relaxed overflow-x-auto">
                                    <code>{codeExample}</code>
                                </pre>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-24 px-6 sm:px-10 bg-white">
                    <div className="max-w-6xl mx-auto">
                        <motion.div {...fadeUp} className="text-center mb-16">
                            <h2 className="font-display text-4xl font-bold mb-4">Built for integration</h2>
                            <p className="text-lg text-[var(--landing-text-muted)]">Everything you need to embed document generation into your product.</p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                { icon: Terminal, title: "RESTful API", desc: "Clean, versioned REST API with comprehensive OpenAPI specs and client libraries in JS, Python, Go, and Ruby." },
                                { icon: Webhook, title: "Webhooks", desc: "Real-time event notifications when documents are created, viewed, signed, or paid." },
                                { icon: FileJson, title: "JSON Schema", desc: "Strongly-typed document schemas with Zod validation. Catch errors at build time, not runtime." },
                                { icon: Shield, title: "API key rotation", desc: "Rotate keys without downtime. Scoped permissions for fine-grained access control." },
                                { icon: Globe, title: "SDKs & Libraries", desc: "Official SDKs for JavaScript, Python, Go, and Ruby. Plus community libraries for more." },
                                { icon: Code2, title: "Sandbox mode", desc: "Test your integration with realistic mock data. No charges, no side effects." },
                            ].map((feat, i) => (
                                <motion.div
                                    key={feat.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08, duration: 0.5 }}
                                    className="group p-8 rounded-[2rem] bg-[var(--landing-cream)] border border-stone-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-blue-100/50 flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                                        <feat.icon size={24} />
                                    </div>
                                    <h3 className="font-display text-xl font-bold mb-2">{feat.title}</h3>
                                    <p className="text-[var(--landing-text-muted)] leading-relaxed text-sm">{feat.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 px-6 sm:px-10">
                    <motion.div {...fadeUp} className="max-w-4xl mx-auto bg-[#1E1E1E] rounded-[3rem] p-12 sm:p-20 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
                        <h2 className="font-display text-4xl sm:text-5xl text-white mb-4 relative z-10">
                            Start building <span className="text-[var(--landing-amber)] italic font-serif">today</span>
                        </h2>
                        <p className="text-gray-400 text-lg mb-8 relative z-10 max-w-lg mx-auto">
                            Free tier includes 100 documents/month. No credit card required.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                            <Link href="/auth/register" className="group inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-[#1E1E1E] font-bold text-lg hover:scale-105 transition-transform">
                                Get API Key <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
                            </Link>
                            <Link href="/docs" className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-gray-600 text-gray-300 font-bold text-lg hover:bg-white/5 transition-colors">
                                <BookOpen size={18} /> Documentation
                            </Link>
                        </div>
                    </motion.div>
                </section>
            </div>
        </LandingLayout>
    )
}
