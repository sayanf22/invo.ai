"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"

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
            // Load Razorpay script
            const loaded = await loadRazorpayScript()
            if (!loaded) {
                throw new Error("Failed to load payment gateway")
            }

            // Get auth token for API call
            const tokenKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.includes("-auth-token"))
            const tokenRaw = tokenKey ? localStorage.getItem(tokenKey) : null
            let accessToken = ""
            if (tokenRaw) {
                try {
                    const parsed = JSON.parse(tokenRaw)
                    accessToken = parsed.access_token || ""
                } catch {
                    // Try URL-decoded
                    try {
                        const decoded = decodeURIComponent(tokenRaw)
                        const parsed = JSON.parse(decoded)
                        accessToken = parsed.access_token || ""
                    } catch {}
                }
            }

            // Create order server-side
            const orderRes = await fetch("/api/razorpay/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({ plan, billingCycle, countryCode }),
            })

            if (!orderRes.ok) {
                const err = await orderRes.json()
                throw new Error(err.error || "Failed to create order")
            }

            const order = await orderRes.json()

            // Open Razorpay Checkout
            const options = {
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: "Clorefy",
                description: `${order.planName} Plan — ${billingCycle === "yearly" ? "Yearly" : "Monthly"}`,
                order_id: order.orderId,
                prefill: {
                    email: user.email || "",
                    name: user.user_metadata?.full_name || "",
                },
                theme: {
                    color: "#1a1a1a",
                },
                handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
                    // Verify payment server-side
                    try {
                        const verifyRes = await fetch("/api/razorpay/verify", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                            },
                            body: JSON.stringify({
                                ...response,
                                plan,
                                billingCycle,
                            }),
                        })

                        if (!verifyRes.ok) {
                            throw new Error("Payment verification failed")
                        }

                        const result = await verifyRes.json()
                        toast.success(`🎉 ${order.planName} plan activated!`)
                        // Small delay to ensure DB write is committed before UI refresh
                        await new Promise(r => setTimeout(r, 800))
                        onSuccess?.(plan, billingCycle)
                    } catch (err) {
                        toast.error("Payment was received but activation failed. Contact support.")
                        onError?.("Verification failed")
                    } finally {
                        setIsProcessing(false)
                    }
                },
                modal: {
                    ondismiss: () => {
                        setIsProcessing(false)
                    },
                },
            }

            const rzp = new window.Razorpay(options)
            rzp.on("payment.failed", (response: any) => {
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
