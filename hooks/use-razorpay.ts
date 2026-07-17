"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/auth-fetch"

declare global {
    interface Window {
        Razorpay: any
    }
}

interface UseRazorpayOptions {
    onSuccess?: (plan: string, billingCycle: string) => void
    onError?: (error: string) => void
}

function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if (window.Razorpay) {
            resolve(true)
            return
        }
        const script = document.createElement("script")
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

/**
 * Ask the server to reconcile a paid-but-not-yet-synced subscription charge,
 * polling a few times while the provider finalizes the first invoice. Returns
 * true only when the server confirms activation from a captured charge. The
 * server remains the sole authority; this never grants access on its own.
 */
async function reconcileUntilActive(attempts = 4, delayMs = 1500): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const res = await authFetch("/api/razorpay/reconcile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            })
            const result = await res.json().catch(() => ({}))
            if (res.ok && result.activated === true) return true
        } catch { /* transient — retry */ }
        if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    return false
}

export function useRazorpay({ onSuccess, onError }: UseRazorpayOptions = {}) {
    const [isProcessing, setIsProcessing] = useState(false)
    const { user } = useAuth()

    const subscribe = useCallback(async (plan: string, billingCycle: "monthly" | "yearly", countryCode?: string) => {
        if (!user) {
            toast.error("Please log in to subscribe")
            return
        }

        setIsProcessing(true)

        try {
            const loaded = await loadRazorpayScript()
            if (!loaded) throw new Error("Failed to load payment gateway")

            // Create subscription server-side
            const orderRes = await authFetch("/api/razorpay/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, billingCycle, countryCode }),
            })

            if (!orderRes.ok) {
                const err = await orderRes.json()
                throw new Error(err.error || "Failed to create subscription")
            }

            const data = await orderRes.json()
            const abandonPendingCheckout = () => authFetch("/api/razorpay/cancel-change", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            }).catch(() => null)

            // If create-order updated an EXISTING Razorpay subscription in place
            // (a paid→paid upgrade — see app/api/razorpay/create-order/route.ts),
            // there's nothing to check out: the plan change already took effect
            // server-side. Skip opening Razorpay Checkout entirely and complete
            // immediately, rather than re-collecting payment details the user
            // already has authorized.
            if (data.upgraded) {
                const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
                if (data.pending) {
                    toast.info(data.message || "Razorpay confirmed the change. Local billing status is still syncing.")
                    await authFetch("/api/razorpay/reconcile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: "{}",
                    }).catch(() => null)
                } else if (data.deferredToNextCycle) {
                    const effectiveDate = data.periodEnd
                        ? new Date(data.periodEnd).toLocaleDateString()
                        : "your next billing cycle"
                    toast.success(`${planLabel} is scheduled for ${effectiveDate}. No charge is made until the new cycle starts.`)
                } else if (typeof data.chargedAmount === "number") {
                    const charged = new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: data.chargedCurrency || data.currency || "INR",
                    }).format(data.chargedAmount / 100)
                    toast.success(`🎉 ${planLabel} activated. Razorpay charged ${charged} for the prorated upgrade.`)
                } else {
                    toast.success(`🎉 ${planLabel} activated. Razorpay is finalizing the prorated charge record.`)
                }
                setIsProcessing(false)
                onSuccess?.(data.plan ?? plan, data.billingCycle ?? billingCycle)
                return
            }

            if (data.scheduledChange) {
                const effectiveDate = data.effectiveDate
                    ? new Date(data.effectiveDate).toLocaleDateString()
                    : "the next billing cycle"
                toast.info(`Authorize the new mandate now. The new price starts on ${effectiveDate}; you will not be charged the full new plan price today.`)
            }

            // Open Razorpay Checkout with subscription_id
            const options: any = {
                key: data.keyId,
                name: "Clorefy",
                description: `${data.planName} Plan — ${data.billingCycle === "yearly" ? "Yearly" : "Monthly"}${data.scheduledChange ? " (starts next cycle)" : ""}`,
                subscription_id: data.subscriptionId,
                prefill: {
                    email: user.email || "",
                    name: user.user_metadata?.full_name || "",
                },
                theme: { color: "#1a1a1a" },
                handler: async (response: any) => {
                    try {
                        const verifyRes = await authFetch("/api/razorpay/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_subscription_id: response.razorpay_subscription_id,
                                razorpay_signature: response.razorpay_signature,
                                plan,
                                billingCycle,
                            }),
                        })

                        const verifyData = await verifyRes.json().catch(() => ({}))
                        if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed")

                        if (verifyData.pending) {
                            // The payment succeeded but the captured charge had not
                            // synced yet at verify time. Actively drive the same
                            // server-side reconciliation the Billing page runs on
                            // load, polling briefly so activation completes without
                            // a manual refresh. The server re-verifies the captured
                            // charge on every attempt — the client never grants
                            // access, it only asks the server to check again.
                            const activated = await reconcileUntilActive()
                            if (activated) {
                                toast.success(`🎉 ${data.planName} plan activated!`)
                            } else {
                                toast.info(verifyData.message || "Payment received. Your plan will activate automatically in a moment.")
                            }
                            onSuccess?.(verifyData.plan ?? plan, verifyData.billingCycle ?? billingCycle)
                            return
                        }
                        if (verifyData.scheduled) {
                            const effectiveDate = verifyData.effectiveDate
                                ? new Date(verifyData.effectiveDate).toLocaleDateString()
                                : "your next billing cycle"
                            toast.success(`Change scheduled for ${effectiveDate}. Your current plan remains active until then.`)
                            onSuccess?.(verifyData.targetPlan ?? plan, verifyData.targetBillingCycle ?? billingCycle)
                            return
                        }

                        toast.success(`🎉 ${data.planName} plan activated!`)
                        await new Promise(r => setTimeout(r, 800))
                        onSuccess?.(verifyData.plan ?? plan, verifyData.billingCycle ?? billingCycle)
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Verification failed"
                        toast.error(message)
                        onError?.(message)
                    } finally {
                        setIsProcessing(false)
                    }
                },
                modal: {
                    ondismiss: () => {
                        abandonPendingCheckout()
                        setIsProcessing(false)
                    },
                },
            }

            const rzp = new window.Razorpay(options)
            rzp.on("payment.failed", (response: any) => {
                abandonPendingCheckout()
                toast.error(response.error?.description || "Payment failed")
                onError?.(response.error?.description || "Payment failed")
                setIsProcessing(false)
            })
            rzp.open()
        } catch (err: any) {
            toast.error(err.message || "Something went wrong")
            onError?.(err.message)
            setIsProcessing(false)
        }
    }, [user, onSuccess, onError])

    return { subscribe, isProcessing }
}
