import "server-only"
import { createClient } from "@supabase/supabase-js"
import { decrypt } from "@/lib/encrypt"

export interface UserPaymentCredentials {
    razorpay?: { keyId: string; keySecret: string; testMode: boolean }
    stripe?: { secretKey: string; testMode: boolean }
    cashfree?: { clientId: string; clientSecret: string; testMode: boolean }
}

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Supabase service role is required for payment credentials")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function getUserPaymentCredentials(userId: string): Promise<UserPaymentCredentials | null> {
    const { data, error } = await adminClient()
        .from("user_payment_settings")
        .select(`
            razorpay_key_id, razorpay_key_secret_encrypted, razorpay_enabled, razorpay_test_mode,
            stripe_secret_key_encrypted, stripe_enabled, stripe_test_mode,
            cashfree_client_id, cashfree_client_secret_encrypted, cashfree_enabled, cashfree_test_mode
        `)
        .eq("user_id", userId)
        .maybeSingle()

    if (error) throw error
    if (!data) return null

    const result: UserPaymentCredentials = {}
    if (data.razorpay_enabled && data.razorpay_key_id && data.razorpay_key_secret_encrypted) {
        const secret = await decrypt(data.razorpay_key_secret_encrypted)
        if (secret) result.razorpay = {
            keyId: data.razorpay_key_id,
            keySecret: secret,
            testMode: data.razorpay_test_mode ?? false,
        }
    }

    if (data.stripe_enabled && data.stripe_secret_key_encrypted) {
        const secret = await decrypt(data.stripe_secret_key_encrypted)
        if (secret) result.stripe = {
            secretKey: secret,
            testMode: data.stripe_test_mode ?? false,
        }
    }
    if (data.cashfree_enabled && data.cashfree_client_id && data.cashfree_client_secret_encrypted) {
        const secret = await decrypt(data.cashfree_client_secret_encrypted)
        if (secret) result.cashfree = {
            clientId: data.cashfree_client_id,
            clientSecret: secret,
            testMode: data.cashfree_test_mode ?? false,
        }
    }
    return Object.keys(result).length > 0 ? result : null
}

export async function getUserRazorpayCredentials(userId: string) {
    const credentials = await getUserPaymentCredentials(userId)
    return credentials?.razorpay ?? null
}