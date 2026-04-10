"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Check, Zap, Crown, Loader2, FileText, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useRazorpay } from "@/hooks/use-razorpay"
import { authFetch } from "@/lib/auth-fetch"
import { toast } from "sonner"
import { COUNTRY_PRICING, detectCountryFromTimezone, formatPrice, DEFAULT_COUNTRY, type CountryPricing } from "@/lib/pricing"

const plans = [
    {
        id: "free", name: "Free",
        features: ["3 documents/month", "Invoice + Contract only", "3 PDF templates", "3 countries (IN, US, UK)", "PDF export only", "7-day session history"],
    },
    {
        id: "starter", name: "Starter", popular: true,
        features: ["50 documents/month", "All 4 document types", "All 9 PDF templates", "All 11 countries", "PDF + DOCX export", "30-day session history"],
    },
    {
        id: "pro", name: "Pro",
        features: ["150 documents/month", "All 4 document types", "All 9 PDF templates", "All 11 countries", "PDF + DOCX + Image export", "1-year session history", "E-signatures", "Custom logo & branding"],
    },
    {
        id: "agency", name: "Agency", comingSoon: true,
        features: ["Unlimited documents", "Everything in Pro", "3 team members", "Priority support", "Forever session history"],
    },
]

interface UsageData {
    plan: string
    planName: string
    subscription: any
    usage: {
        documentsUsed: number
        documentsLimit: number
        documentsPercent: number
        aiRequests: number
        currentMonth: string
    }
}

