import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Payment Gateway Integration — Clorefy / Clorefy",
  description:
    "Connect Razorpay, Stripe, or Cashfree to Clorefy and collect payments directly from your invoices. Step-by-step setup guide, webhook configuration, and FAQ.",
  keywords: [
    "payment gateway integration",
    "Razorpay invoice",
    "Stripe invoice",
    "Cashfree invoice",
    "collect payments invoices",
    "Clorefy payments",
    "Clorefy payment setup",
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

const RazorpayLogoSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 70L70 30" stroke="#2563eb" strokeWidth="12" strokeLinecap="square" />
    <path d="M30 30H50C65 30 65 50 50 50H30V30Z" stroke="white" strokeWidth="10" strokeLinejoin="round" />
  </svg>
)

const StripeLogoSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M65.4 46.1C65.4 37.8 59 34.6 51 34.6C41.2 34.6 34.6 40.5 34.6 49.3C34.6 62.4 53.6 60.5 53.6 66.2C53.6 69.1 50.5 70.8 46.4 70.8C40.6 70.8 35.5 68.3 33.3 65.6L30.5 76C33.4 78 39.4 79.5 45.4 79.5C55.7 79.5 63 73.6 63 64.6C63 50.8 44.1 52.8 44.1 47.7C44.1 45.2 46.8 43.4 51.1 43.4C55.7 43.4 59.8 45.2 62.3 47.7L65.4 46.1Z" fill="white" />
  </svg>
)

const CashfreeLogoSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M70 30L30 70M30 30L70 70" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="8" />
  </svg>
)

