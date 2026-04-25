"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Link2, Copy, Check, Loader2, MessageCircle, RefreshCw, X, AlertTriangle, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import type { InvoiceData } from "@/lib/invoice-types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PaymentLinkButtonProps {
    sessionId: string | null
    invoiceData: InvoiceData
    documentType: string
    onPaymentLinkChange?: (shortUrl: string, status: PaymentLinkState["status"]) => void
    /** Called when a payment link exists — parent can lock invoice editing */
    onLockChange?: (locked: boolean) => void
}

interface PaymentLinkState {
    id?: string
    shortUrl: string
    amount: number
    currency: string
    status: "created" | "paid" | "partially_paid" | "expired" | "cancelled"
    razorpayId?: string
    isExisting?: boolean
}

const CURRENCY_MULTIPLIERS: Record<string, number> = {
    INR: 100, USD: 100, EUR: 100, GBP: 100,
    SGD: 100, AED: 100, CAD: 100, AUD: 100,
    PHP: 100, MYR: 100, JPY: 1,
}

function toSmallestUnit(amount: number, currency: string): number {
    return Math.round(amount * (CURRENCY_MULTIPLIERS[currency.toUpperCase()] ?? 100))
}

function getInvoiceTotal(data: InvoiceData): number {
    if (!data.items?.length) return 0
    const subtotal = data.items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0
        const rate = Number(item.rate) || 0
        const disc = Number(item.discount) || 0
        return sum + (qty * rate * (1 - disc / 100))
    }, 0)
    const taxRate = Number(data.taxRate) || 0
    const discountValue = Number(data.discountValue) || 0
    const shippingFee = Number(data.shippingFee) || 0
    const discountAmount = data.discountType === "percent"
        ? subtotal * (discountValue / 100)
        : discountValue
    const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
    return subtotal - discountAmount + taxAmount + shippingFee
}

