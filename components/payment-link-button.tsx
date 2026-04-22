"use client"

import { useState, useEffect, useCallback } from "react"
import { Link2, Copy, Check, Loader2, MessageCircle, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import type { InvoiceData } from "@/lib/invoice-types"

interface PaymentLinkButtonProps {
    sessionId: string | null
    invoiceData: InvoiceData
    /** Only show for invoices */
    documentType: string
    /** Called when payment link is created/updated — syncs into invoice data for PDF embedding */
    onPaymentLinkChange?: (shortUrl: string, status: PaymentLinkState["status"]) => void
}

interface PaymentLinkState {
    id?: string
    shortUrl: string
    status: "created" | "paid" | "partially_paid" | "expired" | "cancelled"
    razorpayId?: string
    isExisting?: boolean
}

// Currency to smallest unit multiplier
const CURRENCY_MULTIPLIERS: Record<string, number> = {
    INR: 100, USD: 100, EUR: 100, GBP: 100,
    SGD: 100, AED: 100, CAD: 100, AUD: 100,
    PHP: 100, MYR: 100,
    JPY: 1,   // zero decimal
}

function toSmallestUnit(amount: number, currency: string): number {
    const multiplier = CURRENCY_MULTIPLIERS[currency.toUpperCase()] ?? 100
    return Math.round(amount * multiplier)
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    created:         { label: "Awaiting Payment", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    partially_paid:  { label: "Partially Paid",   className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    paid:            { label: "Paid ✓",            className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    expired:         { label: "Expired",           className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    cancelled:       { label: "Cancelled",         className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

export function PaymentLinkButton({ sessionId, invoiceData, documentType, onPaymentLinkChange }: PaymentLinkButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [paymentLink, setPaymentLink] = useState<PaymentLinkState | null>(null)
    const [copied, setCopied] = useState(false)

    const isInvoice = documentType.toLowerCase() === "invoice"

    // Fetch existing payment link on mount — always call hooks, guard inside
    const fetchExisting = useCallback(async () => {
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
                        status: data.paymentLink.status,
                        razorpayId: data.paymentLink.razorpay_payment_link_id,
                        isExisting: true,
                    }
                    setPaymentLink(link)
                    onPaymentLinkChange?.(link.shortUrl, link.status)
                }
            }
        } catch { /* silent */ } finally {
            setIsFetching(false)
        }
    }, [sessionId, onPaymentLinkChange, isInvoice])

    useEffect(() => {
        fetchExisting()
    }, [fetchExisting])

    // Only show for invoices — AFTER all hooks
    if (!isInvoice) return null

    const handleCreate = async () => {
        if (!sessionId || isLoading) return

        const total = getInvoiceTotal(invoiceData)
        if (total <= 0) {
            toast.error("Invoice total must be greater than 0 to create a payment link")
            return
        }

        const currency = invoiceData.currency || "INR"
        const amountInSmallestUnit = toSmallestUnit(total, currency)

        if (amountInSmallestUnit <= 0) {
            toast.error("Invalid invoice amount")
            return
        }

        // Build reference ID from invoice number or session
        const referenceId = invoiceData.invoiceNumber
            || invoiceData.referenceNumber
            || `INV-${sessionId.slice(0, 8).toUpperCase()}`

        const customerName = invoiceData.toName || undefined
        const customerEmail = invoiceData.toEmail || undefined
        const customerPhone = invoiceData.toPhone || undefined

        const description = [
            invoiceData.documentType || "Invoice",
            referenceId,
            customerName ? `for ${customerName}` : "",
        ].filter(Boolean).join(" ")

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
                    customerName,
                    customerEmail,
                    customerPhone,
                    dueDate: invoiceData.dueDate || undefined,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                if (data.code === "NO_PAYMENT_SETTINGS") {
                    toast.error("Connect your Razorpay account first", {
                        description: "Go to Settings → Payments to add your API keys.",
                        action: {
                            label: "Open Settings",
                            onClick: () => window.open("/settings?tab=payments", "_blank"),
                        },
                        duration: 6000,
                    })
                } else {
                    toast.error(data.error || "Failed to create payment link")
                }
                return
            }

            setPaymentLink(data.paymentLink)
            onPaymentLinkChange?.(data.paymentLink.shortUrl, data.paymentLink.status)
            toast.success("Payment link created!")
        } catch {
            toast.error("Failed to create payment link. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }
    const handleCopy = async () => {
        if (!paymentLink?.shortUrl) return
        try {
            await navigator.clipboard.writeText(paymentLink.shortUrl)
            setCopied(true)
            toast.success("Payment link copied!")
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error("Failed to copy link")
        }
    }

    const handleWhatsApp = () => {
        if (!paymentLink?.shortUrl) return
        const invoiceNum = invoiceData.invoiceNumber || invoiceData.referenceNumber || "your invoice"
        const total = getInvoiceTotal(invoiceData)
        const currency = invoiceData.currency || "INR"
        const msg = `Hi, please find the payment link for ${invoiceNum} (${currency} ${total.toFixed(2)}): ${paymentLink.shortUrl}`
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
                toast.success("Payment link cancelled")
            } else {
                const d = await res.json()
                toast.error(d.error || "Failed to cancel")
            }
        } catch {
            toast.error("Failed to cancel payment link")
        } finally {
            setIsLoading(false)
        }
    }

    const total = getInvoiceTotal(invoiceData)
    const currency = invoiceData.currency || "INR"
    const badge = paymentLink ? STATUS_BADGE[paymentLink.status] : null

    // ── Paid state ──────────────────────────────────────────────────────
    if (paymentLink?.status === "paid") {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <Check className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-[13px] font-medium text-green-700 dark:text-green-400">Invoice Paid</span>
            </div>
        )
    }

    // ── No link yet ─────────────────────────────────────────────────────
    if (!paymentLink) {
        return (
            <button
                type="button"
                onClick={handleCreate}
                disabled={isLoading || isFetching || total <= 0}
                className={cn(
                    "inline-flex items-center gap-1.5",
                    "h-9 px-3.5 rounded-xl",
                    "text-[13px] font-medium",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 active:scale-[0.97]",
                    "transition-all duration-150",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "touch-manipulation select-none"
                )}
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.15)" }}
            >
                {isLoading || isFetching
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    : <Link2 className="w-3.5 h-3.5 shrink-0" />
                }
                <span>{isLoading ? "Creating..." : "Get Payment Link"}</span>
            </button>
        )
    }

    // ── Link exists ─────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-2">
            {/* Status + URL row */}
            <div className="flex items-center gap-2 flex-wrap">
                {badge && (
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", badge.className)}>
                        {badge.label}
                    </span>
                )}
                <span className="text-[12px] text-muted-foreground font-mono truncate max-w-[180px]">
                    {paymentLink.shortUrl}
                </span>
            </div>

            {/* Action buttons */}
            {(paymentLink.status === "created" || paymentLink.status === "partially_paid") && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Copy */}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg",
                            "text-[12px] font-medium",
                            "bg-card border border-border",
                            "hover:bg-secondary/60 active:scale-[0.97]",
                            "transition-all duration-150 touch-manipulation"
                        )}
                    >
                        {copied
                            ? <Check className="w-3 h-3 text-green-500 shrink-0" />
                            : <Copy className="w-3 h-3 shrink-0" />
                        }
                        <span>{copied ? "Copied!" : "Copy"}</span>
                    </button>

                    {/* WhatsApp */}
                    <button
                        type="button"
                        onClick={handleWhatsApp}
                        className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg",
                            "text-[12px] font-medium text-green-700 dark:text-green-400",
                            "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800",
                            "hover:bg-green-100 dark:hover:bg-green-900/30 active:scale-[0.97]",
                            "transition-all duration-150 touch-manipulation"
                        )}
                    >
                        <MessageCircle className="w-3 h-3 shrink-0" />
                        <span>WhatsApp</span>
                    </button>

                    {/* Refresh status */}
                    <button
                        type="button"
                        onClick={fetchExisting}
                        disabled={isFetching}
                        className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg",
                            "text-[12px] font-medium text-muted-foreground",
                            "bg-card border border-border",
                            "hover:bg-secondary/60 active:scale-[0.97]",
                            "transition-all duration-150 touch-manipulation",
                            "disabled:opacity-50"
                        )}
                    >
                        <RefreshCw className={cn("w-3 h-3 shrink-0", isFetching && "animate-spin")} />
                    </button>

                    {/* Cancel */}
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isLoading}
                        className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg",
                            "text-[12px] font-medium text-red-600 dark:text-red-400",
                            "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
                            "hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.97]",
                            "transition-all duration-150 touch-manipulation",
                            "disabled:opacity-50"
                        )}
                    >
                        <X className="w-3 h-3 shrink-0" />
                        <span>Cancel</span>
                    </button>
                </div>
            )}

            {/* Expired — offer to create new */}
            {(paymentLink.status === "expired" || paymentLink.status === "cancelled") && (
                <button
                    type="button"
                    onClick={() => { setPaymentLink(null); handleCreate() }}
                    disabled={isLoading}
                    className={cn(
                        "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg",
                        "text-[12px] font-medium",
                        "bg-card border border-border",
                        "hover:bg-secondary/60 active:scale-[0.97]",
                        "transition-all duration-150 touch-manipulation"
                    )}
                >
                    <RefreshCw className="w-3 h-3 shrink-0" />
                    <span>Create New Link</span>
                </button>
            )}
        </div>
    )
}
