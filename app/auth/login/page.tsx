"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient, clearAuthTokens } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InvoLogo } from "@/components/invo-logo"
import { toast } from "sonner"
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react"

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get("redirect") || "/"

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            // Sign out any stale session first — this clears the Supabase client's
            // internal state AND removes cookies/localStorage via our storage adapter.
            // Using scope: 'local' so we only clear this browser, not all sessions.
            await supabase.auth.signOut({ scope: "local" })
        } catch {
            // Ignore sign-out errors — we're just clearing stale state
        }

        // Also clear any leftover cookie fragments that signOut might miss
        clearAuthTokens()

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                console.error("[login] signInWithPassword error:", error.message, error.status)
                if (error.message.includes("Invalid login credentials")) {
                    toast.error("Invalid email or password. Please try again or reset your password.")
                } else if (error.message.includes("Email not confirmed")) {
                    toast.error("Please confirm your email address first. Check your inbox.")
                } else {
                    toast.error(error.message)
                }
                setIsLoading(false)
                return
            }

            if (!data.session) {
                console.error("[login] No session returned after successful login")
                toast.error("Login succeeded but session was not created. Please try again.")
                setIsLoading(false)
                return
            }

            toast.success("Welcome back!")
            router.push(redirectTo)
            router.refresh()
        } catch (err) {
            console.error("[login] Unexpected error:", err)
            toast.error("Unable to connect. Please check your internet connection.")
            setIsLoading(false)
        }
    }

    const handleMagicLink = async () => {
        if (!email) {
            toast.error("Please enter your email address")
            return
        }

        setIsMagicLinkLoading(true)

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
            },
        })

        if (error) {
            toast.error(error.message)
            setIsMagicLinkLoading(false)
            return
        }

        toast.success("Check your email for the magic link!")
        setIsMagicLinkLoading(false)
    }

    return (
        <div className="w-full max-w-sm space-y-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
                <InvoLogo />
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                    <p className="text-sm text-muted-foreground">
                        Sign in to continue to Invo.ai
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
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
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link
                            href="/auth/reset-password"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 pr-10"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            Sign in
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                    )}
                </Button>
            </form>

            {/* Divider */}
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                        Or continue with
                    </span>
                </div>
            </div>

            {/* Magic Link */}
            <Button
                variant="outline"
                className="w-full"
                onClick={handleMagicLink}
                disabled={isMagicLinkLoading}
            >
                {isMagicLinkLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <>
                        <Mail className="mr-2 h-4 w-4" />
                        Magic link
                    </>
                )}
            </Button>

            {/* Sign up link */}
            <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                    href="/auth/signup"
                    className="font-medium text-foreground hover:underline"
                >
                    Sign up
                </Link>
            </p>
        </div>
    )
}

function LoginLoading() {
    return (
        <div className="w-full max-w-sm flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    )
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
                <Link href="/" aria-label="Go to home page">
                    <InvoLogo size={36} />
                </Link>
                <nav className="flex items-center gap-4 text-[14px]">
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                    <Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
                    <Link href="/auth/signup" className="text-muted-foreground hover:text-foreground transition-colors font-medium">Sign up</Link>
                </nav>
            </header>
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
                <Suspense fallback={<LoginLoading />}>
                    <LoginForm />
                </Suspense>
            </div>
        </div>
    )
}
