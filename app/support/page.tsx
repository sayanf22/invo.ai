"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, MessageCircle, Clock, Send, HelpCircle, FileText, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function SupportPage() {
    const [email, setEmail] = useState("")
    const [issue, setIssue] = useState("")
    const [isSending, setIsSending] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !issue) return

        setIsSending(true)
        try {
            const supabase = createClient()
            
            // Try to link to a user if authenticated
            const { data: { user } } = await supabase.auth.getUser()
            
            // In our DB schema, user_id is nullable for error_logs, but for support_messages it references profiles.
            // Wait, does support_messages require a user_id?
            // "user_id UUID REFERENCES profiles(id) ON DELETE CASCADE" - but I didn't add NOT NULL.
            // Let's insert the message. If the user is unauthenticated, user_id will be undefined/null.
            const { error } = await supabase.from("support_messages").insert({
                user_id: user?.id || null,
                message: `[Email Provided: ${email}]\n\n${issue}`
            })

            if (error) throw error

            toast.success("Support ticket created! We will review it shortly.")
            setIssue("")
        } catch (error: any) {
            console.error("Failed to submit support ticket:", error)
            toast.error(error.message || "Failed to submit ticket. Please try again.")
        } finally {
            setIsSending(false)
        }
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
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <HelpCircle className="w-5 h-5 text-primary" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Support Center</h1>
                </div>
                <p className="text-muted-foreground mb-10 text-lg">Find answers or reach out to our technical support team.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" /> Common Questions
                            </h3>
                            <div className="space-y-3 mt-4 text-sm text-muted-foreground">
                                <div className="border-b pb-3">
                                    <p className="font-medium text-foreground">How do I integrate Stripe?</p>
                                    <p className="mt-1">Go to Settings &gt; Payments and click on the Stripe Setup guide.</p>
                                </div>
                                <div className="border-b pb-3">
                                    <p className="font-medium text-foreground">Where are my generated documents?</p>
                                    <p className="mt-1">All documents are stored in the &quot;My Documents&quot; section from the dashboard.</p>
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">How to upgrade my plan?</p>
                                    <p className="mt-1">Navigate to Billing &amp; Plans in your account settings.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <Mail className="w-4 h-4 text-primary" /> Direct Contact
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">If you need immediate assistance, email our dedicated support line.</p>
                            <a href="mailto:support@clorefy.com" className="inline-flex items-center gap-2 text-sm font-medium text-primary bg-primary/10 px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors">
                                support@clorefy.com <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <div>
                            <h3 className="font-semibold mb-1">Create a Support Ticket</h3>
                            <p className="text-sm text-muted-foreground mb-4">Describe your issue in detail and we&apos;ll investigate.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Account Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="issue">Issue Description</Label>
                            <textarea
                                id="issue"
                                value={issue}
                                onChange={e => setIssue(e.target.value)}
                                placeholder="Steps to reproduce the problem..."
                                required
                                rows={6}
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isSending}>
                            {isSending ? "Submitting..." : <><Send className="w-4 h-4 mr-2" /> Submit Ticket</>}
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
