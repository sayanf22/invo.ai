"use client"

import { useState, useEffect } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { useUser } from "@/components/auth-provider"

export interface PaymentMethodOption {
  value: string
  label: string
  group?: "gateway" | "bank" | "cash" | "digital" | "international"
  icon?: string
}

// ── Offline / manual methods — always available ───────────────────────────────
export const OFFLINE_METHODS: PaymentMethodOption[] = [
  // Cash
  { value: "Cash", label: "Cash", group: "cash" },
  // Bank
  { value: "Bank Transfer", label: "Bank Transfer", group: "bank" },
  { value: "NEFT", label: "NEFT", group: "bank" },
  { value: "RTGS", label: "RTGS", group: "bank" },
  { value: "IMPS", label: "IMPS", group: "bank" },
  { value: "SWIFT / Wire", label: "SWIFT / Wire Transfer", group: "international" },
  { value: "ACH", label: "ACH Transfer", group: "international" },
  { value: "SEPA", label: "SEPA Transfer", group: "international" },
  // Digital wallets
  { value: "UPI", label: "UPI", group: "digital" },
  { value: "PayPal", label: "PayPal", group: "digital" },
  { value: "Google Pay", label: "Google Pay", group: "digital" },
  { value: "Apple Pay", label: "Apple Pay", group: "digital" },
  { value: "PhonePe", label: "PhonePe", group: "digital" },
  { value: "Paytm", label: "Paytm", group: "digital" },
  // Paper
  { value: "Check", label: "Check / Cheque", group: "cash" },
  { value: "Demand Draft", label: "Demand Draft", group: "bank" },
  // Other
  { value: "Crypto", label: "Cryptocurrency", group: "digital" },
  { value: "Other", label: "Other", group: "cash" },
]

// ── Gateway-specific methods (only shown if connected) ────────────────────────
const GATEWAY_METHODS: Record<string, PaymentMethodOption> = {
  razorpay: { value: "Razorpay", label: "Razorpay (Online)", group: "gateway" },
  stripe:   { value: "Stripe",   label: "Stripe (Online)",   group: "gateway" },
  cashfree: { value: "Cashfree", label: "Cashfree (Online)", group: "gateway" },
}

/**
 * Returns payment method options based on user's connected gateways.
 * Connected gateways appear first, then offline methods.
 * If no gateway is connected, only offline methods are shown.
 */
export function usePaymentMethods() {
  const user = useUser()
  const [methods, setMethods] = useState<PaymentMethodOption[]>(OFFLINE_METHODS)
  const [connectedGateways, setConnectedGateways] = useState<string[]>([])
  const [hasAnyGateway, setHasAnyGateway] = useState(false)
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
        setHasAnyGateway(gateways.length > 0)

        // Connected gateways first, then offline methods
        const gatewayOptions = gateways.map(g => GATEWAY_METHODS[g]).filter(Boolean)
        setMethods([...gatewayOptions, ...OFFLINE_METHODS])
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false) }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  return { methods, connectedGateways, hasAnyGateway, loading }
}