function formatAmount(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currency || "INR",
            maximumFractionDigits: 2,
        }).format(amount)
    } catch {
        return `${currency} ${amount.toFixed(2)}`
    }
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    created:        { label: "Awaiting Payment", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    partially_paid: { label: "Partially Paid",   className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    paid:           { label: "Paid ✓",            className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    expired:        { label: "Expired",           className: "bg-muted text-muted-foreground" },
    cancelled:      { label: "Cancelled",         className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

// ── Confirmation Dialog ───────────────────────────────────────────────────────

function ConfirmDialog({
    amount,
    currency,
    invoiceRef,
    clientName,
    onConfirm,
    onCancel,
    isLoading,
}: {
    amount: number
    currency: string
    invoiceRef: string
    clientName: string
    onConfirm: () => void
    onCancel: () => void
    isLoading: boolean
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" onClick={onCancel} />
            <div className="relative w-full sm:max-w-[400px] bg-card rounded-t-[28px] sm:rounded-[24px] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] overflow-hidden border border-border/60">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-border/60" />
                </div>

                <div className="px-6 pb-7 pt-4 sm:pt-6 space-y-5">
                    {/* Icon + Header */}
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                            <Link2 className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Create Payment Link</h3>
                            <p className="text-sm text-muted-foreground mt-1">Review details before creating</p>
                        </div>
                    </div>

                    {/* Amount card */}
                    <div className="rounded-2xl bg-muted/40 border border-border/60 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</p>
                                <p className="text-xl font-bold text-foreground mt-0.5">{formatAmount(amount, currency)}</p>
                            </div>
                            <div className="text-right">
                                {invoiceRef && (
                                    <>
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Invoice</p>
                                        <p className="text-sm font-semibold text-foreground mt-0.5">{invoiceRef}</p>
                                    </>
                                )}
                            </div>
                        </div>
                        {clientName && (
                            <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Client</span>
                                <span className="text-xs font-semibold text-foreground">{clientName}</span>
                            </div>
                        )}
                    </div>

                    {/* Info items */}
                    <div className="space-y-2.5">
                        {[
                            { icon: "🔒", text: "Amount will be locked after creation" },
                            { icon: "📝", text: "Invoice becomes read-only to prevent fraud" },
                            { icon: "⏱️", text: "Link expires based on your payment terms" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20">
                                <span className="text-sm shrink-0">{item.icon}</span>
                                <span className="text-[13px] text-foreground/70">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 rounded-2xl text-sm font-semibold border border-border bg-card hover:bg-muted/60 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-60 active:scale-[0.98]"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isLoading ? "Creating..." : "Create Link"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PaymentLinkButton({ sessionId, invoiceData, documentType, onPaymentLinkChange, onLockChange }: PaymentLinkButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [paymentLink, setPaymentLink] = useState<PaymentLinkState | null>(null)
    const [copied, setCopied] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)

    const isInvoice = documentType.toLowerCase() === "invoice"
    const hasFetchedRef = useRef(false)

    const fetchExisting = useCallback(async (showErrors = false) => {
        if (!sessionId || !isInvoice) return
        setIsFetching(true)
        try {
            const res = await authFetch(`/api/payments/create-link?sessionId=${sessionId}`)
            if (res.ok) {
                const data = await res.json()
                if (data.paymentLink) {
                    const link: PaymentLinkState = {
                        id: data.paymentLink.id,
                        shortUrl: data.paymentLink.short_url,
                        amount: data.paymentLink.amount ?? 0,
                        currency: data.paymentLink.currency ?? invoiceData.currency ?? "INR",
                        status: data.paymentLink.status,
                        razorpayId: data.paymentLink.razorpay_payment_link_id,
                        isExisting: true,
                    }
                    setPaymentLink(link)
                    const existingPlatformLink = `${window.location.origin}/pay/${sessionId}`
                    onPaymentLinkChange?.(existingPlatformLink, link.status)
                    // Lock invoice if active link exists
                    if (link.status === "created" || link.status === "partially_paid" || link.status === "paid") {
                        onLockChange?.(true)
                    }
                }
            } else if (showErrors) {
                toast.error("Failed to refresh payment status. Please try again.")
            }
        } catch {
            if (showErrors) {
                toast.error("Failed to refresh payment status. Please try again.")
            }
        } finally {
            setIsFetching(false)
        }
    }, [sessionId, onPaymentLinkChange, onLockChange, isInvoice, invoiceData.currency])

    useEffect(() => {
        if (hasFetchedRef.current) return
        hasFetchedRef.current = true
        fetchExisting()
    }, [fetchExisting])

    // Only show for invoices — AFTER all hooks
    if (!isInvoice) return null

    const total = getInvoiceTotal(invoiceData)
    const currency = invoiceData.currency || "INR"
    const amountInSmallestUnit = toSmallestUnit(total, currency)
    const invoiceRef = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
    const clientName = invoiceData.toName || ""

    const doCreate = async () => {
        if (!sessionId || isLoading) return
        if (amountInSmallestUnit <= 0) {
            toast.error("Invoice total must be greater than 0 to create a payment link")
            return
        }

        const referenceId = invoiceRef || `INV-${sessionId.slice(0, 8).toUpperCase()}`
        const description = ["Invoice", referenceId, clientName ? `for ${clientName}` : ""].filter(Boolean).join(" ")

        setIsLoading(true)
        try {
            const res = await authFetch("/api/payments/create-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    amount: amountInSmallestUnit,
                    currency,
                    description,
                    referenceId,
                    customerName: clientName || undefined,
                    customerEmail: invoiceData.toEmail || undefined,
                    customerPhone: invoiceData.toPhone || undefined,
                    dueDate: invoiceData.dueDate || undefined,
                    // Minimal snapshot — only fields needed for the /pay page
                    contextSnapshot: {
                        documentType: invoiceData.documentType,
                        invoiceNumber: invoiceData.invoiceNumber,
                        fromName: invoiceData.fromName,
                        toName: invoiceData.toName,
                        currency: invoiceData.currency,
                        items: invoiceData.items,
                        taxRate: invoiceData.taxRate,
                        taxLabel: invoiceData.taxLabel,
                        discountType: invoiceData.discountType,
                        discountValue: invoiceData.discountValue,
                        shippingFee: invoiceData.shippingFee,
                        dueDate: invoiceData.dueDate,
                        notes: invoiceData.notes,
                    },
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                console.error("Payment link creation failed:", res.status, data)
                if (data.code === "NO_PAYMENT_SETTINGS") {
                    toast.error("Connect a payment gateway first", {
                        description: "Go to Settings → Payments to add Razorpay, Stripe, or Cashfree.",
                        action: { label: "Open Settings", onClick: () => window.open("/settings?tab=payments", "_blank") },
                        duration: 6000,
                    })
                } else {
                    toast.error(data.error || "Failed to create payment link")
                }
                return
            }

            const link: PaymentLinkState = {
                ...data.paymentLink,
                amount: amountInSmallestUnit,
                currency,
            }
            setPaymentLink(link)
            onPaymentLinkChange?.(`${window.location.origin}/pay/${sessionId}`, data.paymentLink.status)
            onLockChange?.(true) // Lock invoice after link creation
            toast.success("Payment link created! Invoice is now locked.")
        } catch (err) {
            console.error("Payment link creation error:", err)
            toast.error("Failed to create payment link. Please try again.")
        } finally {
            setIsLoading(false)
            setShowConfirm(false)
        }
    }

    const platformLink = sessionId ? `${window.location.origin}/pay/${sessionId}` : ""

    const handleCopy = async () => {
        if (!platformLink) return
        await navigator.clipboard.writeText(platformLink)
        setCopied(true)
        toast.success("Payment link copied!")
        setTimeout(() => setCopied(false), 2000)
    }

    const handleWhatsApp = () => {
        if (!platformLink) return
        const msg = `Hi ${clientName || ""},\n\nPlease find the payment link for ${invoiceRef || "your invoice"} (${formatAmount(total, currency)}):\n${platformLink}\n\nThank you,\n${invoiceData.fromName || ""}`
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")
    }

    const handleCancel = async () => {
        if (!paymentLink?.razorpayId || !sessionId) return
        setShowCancelConfirm(true)
    }

    const handleCancelConfirmed = async () => {
        if (!paymentLink?.razorpayId || !sessionId) return
        setShowCancelConfirm(false)
        setIsLoading(true)
        try {
            const res = await authFetch("/api/payments/cancel-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, razorpayPaymentLinkId: paymentLink.razorpayId }),
            })
            if (res.ok) {
                setPaymentLink(prev => prev ? { ...prev, status: "cancelled" } : null)
                onLockChange?.(false)
                toast.success("Payment link cancelled. Invoice is now editable again.")
            } else {
                const d = await res.json()
                toast.error(d.error || "Failed to cancel payment link", {
                    description: "The payment link is still active. Please try again.",
                })
            }
        } catch {
            toast.error("Failed to cancel payment link", {
                description: "The payment link is still active. Please try again.",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const badge = paymentLink ? STATUS_BADGE[paymentLink.status] : null

    // ── Paid ──────────────────────────────────────────────────────────────────
    if (paymentLink?.status === "paid") {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Paid {paymentLink.amount > 0 ? formatAmount(paymentLink.amount / 100, paymentLink.currency) : ""}
                </span>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 ml-1">
                                <Lock className="w-3 h-3" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>Document is permanently locked after payment</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        )
    }

    // ── No link yet ───────────────────────────────────────────────────────────
    if (!paymentLink) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => {
                        if (total <= 0) { toast.error("Invoice total must be greater than 0"); return }
                        setShowConfirm(true)
                    }}
                    disabled={isLoading || isFetching}
                    className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl",
                        "text-[13px] font-medium bg-primary text-primary-foreground",
                        "hover:bg-primary/90 active:scale-[0.97] transition-all duration-150",
                        "disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation select-none"
                    )}
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.15)" }}
                >
                    {isFetching
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        : <Link2 className="w-3.5 h-3.5 shrink-0" />
                    }
                    <span>Get Payment Link</span>
                </button>

                {showConfirm && (
                    <ConfirmDialog
                        amount={total}
                        currency={currency}
                        invoiceRef={invoiceRef}
                        clientName={clientName}
                        onConfirm={doCreate}
                        onCancel={() => setShowConfirm(false)}
                        isLoading={isLoading}
                    />
                )}
            </>
        )
    }

    // ── Cancel Confirmation Modal ─────────────────────────────────────────────
    const CancelConfirmModal = showCancelConfirm ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" onClick={() => !isLoading && setShowCancelConfirm(false)} />
            <div className="relative w-full sm:max-w-[400px] bg-card rounded-t-[28px] sm:rounded-[24px] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] overflow-hidden border border-border/60">
                {/* Mobile handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                    <div className="w-10 h-1 rounded-full bg-border/60" />
                </div>

                <div className="px-6 pb-7 pt-4 sm:pt-6 space-y-5">
                    {/* Icon + Header */}
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-red-500 dark:text-red-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">Cancel Payment Link?</h3>
                            <p className="text-sm text-muted-foreground mt-1">This cannot be undone</p>
                        </div>
                    </div>

                    {/* Amount card */}
                    {paymentLink && (
                        <div className="rounded-2xl bg-muted/40 border border-border/60 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Amount</p>
                                    <p className="text-xl font-bold text-foreground mt-0.5">
                                        {formatAmount(paymentLink.amount / 100, paymentLink.currency)}
                                    </p>
                                </div>
                                {invoiceRef && (
                                    <div className="text-right">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Invoice</p>
                                        <p className="text-sm font-semibold text-foreground mt-0.5">{invoiceRef}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Consequences */}
                    <div className="space-y-2.5">
                        {[
                            { icon: "🔗", text: "Payment link will stop working immediately" },
                            { icon: "📧", text: "Links shared via email or WhatsApp will be deactivated" },
                            { icon: "✏️", text: "Invoice will become editable again" },
                            { icon: "🔄", text: "You can create a new link anytime" },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/30">
                                <span className="text-sm shrink-0">{item.icon}</span>
                                <span className="text-[13px] text-foreground/80">{item.text}</span>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => setShowCancelConfirm(false)}
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 rounded-2xl text-sm font-semibold border border-border bg-card hover:bg-muted/60 transition-all disabled:opacity-50 active:scale-[0.98]"
                        >
                            Keep Active
                        </button>
                        <button
                            type="button"
                            onClick={handleCancelConfirmed}
                            disabled={isLoading}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all disabled:opacity-60 active:scale-[0.98]"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            {isLoading ? "Cancelling..." : "Cancel Link"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ) : null

    // ── Link exists ───────────────────────────────────────────────────────────
    return (
        <>
        {CancelConfirmModal}
        <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge */}
            {badge && (
                <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 tracking-wide", badge.className)}>
                    {badge.label}
                </span>
            )}

            {(paymentLink.status === "created" || paymentLink.status === "partially_paid") && (
                <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card p-1 shadow-sm">
                    {/* Lock indicator */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted/50 text-muted-foreground">
                                    <Lock className="w-3 h-3" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>Invoice is locked while payment link is active</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Divider */}
                    <div className="w-px h-5 bg-border/60" />

                    {/* Copy */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" onClick={handleCopy}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted/80 transition-colors touch-manipulation text-foreground/60 hover:text-foreground">
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>{copied ? "Copied!" : "Copy payment link"}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* WhatsApp */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" onClick={handleWhatsApp}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[#25D366]/10 transition-colors touch-manipulation text-[#128C7E] dark:text-[#25D366]">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Share via WhatsApp</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Refresh */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" onClick={() => fetchExisting(true)} disabled={isFetching}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50 text-foreground/60 hover:text-foreground">
                                    <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Refresh payment status</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Divider */}
                    <div className="w-px h-5 bg-border/60" />

                    {/* Cancel */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" onClick={handleCancel} disabled={isLoading}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel payment link</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}

            {(paymentLink.status === "expired" || paymentLink.status === "cancelled") && (
                <button type="button" onClick={() => { setPaymentLink(null); onLockChange?.(false) }}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.97] shadow-sm">
                    <RefreshCw className="w-3 h-3" />
                    <span>New Link</span>
                </button>
            )}
        </div>
        </>
    )
}
