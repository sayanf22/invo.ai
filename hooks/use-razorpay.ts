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

            // Open Razorpay Checkout with subscription_id
            const options: any = {
                key: data.keyId,
                name: "Clorefy",
                description: `${data.planName} Plan — Monthly`,
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

                        if (!verifyRes.ok) throw new Error("Payment verification failed")

                        toast.success(`🎉 ${data.planName} plan activated!`)
                        await new Promise(r => setTimeout(r, 800))
                        onSuccess?.(plan, billingCycle)
                    } catch {
                        toast.error("Payment received but activation failed. Contact support.")
                        onError?.("Verification failed")
                    } finally {
                        setIsProcessing(false)
                    }
                },
                modal: {
                    ondismiss: () => setIsProcessing(false),
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