export default function BillingPage() {
    const router = useRouter()
    const { user } = useAuth()
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
    const [data, setData] = useState<UsageData | null>(null)
    const [loading, setLoading] = useState(true)
    const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null)
    const [isDowngrading, setIsDowngrading] = useState(false)
    const [countryPricing, setCountryPricing] = useState<CountryPricing>(COUNTRY_PRICING[DEFAULT_COUNTRY])

    const { subscribe, isProcessing } = useRazorpay({
        onSuccess: () => {
            fetchUsage()
            router.refresh()
        },
    })

    const fetchUsage = useCallback(async () => {
        try {
            const res = await authFetch("/api/usage")
            if (res.ok) {
                const d = await res.json()
                setData(d)
            }
        } catch {} finally { setLoading(false) }
    }, [])

    useEffect(() => {
        if (!user) { router.push("/auth/login"); return }
        fetchUsage()
        // Detect country for pricing display
        const detected = detectCountryFromTimezone()
        setCountryPricing(COUNTRY_PRICING[detected] || COUNTRY_PRICING[DEFAULT_COUNTRY])
    }, [user, router, fetchUsage])

    const currentPlan = data?.plan || "free"

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    const usage = data?.usage
    const docsUsed = usage?.documentsUsed || 0
    const docsLimit = usage?.documentsLimit || 3
    const docsPercent = usage?.documentsPercent || 0

    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-5xl pb-20">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold mb-1">Billing & Plans</h1>
                <p className="text-sm text-muted-foreground">Manage your subscription and track usage</p>
            </div>

            {/* Usage Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Crown className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Current Plan</p>
                            <p className="font-semibold">{data?.planName || "Free"}</p>
                        </div>
                    </div>
                    {data?.subscription?.current_period_end && (
                        <p className="text-xs text-muted-foreground">Renews {new Date(data.subscription.current_period_end).toLocaleDateString()}</p>
                    )}
                </div>

                <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Documents This Month</p>
                            <p className="font-semibold">{docsUsed} <span className="text-muted-foreground font-normal">/ {docsLimit === -1 ? "∞" : docsLimit}</span></p>
                        </div>
                    </div>
                    {docsLimit > 0 && (
                        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${docsPercent > 80 ? "bg-red-500" : docsPercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${docsPercent}%` }}
                            />
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">AI Requests</p>
                            <p className="font-semibold">{usage?.aiRequests || 0}</p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Month: {usage?.currentMonth || "—"}</p>
                </div>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-1 mb-6 bg-secondary/50 rounded-2xl p-1 w-fit mx-auto">
                <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${billingCycle === "yearly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                >
                    Yearly <span className="text-emerald-600 text-xs font-bold">-20%</span>
                </button>
            </div>

            {/* Plans Grid — equal height cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => {
                    const isCurrent = plan.id === currentPlan
                    const paidPlan = plan.id as "starter" | "pro" | "agency"
                    const price = plan.id === "free" ? 0 : countryPricing[paidPlan]?.[billingCycle] || 0
                    const priceDisplay = plan.id === "free" ? "Free" : formatPrice(price, countryPricing)
                    const isUpgrade = plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentPlan)
                    const isDowngrade = plans.findIndex(p => p.id === plan.id) < plans.findIndex(p => p.id === currentPlan)

                    return (
                        <div
                            key={plan.id}
                            className={`relative flex flex-col rounded-2xl border bg-card overflow-hidden ${plan.popular ? "border-primary shadow-md ring-1 ring-primary/10" : ""}`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                            )}

                            {/* Header — fixed height */}
                            <div className="p-5 pb-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-base">{plan.name}</h3>
                                    {plan.popular && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Zap className="w-2.5 h-2.5 mr-0.5" />Popular</Badge>}
                                    {isCurrent && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Current</Badge>}
                                </div>
                                <div className="mt-2 mb-1">
                                    {plan.id === "free" ? (
                                        <span className="text-2xl font-bold">Free</span>
                                    ) : (
                                        <><span className="text-2xl font-bold">{priceDisplay}</span><span className="text-muted-foreground text-xs">/mo</span></>
                                    )}
                                </div>
                                {billingCycle === "yearly" && price > 0 && (
                                    <p className="text-xs text-muted-foreground">Billed {formatPrice(price * 12, countryPricing)}/year</p>
                                )}
                            </div>

                            {/* Features — flex-1 to push button to bottom */}
                            <div className="flex-1 px-5 pb-3">
                                <ul className="space-y-2">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[13px] leading-snug">
                                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Button — always at bottom */}
                            <div className="p-5 pt-3">
                                <Button
                                    className="w-full"
                                    variant={isCurrent ? "outline" : isDowngrade ? "ghost" : "default"}
                                    size="sm"
                                    disabled={isCurrent || plan.comingSoon || isProcessing || isDowngrading || (plan.id === "free" && currentPlan === "free")}
                                    onClick={() => {
                                        if (isDowngrade) {
                                            setDowngradeTarget(plan.id)
                                        } else if (plan.id !== "free" && !plan.comingSoon) {
                                            subscribe(plan.id, billingCycle)
                                        }
                                    }}
                                >
                                    {(isProcessing || isDowngrading) ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : isCurrent ? "Current Plan"
                                        : plan.comingSoon ? "Coming Soon"
                                        : isUpgrade ? "Upgrade"
                                        : isDowngrade ? "Downgrade"
                                        : "Subscribe"}
                                </Button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <p className="text-[11px] text-muted-foreground text-center mt-6">
                Payments processed securely by Razorpay. All prices in INR. Cancel anytime.{" "}
                <a href="/refund-policy" className="underline">Refund Policy</a> · <a href="/terms" className="underline">Terms</a>
            </p>

            {/* Scheduled downgrade notice */}
            {(data?.subscription as any)?.scheduled_downgrade && (
                <div className="mt-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 text-center">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Your plan will downgrade to <span className="font-bold">{plans.find(p => p.id === (data?.subscription as any)?.scheduled_downgrade)?.name}</span> on{" "}
                        {data?.subscription?.current_period_end ? new Date(data.subscription.current_period_end).toLocaleDateString() : "end of billing period"}.
                    </p>
                </div>
            )}

            {/* Downgrade Confirmation Dialog */}
            {downgradeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDowngradeTarget(null)}>
                    <div className="bg-background rounded-2xl border shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold mb-2">Confirm Downgrade</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Are you sure you want to downgrade to the <span className="font-medium text-foreground">{plans.find(p => p.id === downgradeTarget)?.name}</span> plan?
                        </p>
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 mb-4">
                            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                                • You&apos;ll keep your current plan features until the end of your billing period<br />
                                • The downgrade takes effect from the next billing cycle<br />
                                • Your documents and data will be preserved<br />
                                {downgradeTarget === "free" && "• Some features will become unavailable on the Free plan"}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setDowngradeTarget(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                className="flex-1"
                                disabled={isDowngrading}
                                onClick={async () => {
                                    setIsDowngrading(true)
                                    try {
                                        const res = await authFetch("/api/razorpay/downgrade", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ targetPlan: downgradeTarget }),
                                        })
                                        const result = await res.json()
                                        if (res.ok) {
                                            toast.success(result.message)
                                            setDowngradeTarget(null)
                                            fetchUsage()
                                        } else {
                                            toast.error(result.error || "Failed to downgrade")
                                        }
                                    } catch {
                                        toast.error("Something went wrong")
                                    } finally {
                                        setIsDowngrading(false)
                                    }
                                }}
                            >
                                {isDowngrading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Downgrade"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
