"use client"

import { useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InvoLogo } from "@/components/invo-logo"
import { toast } from "sonner"
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react"

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user: authUser } = useAuth()
    const redirectTo = searchParams.get("redirect") || "/"

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const supabase = createClient()

    // If user becomes authenticated (via onAuthStateChange), navigate away
    useEffect(() => {
        if (authUser) {
            router.push(redirectTo)
        }
    }, [authUser, redirectTo, router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

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
            // onAuthStateChange will fire SIGNED_IN → authUser updates → useEffect navigates
            // No need to manually redirect — React handles it
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

    const handleGoogleLogin = async () => {
        setIsGoogleLoading(true)
        // Do NOT sign out before OAuth — it clears the PKCE state verifier
        // which causes "OAuth state not found or expired" on callback
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
                queryParams: {
                    // Force account selection so users can pick the right Google account
                    prompt: "select_account",
                },
            },
        })
        if (error) {
            toast.error(error.message)
            setIsGoogleLoading(false)
        }
    }

    return (
        <div className="w-full max-w-sm space-y-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
                <InvoLogo />
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                    <p className="text-sm text-muted-foreground">
                        Sign in to continue to Clorefy
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

            {/* Google */}
            <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                type="button"
            >
                {isGoogleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                )}
                Continue with Google
            </Button>

            {/* Magic Link */}
            <Button
                variant="outline"
                className="w-full"
                onClick={handleMagicLink}
                disabled={isMagicLinkLoading}
                type="button"
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
