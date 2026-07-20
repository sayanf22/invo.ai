"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Check, Zap, Crown, Loader2, FileText, MessageSquare, Download, Receipt, ArrowLeft, Info, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useRazorpay } from "@/hooks/use-razorpay"
import { authFetch } from "@/lib/auth-fetch"
import { useSafeBack } from "@/hooks/use-safe-back"
import { PageHeaderSkeleton, StatTilesSkeleton, PlanGridSkeleton, ListItemSkeleton } from "@/components/ui/skeletons"
import { toast } from "sonner"
import { getBillablePricing, detectCountryFromTimezone, detectCountryFromIP, formatPrice, DEFAULT_COUNTRY, type CountryPricing } from "@/lib/pricing"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { ClorefyLogo } from "@/components/clorefy-logo"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { fromMinorUnits } from "@/lib/invoice-types"
import type { Database } from "@/lib/database.types"
import { cn } from "@/lib/utils"

const plans = [
    {
        id: "free", name: "Free",
        features: ["5 documents/month", "Invoice + Contract + Quote", "3 PDF templates", "Every country worldwide", "PDF export only", "5 email sends/month", "Custom logo & branding"],
    },
    {
        id: "starter", name: "Starter", popular: true,
        features: ["50 documents/month", "All document types", "All PDF templates", "Every country worldwide", "PDF + DOCX export", "100 email sends/month", "Custom logo & branding"],
    },
    {
        id: "pro", name: "Pro",
        features: ["150 documents/month", "All document types", "All PDF templates", "Every country worldwide", "PDF + DOCX + Image export", "250 email sends/month", "E-signatures", "Custom logo & branding"],
    },
    {
        id: "agency", name: "Agency", comingSoon: true,
        features: ["Unlimited documents", "Everything in Pro", "Unlimited email sends", "Custom logo & branding", "3 team members", "Priority support"],
    },
]

const PLAN_LABELS: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", agency: "Agency" }

interface UsageData {
    plan: string
    storedPlan?: string
    planName: string
    subscription: any
    billingStatus?: string
    periodEnd?: string | null
    isExpired?: boolean
    usageResetsAt: string
    usagePolicy: string
    billingAnchored?: boolean
    lastUsageReset?: {
        effectiveAt: string
        reason: string
        fromPlan: string
        toPlan: string
    } | null
    usage: {
        documentsUsed: number
        documentsLimit: number
        documentsPercent: number
        isOverLimit: boolean
        aiRequests: number
        currentMonth: string
        periodStart: string
        periodEndExclusive: string
        timezone: string
    }
}

type PaymentHistoryRow = Database["public"]["Tables"]["payment_history"]["Row"]
type PaymentRecord = Pick<
    PaymentHistoryRow,
    | "id"
    | "razorpay_payment_id"
    | "razorpay_order_id"
    | "razorpay_invoice_id"
    | "razorpay_subscription_id"
    | "amount"
    | "currency"
    | "status"
    | "plan"
    | "billing_cycle"
    | "created_at"
>

function formatExactLocal(value: string | null | undefined): string {
    if (!value) return "Unavailable"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Unavailable"
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    }).format(date)
}

