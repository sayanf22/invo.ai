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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-border" />
                </div>

                <div className="px-5 pb-6 pt-3 space-y-4">
                    {/* Warning icon */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-base text-foreground">Confirm Payment Link</h3>
                            <p className="text-xs text-muted-foreground">This action cannot be undone</p>
                        </div>
                    </div>

                    {/* Amount summary */}
                    <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Amount</span>
                            <span className="text-lg font-bold text-foreground">{formatAmount(amount, currency)}</span>
                        </div>
                        {invoiceRef && (
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Invoice</span>
                                <span className="text-xs font-medium text-foreground">{invoiceRef}</span>
                            </div>
                        )}
                        {clientName && (
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Client</span>
                                <span className="text-xs font-medium text-foreground truncate max-w-[160px]">{clientName}</span>
                            </div>
                        )}
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Amount is locked after creation</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Once created, the payment amount cannot be changed. The invoice will also be locked to prevent fraud. Make sure the amount is correct before proceeding.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
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
                    toast.error("Connect your Razorpay account first", {
                        description: "Go to Settings → Payments to add your API keys.",
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
        if (!confirm("Cancel this payment link? The client will no longer be able to pay using it.")) return
        setIsLoading(true)
        try {
            const res = await authFetch("/api/payments/cancel-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, razorpayPaymentLinkId: paymentLink.razorpayId }),
            })
            if (res.ok) {
                setPaymentLink(prev => prev ? { ...prev, status: "cancelled" } : null)
                onLockChange?.(false) // Unlock invoice when link is cancelled
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

    // ── Link exists ───────────────────────────────────────────────────────────
    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status badge */}
            {badge && (
                <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-lg shrink-0", badge.className)}>
                    {badge.label}
                </span>
            )}

            {/* Lock indicator */}
            {(paymentLink.status === "created" || paymentLink.status === "partially_paid") && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground cursor-default">
                                <Lock className="w-3 h-3" />
                                <span className="hidden sm:inline">Locked</span>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            Invoice is locked while a payment link is active
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            {(paymentLink.status === "created" || paymentLink.status === "partially_paid") && (
                <>
                    <button type="button" onClick={handleCopy}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12px] font-medium bg-card border border-border hover:bg-secondary/60 transition-colors touch-manipulation">
                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
                    </button>

                    <button type="button" onClick={handleWhatsApp}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12px] font-medium text-[#128C7E] dark:text-[#25D366] bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 transition-colors touch-manipulation">
                        <MessageCircle className="w-3 h-3" />
                        <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    <button type="button" onClick={() => fetchExisting(true)} disabled={isFetching}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground bg-card border border-border hover:bg-secondary/60 transition-colors disabled:opacity-50">
                        <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                    </button>

                    <button type="button" onClick={handleCancel} disabled={isLoading}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors disabled:opacity-50">
                        <X className="w-3 h-3" />
                    </button>
                </>
            )}

            {(paymentLink.status === "expired" || paymentLink.status === "cancelled") && (
                <button type="button" onClick={() => { setPaymentLink(null); onLockChange?.(false) }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium bg-card border border-border hover:bg-secondary/60 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                    <span>New Link</span>
                </button>
            )}
        </div>
    )
}
