import { cancelPaymentLink } from "@/lib/razorpay"
import { expireStripeCheckoutSession } from "@/lib/stripe-payments"
import { cancelCashfreePaymentLink } from "@/lib/cashfree-payment-links"
import type { UserPaymentCredentials } from "@/lib/payment-credentials"

export type InvoicePaymentGateway = "razorpay" | "stripe" | "cashfree"

export interface CreatedProviderLink {
    correlationId: string
    providerLinkId: string
    shortUrl: string
    expiresAt: string | null
    testMode: boolean
}

export async function cancelProviderLink(
    gateway: InvoicePaymentGateway,
    correlationId: string,
    providerLinkId: string,
    credentials: UserPaymentCredentials,
): Promise<void> {
    if (gateway === "razorpay") {
        const razorpay = credentials.razorpay
        if (!razorpay) throw new Error("Razorpay credentials are unavailable")
        await cancelPaymentLink(correlationId, razorpay.keyId, razorpay.keySecret)
        return
    }
    if (gateway === "stripe") {
        const stripe = credentials.stripe
        if (!stripe) throw new Error("Stripe credentials are unavailable")
        await expireStripeCheckoutSession(providerLinkId, stripe.secretKey)
        return
    }
    const cashfree = credentials.cashfree
    if (!cashfree) throw new Error("Cashfree credentials are unavailable")
    await cancelCashfreePaymentLink(providerLinkId, cashfree.clientId, cashfree.clientSecret, cashfree.testMode)
}
