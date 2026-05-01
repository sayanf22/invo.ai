"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Send, HelpCircle, FileText, ExternalLink, Lock } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"

export default function SupportPage() {
    const [userEmail, setUserEmail] = useState("")
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [issue, setIssue] = useState("")
    const [isSending, setIsSending] = useState(false)
    const [sent, setSent] = useState(false)

    // Load the authenticated user's email on mount — read-only, not editable
    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email) {
                setUserEmail(user.email)
                setIsAuthenticated(true)
            }
        })
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!issue.trim() || issue.trim().length < 10) {
            toast.error("Please describe your issue in at least 10 characters.")
            return
        }

        setIsSending(true)
        try {
            if (isAuthenticated) {
                // Authenticated: use the secure API route (rate-limited, user_id from JWT)
                const response = await authFetch("/api/support/submit", {
                    method: "POST",
                    body: JSON.stringify({
                        message: issue.trim(),
                        metadata: { submitted_from: "support_page" },
                    }),
                })
                if (!response.ok) {
                    const data = await response.json().catch(() => ({}))
                    throw new Error(data.error || "Failed to submit ticket")
                }
            } else {
                // Unauthenticated: insert directly with null user_id
                const supabase = createClient()
                const { error } = await supabase.from("support_messages").insert({
                    user_id: null,
                    message: `[Unauthenticated — Email: ${userEmail || "not provided"}]\n\n${issue.trim()}`,
                    status: "unread",
                })
                if (error) throw error
            }

            setSent(true)
            setIssue("")
            toast.success("Support ticket submitted! We'll get back to you soon.")
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
                    {/* Left: FAQ + Direct Contact */}
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

                    {/* Right: Support Ticket Form */}
                    {sent ? (
                        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
                            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                                <Send className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-lg">Ticket submitted!</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    We&apos;ll review your message and respond to <span className="font-medium text-foreground">{userEmail}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSent(false)}
                                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                            >
                                Submit another ticket
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-2xl p-6 shadow-sm">
                            <div>
                                <h3 className="font-semibold mb-1">Create a Support Ticket</h3>
                                <p className="text-sm text-muted-foreground mb-4">Describe your issue in detail and we&apos;ll investigate.</p>
                            </div>

                            {/* Email — read-only, auto-filled from auth */}
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="flex items-center gap-1.5">
                                    Account Email
                                    <Lock className="w-3 h-3 text-muted-foreground/60" />
                                </Label>
                                <div className="relative">
                                    <input
                                        id="email"
                                        type="email"
                                        value={userEmail}
                                        readOnly
                                        tabIndex={-1}
                                        aria-readonly="true"
                                        placeholder={isAuthenticated ? "" : "Sign in to auto-fill your email"}
                                        className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed select-none outline-none"
                                    />
                                </div>
                                {!isAuthenticated && (
                                    <p className="text-xs text-muted-foreground">
                                        <Link href="/auth/login" className="text-primary hover:underline">Sign in</Link> to link this ticket to your account.
                                    </p>
                                )}
                            </div>

                            {/* Issue description */}
                            <div className="space-y-1.5">
                                <Label htmlFor="issue">Issue Description</Label>
                                <textarea
                                    id="issue"
                                    value={issue}
                                    onChange={e => setIssue(e.target.value)}
                                    placeholder="Describe your issue in detail — steps to reproduce, what you expected, what happened..."
                                    required
                                    minLength={10}
                                    rows={6}
                                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                                />
                                <p className="text-xs text-muted-foreground text-right">{issue.trim().length}/2000</p>
                            </div>

                            <Button type="submit" className="w-full" disabled={isSending || issue.trim().length < 10}>
                                {isSending ? "Submitting..." : <><Send className="w-4 h-4 mr-2" /> Submit Ticket</>}
                            </Button>
                        </form>
                    )}
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
