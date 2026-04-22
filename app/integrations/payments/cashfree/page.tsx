import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Cashfree Integration Guide | Clorefy",
  description:
    "Step-by-step guide to connect Cashfree with Clorefy. Set up API keys, configure webhooks, and start accepting payments with fast settlements.",
  keywords: [
    "Cashfree integration",
    "Cashfree API keys",
    "Cashfree webhook setup",
    "Clorefy Cashfree",
    "payment gateway India",
    "Cashfree payment links",
    "fast settlements",
  ],
}

export default function CashfreeGuidePage() {
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
          <div className="w-10 h-10 rounded-lg bg-[#00B050] flex items-center justify-center">
            <img
              src="https://cashfreelogo.cashfree.com/cashfreepayments/logoAssets/cf-primary-logo.png"
              alt="Cashfree"
              className="w-6 h-6 object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Cashfree Integration Guide
          </h1>
        </div>
        <p className="text-muted-foreground mb-10">
          Connect Cashfree to accept payments with fast settlements and
          payment link support for Indian businesses.
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
                href="https://merchant.cashfree.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                merchant.cashfree.com
              </a>
            </li>
            <li>
              Click the{" "}
              <strong className="text-foreground">
                &quot;Developers&quot;
              </strong>{" "}
              icon in the top-right navigation bar
            </li>
            <li>
              Click{" "}
              <strong className="text-foreground">
                &quot;API Keys&quot;
              </strong>{" "}
              under the Payment Gateway section
            </li>
            <li>
              Click{" "}
              <strong className="text-foreground">
                &quot;View API Key&quot;
              </strong>{" "}
              (you will need to enter your password)
            </li>
            <li>
              Copy the{" "}
              <strong className="text-foreground">App ID</strong> (Client ID)
              and <strong className="text-foreground">Secret Key</strong>
            </li>
            <li>
              Go to{" "}
              <strong className="text-foreground">
                Clorefy Settings → Payment Gateways → Select Cashfree
              </strong>{" "}
              → Paste keys → Connect
            </li>
          </ol>
        </section>

        {/* ── Step 2: Webhook Setup ────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Step 2 — Webhook Configuration
          </h2>
          <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-950/30 p-4 mb-4">
            <p className="text-sm text-green-800 dark:text-green-300">
              <strong>Automatic via payment links.</strong> Cashfree webhook URL
              is embedded in each payment link via the{" "}
              <code className="px-1 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-xs font-mono">
                notify_url
              </code>{" "}
              parameter. No separate configuration is required for basic usage.
            </p>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            For additional reliability, you can also set up a manual webhook
            endpoint:
          </p>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              In Cashfree Dashboard, go to{" "}
              <strong className="text-foreground">
                Developers → Webhooks
              </strong>
            </li>
            <li>
              Click{" "}
              <strong className="text-foreground">
                &quot;Add Webhook Endpoint&quot;
              </strong>
            </li>
            <li>
              Enter the URL shown in Clorefy settings:
              <code className="block mt-1.5 px-3 py-2 rounded-lg bg-muted text-xs font-mono break-all">
                https://clorefy.com/api/cashfree/webhook/&#123;your-user-id&#125;
              </code>
            </li>
            <li>
              Select the <strong className="text-foreground">webhook version</strong> from the dropdown
            </li>
            <li>
              Enable these events:
              <ul className="mt-2 ml-4 space-y-1">
                <li>
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                    PAYMENT_SUCCESS_WEBHOOK
                  </code>
                </li>
                <li>
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                    PAYMENT_FAILED_WEBHOOK
                  </code>
                </li>
              </ul>
            </li>
          </ol>
        </section>

        {/* ── Test / Sandbox Mode ──────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Test / Sandbox Mode
          </h2>
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Cashfree provides a separate sandbox environment for testing. In
              the Cashfree dashboard, toggle between{" "}
              <strong>Production</strong> and <strong>Sandbox</strong> mode using
              the switch in the top navigation bar. Make sure to use the
              matching API keys for each environment. In Clorefy, enable the{" "}
              <strong>&quot;Test Mode&quot;</strong> toggle when using sandbox
              credentials.
            </p>
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
              Your Client Secret is encrypted with AES-256 before storage — it
              is never logged or exposed in API responses.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Webhook payloads are verified using the Cashfree signature to
              prevent spoofing.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Use <strong>sandbox credentials</strong> during development, then
              switch to production keys when ready to go live.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Rotate your API keys periodically from the Cashfree dashboard for
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