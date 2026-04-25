import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/payments/test-webhook
 * 
 * Sends a test webhook ping to the user's configured webhook endpoint
 * for the specified gateway. This verifies the webhook is reachable and
 * the signature verification works.
 * 
 * Body: { gateway: "razorpay" | "stripe" | "cashfree" }
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  const userId = auth.user.id
  let body: { gateway: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { gateway } = body
  if (!gateway || !["razorpay", "stripe", "cashfree"].includes(gateway)) {
    return NextResponse.json({ error: "Invalid gateway" }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch user's payment settings
  const { data: settings } = await supabaseAdmin
    .from("user_payment_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (!settings) {
    return NextResponse.json({ error: "No payment settings found" }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
  let webhookUrl: string
  let testPayload: string
  let headers: Record<string, string> = { "Content-Type": "application/json" }

  try {
    if (gateway === "razorpay") {
      // Razorpay webhook uses platform-level endpoint
      webhookUrl = `${appUrl}/api/razorpay/webhook`

      // Build a test payload that mimics a Razorpay payment_link.paid event
      const testEvent = {
        entity: "event",
        event: "payment_link.paid",
        contains: ["payment_link", "payment"],
        payload: {
          payment_link: {
            entity: {
              id: "plink_test_" + Date.now(),
              amount: 100,
              amount_paid: 100,
              currency: "INR",
              status: "paid",
              reference_id: "TEST-WEBHOOK-PING",
              notes: { session_id: "test", user_id: userId, platform: "invo-ai" },
            },
          },
          payment: {
            entity: { id: "pay_test_" + Date.now() },
          },
        },
      }
      testPayload = JSON.stringify(testEvent)

      // Sign with the platform webhook secret
      const { getSecret } = await import("@/lib/secrets")
      const webhookSecret = await getSecret("RAZORPAY_WEBHOOK_SECRET")

      if (webhookSecret) {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
          "raw", encoder.encode(webhookSecret),
          { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        )
        const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(testPayload))
        const signature = Array.from(new Uint8Array(sigBuffer))
          .map(b => b.toString(16).padStart(2, "0")).join("")
        headers["x-razorpay-signature"] = signature
        headers["x-razorpay-event-id"] = `test_${Date.now()}`
      } else {
        return NextResponse.json({
          success: false,
          error: "No Razorpay webhook secret configured on the platform. Set RAZORPAY_WEBHOOK_SECRET in environment variables.",
        }, { status: 422 })
      }

    } else if (gateway === "stripe") {
      webhookUrl = `${appUrl}/api/stripe/webhook/${userId}`

      if (!settings.stripe_webhook_secret || !settings.stripe_enabled) {
        return NextResponse.json({
          success: false,
          error: "Stripe is not connected or webhook is not registered. Connect Stripe first in Settings → Payments.",
        }, { status: 422 })
      }

      // Build a test Stripe event
      const testEvent = {
        id: "evt_test_" + Date.now(),
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_" + Date.now(),
            amount_total: 100,
            currency: "usd",
            metadata: { reference_id: "TEST-WEBHOOK-PING", session_id: "test" },
            client_reference_id: "TEST-WEBHOOK-PING",
          },
        },
      }
      testPayload = JSON.stringify(testEvent)

      // Sign with the user's Stripe webhook secret
      const timestamp = Math.floor(Date.now() / 1000)
      const signedPayload = `${timestamp}.${testPayload}`
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(settings.stripe_webhook_secret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      )
      const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload))
      const sig = Array.from(new Uint8Array(sigBuffer))
        .map(b => b.toString(16).padStart(2, "0")).join("")
      headers["stripe-signature"] = `t=${timestamp},v1=${sig}`

    } else if (gateway === "cashfree") {
      webhookUrl = `${appUrl}/api/cashfree/webhook/${userId}`

      if (!settings.cashfree_client_secret_encrypted || !settings.cashfree_enabled) {
        return NextResponse.json({
          success: false,
          error: "Cashfree is not connected. Connect Cashfree first in Settings → Payments.",
        }, { status: 422 })
      }

      const testEvent = {
        type: "PAYMENT_LINK_EVENT",
        data: {
          link: {
            link_id: "TEST-WEBHOOK-PING",
            link_status: "PAID",
            link_amount_paid: 1.00,
            link_currency: "INR",
          },
        },
      }
      testPayload = JSON.stringify(testEvent)

      // Sign with the user's Cashfree client secret
      const { decrypt } = await import("@/lib/encrypt")
      const clientSecret = await decrypt(settings.cashfree_client_secret_encrypted)
      if (clientSecret) {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
          "raw", encoder.encode(clientSecret),
          { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        )
        const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(testPayload))
        const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
        headers["x-webhook-signature"] = sig
      }
    } else {
      return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 })
    }

    // Send the test webhook
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: testPayload,
    })

    const responseText = await res.text()
    let responseJson: any = null
    try { responseJson = JSON.parse(responseText) } catch {}

    if (res.ok) {
      return NextResponse.json({
        success: true,
        status: res.status,
        message: `Webhook endpoint responded with ${res.status}. ${gateway.charAt(0).toUpperCase() + gateway.slice(1)} webhook is working.`,
        response: responseJson,
      })
    } else {
      return NextResponse.json({
        success: false,
        status: res.status,
        message: `Webhook endpoint responded with ${res.status}. Check your configuration.`,
        response: responseJson || responseText.slice(0, 500),
      })
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: `Failed to reach webhook endpoint: ${err.message || "Unknown error"}`,
    }, { status: 500 })
  }
}
