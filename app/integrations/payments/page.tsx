import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Payment Gateway Integration — Clorefy / Invo.ai",
  description:
    "Connect Razorpay, Stripe, or Cashfree to Clorefy and collect payments directly from your invoices. Step-by-step setup guide, webhook configuration, and FAQ.",
  keywords: [
    "payment gateway integration",
    "Razorpay invoice",
    "Stripe invoice",
    "Cashfree invoice",
    "collect payments invoices",
    "Clorefy payments",
    "Invo.ai payment setup",
    "invoice payment link",
    "webhook payment status",
  ],
  openGraph: {
    title: "Payment Gateway Integration — Clorefy",
    description:
      "Connect Razorpay, Stripe, or Cashfree to collect payments from your AI-generated invoices.",
    type: "website",
  },
}

// ── Gateway Logo ─────────────────────────────────────────────────────────────

function GatewayLogo({ url, alt, bg, size = 40 }: { url: string; alt: string; bg: string; size?: number }) {
  return (
    <div
      className={`rounded-lg flex items-center justify-center shrink-0 ${bg}`}
      style={{ width: size, height: size }}
    >
      <img src={url} alt={alt} className="w-[60%] h-[60%] object-contain" />
    </div>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

const gateways = [
  {
    id: "razorpay",
    name: "Razorpay",
    logoUrl: "https://razorpay.com/assets/razorpay-glyph.svg",
    logoBg: "bg-[#072654]",
    tagline: "Best for India",
    description:
      "Accept UPI, credit/debit cards, netbanking, wallets, and EMI. Razorpay is the most popular payment gateway for Indian businesses.",
    bestFor: "India-based businesses",
    currencies: "INR",
    webhookSetup: "Manual — copy URL + secret from settings",
    steps: [
      "Go to Settings → Payment Gateways in your Clorefy dashboard",
      "Select Razorpay from the dropdown",
      "Log in to Razorpay Dashboard → Settings → API Keys",
      "Generate a key pair and paste the Key ID and Key Secret",
      "After saving, copy the Webhook URL and Secret shown in Clorefy",
      "In Razorpay Dashboard → Settings → Webhooks, add a new webhook",
      "Paste the URL and secret, then select payment.captured and payment.failed events",
    ],
    color: "border-blue-200 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20",
    accentColor: "text-blue-900 dark:text-blue-300",
  },
  {
    id: "stripe",
    name: "Stripe",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg",
    logoBg: "bg-[#635BFF]",
    tagline: "Global payments",
    description:
      "Accept cards, Apple Pay, Google Pay, and 135+ currencies worldwide. Stripe's webhook is registered automatically — no manual setup.",
    bestFor: "International / global businesses",
    currencies: "135+ currencies",
    webhookSetup: "Automatic — no manual setup needed",
    steps: [
      "Go to Settings → Payment Gateways in your Clorefy dashboard",
      "Select Stripe from the dropdown",
      "Log in to Stripe Dashboard → Developers → API Keys",
      "Copy your Secret Key (starts with sk_live_ or sk_test_)",
      "Paste it in Clorefy and click Connect",
      "Webhook is registered automatically via Stripe API",
    ],
    color: "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800/40 dark:bg-indigo-950/20",
    accentColor: "text-indigo-900 dark:text-indigo-300",
  },
  {
    id: "cashfree",
    name: "Cashfree",
    logoUrl: "https://cashfreelogo.cashfree.com/cashfreepayments/logoAssets/cf-primary-logo.png",
    logoBg: "bg-[#00B050]",
    tagline: "Fast settlements",
    description:
      "India-focused gateway with fast T+1 settlements and payment links. Webhook URL is embedded automatically in every payment link.",
    bestFor: "India — fast settlement priority",
    currencies: "INR",
    webhookSetup: "Embedded in payment link — no manual setup",
    steps: [
      "Go to Settings → Payment Gateways in your Clorefy dashboard",
      "Select Cashfree from the dropdown",
      "Log in to Cashfree Merchant Dashboard → Developers → API Keys",
      "Copy your App ID (Client ID) and Secret Key",
      "Choose Production or Sandbox mode",
      "Paste credentials in Clorefy and click Connect",
      "Webhook URL is embedded in each payment link automatically",
    ],
    color: "border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-950/20",
    accentColor: "text-green-900 dark:text-green-300",
  },
]

const faqs = [
  {
    q: "Is a webhook required?",
    a: "Yes — webhooks are required for reliable payment status updates. The callback_url only works if the client completes the redirect after payment. If they close the browser tab, the invoice status won't update. Webhooks fire server-to-server regardless of what the client does. Razorpay's own documentation states: \"Implement webhooks to avoid callback failure.\"",
  },
  {
    q: "What happens if the client closes the browser after paying?",
    a: "Without a webhook, the invoice would remain in 'pending' status even though payment was received. With a webhook configured, Razorpay/Stripe/Cashfree sends a server-to-server notification to Clorefy, which updates the invoice status to 'paid' automatically.",
  },
  {
    q: "Where does the money go?",
    a: "Payments go directly into your payment gateway account (Razorpay, Stripe, or Cashfree). Clorefy never touches your money — we only facilitate the payment link and track the status. You withdraw funds from your gateway dashboard on your own schedule.",
  },
  {
    q: "Can I connect multiple gateways?",
    a: "Yes. You can connect Razorpay, Stripe, and Cashfree simultaneously. When generating a payment link for an invoice, you choose which gateway to use for that specific invoice.",
  },
  {
    q: "Is my API key stored securely?",
    a: "Yes. All credentials are encrypted with AES-256 before storage. Keys are never logged, and secrets are masked in API responses. Only the encrypted ciphertext is stored in the database.",
  },
  {
    q: "Can I use test/sandbox mode?",
    a: "Yes. Razorpay test keys start with rzp_test_, Stripe test keys start with sk_test_, and Cashfree has a dedicated sandbox environment. Test mode is detected automatically from the key prefix.",
  },
  {
    q: "What events does the webhook listen for?",
    a: "For Razorpay: payment_link.paid, payment_link.partially_paid, payment_link.expired, and payment_link.cancelled. For Stripe: checkout.session.completed, payment_intent.succeeded, and payment_intent.payment_failed. For Cashfree: the webhook URL is embedded in the payment link via the notify_url parameter.",
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentIntegrationsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-muted/40 to-background">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6">
            Payment Integrations
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Collect payments directly from your invoices
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Connect Razorpay, Stripe, or Cashfree to Clorefy and add a &quot;Pay Now&quot; button to every invoice you generate. Payments go straight to your account.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              Get started free
            </Link>
            <Link
              href="/settings"
              className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Go to settings
            </Link>
          </div>
        </div>
      </section>

      {/* Visual payment flow */}
      <section className="max-w-4xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-bold mb-2">How payment collection works</h2>
        <p className="text-muted-foreground mb-10">
          Clorefy generates your invoice with AI, then adds a payment link powered by your chosen gateway.
        </p>

        {/* 3-step visual flow */}
        <div className="flex items-center justify-center gap-0 sm:gap-2 mb-10">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 flex items-center justify-center mb-2">
              <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-foreground">Invoice Generated</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">AI creates your document</p>
          </div>

          {/* Arrow 1 */}
          <div className="flex-1 max-w-[80px] flex items-center justify-center -mt-6">
            <div className="w-full h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 dark:from-blue-700 dark:to-purple-700 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-purple-300 dark:border-l-purple-700" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-300 dark:border-purple-700 flex items-center justify-center mb-2">
              <svg className="w-7 h-7 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L5.25 9.879" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-foreground">Payment Link Shared</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Client receives pay link</p>
          </div>

          {/* Arrow 2 */}
          <div className="flex-1 max-w-[80px] flex items-center justify-center -mt-6">
            <div className="w-full h-0.5 bg-gradient-to-r from-purple-300 to-green-300 dark:from-purple-700 dark:to-green-700 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-green-300 dark:border-l-green-700" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 flex items-center justify-center mb-2">
              <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-foreground">Payment Received</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Status updates automatically</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { step: "1", title: "Connect your gateway", desc: "Add your API keys in Settings → Payment Gateways. Takes under 2 minutes." },
            { step: "2", title: "Generate an invoice", desc: "Describe what you need — Clorefy's AI writes a complete, compliant invoice." },
            { step: "3", title: "Share the payment link", desc: "Send the invoice link to your client. They click Pay Now and pay instantly." },
          ].map(item => (
            <div key={item.step} className="p-5 rounded-xl border border-border bg-card">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gateways */}
      <section className="max-w-4xl mx-auto px-6 py-6">
        <h2 className="text-2xl font-bold mb-2">Supported payment gateways</h2>
        <p className="text-muted-foreground mb-8">
          Choose the gateway that fits your business. You can connect all three simultaneously.
        </p>
        <div className="space-y-6">
          {gateways.map(gw => (
            <div key={gw.id} className={`rounded-2xl border p-6 ${gw.color}`}>
              <div className="flex items-start gap-4">
                <GatewayLogo url={gw.logoUrl} alt={`${gw.name} logo`} bg={gw.logoBg} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`text-lg font-bold ${gw.accentColor}`}>{gw.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/20 text-muted-foreground font-medium">
                      {gw.tagline}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{gw.description}</p>

                  <div className="grid sm:grid-cols-3 gap-3 mb-5 text-xs">
                    <div>
                      <p className="font-medium text-foreground/70 uppercase tracking-wide mb-0.5">Best for</p>
                      <p className="text-foreground">{gw.bestFor}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground/70 uppercase tracking-wide mb-0.5">Currencies</p>
                      <p className="text-foreground">{gw.currencies}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground/70 uppercase tracking-wide mb-0.5">Webhook setup</p>
                      <p className="text-foreground">{gw.webhookSetup}</p>
                    </div>
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-primary hover:underline list-none flex items-center gap-1">
                      <span>Step-by-step setup guide</span>
                      <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <ol className="mt-3 space-y-2">
                      {gw.steps.map((step, i) => (
                        <li key={i} className="flex gap-2.5 text-xs text-muted-foreground">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-white/70 dark:bg-black/20 text-foreground/70 flex items-center justify-center text-[10px] font-bold mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Webhook setup guide */}
      <section id="webhooks" className="max-w-4xl mx-auto px-6 py-10 scroll-mt-20">
        <h2 className="text-2xl font-bold mb-2">Webhook configuration</h2>
        <p className="text-muted-foreground mb-8">
          Webhooks ensure your invoice status updates reliably, even if the client closes their browser after paying.
        </p>

        <div className="space-y-6">
          {/* Razorpay webhooks */}
          <div className="rounded-2xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <GatewayLogo url="https://razorpay.com/assets/razorpay-glyph.svg" alt="Razorpay" bg="bg-[#072654]" size={32} />
              <h3 className="text-base font-bold text-blue-900 dark:text-blue-300">Razorpay Webhook Events</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              In your Razorpay Dashboard → Settings → Webhooks, create a new webhook and select these events:
            </p>
            <div className="grid sm:grid-cols-2 gap-2 mb-4">
              {[
                { event: "payment_link.paid", desc: "Payment completed successfully" },
                { event: "payment_link.partially_paid", desc: "Partial payment received" },
                { event: "payment_link.expired", desc: "Payment link has expired" },
                { event: "payment_link.cancelled", desc: "Payment link was cancelled" },
              ].map(e => (
                <div key={e.event} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 dark:bg-black/20 border border-blue-100 dark:border-blue-800/30">
                  <code className="text-xs font-mono text-blue-800 dark:text-blue-300 font-semibold shrink-0">{e.event}</code>
                  <span className="text-[11px] text-muted-foreground ml-auto">{e.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Paste the <strong>Webhook URL</strong> and <strong>Webhook Secret</strong> shown in your Clorefy payment settings into the Razorpay webhook form.
            </p>
          </div>

          {/* Stripe webhooks */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <GatewayLogo url="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" bg="bg-[#635BFF]" size={32} />
              <h3 className="text-base font-bold text-indigo-900 dark:text-indigo-300">Stripe Webhook Events</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium ml-auto">Auto-registered</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Stripe webhooks are registered automatically when you connect. These events are listened for:
            </p>
            <div className="grid sm:grid-cols-3 gap-2 mb-4">
              {[
                { event: "checkout.session.completed", desc: "Checkout finished" },
                { event: "payment_intent.succeeded", desc: "Payment succeeded" },
                { event: "payment_intent.payment_failed", desc: "Payment failed" },
              ].map(e => (
                <div key={e.event} className="p-2.5 rounded-lg bg-white/60 dark:bg-black/20 border border-indigo-100 dark:border-indigo-800/30">
                  <code className="text-xs font-mono text-indigo-800 dark:text-indigo-300 font-semibold block">{e.event}</code>
                  <span className="text-[11px] text-muted-foreground">{e.desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              No manual setup needed — Stripe&apos;s API allows programmatic webhook creation.
            </p>
          </div>

          {/* Cashfree webhooks */}
          <div className="rounded-2xl border border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-950/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <GatewayLogo url="https://cashfreelogo.cashfree.com/cashfreepayments/logoAssets/cf-primary-logo.png" alt="Cashfree" bg="bg-[#00B050]" size={32} />
              <h3 className="text-base font-bold text-green-900 dark:text-green-300">Cashfree Webhook</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-medium ml-auto">Embedded</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Cashfree uses a different approach — the webhook URL is embedded directly in each payment link via the <code className="text-xs font-mono bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">notify_url</code> parameter.
            </p>
            <div className="p-3 rounded-lg bg-white/60 dark:bg-black/20 border border-green-100 dark:border-green-800/30 text-xs text-muted-foreground">
              When Clorefy creates a Cashfree payment link, it automatically includes <code className="font-mono text-green-800 dark:text-green-300">notify_url</code> pointing to your Clorefy webhook endpoint. Cashfree sends payment status updates to this URL for each individual transaction. No global webhook configuration is needed in the Cashfree dashboard.
            </div>
          </div>
        </div>
      </section>

      {/* Webhook explainer */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-6">
          <h2 className="text-lg font-bold text-amber-900 dark:text-amber-300 mb-2">
            Why webhooks are required
          </h2>
          <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed mb-4">
            Payment gateways offer two ways to notify your app about a completed payment: a <strong>callback URL</strong> (redirect after payment) and a <strong>webhook</strong> (server-to-server notification).
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
              <p className="font-semibold text-red-700 dark:text-red-400 mb-1">❌ Callback URL only</p>
              <p className="text-red-700 dark:text-red-400">If the client closes the browser tab after paying, the redirect never fires. Invoice stays &quot;pending&quot; even though payment was received.</p>
            </div>
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
              <p className="font-semibold text-green-700 dark:text-green-400 mb-1">✅ Webhook (required)</p>
              <p className="text-green-700 dark:text-green-400">Fires server-to-server regardless of client behavior. Invoice status updates to &quot;paid&quot; reliably every time.</p>
            </div>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-500 mt-3 italic">
            Razorpay&apos;s own documentation: &quot;Implement webhooks to avoid callback failure.&quot;
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-6 py-6 pb-16">
        <h2 className="text-2xl font-bold mb-8">Frequently asked questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details key={i} className="group rounded-xl border border-border bg-card overflow-hidden">
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-medium text-sm hover:bg-muted/40 transition-colors">
                <span>{faq.q}</span>
                <svg className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <h2 className="text-2xl font-bold mb-3">Ready to collect payments?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Connect your payment gateway in under 2 minutes and start collecting payments from your AI-generated invoices.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              Create free account
            </Link>
            <Link
              href="/settings"
              className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Go to payment settings
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
