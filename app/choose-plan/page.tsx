"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Check, Zap, Loader2, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { useRazorpay } from "@/hooks/use-razorpay"
import { COUNTRY_PRICING, detectCountryFromTimezone, formatPrice, DEFAULT_COUNTRY, type CountryPricing } from "@/lib/pricing"
import { toast } from "sonner"

const plans = [
    {
        id: "free", name: "Free",
        desc: "Get started with basic document generation",
        features: ["3 documents/month", "All 4 document types", "3 PDF templates", "All 11 countries", "PDF export"],
    },
    {
        id: "starter", name: "Starter", popular: true,
        desc: "For growing businesses that need more",
        features: ["50 documents/month", "All 4 document types", "All 9 templates", "All 11 countries", "PDF + DOCX export"],
    },
    {
        id: "pro", name: "Pro",
        desc: "Full power for professionals",
        features: ["150 documents/month", "All document types", "All export formats", "E-signatures", "Custom branding"],
    },
    {
        id: "agency", name: "Agency", comingSoon: true,
        desc: "For teams and agencies",
        features: ["Unlimited documents", "Everything in Pro", "3 team members", "Priority support"],
    },
]

export default function ChoosePlanPage() {
    const router = useRouter()
    const { user, supabase, isLoading } = useAuth()
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
    const [selectingFree, setSelectingFree] = useState(false)
    const [countryPricing, setCountryPricing] = useState<CountryPricing>(COUNTRY_PRICING[DEFAULT_COUNTRY])

    const { subscribe, isProcessing } = useRazorpay({
        onSuccess: async () => {
            // Mark plan as selected in profile
            if (user) {
                await supabase.from("profiles").update({ plan_selected: true } as any).eq("id", user.id)
            }
            toast.success("Plan activated! Let's set up your business profile.")
            router.push("/onboarding")
        },
    })

    // Redirect if not logged in
    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/auth/login")
        }
        // Detect country for pricing
        const detected = detectCountryFromTimezone()
        setCountryPricing(COUNTRY_PRICING[detected] || COUNTRY_PRICING[DEFAULT_COUNTRY])
    }, [isLoading, user, router])

    // Check if plan already selected
    useEffect(() => {
        if (!user) return
        supabase
            .from("profiles")
            .select("onboarding_complete, plan_selected")
            .eq("id", user.id)
            .single()
            .then(({ data }: any) => {
                if (data?.plan_selected) {
                    router.push(data.onboarding_complete ? "/" : "/onboarding")
                }
            })
    }, [user, supabase, router])

    const handleFreePlan = useCallback(async () => {
        if (!user) return
        setSelectingFree(true)
        try {
            // Create free subscription record
            await supabase.from("subscriptions" as any).upsert({
                user_id: user.id,
                plan: "free",
                status: "active",
                current_period_start: new Date().toISOString(),
            } as any, { onConflict: "user_id" })

            // Mark plan as selected
            await supabase.from("profiles").update({ plan_selected: true } as any).eq("id", user.id)

            toast.success("Free plan activated! Let's set up your business profile.")
            router.push("/onboarding")
        } catch (err) {
            toast.error("Something went wrong. Please try again.")
        } finally {
            setSelectingFree(false)
        }
    }, [user, supabase, router])

    const handlePaidPlan = useCallback((planId: string) => {
        subscribe(planId, billingCycle, countryPricing.countryCode)
    }, [subscribe, billingCycle, countryPricing])

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="py-4 px-4 sm:px-6 flex items-center justify-between shrink-0">
                <ClorefyLogo size={36} />
                <HamburgerMenu />
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
                <div className="text-center mb-8 max-w-lg">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Choose your plan</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Select a plan to get started. You can upgrade or downgrade anytime.</p>
                </div>

                {/* Billing Toggle */}
                <div className="flex items-center gap-1 bg-secondary/50 rounded-2xl p-1 mb-8">
                    <button
                        onClick={() => setBillingCycle("monthly")}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${billingCycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingCycle("yearly")}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${billingCycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >
                        Yearly <span className="text-emerald-600 text-xs font-bold">-20%</span>
                    </button>
                </div>

                {/* Plans */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
                    {plans.map((plan) => {
                        const paidPlan = plan.id as "starter" | "pro" | "agency"
                        const price = plan.id === "free" ? 0 : countryPricing[paidPlan]?.[billingCycle] || 0
                        const priceDisplay = plan.id === "free" ? "Free" : formatPrice(price, countryPricing)
                        return (
                            <div
                                key={plan.id}
                                className={`relative flex flex-col rounded-2xl border bg-card overflow-hidden ${plan.popular ? "border-primary shadow-md ring-1 ring-primary/10" : ""}`}
                            >
                                {plan.popular && <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />}

                                <div className="p-5 pb-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold">{plan.name}</h3>
                                        {plan.popular && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Zap className="w-2.5 h-2.5 mr-0.5" />Popular</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-3">{plan.desc}</p>
                                    <div>
                                        {plan.id === "free" ? (
                                            <span className="text-2xl font-bold">Free</span>
                                        ) : (
                                            <><span className="text-2xl font-bold">{priceDisplay}</span><span className="text-muted-foreground text-xs">/mo</span></>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 px-5 pb-3">
                                    <ul className="space-y-2">
                                        {plan.features.map((f, i) => (
                                            <li key={i} className="flex items-start gap-2 text-[13px]">
                                                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-5 pt-3">
                                    <Button
                                        className="w-full"
                                        size="sm"
                                        disabled={plan.comingSoon || isProcessing || selectingFree}
                                        onClick={() => {
                                            if (plan.id === "free") handleFreePlan()
                                            else if (!plan.comingSoon) handlePaidPlan(plan.id)
                                        }}
                                    >
                                        {(isProcessing || selectingFree) ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : plan.comingSoon ? "Coming Soon"
                                            : <>Get Started <ArrowRight className="w-3.5 h-3.5 ml-1" /></>}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </main>
        </div>
    )
}
