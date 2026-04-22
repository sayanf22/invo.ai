"use client"

import { useState, useEffect } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { useUser } from "@/components/auth-provider"

interface PaymentMethodOption {
  value: string
  label: string
}

// Base methods always available (no gateway needed)
const BASE_METHODS: PaymentMethodOption[] = [
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "UPI", label: "UPI" },
  { value: "Cash", label: "Cash" },
  { value: "Check", label: "Check" },
  { value: "Wire Transfer", label: "Wire Transfer" },
]

// Gateway-specific methods (only shown if connected)
const GATEWAY_METHODS: Record<string, PaymentMethodOption> = {
  razorpay: { value: "Razorpay", label: "Razorpay (Online)" },
  stripe: { value: "Stripe", label: "Stripe (Online)" },
  cashfree: { value: "Cashfree", label: "Cashfree (Online)" },
}

/**
 * Returns payment method options based on user's connected gateways.
 * Always includes base methods (Bank Transfer, UPI, Cash, etc.)
 * Only includes Razorpay/Stripe/Cashfree if the user has connected them.
 */
export function usePaymentMethods() {
  const user = useUser()
  const [methods, setMethods] = useState<PaymentMethodOption[]>(BASE_METHODS)
  const [connectedGateways, setConnectedGateways] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    let cancelled = false
    async function load() {
      try {
        const res = await authFetch("/api/payments/settings")
        if (!res.ok || cancelled) return
        const data = await res.json()
        const settings = data.settings
        if (!settings || cancelled) return

        const gateways: string[] = []
        if (settings.razorpay) gateways.push("razorpay")
        if (settings.stripe) gateways.push("stripe")
        if (settings.cashfree) gateways.push("cashfree")

        setConnectedGateways(gateways)

        // Build methods list: connected gateways first, then base methods
        const gatewayOptions = gateways.map(g => GATEWAY_METHODS[g]).filter(Boolean)
        setMethods([...gatewayOptions, ...BASE_METHODS])
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false) }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  return { methods, connectedGateways, loading }
}
