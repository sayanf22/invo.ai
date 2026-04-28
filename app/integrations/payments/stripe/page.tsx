import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { DashboardMockup, StripeLogo, SecurityItem } from "../_components"

export const metadata: Metadata = {
  title: "Stripe Integration Guide | Clorefy",
  description:
    "Step-by-step guide to connect Stripe with Clorefy. Set up your API key, understand auto-registered webhooks, and start accepting global payments.",
}

export default function StripeGuidePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/integrations/payments" className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all shadow-sm">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="hidden sm:flex items-center gap-3">
              <ClorefyLogo size={24} />
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Integration Guide</span>
            </div>
          </div>
          <HamburgerMenu />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-20">

        {/* Hero Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12">
          <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[#635BFF] to-[#7A73FF] flex items-center justify-center shadow-lg shadow-indigo-900/20 shrink-0">
            <StripeLogo size={48} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
              Stripe Integration Guide
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Connect Stripe to accept cards and bank transfers globally. Learn where to find your API keys and how auto-webhooks work.
            </p>
          </div>
        </div>

        {/* ── What are Webhooks? ────────────────────────────────── */}
        <section className="mb-12">
          <div className="rounded-[2rem] border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20 p-5 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-3">What are Webhooks and why are they important?</h2>
            <p className="text-[15px] text-blue-800 dark:text-blue-300 leading-relaxed mb-4">
              A webhook is a way for Stripe to securely send real-time payment status updates directly to Clorefy's servers. 
              Instead of Clorefy constantly asking Stripe "Did the user pay yet?", Stripe instantly sends a cryptographic message to Clorefy saying "The payment was successful!" 
            </p>
            <p className="text-[15px] text-blue-800 dark:text-blue-300 leading-relaxed">
              <strong>Why it matters:</strong> If a customer completes a payment but their internet drops or they close their browser before being redirected back to your invoice, the payment is still securely recorded. The webhook ensures the invoice is marked as "Paid" flawlessly in the background.
            </p>
          </div>
        </section>

        {/* ── Step 1: API Keys ──────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Step 1 — Get your Secret Key
          </h2>
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
            <ol className="space-y-4 text-[15px] text-slate-600 dark:text-slate-400 mb-8">
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">1</span>
                <span className="mt-1">Log in to <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">dashboard.stripe.com</a></span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">2</span>
                <span className="mt-1">In the top right navigation, click the <strong className="text-slate-900 dark:text-white">"Developers"</strong> button.</span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">3</span>
                <span className="mt-1">Click the <strong className="text-slate-900 dark:text-white">"API Keys"</strong> tab.</span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">4</span>
                <span className="mt-1">Under Standard keys, click <strong className="text-slate-900 dark:text-white">"Reveal live key"</strong> (or test key) next to Secret key.</span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">5</span>
                <span className="mt-1">Copy the <strong className="text-slate-900 dark:text-white">Secret key</strong> (starts with <code className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono">sk_live_</code> or <code className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono">sk_test_</code>).</span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">6</span>
                <span className="mt-1">Go to <strong className="text-slate-900 dark:text-white">Clorefy Settings → Payment Gateways → Select Stripe</strong> → Paste key → Connect.</span>
              </li>
            </ol>

            {/* Dashboard Mockup - API Keys */}
            <DashboardMockup title="dashboard.stripe.com/apikeys">
              <div className="flex min-h-[16rem] text-sm">
                {/* Sidebar */}
                <div className="w-48 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-4 hidden sm:block shrink-0">
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1.5 rounded-lg -ml-2">
                      API keys
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 px-2">Webhooks</div>
                    <div className="text-slate-600 dark:text-slate-400 px-2">Events</div>
                    <div className="text-slate-600 dark:text-slate-400 px-2">Logs</div>
                  </div>
                </div>
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-6 bg-white dark:bg-slate-900 min-w-[280px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">API keys</h3>
                    <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs px-3 py-1.5 rounded-full font-medium border border-slate-200 dark:border-slate-700">Test mode</div>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Token</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        <tr>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">Publishable key</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">pk_test_51Nx...</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">Secret key</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2 xl:gap-3">
                              <span className="font-mono text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded text-slate-800 dark:text-slate-200">sk_test_••••••••</span>
                              <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[10px] sm:text-xs font-medium cursor-pointer shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0">Reveal test key</span>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </DashboardMockup>
          </div>
        </section>

        {/* ── Step 2: Webhooks (Auto) ──────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Step 2 — Webhooks (Auto-Registered)
          </h2>
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
            
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 mb-8">
              <p className="text-[15px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
                <strong>No manual setup needed.</strong> Clorefy automatically registers a webhook endpoint via the Stripe API when you securely connect your account. We handle the URL, the secret verification, and the events automatically.
              </p>
            </div>

            <p className="text-[15px] text-slate-600 dark:text-slate-400 mb-6 font-medium">
              If you navigate to Developers → Webhooks in your Stripe Dashboard, you will see the endpoint Clorefy created for you automatically:
            </p>
            
            {/* Dashboard Mockup - Webhooks */}
            <DashboardMockup title="dashboard.stripe.com/webhooks">
              <div className="flex min-h-[14rem] text-sm">
                {/* Sidebar */}
                <div className="w-48 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-4 hidden sm:block shrink-0">
                  <div className="space-y-3 mt-4">
                    <div className="text-slate-600 dark:text-slate-400 px-2">API keys</div>
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1.5 rounded-lg -ml-2">
                      Webhooks
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 px-2">Events</div>
                  </div>
                </div>
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-6 bg-white dark:bg-slate-900 min-w-[280px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Webhooks</h3>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 font-medium">URL</th>
                          <th className="px-4 py-3 font-medium">Events</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        <tr>
                          <td className="px-4 py-3 font-mono text-[10px] sm:text-xs text-slate-800 dark:text-slate-200 break-all">
                            https://clorefy.com/api/stripe/webhook/...
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs">3 events</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </DashboardMockup>
          </div>
        </section>

        {/* ── About the Webhook Secret ─────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            About the Webhook Signing Secret
          </h2>
          <div className="rounded-[2rem] border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/30 dark:bg-indigo-950/20 p-5 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-start gap-4">
              <span className="text-3xl shrink-0">✅</span>
              <div>
                <h3 className="font-bold text-indigo-900 dark:text-indigo-200 text-lg mb-2">Fully automatic — nothing to do!</h3>
                <p className="text-[15px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
                  When you connect Stripe, we automatically register a webhook endpoint via the Stripe API and receive the signing secret (<code className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-xs font-mono">whsec_...</code>). This secret is stored encrypted and used to verify every incoming webhook.
                </p>
              </div>
            </div>
            <div className="border-t border-indigo-200/60 dark:border-indigo-800/40 pt-4">
              <p className="text-[14px] text-indigo-700 dark:text-indigo-400 leading-relaxed">
                <strong>Unlike Razorpay</strong>, Stripe generates the signing secret automatically — you cannot set your own. It starts with <code className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-xs font-mono">whsec_</code> and is only shown once in the Stripe dashboard when the endpoint is created. We capture it at that moment and store it securely.
              </p>
            </div>
          </div>
        </section>

        {/* ── Security Notes ───────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Security Notes
          </h2>
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
            <ul className="space-y-4 text-[15px] text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
                <span>Your Secret Key is encrypted with AES-256 before storage — it is never logged or exposed in API responses.</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
                <span>Webhook signatures are verified using the Stripe signing secret on every incoming request to guarantee authenticity.</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
                <span>Use <strong>test mode keys</strong> (<code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">sk_test_</code>) during development, then switch to live keys for production.</span>
              </li>
            </ul>
          </div>
        </section>

        <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-8 flex justify-center">
          <Link
            href="/integrations/payments"
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-primary hover:text-primary/80 transition-colors bg-primary/5 px-6 py-3 rounded-2xl"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Payment Integrations
          </Link>
        </div>
      </div>
    </div>
  )
}