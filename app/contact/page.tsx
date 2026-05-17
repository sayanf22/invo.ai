"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, Clock, ArrowRight, Send, FileText, Shield } from "lucide-react"
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSending(true)
        await new Promise(r => setTimeout(r, 800))
        toast.success("Message sent! We'll get back to you within 24 hours.")
        setName("")
        setEmail("")
        setSubject("")
        setMessage("")
        setIsSending(false)
    }

    return (
        <LandingLayout>
            <div className="min-h-screen">
                {/* Hero */}
                <section className="relative pt-32 pb-16 px-6 sm:px-10 bg-[var(--landing-cream)]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#F5F4F0] to-[#EAE8E3] opacity-90" />
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
                        <p className="text-xl text-[var(--landing-text-muted)] max-w-xl mx-auto">
                            Email us at <a href="mailto:support@clorefy.com" className="text-[var(--landing-amber)] font-semibold hover:underline">support@clorefy.com</a>. We respond within 24 hours on business days.
                        </p>
                    </motion.div>
                </section>

                {/* Content */}
                <section className="py-16 px-6 sm:px-10 bg-white">
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
                        {/* Info */}
                        <motion.div {...fadeUp} className="space-y-7">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-[var(--landing-amber)] shrink-0 border-[2px] border-[var(--landing-dark)] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-base text-[var(--landing-text-dark)] mb-1.5">Email</h3>
                                    <p className="text-sm text-[var(--landing-text-muted)]">Support: <a href="mailto:support@clorefy.com" className="text-[var(--landing-amber)] font-semibold hover:underline">support@clorefy.com</a></p>
                                    <p className="text-sm text-[var(--landing-text-muted)]">General: <a href="mailto:info@clorefy.com" className="text-[var(--landing-amber)] font-semibold hover:underline">info@clorefy.com</a></p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-[var(--landing-amber)] shrink-0 border-[2px] border-[var(--landing-dark)] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-base text-[var(--landing-text-dark)] mb-1.5">Response time</h3>
                                    <p className="text-sm text-[var(--landing-text-muted)]">Within 24 hours on business days (Mon–Fri, 10 AM – 7 PM IST).</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-[var(--landing-amber)] shrink-0 border-[2px] border-[var(--landing-dark)] shadow-[2px_2px_0px_0px_rgba(26,26,26,1)]">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="font-display font-bold text-base text-[var(--landing-text-dark)] mb-1.5">Useful links</h3>
                                    <div className="space-y-1 text-sm">
                                        <p><Link href="/refund-policy" className="text-[var(--landing-amber)] font-semibold hover:underline">Refund & Cancellation Policy</Link></p>
                                        <p><Link href="/terms" className="text-[var(--landing-amber)] font-semibold hover:underline">Terms & Conditions</Link></p>
                                        <p><Link href="/privacy" className="text-[var(--landing-amber)] font-semibold hover:underline">Privacy Policy</Link></p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Form */}
                        <motion.form
                            {...fadeUp}
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            {[
                                { id: "name", label: "Name", type: "text", value: name, setter: setName, placeholder: "Your name" },
                                { id: "email", label: "Email", type: "email", value: email, setter: setEmail, placeholder: "you@example.com" },
                                { id: "subject", label: "Subject", type: "text", value: subject, setter: setSubject, placeholder: "How can we help?" },
                            ].map(field => (
                                <div key={field.id}>
                                    <label htmlFor={field.id} className="block text-sm font-semibold text-[var(--landing-text-dark)] mb-1.5">{field.label}</label>
                                    <input
                                        id={field.id}
                                        type={field.type}
                                        value={field.value}
                                        onChange={e => field.setter(e.target.value)}
                                        placeholder={field.placeholder}
                                        required
                                        className="w-full rounded-xl border-[2px] border-stone-200 bg-[var(--landing-cream)] px-4 py-3 text-sm text-[var(--landing-text-dark)] placeholder:text-stone-400 outline-none focus:border-[var(--landing-dark)] transition-all"
                                    />
                                </div>
                            ))}
                            <div>
                                <label htmlFor="message" className="block text-sm font-semibold text-[var(--landing-text-dark)] mb-1.5">Message</label>
                                <textarea
                                    id="message"
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Describe your question or issue..."
                                    required
                                    rows={5}
                                    className="w-full rounded-xl border-[2px] border-stone-200 bg-[var(--landing-cream)] px-4 py-3 text-sm text-[var(--landing-text-dark)] placeholder:text-stone-400 outline-none focus:border-[var(--landing-dark)] transition-all resize-none"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSending}
                                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--landing-dark)] text-white font-bold text-sm border-[2px] border-[var(--landing-dark)] shadow-[3px_3px_0px_0px_rgba(26,26,26,1)] hover:shadow-[4px_4px_0px_0px_rgba(26,26,26,1)] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSending ? "Sending…" : <><Send size={15} /> Send Message</>}
                            </button>
                        </motion.form>
                    </div>
                </section>
            </div>
        </LandingLayout>
    )
}