function GatewayLogo({ LogoComponent, bg, size = 48 }: { LogoComponent: React.ComponentType; bg: string; size?: number }) {
  return (
    <div
      className={`rounded-2xl flex items-center justify-center shrink-0 shadow-md ${bg}`}
      style={{ width: size, height: size }}
    >
      <div className="w-[55%] h-[55%] drop-shadow-sm flex items-center justify-center">
        <LogoComponent />
      </div>
    </div>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

const gateways = [
  {
    id: "razorpay",
    name: "Razorpay",
    LogoComponent: RazorpayLogoSVG,
    logoBg: "bg-gradient-to-br from-[#072654] to-[#123970]",
    tagline: "Global & India",
    description:
      "Accept UPI, credit/debit cards, netbanking, wallets, and EMI. Razorpay is a powerful payment gateway for global and Indian businesses.",
    bestFor: "Global & Indian businesses",
    currencies: "100+ currencies",
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
    color: "border-blue-200 bg-white dark:border-blue-800/40 dark:bg-slate-900",
    shadow: "shadow-xl shadow-blue-900/5",
    accentColor: "text-blue-900 dark:text-blue-300",
  },
  {
    id: "stripe",
    name: "Stripe",
    LogoComponent: StripeLogoSVG,
    logoBg: "bg-gradient-to-br from-[#635BFF] to-[#7A73FF]",
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
    color: "border-indigo-200 bg-white dark:border-indigo-800/40 dark:bg-slate-900",
    shadow: "shadow-xl shadow-indigo-900/5",
    accentColor: "text-indigo-900 dark:text-indigo-300",
  },
  {
    id: "cashfree",
    name: "Cashfree",
    LogoComponent: CashfreeLogoSVG,
    logoBg: "bg-gradient-to-br from-[#00B050] to-[#00C95B]",
    tagline: "Fast global settlements",
    description:
      "Gateway with fast T+1 settlements and payment links. Webhook URL is embedded automatically in every payment link.",
    bestFor: "Global businesses needing fast settlements",
    currencies: "100+ currencies",
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
    color: "border-green-200 bg-white dark:border-green-800/40 dark:bg-slate-900",
    shadow: "shadow-xl shadow-green-900/5",
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

// ── Realistic SVGs ─────────────────────────────────────────────────────────────

const InvoiceGeneratedSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="25" y="15" width="70" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2"/>
    <path d="M40 35H80M40 50H80M40 65H60" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round"/>
    <rect x="65" y="60" width="15" height="15" rx="3" fill="#e2e8f0"/>
    <circle cx="80" cy="85" r="16" fill="#3b82f6" fillOpacity="0.1" stroke="#3b82f6" strokeWidth="2"/>
    <path d="M75 85L78 88L85 81" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 30L10 20M10 50H5M30 10V5" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 4" className="animate-pulse"/>
  </svg>
)

const PaymentLinkSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="30" width="90" height="60" rx="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2"/>
    <circle cx="35" cy="60" r="8" fill="#e2e8f0"/>
    <path d="M55 55H85M55 65H70" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round"/>
    <rect x="70" y="20" width="30" height="30" rx="15" fill="#8b5cf6" className="animate-bounce" style={{animationDuration: '3s'}}/>
    <path d="M80 35C80 32.2386 82.2386 30 85 30C87.7614 30 90 32.2386 90 35M85 35V40" stroke="#ffffff" strokeWidth="3" strokeLinecap="round"/>
  </svg>
)

const PaymentReceivedSVG = () => (
  <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="35" width="80" height="50" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2"/>
    <rect x="20" y="45" width="80" height="15" fill="#cbd5e1"/>
    <rect x="30" y="68" width="20" height="8" rx="4" fill="#e2e8f0"/>
    <circle cx="85" cy="85" r="24" fill="#22c55e" stroke="#ffffff" strokeWidth="4"/>
    <path d="M76 85L82 91L94 79" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentIntegrationsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-hidden">

      {/* Hero */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-950 border-b border-border shadow-sm">
        {/* Background Decorative Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-5xl pointer-events-none opacity-40 dark:opacity-20 flex justify-center">
          <div className="w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl absolute -top-32 -left-32"></div>
          <div className="w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-3xl absolute top-32 -right-32"></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-20 text-center relative z-10">
          <div className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-full bg-white dark:bg-slate-900 text-primary border border-primary/20 shadow-lg shadow-primary/5 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Payment Integrations
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 text-slate-900 dark:text-white drop-shadow-sm">
            Collect payments directly <br className="hidden sm:block" /> from your invoices
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect Razorpay, Stripe, or Cashfree to Clorefy and add a "Pay Now" button to every invoice you generate. Payments go straight to your bank account.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/settings"
              className="px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              Integrate Now
            </Link>
            <Link
              href="/"
              className="px-8 py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-md hover:shadow-lg"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Visual payment flow */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">How payment collection works</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Clorefy generates your invoice with AI, then adds a secure payment link powered by your chosen gateway.
          </p>
        </div>

        {/* 3-step visual flow */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting Lines (Desktop only) */}
          <div className="hidden md:block absolute top-[40%] left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-green-200 dark:from-blue-900 dark:via-purple-900 dark:to-green-900 z-0 border-t-2 border-dashed border-slate-300 dark:border-slate-700 opacity-50"></div>

          {[
            { 
              step: "1", 
              title: "Invoice Generated", 
              desc: "AI creates your document flawlessly.", 
              color: "text-blue-600", 
              bg: "bg-blue-50 dark:bg-blue-900/20",
              border: "border-blue-100 dark:border-blue-800",
              svg: <InvoiceGeneratedSVG />
            },
            { 
              step: "2", 
              title: "Payment Link Shared", 
              desc: "Client receives secure pay link.", 
              color: "text-purple-600", 
              bg: "bg-purple-50 dark:bg-purple-900/20",
              border: "border-purple-100 dark:border-purple-800",
              svg: <PaymentLinkSVG />
            },
            { 
              step: "3", 
              title: "Payment Received", 
              desc: "Status updates automatically.", 
              color: "text-green-600", 
              bg: "bg-green-50 dark:bg-green-900/20",
              border: "border-green-100 dark:border-green-800",
              svg: <PaymentReceivedSVG />
            },
          ].map((item, idx) => (
            <div key={item.step} className="relative z-10 flex flex-col items-center">
              <div className={`w-32 h-32 mb-6 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-none p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center transform transition-transform hover:-translate-y-2 duration-300`}>
                {item.svg}
              </div>
              <div className={`w-8 h-8 rounded-full ${item.bg} ${item.border} border flex items-center justify-center mb-4 shadow-sm`}>
                <span className={`text-sm font-bold ${item.color}`}>{item.step}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-[200px]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gateways */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-20 border-y border-border">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">Supported payment gateways</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Choose the gateway that fits your business. You can connect all three simultaneously.
            </p>
          </div>
          
          <div className="space-y-8">
            {gateways.map(gw => (
              <div key={gw.id} id={gw.id} className={`rounded-[2rem] border ${gw.color} ${gw.shadow} p-8 scroll-mt-24 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]`}>
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <GatewayLogo LogoComponent={gw.LogoComponent} bg={gw.logoBg} size={64} />
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className={`text-2xl font-bold ${gw.accentColor}`}>{gw.name}</h3>
                      <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 shadow-sm">
                        {gw.tagline}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">{gw.description}</p>

                    <div className="grid sm:grid-cols-3 gap-4 mb-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Best for</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{gw.bestFor}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Currencies</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{gw.currencies}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Webhook setup</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{gw.webhookSetup}</p>
                      </div>
                    </div>

                    <details className="group">
                      <summary className="cursor-pointer text-sm font-semibold text-primary hover:text-primary/80 transition-colors list-none flex items-center gap-2 bg-primary/5 hover:bg-primary/10 w-fit px-4 py-2 rounded-xl">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span>Step-by-step setup guide</span>
                        <svg className="w-4 h-4 transition-transform group-open:rotate-180 ml-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </summary>
                      <div className="mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-inner">
                        <ol className="space-y-3">
                          {gw.steps.map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-sm">
                                {i + 1}
                              </span>
                              <span className="mt-0.5">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Webhook setup guide */}
      <section id="webhooks" className="max-w-4xl mx-auto px-6 py-20 scroll-mt-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">Webhook configuration</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Webhooks ensure your invoice status updates reliably in real-time, even if the client closes their browser immediately after paying.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 shadow-lg shadow-red-900/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
            <p className="font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600">✕</span> 
              Callback URL only
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">If the client closes the browser tab after paying, the redirect never fires. Your invoice stays "pending" even though payment was actually received.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-green-100 dark:border-green-900/30 shadow-lg shadow-green-900/5 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
            <p className="font-bold text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600">✓</span> 
              Webhook (Required)
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Fires server-to-server reliably regardless of client behavior. Invoice status updates to "paid" securely every single time.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Razorpay webhooks */}
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <GatewayLogo LogoComponent={RazorpayLogoSVG} bg="bg-gradient-to-br from-[#072654] to-[#123970]" size={40} />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Razorpay Webhook Events</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              In your Razorpay Dashboard → Settings → Webhooks, create a new webhook and select exactly these events:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {[
                { event: "payment_link.paid", desc: "Payment completed successfully" },
                { event: "payment_link.partially_paid", desc: "Partial payment received" },
                { event: "payment_link.expired", desc: "Payment link has expired" },
                { event: "payment_link.cancelled", desc: "Payment link was cancelled" },
              ].map(e => (
                <div key={e.event} className="flex flex-col gap-1 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 transition-colors">
                  <code className="text-xs font-mono text-blue-700 dark:text-blue-400 font-bold">{e.event}</code>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{e.desc}</span>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">
              Paste the <strong>Webhook URL</strong> and <strong>Webhook Secret</strong> shown in your Clorefy payment settings directly into the Razorpay webhook form.
            </div>
          </div>

          {/* Stripe webhooks */}
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <GatewayLogo LogoComponent={StripeLogoSVG} bg="bg-gradient-to-br from-[#635BFF] to-[#7A73FF]" size={40} />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Stripe Webhook Events</h3>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm">Auto-registered</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Stripe webhooks are registered automatically via API when you connect. These events are actively monitored:
            </p>
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              {[
                { event: "checkout.session.completed", desc: "Checkout finished" },
                { event: "payment_intent.succeeded", desc: "Payment succeeded" },
                { event: "payment_intent.payment_failed", desc: "Payment failed" },
              ].map(e => (
                <div key={e.event} className="flex flex-col gap-1 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-indigo-200 transition-colors">
                  <code className="text-xs font-mono text-indigo-700 dark:text-indigo-400 font-bold">{e.event}</code>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{e.desc}</span>
                </div>
              ))}
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-sm text-indigo-800 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50">
              No manual setup needed in your Stripe dashboard — Clorefy handles the programmatic webhook creation for you securely.
            </div>
          </div>

          {/* Cashfree webhooks */}
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
               <div className="flex items-center gap-4">
                <GatewayLogo LogoComponent={CashfreeLogoSVG} bg="bg-gradient-to-br from-[#00B050] to-[#00C95B]" size={40} />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Cashfree Webhook</h3>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold shadow-sm">Embedded</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Cashfree uses an embedded approach. The webhook URL is passed dynamically in each payment link payload.
            </p>
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 text-sm text-slate-600 dark:text-slate-400 shadow-inner">
              When Clorefy creates a Cashfree payment link, it automatically injects a <code className="font-mono text-green-700 dark:text-green-400 font-bold bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded">notify_url</code> pointing to your secure Clorefy webhook endpoint. Cashfree securely sends payment status updates to this URL for each transaction. <strong>No global webhook configuration is needed</strong> in the Cashfree dashboard.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-20 border-t border-border">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">Frequently asked questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors">
                  <span className="text-[15px]">{faq.q}</span>
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-open:bg-primary/10 group-open:text-primary transition-colors">
                    <svg className="w-4 h-4 transition-transform duration-300 group-open:rotate-180" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </summary>
                <div className="px-6 pb-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6 drop-shadow-sm">Ready to collect payments?</h2>
          <p className="text-lg text-primary-foreground/80 mb-10 max-w-xl mx-auto">
            Connect your payment gateway in under 2 minutes and start getting paid instantly from your AI-generated invoices.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/settings"
              className="px-8 py-4 rounded-2xl bg-white text-primary text-sm font-bold hover:bg-slate-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
            >
              Integrate Now
            </Link>
            <Link
              href="/"
              className="px-8 py-4 rounded-2xl border-2 border-primary-foreground/20 text-primary-foreground text-sm font-bold hover:bg-primary-foreground/10 transition-all shadow-md"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>

    </main>
  )
}
