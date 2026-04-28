import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { DashboardMockup, CashfreeLogo, SecurityItem } from "../_components"

export const metadata: Metadata = {
  title: "Cashfree Integration Guide | Clorefy",
  description:
    "Step-by-step guide to connect Cashfree with Clorefy. Set up API keys, configure webhooks, and start accepting payments with fast settlements.",
}

export default function CashfreeGuidePage() {
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
          <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[#00A550] to-[#00C95B] flex items-center justify-center shadow-lg shadow-green-900/20 shrink-0">
            <CashfreeLogo size={48} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
              Cashfree Integration Guide
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Connect Cashfree to accept payments with fast global settlements. Learn where to find your API keys and how webhooks work.
            </p>
          </div>
        </div>

        {/* ── What are Webhooks? ────────────────────────────────── */}
        <section className="mb-12">
          <div className="rounded-[2rem] border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20 p-5 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-3">What are Webhooks and why are they important?</h2>
            <p className="text-[15px] text-blue-800 dark:text-blue-300 leading-relaxed mb-4">
              A webhook is a way for an app (like Cashfree) to send real-time information to another app (like Clorefy) the moment an event happens. 
              Instead of Clorefy constantly asking Cashfree "Did the user pay yet?", Cashfree instantly sends a message to Clorefy saying "The payment was successful!" 
            </p>
            <p className="text-[15px] text-blue-800 dark:text-blue-300 leading-relaxed">
              <strong>Why it matters:</strong> If a customer completes a payment but closes their browser before being redirected back to your invoice, the payment is still securely recorded because the webhook sends the success signal server-to-server in the background.
            </p>
          </div>
        </section>

        {/* ── Step 1: API Keys ──────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Step 1 — Get your API Keys
          </h2>
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
            <ol className="space-y-4 text-[15px] text-slate-600 dark:text-slate-400 mb-8">
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">1</span>
                <span className="mt-1">Log in to <a href="https://merchant.cashfree.com" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">merchant.cashfree.com</a></span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">2</span>
                <span className="mt-1">Navigate to the <strong className="text-slate-900 dark:text-white">"Developers"</strong> section (usually in the left sidebar or top navigation).</span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">3</span>
                <span className="mt-1">Click on <strong className="text-slate-900 dark:text-white">"API Keys"</strong>. Click "View API Key" to reveal your App ID and Secret Key.</span>
              </li>
            </ol>

            {/* Dashboard Mockup - API Keys */}
            <DashboardMockup title="merchant.cashfree.com/developers/api-keys">
              <div className="flex min-h-[16rem] text-sm">
                {/* Sidebar */}
                <div className="w-48 bg-slate-100/50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-4 hidden sm:block shrink-0">
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded mb-3"></div>
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-500 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-lg -ml-2">
                        <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-800"></div>
                        Developers
                      </div>
                      <div className="ml-6 mt-2 space-y-2">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">API Keys</div>
                        <div className="text-slate-400">Webhooks</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-6 min-w-[280px]">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">API Keys</h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Production API Keys</div>
                        <div className="text-xs text-slate-500">Use these keys to authenticate API requests.</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">App ID (Client ID)</div>
                        <div className="font-mono text-xs bg-slate-100 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">1234567890abcdef</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Secret Key</div>
                        <div className="font-mono text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-400">••••••••••••••••••••••••••••</div>
                        <div className="mt-2 text-xs text-blue-600 font-semibold cursor-pointer">👁️ View API Key</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DashboardMockup>
          </div>
        </section>

        {/* ── Step 2: Webhook Setup ────────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Step 2 — Webhook Configuration
          </h2>
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
            
            <div className="rounded-2xl border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20 p-5 mb-8">
              <p className="text-[15px] text-green-800 dark:text-green-300 leading-relaxed">
                <strong>Automatic via payment links.</strong> Cashfree webhook URL is embedded in each payment link automatically via the <code className="px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/50 text-xs font-mono font-bold">notify_url</code> parameter. No separate configuration is required for basic usage.
              </p>
            </div>

            <p className="text-[15px] text-slate-600 dark:text-slate-400 mb-6 font-medium">
              If you wish to set it up manually for redundancy, navigate to the <strong className="text-slate-900 dark:text-white">Webhooks</strong> tab under Developers:
            </p>
            
            {/* Dashboard Mockup - Webhooks */}
            <DashboardMockup title="merchant.cashfree.com/developers/webhooks">
              <div className="flex min-h-[16rem] text-sm">
                {/* Sidebar */}
                <div className="w-48 bg-slate-100/50 dark:bg-slate-950/50 border-r border-slate-200 dark:border-slate-800 p-4 hidden sm:block shrink-0">
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
                  <div className="space-y-3">
                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-500 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-lg -ml-2">
                        <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-800"></div>
                        Developers
                      </div>
                      <div className="ml-6 mt-2 space-y-2">
                        <div className="text-slate-400">API Keys</div>
                        <div className="text-slate-800 dark:text-slate-200 font-medium">Webhooks</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-6 min-w-[280px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Webhook Endpoints</h3>
                    <div className="bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Add Webhook Endpoint</div>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm">
                    <div className="text-xs text-slate-500 mb-2">Endpoint URL</div>
                    <div className="font-mono text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 break-all">
                      https://clorefy.com/api/cashfree/webhook/your-id
                    </div>
                    <div className="mt-4 text-xs text-slate-500 mb-2">Events</div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-mono">PAYMENT_SUCCESS</span>
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-mono">PAYMENT_FAILED</span>
                    </div>
                  </div>
                </div>
              </div>
            </DashboardMockup>
          </div>
        </section>

        {/* ── About the Webhook Secret ─────────────────────────── */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            About the Webhook Secret
          </h2>
          <div className="rounded-[2rem] border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/20 p-5 sm:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="text-3xl shrink-0">✅</span>
              <div>
                <h3 className="font-bold text-emerald-900 dark:text-emerald-200 text-lg mb-2">No separate webhook secret needed!</h3>
                <p className="text-[15px] text-emerald-800 dark:text-emerald-300 leading-relaxed mb-3">
                  Cashfree uses your <strong>Client Secret</strong> (the one you already entered when connecting) to sign all webhook notifications using HMAC-SHA256. Our app already has this stored securely and uses it automatically to verify every incoming webhook.
                </p>
                <p className="text-[14px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  You don't need to configure anything extra. Just add the Webhook URL to your Cashfree dashboard (Step 2 above) and everything works automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Security Notes ───────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Security Notes</h2>
          <div className="rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
            <ul className="space-y-4 text-[15px] text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
                <span>Your Client Secret is encrypted with AES-256-GCM before storage — never logged or returned to the browser.</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
                <span>Webhook signatures are verified using HMAC-SHA256 with your Client Secret on every incoming request.</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
                <span>Webhook timestamps are validated — requests older than 5 minutes are rejected to prevent replay attacks.</span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
                <span>Use <strong>Sandbox mode</strong> during testing — toggle it in Clorefy when connecting with sandbox credentials.</span>
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