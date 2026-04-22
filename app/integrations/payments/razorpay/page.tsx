import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Razorpay Integration Guide | Clorefy",
  description:
    "Step-by-step guide to connect Razorpay with Clorefy. Set up API keys, configure webhooks, and start accepting payments via UPI, cards, and netbanking.",
  keywords: [
    "Razorpay integration",
    "Razorpay API keys",
    "Razorpay webhook setup",
    "Clorefy Razorpay",
    "payment gateway India",
    "UPI payments",
    "Razorpay payment links",
  ],
}

export default function RazorpayGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <Link
          href="/integrations/payments"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          ← Back to Payment Integrations
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#072654] flex items-center justify-center">
            <img
              src="https://razorpay.com/assets/razorpay-glyph.svg"
              alt="Razorpay"
              className="w-6 h-6 object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Razorpay Integration Guide
          </h1>
        </div>
        <p className="text-muted-foreground mb-10">
          Connect Razorpay to accept UPI, cards, netbanking, and wallets from
          Indian customers.
        </p>

        {/* ── Step 1: API Keys ──────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Step 1 — Get your API Keys
          </h2>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              Log in to{" "}
              <a
                href="https://dashboard.razorpay.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                dashboard.razorpay.com
              </a>
            </li>
            <li>
              Click the <strong className="text-foreground">gear icon</strong>{" "}
              (Settings) in the top-right corner
            </li>
            <li>
              Click{" "}
              <strong className="text-foreground">&quot;API Keys&quot;</strong>{" "}
              in the left sidebar
            </li>
            <li>
              Click{" "}
              <strong className="text-foreground">
                &quot;Generate Key&quot;
              </strong>{" "}
              (or &quot;Regenerate Key&quot; if you already have one)
            </li>
            <li>
              Copy the{" "}
              <strong className="text-foreground">Key ID</strong> (starts with{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                rzp_live_
              </code>{" "}
              or{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                rzp_test_
              </code>
              ) and <strong className="text-foreground">Key Secret</strong>
            </li>
            <li>
              Go to{" "}
              <strong className="text-foreground">
                Clorefy Settings → Payment Gateways → Select Razorpay
              </strong>{" "}
              → Paste keys → Connect
            </li>
          </ol>
        </section>

        {/* ── Step 2: Get your Webhook URL and Secret from Clorefy ── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Step 2 — Get your Webhook URL and Secret from Clorefy
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            After connecting your Razorpay keys in Step 1, Clorefy generates a unique <strong className="text-foreground">Webhook URL</strong> and <strong className="text-foreground">Webhook Secret</strong> for your account. You need to copy these and paste them into Razorpay.
          </p>
          <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30 p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Where to find them:</p>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-300 list-decimal list-inside">
              <li>Go to <strong>Clorefy → Settings → Payment Gateways</strong></li>
              <li>Your connected Razorpay gateway will show a <strong>&quot;View Setup Guide&quot;</strong> button — click it</li>
              <li>Or look for the <strong>Webhook URL</strong> and <strong>Webhook Secret</strong> displayed after you connect your keys</li>
              <li>The URL looks like: <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-xs font-mono">https://clorefy.com/api/razorpay/webhook/abc123-def456-...</code></li>
              <li>The Secret is a long random string like: <code className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-xs font-mono">7f3e6a9b2c...</code></li>
            </ol>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-3 italic">
              The URL contains your unique account identifier — you don&apos;t need to know what it is, just copy the full URL as shown.
            </p>
          </div>
        </section>

        {/* ── Step 3: Add Webhook in Razorpay Dashboard ────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Step 3 — Add Webhook in Razorpay Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Now paste the URL and Secret from Clorefy into Razorpay. This ensures your invoices update to &quot;Paid&quot; automatically when your client pays.
          </p>
          <ol className="space-y-4 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              In Razorpay Dashboard, click the <strong className="text-foreground">gear icon ⚙️</strong> (Settings) in the <strong className="text-foreground">top-right corner</strong>
            </li>
            <li>
              In the left sidebar, click <strong className="text-foreground">&quot;Webhooks&quot;</strong>
            </li>
            <li>
              Click the <strong className="text-foreground">&quot;+ Add New Webhook&quot;</strong> button
            </li>
            <li>
              A form will appear with these fields. Fill them in:
              <div className="mt-3 rounded-lg border border-border bg-card p-4 space-y-4 not-prose">
                {/* Field 1: Webhook URL */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">📋 Webhook URL</p>
                  <p className="text-xs text-muted-foreground mb-1.5">Paste the full URL you copied from Clorefy settings.</p>
                  <div className="px-3 py-2 rounded-lg bg-muted border border-border">
                    <code className="text-xs font-mono text-foreground break-all">https://clorefy.com/api/razorpay/webhook/your-unique-id</code>
                  </div>
                </div>

                {/* Field 2: Secret */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">🔑 Secret</p>
                  <p className="text-xs text-muted-foreground mb-1.5">Paste the webhook secret you copied from Clorefy settings. This is used to verify that webhook calls are genuinely from Razorpay and not spoofed.</p>
                  <div className="px-3 py-2 rounded-lg bg-muted border border-border">
                    <code className="text-xs font-mono text-foreground">7f3e6a9b2c4d8e1f...</code>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 italic">This is NOT your Razorpay API key secret. It&apos;s a separate secret generated by Clorefy specifically for webhook verification.</p>
                </div>

                {/* Field 3: Alert Email */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">📧 Alert Email <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <p className="text-xs text-muted-foreground">Enter your email if you want Razorpay to notify you when webhook delivery fails. You can leave this blank.</p>
                </div>

                {/* Field 4: Active Events */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1">✅ Active Events</p>
                  <p className="text-xs text-muted-foreground mb-2">Scroll down to the events list and check <strong>exactly these 4 boxes</strong>:</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                      <span className="text-green-600">☑</span>
                      <code className="text-xs font-mono font-semibold text-green-800 dark:text-green-300">payment_link.paid</code>
                      <span className="text-[11px] text-muted-foreground ml-auto">When full payment is received</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                      <span className="text-green-600">☑</span>
                      <code className="text-xs font-mono font-semibold text-green-800 dark:text-green-300">payment_link.partially_paid</code>
                      <span className="text-[11px] text-muted-foreground ml-auto">When partial payment is received</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                      <span className="text-green-600">☑</span>
                      <code className="text-xs font-mono font-semibold text-green-800 dark:text-green-300">payment_link.expired</code>
                      <span className="text-[11px] text-muted-foreground ml-auto">When link expires</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                      <span className="text-green-600">☑</span>
                      <code className="text-xs font-mono font-semibold text-green-800 dark:text-green-300">payment_link.cancelled</code>
                      <span className="text-[11px] text-muted-foreground ml-auto">When link is cancelled</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">You can find these under the &quot;Payment Link&quot; section in the events list. Don&apos;t select other events — only these 4 are needed.</p>
                </div>
              </div>
            </li>
            <li>
              Click <strong className="text-foreground">&quot;Create Webhook&quot;</strong> to save
            </li>
            <li>
              <strong className="text-foreground">Done!</strong> Your Razorpay webhook is now configured. When your client pays an invoice, Clorefy will automatically update the invoice status to &quot;Paid&quot; and send you a notification.
            </li>
          </ol>
        </section>

        {/* ── Troubleshooting ──────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Troubleshooting
          </h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground mb-1">Invoice not updating to &quot;Paid&quot;?</p>
              <p className="text-xs text-muted-foreground">Check that the webhook URL and secret are correctly pasted in Razorpay. Go to Razorpay Dashboard → Settings → Webhooks and verify the webhook is &quot;Active&quot; (green status).</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground mb-1">Webhook showing &quot;Failed&quot; in Razorpay?</p>
              <p className="text-xs text-muted-foreground">Make sure the webhook secret in Razorpay matches exactly what Clorefy shows. Even one extra space will cause verification to fail. Copy-paste it again carefully.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground mb-1">Using test mode?</p>
              <p className="text-xs text-muted-foreground">Test mode keys (rzp_test_) work with Razorpay&apos;s test environment. Webhooks will fire for test payments too, so you can verify the full flow before going live.</p>
            </div>
          </div>
        </section>

        {/* ── Security Notes ───────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Security Notes
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Your Key Secret is encrypted with AES-256 before storage — it is
              never logged or exposed in API responses.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Webhook signatures are verified on every incoming request to
              prevent spoofing.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Use <strong>test mode keys</strong> (
              <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">
                rzp_test_
              </code>
              ) during development, then switch to live keys for production.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Rotate your API keys periodically from the Razorpay dashboard for
              added security.
            </li>
          </ul>
        </section>

        <div className="border-t border-border pt-6">
          <Link
            href="/integrations/payments"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            ← Back to Payment Integrations
          </Link>
        </div>
      </div>
    </div>
  )
}