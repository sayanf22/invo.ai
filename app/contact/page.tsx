"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, MessageCircle, Clock, Send } from "lucide-react"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function ContactPage() {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [subject, setSubject] = useState("")
    const [message, setMessage] = useState("")
    const [isSending, setIsSending] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSending(true)
        // For now, just show a success message — integrate with email service later
        await new Promise(r => setTimeout(r, 1000))
        toast.success("Message sent! We'll get back to you within 24 hours.")
        setName("")
        setEmail("")
        setSubject("")
        setMessage("")
        setIsSending(false)
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <ClorefyLogo size={32} />
                    </Link>
                    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to home
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Contact Us</h1>
                <p className="text-muted-foreground mb-10">We&apos;re here to help. Reach out and we&apos;ll respond within 24 hours.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Mail className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Email</h3>
                                <p className="text-sm text-muted-foreground">General: <a href="mailto:info@clorefy.com" className="text-primary">info@clorefy.com</a></p>
                                <p className="text-sm text-muted-foreground">Support: <a href="mailto:support@clorefy.com" className="text-primary">support@clorefy.com</a></p>
                                <p className="text-sm text-muted-foreground">Sales: <a href="mailto:sales@clorefy.com" className="text-primary">sales@clorefy.com</a></p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Response Time</h3>
                                <p className="text-sm text-muted-foreground">We typically respond within 24 hours on business days (Mon–Fri, 10 AM – 7 PM IST).</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <MessageCircle className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-1">Quick Links</h3>
                                <div className="space-y-1 text-sm">
                                    <p><Link href="/refund-policy" className="text-primary hover:underline">Refund & Cancellation Policy</Link></p>
                                    <p><Link href="/terms" className="text-primary hover:underline">Terms & Conditions</Link></p>
                                    <p><Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="How can we help?" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="message">Message</Label>
                            <textarea
                                id="message"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Describe your question or issue..."
                                required
                                rows={5}
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isSending}>
                            {isSending ? "Sending..." : <><Send className="w-4 h-4 mr-2" /> Send Message</>}
                        </Button>
                    </form>
                </div>
            </main>

            <footer className="border-t py-8 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto text-center text-xs text-muted-foreground">
                    <p>© {new Date().getFullYear()} Clorefy. All rights reserved.</p>
                </div>
            </footer>
        </div>
    )
}
