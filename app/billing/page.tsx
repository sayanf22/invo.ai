"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Check, Zap, Crown, Loader2, FileText, MessageSquare, Download, Receipt, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useRazorpay } from "@/hooks/use-razorpay"
import { authFetch } from "@/lib/auth-fetch"
import { toast } from "sonner"
import { COUNTRY_PRICING, detectCountryFromTimezone, formatPrice, DEFAULT_COUNTRY, type CountryPricing } from "@/lib/pricing"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { ClorefyLogo } from "@/components/clorefy-logo"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const plans = [
    {
        id: "free", name: "Free",
        features: ["5 documents/month", "Invoice + Contract only", "3 PDF templates", "3 countries (IN, US, UK)", "PDF export only", "7-day session history"],
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

const PLAN_LABELS: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", agency: "Agency" }

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

interface PaymentRecord {
    id: string
    razorpay_payment_id: string
    razorpay_order_id: string
    amount: number
    currency: string
    status: string
    plan: string
    billing_cycle: string | null
    created_at: string
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
    const [payments, setPayments] = useState<PaymentRecord[]>([])
    const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null)

    const { subscribe, isProcessing } = useRazorpay({
        onSuccess: () => { fetchUsage(); fetchPayments(); router.refresh() },
    })

    const fetchUsage = useCallback(async () => {
        try {
            const res = await authFetch("/api/usage")
            if (res.ok) setData(await res.json())
        } catch {} finally { setLoading(false) }
    }, [])

    const fetchPayments = useCallback(async () => {
        try {
            const supabase = createClient()
            const { data: rows } = await supabase
                .from("payment_history" as any)
                .select("id, razorpay_payment_id, razorpay_order_id, amount, currency, status, plan, billing_cycle, created_at")
                .eq("status", "captured")
                .order("created_at", { ascending: false })
                .limit(10)
            if (rows) setPayments(rows as unknown as PaymentRecord[])
        } catch {}
    }, [])

    const downloadReceipt = useCallback(async (payment: PaymentRecord) => {
        setDownloadingReceiptId(payment.id)
        try {
            const { pdf } = await import("@react-pdf/renderer")
            const { PaymentReceiptPDF } = await import("@/lib/pdf-templates")
            const receiptData = {
                paymentId: payment.razorpay_payment_id,
                orderId: payment.razorpay_order_id,
                plan: PLAN_LABELS[payment.plan] || payment.plan,
                billingCycle: payment.billing_cycle || "monthly",
                amount: payment.amount,
                currency: payment.currency,
                date: payment.created_at,
                userEmail: user?.email || "",
            }
            const blob = await pdf(<PaymentReceiptPDF receiptData={receiptData} />).toBlob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `clorefy-receipt-${payment.razorpay_payment_id}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            toast.success("Receipt downloaded!")
        } catch (err) {
            console.error("Receipt error:", err)
            toast.error("Failed to generate receipt")
        } finally {
            setDownloadingReceiptId(null)
        }
    }, [user])

    useEffect(() => {
        if (!user) { router.push("/auth/login"); return }
        fetchUsage()
        fetchPayments()
        const detected = detectCountryFromTimezone()
        setCountryPricing(COUNTRY_PRICING[detected] || COUNTRY_PRICING[DEFAULT_COUNTRY])
    }, [user, router, fetchUsage, fetchPayments])

    const currentPlan = data?.plan || "free"

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    const usage = data?.usage
    const docsUsed = usage?.documentsUsed || 0
    const docsLimit = usage?.documentsLimit || 5
    const docsPercent = usage?.documentsPercent || 0

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary/60 transition-colors shrink-0"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <Link href="/" className="flex items-center gap-2"><ClorefyLogo size={28} /><span className="font-bold text-lg hidden sm:block">Clorefy</span></Link>
                    </div>
                    <HamburgerMenu />
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-8">
                <div className="mb-2">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-1 tracking-tight">Billing & Plans</h1>
                    <p className="text-sm text-muted-foreground">Manage your subscription and track usage</p>
                </div>

            {/* Usage Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)] flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/5 border border-border/40 flex items-center justify-center">
                                <Crown className="w-5 h-5 text-primary/70" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Current Plan</p>
                                <p className="font-semibold text-lg leading-tight">{data?.planName || "Free"}</p>
                            </div>
                        </div>
                    </div>
                    {data?.subscription?.current_period_end && (
                        <p className="text-[11px] text-muted-foreground font-medium pt-3 mt-1 border-t border-border/40">
                            Renews {new Date(data.subscription.current_period_end).toLocaleDateString()}
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)] flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600/70 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Documents Used</p>
                                <p className="font-semibold text-lg leading-tight">{docsUsed} <span className="text-muted-foreground text-sm font-medium">/ {docsLimit === -1 ? "∞" : docsLimit}</span></p>
                            </div>
                        </div>
                    </div>
                    {docsLimit > 0 && (
                        <div className="pt-2">
                            <div className="w-full h-2 bg-secondary/80 rounded-full overflow-hidden border border-border/40">
                                <div className={`h-full rounded-full transition-all duration-500 ${docsPercent > 80 ? "bg-red-500/80" : docsPercent > 50 ? "bg-amber-500/80" : "bg-emerald-500/80"}`} style={{ width: `${docsPercent}%` }} />
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)] flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-purple-600/70 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">AI Requests</p>
                                <p className="font-semibold text-lg leading-tight">{usage?.aiRequests || 0}</p>
                            </div>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium pt-3 mt-1 border-t border-border/40">
                        Period: {usage?.currentMonth || "—"}
                    </p>
                </div>
            </div>

            {/* Payment History */}
            {payments.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-base font-semibold mb-3">Payment History</h2>
                    <div className="rounded-2xl border bg-card divide-y divide-border overflow-hidden">
                        {payments.map((p) => {
                            return (
                                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                                        <Receipt className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{PLAN_LABELS[p.plan] || p.plan} Plan</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(p.created_at), "MMM dd, yyyy")}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0 h-8 px-3 text-xs gap-1.5"
                                        disabled={downloadingReceiptId === p.id}
                                        onClick={() => downloadReceipt(p)}
                                    >
                                        {downloadingReceiptId === p.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <Download className="w-3.5 h-3.5" />}
                                        Receipt
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-1 mb-6 bg-secondary/60 border border-border/40 rounded-2xl p-1 w-fit mx-auto shadow-sm">
                <button onClick={() => setBillingCycle("monthly")} className={`px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all duration-200 ${billingCycle === "monthly" ? "bg-background shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Monthly</button>
                <button onClick={() => setBillingCycle("yearly")} className={`px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${billingCycle === "yearly" ? "bg-background shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    Yearly <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">-20%</span>
                </button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => {
                    const isCurrent = plan.id === currentPlan
                    const paidPlan = plan.id as "starter" | "pro" | "agency"
                    const price = plan.id === "free" ? 0 : countryPricing[paidPlan]?.[billingCycle] || 0
                    const priceDisplay = plan.id === "free" ? "Free" : formatPrice(price, countryPricing)
                    const isUpgrade = plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentPlan)
                    const isDowngrade = plans.findIndex(p => p.id === plan.id) < plans.findIndex(p => p.id === currentPlan)

                    return (
                        <div key={plan.id} className={`relative flex flex-col rounded-3xl border bg-card overflow-hidden transition-all duration-300 shadow-[0_8px_24px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)] hover:-translate-y-1 ${plan.popular ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"}`}>
                            {plan.popular && <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />}
                            <div className="p-6 pb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                                    {plan.popular && <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 border-none text-[10px] px-2 py-0.5"><Zap className="w-3 h-3 mr-1" />Popular</Badge>}
                                </div>
                                <div className="mt-4 mb-1 h-[40px] flex items-end">
                                    {plan.id === "free" ? <span className="text-3xl font-bold">Free</span> : <div className="flex items-end gap-1"><span className="text-3xl font-bold leading-none">{priceDisplay}</span><span className="text-muted-foreground text-sm mb-1 font-medium">/mo</span></div>}
                                </div>
                                <div className="h-5">
                                    {billingCycle === "yearly" && price > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium tracking-wide">Billed {formatPrice(price * 12, countryPricing)}/year</p>}
                                </div>
                            </div>
                            <div className="flex-1 px-6 pb-4 pt-2">
                                <ul className="space-y-3">
                                    {plan.features.map((f, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                                            <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /><span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="p-6 pt-4 border-t border-border/40 mt-auto bg-muted/10">
                                <Button className={cn("w-full rounded-xl py-5 font-semibold", plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")} variant={isCurrent ? "outline" : isDowngrade ? "ghost" : "default"} size="default"
                                    disabled={isCurrent || plan.comingSoon || isProcessing || isDowngrading || (plan.id === "free" && currentPlan === "free")}
                                    onClick={() => {
                                        if (isDowngrade) setDowngradeTarget(plan.id)
                                        else if (plan.id !== "free" && !plan.comingSoon) subscribe(plan.id, billingCycle, countryPricing.countryCode)
                                    }}>
                                    {(isProcessing || isDowngrading) ? <Loader2 className="w-5 h-5 animate-spin" />
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

            {(data?.subscription as any)?.scheduled_downgrade && (
                <div className="mt-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 text-center">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Your plan will downgrade to <span className="font-bold">{plans.find(p => p.id === (data?.subscription as any)?.scheduled_downgrade)?.name}</span> on{" "}
                        {data?.subscription?.current_period_end ? new Date(data.subscription.current_period_end).toLocaleDateString() : "end of billing period"}.
                    </p>
                </div>
            )}

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
                            <Button variant="outline" className="flex-1" onClick={() => setDowngradeTarget(null)}>Cancel</Button>
                            <Button variant="destructive" className="flex-1" disabled={isDowngrading}
                                onClick={async () => {
                                    setIsDowngrading(true)
                                    try {
                                        const res = await authFetch("/api/razorpay/downgrade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetPlan: downgradeTarget }) })
                                        const result = await res.json()
                                        if (res.ok) { toast.success(result.message); setDowngradeTarget(null); fetchUsage() }
                                        else toast.error(result.error || "Failed to downgrade")
                                    } catch { toast.error("Something went wrong") }
                                    finally { setIsDowngrading(false) }
                                }}>
                                {isDowngrading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Downgrade"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    )
}
