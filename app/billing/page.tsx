"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Zap, Crown, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useRazorpay } from "@/hooks/use-razorpay"
import { toast } from "sonner"

const plans = [
    {
        id: "free",
        name: "Free",
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: ["3 documents/month", "Invoice + Contract", "3 templates", "3 countries", "PDF export", "7-day history"],
    },
    {
        id: "starter",
        name: "Starter",
        monthlyPrice: 900,
        yearlyPrice: 700,
        features: ["50 documents/month", "All 4 document types", "All 9 templates", "All 11 countries", "PDF + DOCX export", "30-day history"],
        popular: true,
    },
    {
        id: "pro",
        name: "Pro",
        monthlyPrice: 2400,
        yearlyPrice: 1900,
        features: ["150 documents/month", "All document types", "All templates", "All countries", "All export formats", "1-year history", "E-signatures", "Custom branding"],
    },
    {
        id: "agency",
        name: "Agency",
        monthlyPrice: 5900,
        yearlyPrice: 4700,
        comingSoon: true,
        features: ["Unlimited documents", "Everything in Pro", "3 team members", "Priority support", "Forever history"],
    },
]

export default function BillingPage() {
    const router = useRouter()
    const { user, supabase } = useAuth()
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
    const [currentPlan, setCurrentPlan] = useState("free")
    const [loading, setLoading] = useState(true)

    const { subscribe, isProcessing } = useRazorpay({
        onSuccess: (plan) => {
            setCurrentPlan(plan)
            router.refresh()
        },
    })

    // Fetch current subscription
    useEffect(() => {
        if (!user) {
            router.push("/auth/login")
            return
        }
        async function fetchSub() {
            try {
                const tokenKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.includes("-auth-token"))
                const tokenRaw = tokenKey ? localStorage.getItem(tokenKey) : null
                let accessToken = ""
                if (tokenRaw) {
                    try {
                        const parsed = JSON.parse(tokenRaw.startsWith("%7B") ? decodeURIComponent(tokenRaw) : tokenRaw)
                        accessToken = parsed.access_token || ""
                    } catch {}
                }
                const res = await fetch("/api/razorpay/subscription", {
                    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                })
                if (res.ok) {
                    const data = await res.json()
                    setCurrentPlan(data.subscription?.plan || "free")
                }
            } catch {} finally {
                setLoading(false)
            }
        }
        fetchSub()
    }, [user, router])

    const handleSubscribe = useCallback((planId: string) => {
        if (planId === "free" || planId === currentPlan) return
        subscribe(planId, billingCycle)
    }, [subscribe, billingCycle, currentPlan])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Billing & Plans</h1>
                <p className="text-muted-foreground">Choose the plan that fits your needs</p>
            </div>

            {/* Current Plan */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-primary" />
                        Current Plan: {plans.find(p => p.id === currentPlan)?.name || "Free"}
                    </CardTitle>
                </CardHeader>
            </Card>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${billingCycle === "yearly" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                    Yearly <span className="text-xs text-emerald-500 font-bold ml-1">Save 20%</span>
                </button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => {
                    const isCurrent = plan.id === currentPlan
                    const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice
                    return (
                        <Card key={plan.id} className={`relative ${plan.popular ? "border-primary shadow-lg ring-1 ring-primary/20" : ""}`}>
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-primary text-xs"><Zap className="w-3 h-3 mr-1" />Popular</Badge>
                                </div>
                            )}
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">{plan.name}</CardTitle>
                                <div className="mt-2">
                                    {price === 0 ? (
                                        <span className="text-3xl font-bold">Free</span>
                                    ) : (
                                        <>
                                            <span className="text-3xl font-bold">₹{price.toLocaleString()}</span>
                                            <span className="text-muted-foreground text-sm">/mo</span>
                                        </>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2.5 mb-6">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    className="w-full"
                                    variant={isCurrent ? "outline" : "default"}
                                    disabled={isCurrent || plan.comingSoon || isProcessing}
                                    onClick={() => handleSubscribe(plan.id)}
                                >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : isCurrent ? "Current Plan" : plan.comingSoon ? "Coming Soon" : plan.id === "free" ? "Downgrade" : "Subscribe"}
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-8">
                Payments processed securely by Razorpay. All prices in INR. Cancel anytime from your account settings.
            </p>
        </div>
    )
}
