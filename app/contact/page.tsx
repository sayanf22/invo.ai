"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, Clock, FileText, Send, CheckCircle } from "lucide-react"
import { LandingLayout } from "@/components/landing/landing-layout"
import { motion } from "framer-motion"
import { toast } from "sonner"

const fadeUp = {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
}

export default function ContactPage() {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [subject, setSubject] = useState("")
    const [message, setMessage] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [sent, setSent] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSending(true)
        await new Promise(r => setTimeout(r, 800))
        setSent(true)
        setIsSending(false)
        toast.success("Message sent! We'll get back to you within 24 hours.")
    }

    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="relative pt-32 pb-20 px-6 sm:px-10 overflow-hidden bg-[var(--landing-cream)]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#F5F4F0] to-[#EAE8E3] opacity-90 pointer-events-none" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="max-w-3xl mx-auto text-center relative z-10"
                    >
                        <h1
                            className="font-display text-5xl sm:text-7xl font-semibold tracking-tighter text-[var(--landing-text-dark)] mb-4 leading-[1.02]"
                            style={{ textShadow: "3px 3px 0px rgba(26,26,26,0.08), 0 8px 24px rgba(26,26,26,0.06)" }}
                        >
                            Get in touch
                        </h1>
                        <p className="text-lg sm:text-xl text-[var(--landing-text-muted)] max-w-xl mx-auto leading-relaxed">
                            Email <a href="mailto:support@clorefy.com" className="text-[var(--landing-amber)] font-semibold hover:underline">support@clorefy.com</a> directly, or use the form below. We respond within 24 hours on business days.
                        </p>
                    </motion.div>
                </section>

                {/* Main content */}
                <section className="py-16 px-6 sm:px-10 bg-white">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-start">

                        {/* Left — contact info */}
                        <motion.div {...fadeUp} className="lg:col-span-2 space-y-6">
                            <div>
                                <h2 className="font-display text-2xl font-bold text-[var(--landing-text-dark)] mb-5 tracking-tight">
                                    Contact details
                                </h2>
                            </div>

                            {[
                                {
                                    icon: Mail,
                                    label: "Email",
                                    lines: [
                                        { text: "support@clorefy.com", href: "mailto:support@clorefy.com" },
                                        { text: "info@clorefy.com", href: "mailto:info@clorefy.com" },
                                    ],
                                },
                                {
                                    icon: Clock,
                                    label: "Response time",
                                    lines: [
                                        { text: "Within 24 hrs on business days" },
                                        { text: "Mon – Fri, 10 AM – 7 PM IST" },
                                    ],
                                },
                                {
                                    icon: FileText,
                                    label: "Policies",
                                    lines: [
                                        { text: "Refund & Cancellation Policy", href: "/refund-policy" },
                                        { text: "Terms & Conditions", href: "/terms" },
                                        { text: "Privacy Policy", href: "/privacy" },
                                    ],
                                },
                            ].map(item => (
                                <div key={item.label} className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 border-[2px] border-[var(--landing-dark)] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)] flex items-center justify-center text-[var(--landing-amber)] shrink-0 mt-0.5">
                                        <item.icon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--landing-text-dark)] mb-1">{item.label}</p>
                                        {item.lines.map((line, i) => (
                                            <p key={i} className="text-sm text-[var(--landing-text-muted)]">
                                                {line.href ? (
                                                    <Link href={line.href} className="text-[var(--landing-amber)] font-medium hover:underline">
                                                        {line.text}
                                                    </Link>
                                                ) : line.text}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </motion.div>

                        {/* Right — form */}
                        <motion.div
                            {...fadeUp}
                            className="lg:col-span-3"
                        >
                            <div className="rounded-2xl border-[2px] border-[var(--landing-dark)] bg-[var(--landing-cream)] shadow-[6px_6px_0px_0px_rgba(26,26,26,1)] overflow-hidden">
                                {/* Form header */}
                                <div className="px-7 py-5 border-b-[2px] border-[var(--landing-dark)] bg-white">
                                    <h3 className="font-display font-bold text-lg text-[var(--landing-text-dark)]">Send a message</h3>
                                    <p className="text-sm text-[var(--landing-text-muted)] mt-0.5">We&apos;ll reply to your email within 24 hours.</p>
                                </div>

                                {sent ? (
                                    <div className="px-7 py-14 text-center">
                                        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle className="w-7 h-7 text-green-600" />
                                        </div>
                                        <h4 className="font-display font-bold text-xl text-[var(--landing-text-dark)] mb-2">Message sent</h4>
                                        <p className="text-sm text-[var(--landing-text-muted)]">We&apos;ll get back to you within 24 hours on business days.</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="px-7 py-7 space-y-5">
                                        {/* Name + Email row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-[var(--landing-text-muted)] mb-1.5">
                                                    Your name
                                                </label>
                                                <input
                                                    id="name"
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    placeholder="Sayan Banik"
                                                    required
                                                    className="w-full rounded-xl border-[2px] border-stone-200 bg-white px-4 py-3 text-sm text-[var(--landing-text-dark)] placeholder:text-stone-300 outline-none focus:border-[var(--landing-dark)] transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[var(--landing-text-muted)] mb-1.5">
                                                    Email address
                                                </label>
                                                <input
                                                    id="email"
                                                    type="email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    placeholder="you@example.com"
                                                    required
                                                    className="w-full rounded-xl border-[2px] border-stone-200 bg-white px-4 py-3 text-sm text-[var(--landing-text-dark)] placeholder:text-stone-300 outline-none focus:border-[var(--landing-dark)] transition-colors"
                                                />
                                            </div>
                                        </div>

                                        {/* Subject */}
                                        <div>
                                            <label htmlFor="subject" className="block text-xs font-bold uppercase tracking-wider text-[var(--landing-text-muted)] mb-1.5">
                                                Subject
                                            </label>
                                            <input
                                                id="subject"
                                                type="text"
                                                value={subject}
                                                onChange={e => setSubject(e.target.value)}
                                                placeholder="How can we help?"
                                                required
                                                className="w-full rounded-xl border-[2px] border-stone-200 bg-white px-4 py-3 text-sm text-[var(--landing-text-dark)] placeholder:text-stone-300 outline-none focus:border-[var(--landing-dark)] transition-colors"
                                            />
                                        </div>

                                        {/* Message */}
                                        <div>
                                            <label htmlFor="message" className="block text-xs font-bold uppercase tracking-wider text-[var(--landing-text-muted)] mb-1.5">
                                                Message
                                            </label>
                                            <textarea
                                                id="message"
                                                value={message}
                                                onChange={e => setMessage(e.target.value)}
                                                placeholder="Describe your question, issue, or feedback in detail..."
                                                required
                                                rows={5}
                                                className="w-full rounded-xl border-[2px] border-stone-200 bg-white px-4 py-3 text-sm text-[var(--landing-text-dark)] placeholder:text-stone-300 outline-none focus:border-[var(--landing-dark)] transition-colors resize-none"
                                            />
                                        </div>

                                        {/* Submit */}
                                        <button
                                            type="submit"
                                            disabled={isSending}
                                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--landing-dark)] text-white font-bold text-sm border-[2px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSending ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Sending…
                                                </span>
                                            ) : (
                                                <><Send size={14} /> Send Message</>
                                            )}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </div>
                </section>
            </div>
        </LandingLayout>
    )
}
