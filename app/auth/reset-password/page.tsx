"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InvoLogo } from "@/components/invo-logo"
import { toast } from "sonner"
import { Loader2, Mail, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react"

export default function ResetPasswordPage() {
    const [email, setEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    const [canResend, setCanResend] = useState(false)
    const [countdown, setCountdown] = useState(0)

    const supabase = createClient()

    const startCountdown = () => {
        setCanResend(false)
        setCountdown(60)
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    setCanResend(true)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const handleResetPassword = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()

        if (!email.trim()) {
            toast.error("Please enter your email address")
            return
        }

        setIsLoading(true)

        try {
            // In PKCE flow (used by @supabase/ssr), the email template controls
            // the redirect URL, not this redirectTo parameter. But we pass it anyway
            // as a fallback for implicit flow compatibility.
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/update-password`,
            })

            if (error) {
                console.error("Reset password error:", error)
                // Handle specific error cases
                if (error.message.includes("security purposes") || error.message.includes("after")) {
                    toast.error("Please wait a few seconds before trying again.")
                } else if (error.message.includes("rate limit") || error.message.includes("too many")) {
                    toast.error("Too many requests. Please wait a few minutes before trying again.")
                } else if (error.message.includes("not authorized")) {
                    toast.error("Email sending is not configured. Please contact support.")
                } else {
                    toast.error(error.message)
                }
                setIsLoading(false)
                return
            }

            setEmailSent(true)
            startCountdown()
            toast.success("Reset link sent! Check your inbox.")
        } catch {
            toast.error("Something went wrong. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleResend = async () => {
        if (!canResend) return
        await handleResetPassword()
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-background">
            <div className="w-full max-w-sm space-y-8">
                <div className="flex flex-col items-center gap-4">
                    <InvoLogo />
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
                        <p className="text-sm text-muted-foreground">
                            {emailSent
                                ? "Check your email for the reset link"
                                : "Enter your email and we'll send you a reset link"}
                        </p>
                    </div>
                </div>

                {emailSent ? (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                We sent a password reset link to{" "}
                                <span className="font-medium text-foreground">{email}</span>.
                                Click the link in the email to set a new password.
                            </p>
                        </div>

                        <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
                            <p className="text-xs font-medium">Didn&apos;t get the email?</p>
                            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                <li>Check your spam/junk folder</li>
                                <li>Make sure you entered the correct email</li>
                                <li>The email may take 1-2 minutes to arrive</li>
                            </ul>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleResend}
                                disabled={!canResend || isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                        {canResend ? "Resend" : `Resend in ${countdown}s`}
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setEmailSent(false)
                                    setEmail("")
                                }}
                            >
                                Try different email
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Send reset link"
                            )}
                        </Button>
                    </form>
                )}

                <div className="text-center">
                    <Link
                        href="/auth/login"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to sign in
                    </Link>
                </div>
            </div>
        </div>
    )
}