function formatPaymentAmount(amount: number, currencyValue: string | null): string {
    const currency = (currencyValue || "INR").toUpperCase()
    const majorAmount = fromMinorUnits(amount, currency)
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(majorAmount)
    } catch {
        return `${currency} ${majorAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
}

export default function BillingPage() {
    const router = useRouter()
    const goBack = useSafeBack("/")
    const { user } = useAuth()
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
    const [data, setData] = useState<UsageData | null>(null)
    const [loading, setLoading] = useState(true)
    const [downgradeTarget, setDowngradeTarget] = useState<string | null>(null)
    const [isDowngrading, setIsDowngrading] = useState(false)
    const [countryPricing, setCountryPricing] = useState<CountryPricing>(getBillablePricing(DEFAULT_COUNTRY))
    const [payments, setPayments] = useState<PaymentRecord[]>([])
    const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null)
    const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null)
    const [isCancellingChange, setIsCancellingChange] = useState(false)

    const { subscribe, isProcessing } = useRazorpay({
        onSuccess: () => { fetchUsage(); fetchPayments(); router.refresh() },
    })

    const fetchUsage = useCallback(async () => {
        try {
            const res = await authFetch("/api/usage")
            if (res.ok) {
                const json = await res.json()
                setData(json)
                return json as UsageData
            }
        } catch {} finally { setLoading(false) }
        return null
    }, [])

    const fetchPayments = useCallback(async () => {
        if (!user?.id) return
        try {
            const supabase = createClient()
            const { data: rows } = await supabase
                .from("payment_history")
                .select("id, razorpay_payment_id, razorpay_order_id, razorpay_invoice_id, razorpay_subscription_id, amount, currency, status, plan, billing_cycle, created_at")
                .eq("user_id", user.id)
                .eq("status", "captured")
                .in("plan", ["starter", "pro", "agency"])
                .order("created_at", { ascending: false })
                .limit(10)
            if (rows) setPayments(rows)
        } catch {}
    }, [user?.id])

    // Auto-reconcile: if a payment was charged but activation was missed,
    // recover it silently on load and refresh the UI — no manual refresh needed.
    const autoReconcile = useCallback(async () => {
        try {
            const res = await authFetch("/api/razorpay/reconcile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            })
            if (!res.ok) return
            const result = await res.json()
            if (result.activated) {
                const planLabel = (result.plan || "").charAt(0).toUpperCase() + (result.plan || "").slice(1)
                toast.success(`🎉 ${planLabel} plan activated!`)
            }
            const shouldRefresh = Boolean(
                result.activated
                || result.terminal
                || result.finalized
                || result.pendingCleared
                || result.scheduled
            )
            if (shouldRefresh) {
                await Promise.all([fetchUsage(), fetchPayments()])
                router.refresh()
            }
        } catch { /* silent — non-blocking */ }
    }, [fetchUsage, fetchPayments, router])

    const cancelPendingChange = useCallback(async () => {
        setIsCancellingChange(true)
        try {
            const res = await authFetch("/api/razorpay/cancel-change", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            })
            const result = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (result.code === "REAUTHORIZATION_REQUIRED") {
                    toast.info("Choose a paid plan below to replace the cancelled mandate before access ends.")
                    return
                }
                throw new Error(result.error || "Failed to cancel scheduled change")
            }
            toast.success("Pending change cancelled")
            await Promise.all([fetchUsage(), fetchPayments()])
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to cancel scheduled change")
        } finally {
            setIsCancellingChange(false)
        }
    }, [fetchUsage, fetchPayments, router])

    const downloadReceipt = useCallback(async (payment: PaymentRecord) => {
        if (payment.status !== "captured") {
            toast.error("A receipt is only available for captured payments")
            return
        }
        setDownloadingReceiptId(payment.id)
        try {
            const { pdf } = await import("@react-pdf/renderer")
            const { PaymentReceiptPDF } = await import("@/lib/pdf-templates")
            const receiptData = {
                paymentId: payment.razorpay_payment_id,
                orderId: payment.razorpay_order_id,
                invoiceId: payment.razorpay_invoice_id,
                subscriptionId: payment.razorpay_subscription_id,
                plan: payment.plan ? (PLAN_LABELS[payment.plan] || payment.plan) : "Unavailable",
                billingCycle: payment.billing_cycle || "Unavailable",
                amount: payment.amount,
                currency: payment.currency || "INR",
                date: payment.created_at,
                userEmail: user?.email || "",
            }
            const blob = await pdf(<PaymentReceiptPDF receiptData={receiptData} />).toBlob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            const rawReference = payment.razorpay_payment_id || payment.id || "payment"
            const safeReference = rawReference.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "payment"
            link.href = url
            link.download = `clorefy-receipt-${safeReference}.pdf`
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
        fetchUsage().then((usage) => {
            // Reconcile missed activations and any provider-confirmed transition
            // whose local persistence/old-mandate cleanup is still pending.
            const subscription = usage?.subscription as any
            if (!usage || usage.plan === "free" || subscription?.provider_sync_required || subscription?.pending_previous_subscription_id || subscription?.pending_razorpay_subscription_id || subscription?.pending_change_type) {
                autoReconcile()
            }
        })
        fetchPayments()
        // Step 1: instant timezone detection.
        // getBillablePricing() ensures the DISPLAYED currency/price is exactly what
        // will be CHARGED — countries without a billable currency fall back to USD
        // (matches server-side resolveSubscriptionCurrency), and yearly is 20% off.
        const tzCountry = detectCountryFromTimezone()
        setCountryPricing(getBillablePricing(tzCountry))
        // Step 2: refine with IP detection (Cloudflare header, more accurate)
        detectCountryFromIP().then((ipCountry) => {
            if (ipCountry) {
                setCountryPricing(getBillablePricing(ipCountry))
            }
        })
    }, [user, router, fetchUsage, fetchPayments, autoReconcile])

    const currentPlan = data?.plan || "free"

    if (loading) {
        return (
            <div className="min-h-screen bg-background pb-20">
                <PageHeaderSkeleton titleWidth={20} />
                <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-8">
                    <div className="mb-2 space-y-2">
                        <div className="h-7 w-48 rounded-lg bg-muted animate-pulse" />
                        <div className="h-4 w-64 rounded-md bg-muted/60 animate-pulse" />
                    </div>
                    <StatTilesSkeleton count={3} />
                    <div className="space-y-3">
                        <div className="h-5 w-36 rounded-md bg-muted animate-pulse" />
                        <ListItemSkeleton count={2} />
                    </div>
                    <PlanGridSkeleton count={4} />
                </div>
            </div>
        )
    }

    const usage = data?.usage
    const docsUsed = usage?.documentsUsed ?? 0
    const docsLimit = usage?.documentsLimit ?? 5
    const docsPercent = usage?.documentsPercent ?? 0

        const isUnlimited = docsLimit === 0
        const docsLabel = isUnlimited ? "∞" : docsLimit

        return (
            <div className="min-h-screen bg-background pb-20">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => goBack()}
                            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary/60 transition-colors shrink-0"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <Link href="/" className="flex items-center gap-2"><ClorefyLogo size={26} /><span className="font-bold text-lg hidden sm:block">Clorefy</span></Link>
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
                    {data?.isExpired ? (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-3 mt-1 border-t border-border/40">
                            {data?.storedPlan && data.storedPlan !== "free"
                                ? `Your ${PLAN_LABELS[data.storedPlan] || data.storedPlan} plan ended${data?.periodEnd ? ` at ${formatExactLocal(data.periodEnd)}` : ""} — now on Free`
                                : "Subscription ended — now on Free"}
                        </p>
                    ) : data?.plan !== "free" && data?.subscription?.current_period_end && (
                        <p className="text-[11px] text-muted-foreground font-medium pt-3 mt-1 border-t border-border/40">
                            {(data?.subscription?.cancelled_at || data?.subscription?.scheduled_downgrade === "free")
                                ? `Access until ${formatExactLocal(data.subscription.current_period_end)}`
                                : data?.subscription?.scheduled_downgrade
                                    ? `Changes plan at ${formatExactLocal(data.subscription.current_period_end)}`
                                    : `Renews ${formatExactLocal(data.subscription.current_period_end)}`}
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
                                <p className="font-semibold text-lg leading-tight">{docsUsed} <span className="text-muted-foreground text-sm font-medium">/ {docsLabel}</span></p>
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
                        Allowance period: {formatExactLocal(usage?.periodStart)}
                    </p>
                </div>
            </div>
            <details className="group -mt-5 mb-6 text-[10px] text-muted-foreground">
                <summary className="ml-auto flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted/50 hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <Info className="h-3 w-3" />
                    Usage reset details
                    <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-1.5 ml-auto max-w-lg space-y-1 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 leading-relaxed">
                    <p>
                        {data?.billingAnchored
                            ? "Paid allowances renew on your billing date each month (monthly and yearly plans alike)."
                            : "Free allowances reset at the start of each UTC calendar month."}
                        {" "}Next reset: {formatExactLocal(data?.usageResetsAt || usage?.periodEndExclusive)}.
                    </p>
                    {data?.lastUsageReset && (
                        <p>Last plan reset: {PLAN_LABELS[data.lastUsageReset.fromPlan] || data.lastUsageReset.fromPlan} → {PLAN_LABELS[data.lastUsageReset.toPlan] || data.lastUsageReset.toPlan} at {formatExactLocal(data.lastUsageReset.effectiveAt)}.</p>
                    )}
                    <p>Existing documents always stay editable, even after a downgrade.{usage?.isOverLimit ? " Current document limit reached." : ""}</p>
                </div>
            </details>

            {/* Payment History */}
            {payments.length > 0 && (
                <details className="group mb-8">
                    <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-1 py-2 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                        <div>
                            <h2 className="text-base font-semibold">Payment History</h2>
                            <p className="text-[11px] text-muted-foreground">{payments.length} {payments.length === 1 ? "payment" : "payments"}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-2 rounded-2xl border bg-card divide-y divide-border overflow-hidden">
                        {payments.map((payment) => (
                            <div key={payment.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                                    <Receipt className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">
                                        {payment.plan ? (PLAN_LABELS[payment.plan] || payment.plan) : "Paid subscription"}
                                        <span className="ml-2 text-muted-foreground font-normal">{formatPaymentAmount(payment.amount, payment.currency)}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground">{formatExactLocal(payment.created_at)}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-8 w-8"
                                    aria-label="View payment information"
                                    title="Payment information"
                                    onClick={() => setSelectedPayment(payment)}
                                >
                                    <Info className="w-4 h-4" aria-hidden="true" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-8 w-8"
                                    aria-label="Download payment receipt"
                                    title="Download receipt"
                                    disabled={downloadingReceiptId === payment.id}
                                    onClick={() => downloadReceipt(payment)}
                                >
                                    {downloadingReceiptId === payment.id
                                        ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                        : <Download className="w-4 h-4" aria-hidden="true" />}
                                </Button>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            <Dialog open={Boolean(selectedPayment)} onOpenChange={(open) => { if (!open) setSelectedPayment(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Payment information</DialogTitle>
                        <DialogDescription>Historical captured subscription payment.</DialogDescription>
                    </DialogHeader>
                    {selectedPayment && (
                        <div className="space-y-2 text-sm">
                            {[
                                ["Plan", selectedPayment.plan ? (PLAN_LABELS[selectedPayment.plan] || selectedPayment.plan) : "Unavailable"],
                                ["Amount", formatPaymentAmount(selectedPayment.amount, selectedPayment.currency)],
                                ["Cycle", selectedPayment.billing_cycle || "Unavailable"],
                                ["Status", selectedPayment.status],
                                ["Recorded at", formatExactLocal(selectedPayment.created_at)],
                                ["Payment ID", selectedPayment.razorpay_payment_id || "Unavailable"],
                                ...(selectedPayment.razorpay_order_id ? [["Order ID", selectedPayment.razorpay_order_id]] : []),
                                ...(selectedPayment.razorpay_invoice_id ? [["Invoice ID", selectedPayment.razorpay_invoice_id]] : []),
                                ...(selectedPayment.razorpay_subscription_id ? [["Subscription ID", selectedPayment.razorpay_subscription_id]] : []),
                            ].map(([label, value]) => (
                                <div key={label} className="grid grid-cols-[110px_1fr] gap-3 border-b border-border/50 py-2 last:border-0">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="font-medium break-all">{value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            className="gap-2"
                            disabled={!selectedPayment || downloadingReceiptId === selectedPayment.id}
                            onClick={() => { if (selectedPayment) downloadReceipt(selectedPayment) }}
                        >
                            {selectedPayment && downloadingReceiptId === selectedPayment.id
                                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                : <Download className="w-4 h-4" aria-hidden="true" />}
                            Download receipt
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                    const isCurrentPlan = plan.id === currentPlan
                    const subscription = data?.subscription as any
                    const currentBillingCycle = subscription?.billing_cycle || "monthly"
                    const pendingPlan = subscription?.pending_plan as string | null
                    const pendingCycle = subscription?.pending_billing_cycle as string | null
                    const pendingType = subscription?.pending_change_type as string | null
                    const hasPendingChange = Boolean(pendingType && pendingPlan)
                    // Paid targets are scheduled for an exact plan AND billing cycle, so
                    // the monthly and yearly cards never both show "Scheduled". Free has
                    // no billing cycle.
                    const isScheduledTarget = hasPendingChange && plan.id === pendingPlan
                        && (plan.id === "free" || pendingCycle === billingCycle)
                    const isPendingCancellation = pendingType === "cancellation" && pendingPlan === "free"
                    const canAuthorizeCancellationReplacement = isPendingCancellation
                        && plan.id !== "free" && !plan.comingSoon
                    const isExactCurrent = isCurrentPlan && (plan.id === "free" || currentBillingCycle === billingCycle)
                    const isCycleSwitch = isCurrentPlan && plan.id !== "free" && currentBillingCycle !== billingCycle
                    const paidPlan = plan.id as "starter" | "pro" | "agency"
                    const price = plan.id === "free" ? 0 : countryPricing[paidPlan]?.[billingCycle] || 0
                    const priceDisplay = plan.id === "free" ? "Free" : formatPrice(price, countryPricing)
                    const isUpgrade = plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === currentPlan)
                    const isDowngrade = plans.findIndex(p => p.id === plan.id) < plans.findIndex(p => p.id === currentPlan)

                    return (
                        <div key={plan.id} className={`relative flex flex-col rounded-3xl border bg-card overflow-hidden transition-all duration-300 shadow-[0_8px_24px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)] hover:-translate-y-1 ${plan.popular ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"}`}>
                            {plan.popular && <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary" />}
                            <div className="p-6 pb-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                                    <div className="flex flex-col items-end gap-1">
                                        {isCurrentPlan && <Badge variant="outline" className="text-[10px] px-2 py-0.5">Current plan</Badge>}
                                        {isScheduledTarget && (
                                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 border-none text-[10px] px-2 py-0.5">
                                                Scheduled plan
                                            </Badge>
                                        )}
                                        {plan.popular && !isCurrentPlan && !isScheduledTarget && <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 border-none text-[10px] px-2 py-0.5"><Zap className="w-3 h-3 mr-1" />Popular</Badge>}
                                    </div>
                                </div>
                                {isScheduledTarget && subscription?.pending_effective_at && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mb-2">
                                        Starts {formatExactLocal(subscription.pending_effective_at)}
                                    </p>
                                )}
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
                                <Button className={cn("w-full rounded-xl py-5 font-semibold", plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")} variant={isExactCurrent ? "outline" : isDowngrade ? "ghost" : "default"} size="default"
                                    disabled={isScheduledTarget || (isExactCurrent && !canAuthorizeCancellationReplacement) || (hasPendingChange && !canAuthorizeCancellationReplacement) || plan.comingSoon || isProcessing || isDowngrading || isCancellingChange || (plan.id === "free" && currentPlan === "free")}
                                    onClick={() => {
                                        if (canAuthorizeCancellationReplacement) subscribe(plan.id, billingCycle, countryPricing.countryCode)
                                        else if (isDowngrade) setDowngradeTarget(plan.id)
                                        else if (plan.id !== "free" && !plan.comingSoon) subscribe(plan.id, billingCycle, countryPricing.countryCode)
                                    }}>
                                    {(isProcessing || isDowngrading || isCancellingChange) ? <Loader2 className="w-5 h-5 animate-spin" />
                                        : isScheduledTarget ? "Scheduled"
                                        : canAuthorizeCancellationReplacement && isExactCurrent ? "Keep Current Plan"
                                        : canAuthorizeCancellationReplacement ? `Authorize ${plan.name}`
                                        : hasPendingChange ? "Resolve Pending Change"
                                        : isExactCurrent ? "Current Plan"
                                        : plan.comingSoon ? "Coming Soon"
                                        : isCycleSwitch ? `Switch to ${billingCycle === "yearly" ? "Yearly" : "Monthly"}`
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
                Payments processed securely by Razorpay. Prices shown in {countryPricing.currency} ({countryPricing.country}). Cancel anytime.{" "}
                <a href="/refund-policy" className="underline">Refund Policy</a> · <a href="/terms" className="underline">Terms</a>
            </p>

            {(data?.subscription as any)?.pending_change_type && (() => {
                const sub = data!.subscription as any
                const pType = sub.pending_change_type as string
                const pPlan = (sub.pending_plan as string) || ""
                const pCycle = sub.pending_billing_cycle as string | null
                const effectiveAt = sub.pending_effective_at as string | null
                const isCancellation = pType === "cancellation"
                // "Scheduled" only when there is a real future effective date (a
                // downgrade or cancellation at period end). An upgrade has no date —
                // it activates the moment payment is confirmed, so it is "pending",
                // never "scheduled".
                const isScheduled = Boolean(effectiveAt)
                const targetLabel = `${PLAN_LABELS[pPlan] || pPlan}${pCycle ? ` · ${pCycle}` : ""}`
                const title = isCancellation
                    ? "Cancellation scheduled"
                    : isScheduled ? "Plan change scheduled" : "Upgrade awaiting payment"
                const body = isCancellation
                    ? `Your ${PLAN_LABELS[currentPlan] || currentPlan} access stays active until ${formatExactLocal(effectiveAt)}. To keep a paid plan, choose one above and authorize the replacement before then.`
                    : isScheduled
                        ? `You'll move to ${targetLabel} on ${formatExactLocal(effectiveAt)}, and your ${PLAN_LABELS[currentPlan] || currentPlan} plan stays active until then. Document, email, and AI allowance counters reset once when this transition actually completes; your documents and payment history are preserved.`
                        : `You started an upgrade to ${targetLabel}. It activates only after Razorpay confirms your payment — if you didn't finish checkout you can safely discard it. Your documents and payment history are preserved.`
                return (
                    <div className="mt-6 rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_24px_rgb(0,0,0,0.06)]">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center">
                                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold">{title}</p>
                                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium">
                                        {PLAN_LABELS[currentPlan] || currentPlan} → {targetLabel}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {!isCancellation && (
                                        <Button variant="outline" size="sm" disabled={isCancellingChange || isProcessing} onClick={cancelPendingChange}>
                                            {isCancellingChange
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : isScheduled ? "Cancel scheduled change" : "Discard upgrade"}
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" disabled={isCancellingChange || isProcessing} onClick={autoReconcile}>
                                        Refresh status
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

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
                                • The downgrade takes effect at the exact end of your paid billing period<br />
                                • Document, email, and AI allowances reset once when the new plan becomes active<br />
                                • Your documents, payment receipts, and account data will be preserved<br />
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
