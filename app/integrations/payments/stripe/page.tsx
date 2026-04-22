import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Stripe Integration Guide | Clorefy",
  description:
    "Step-by-step guide to connect Stripe with Clorefy. Set up your API key, understand auto-registered webhooks, and start accepting global payments.",
  keywords: [
    "Stripe integration",
    "Stripe API keys",
    "Stripe webhook",
    "Clorefy Stripe",
    "payment gateway international",
    "Stripe India",
    "global payments",
  ],
}

export default function StripeGuidePage() {
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
          <div className="w-10 h-10 rounded-lg bg-[#635BFF] flex items-center justify-center">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg"
              alt="Stripe"
              className="w-6 h-6 object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Stripe Integration Guide
          </h1>
        </div>
        <p className="text-muted-foreground mb-10">
          Connect Stripe to accept cards, wallets, and bank transfers across
          135+ currencies worldwide.
        </p>

        {/* ── Step 1: API Key ──────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Step 1 — Get your Secret Key
          </h2>
          <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
            <li>
              Log in to{" "}
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                dashboard.stripe.com
              </a>
            </li>
            <li>
              In the left sidebar (bottom-left), click{" "}
              <strong className="text-foreground">
                &quot;Developers&quot;
              </strong>
            </li>
            <li>
              Click the{" "}
              <strong className="text-foreground">
                &quot;API Keys&quot;
              </strong>{" "}
              tab
            </li>
            <li>
              Under &quot;Standard keys&quot;, click{" "}
              <strong className="text-foreground">
                &quot;Reveal test key&quot;
              </strong>{" "}
              or{" "}
              <strong className="text-foreground">
                &quot;Reveal live key&quot;
              </strong>{" "}
              next to Secret key
            </li>
            <li>
              Copy the{" "}
              <strong className="text-foreground">Secret key</strong> (starts
              with{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                sk_live_
              </code>{" "}
              or{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                sk_test_
              </code>
              )
            </li>
            <li>
              Go to{" "}
              <strong className="text-foreground">
                Clorefy Settings → Payment Gateways → Select Stripe
              </strong>{" "}
              → Paste key → Connect
            </li>
          </ol>
        </section>

        {/* ── Step 2: Webhooks (Auto) ──────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Step 2 — Webhooks (Auto-Registered)
          </h2>
          <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/30 p-4 mb-4">
            <p className="text-sm text-indigo-800 dark:text-indigo-300">
              <strong>No manual setup needed.</strong> Clorefy automatically
              registers a webhook endpoint via the Stripe API when you connect
              your account.
            </p>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            The following events are listened to automatically:
          </p>
          <ul className="space-y-1.5 ml-4">
            <li>
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                checkout.session.completed
              </code>
            </li>
            <li>
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                payment_intent.succeeded
              </code>
            </li>
            <li>
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                payment_intent.payment_failed
              </code>
            </li>
          </ul>
        </section>

        {/* ── India Note ───────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Important: Stripe in India
          </h2>
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Since May 2024, Stripe operates on an{" "}
              <strong>invite-only basis in India</strong>. New Indian businesses
              cannot sign up directly. Stripe is best suited for{" "}
              <strong>international businesses</strong> or Indian companies that
              already have an active Stripe account. If you primarily serve
              Indian customers, consider using Razorpay or Cashfree instead.
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
              Your Secret Key is encrypted with AES-256 before storage — it is
              never logged or exposed in API responses.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Webhook signatures are verified using the Stripe signing secret on
              every incoming request.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              Use <strong>test mode keys</strong> (
              <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">
                sk_test_
              </code>
              ) during development, then switch to live keys for production.
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