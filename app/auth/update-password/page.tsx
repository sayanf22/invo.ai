"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InvoLogo } from "@/components/invo-logo"
import { toast } from "sonner"
import { Loader2, Lock, CheckCircle2, ArrowLeft } from "lucide-react"

export default function UpdatePasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isUpdated, setIsUpdated] = useState(false)
    const [hasSession, setHasSession] = useState<boolean | null>(null)

    const supabase = createClient()

    // Check if user has a valid session (from the reset link)
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setHasSession(!!session)
            if (!session) {
                toast.error("Invalid or expired reset link. Please request a new one.")
            }
        }
        checkSession()
    }, [supabase.auth])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters")
            return
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }

        setIsLoading(true)

        const { error } = await supabase.auth.updateUser({
            password,
        })

        if (error) {
            toast.error(error.message)
            setIsLoading(false)
            return
        }

        setIsUpdated(true)
        setIsLoading(false)
        toast.success("Password updated successfully!")
    }

    // Still checking session
    if (hasSession === null) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // No valid session — reset link was invalid or expired
    if (!hasSession) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-background">
                <div className="w-full max-w-sm space-y-8">
                    <div className="flex flex-col items-center gap-4">
                        <InvoLogo />
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-semibold tracking-tight">Link expired</h1>
                            <p className="text-sm text-muted-foreground">
                                This password reset link is invalid or has expired. Please request a new one.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Button className="w-full" onClick={() => router.push("/auth/reset-password")}>
                            Request new reset link
                        </Button>
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
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-background">
            <div className="w-full max-w-sm space-y-8">
                {/* Logo */}
                <div className="flex flex-col items-center gap-4">
                    <InvoLogo />
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {isUpdated ? "All set!" : "Set new password"}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {isUpdated
                                ? "Your password has been updated"
                                : "Enter your new password below"}
                        </p>
                    </div>
                </div>

                {isUpdated ? (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Your password has been updated. You can now sign in with your new password.
                            </p>
                        </div>
                        <Button className="w-full" onClick={() => router.push("/")}>
                            Continue to Invo.ai
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    required
                                    minLength={6}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10"
                                    required
                                    minLength={6}
                                />
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <p className="text-xs text-destructive">Passwords do not match</p>
                            )}
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Update password"
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}
