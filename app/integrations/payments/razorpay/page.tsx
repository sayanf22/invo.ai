import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"

export const metadata: Metadata = {
  title: "Razorpay Integration Guide | Clorefy",
  description:
    "Step-by-step guide to connect Razorpay with Clorefy. Set up API keys, configure webhooks, and start accepting payments via UPI, cards, and netbanking.",
}

// Inline Razorpay Logo SVG
const RazorpayLogoSVG = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#072654" />
    <path d="M30 70L70 30" stroke="#2563eb" strokeWidth="12" strokeLinecap="square" />
    <path d="M30 30H50C65 30 65 50 50 50H30V30Z" stroke="white" strokeWidth="10" strokeLinejoin="round" />
  </svg>
)

// Mini Dashboard Mockup Component
const DashboardMockup = ({ children, title }: { children: React.ReactNode, title: string }) => (
  <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none bg-slate-50 dark:bg-slate-900/80">
    <div className="h-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2">
      <div className="flex gap-1.5 shrink-0">
        <div className="w-3 h-3 rounded-full bg-red-400"></div>
        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
        <div className="w-3 h-3 rounded-full bg-green-400"></div>
      </div>
      <div className="mx-auto bg-slate-100 dark:bg-slate-900 px-3 sm:px-4 py-1 rounded-md text-[10px] font-mono text-slate-500 truncate max-w-[60%] sm:max-w-[80%]">{title}</div>
    </div>
    <div className="p-0 overflow-x-auto">
      {children}
    </div>
  </div>
)

export default function RazorpayGuidePage() {
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
          <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-[#072654] to-[#123970] flex items-center justify-center shadow-lg shadow-blue-900/10 shrink-0">
            <RazorpayLogoSVG />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3">
              Razorpay Integration Guide
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Connect Razorpay to accept UPI, cards, and netbanking. Learn where to find your API keys and how webhooks work.
            </p>
          </div>
        </div>

        {/* ── What are Webhooks? ────────────────────────────────── */}
        <section className="mb-12">
          <div className="rounded-[2rem] border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/20 p-5 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-3">What are Webhooks and why are they important?</h2>
            <p className="text-[15px] text-blue-800 dark:text-blue-300 leading-relaxed mb-4">
              A webhook is a way for an app (like Razorpay) to send real-time information to another app (like Clorefy) the moment an event happens. 
              Instead of Clorefy constantly asking Razorpay "Did the user pay yet?", Razorpay instantly sends a message to Clorefy saying "The payment was successful!" 
            </p>
            <p className="text-[15px] text-blue-800 dark:text-blue-300 leading-relaxed">
              <strong>Why it matters:</strong> If a customer completes a payment but closes their browser before being redirected back to your invoice, the payment is still securely recorded because the webhook sends the success signal server-to-server in the background. Razorpay's own documentation strongly recommends webhooks to prevent dropped payments.
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
                <span className="mt-1">Log in to <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">dashboard.razorpay.com</a></span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">2</span>
                <span className="mt-1">Navigate to <strong className="text-slate-900 dark:text-white">Account & Settings</strong> (usually in the left sidebar under Settings or by clicking the gear icon).</span>
              </li>
              <li className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm font-bold border border-slate-200/60 dark:border-slate-700/60">3</span>
                <span className="mt-1">Click on <strong className="text-slate-900 dark:text-white">"API Keys"</strong> in the settings menu. Click "Generate Key" (or Regenerate Key).</span>
              </li>
            </ol>

            {/* Dashboard Mockup - API Keys */}
            <DashboardMockup title="dashboard.razorpay.com/app/keys">
              <div className="flex min-h-[16rem] text-sm">
                {/* Sidebar */}
                <div className="w-48 bg-[#0B1527] border-r border-[#1C2C47] p-4 hidden sm:block text-slate-400 shrink-0">
                  <div className="h-6 w-24 bg-[#1C2C47] rounded mb-6"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-[#1C2C47] rounded"></div>
                    <div className="h-4 w-3/4 bg-[#1C2C47] rounded"></div>
                    <div className="pt-4 mt-4 border-t border-[#1C2C47]">
                      <div className="flex items-center gap-2 text-white font-semibold bg-[#1C2C47] px-2 py-1.5 rounded-lg -ml-2">
                        <div className="w-4 h-4 rounded bg-slate-600"></div>
                        Account & Settings
                      </div>
                      <div className="ml-6 mt-2 space-y-2">
                        <div className="text-blue-400 font-medium">API Keys</div>
                        <div className="text-slate-400">Webhooks</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 min-w-[280px]">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">API Keys</h3>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Live API Key</div>
                        <div className="text-xs text-slate-500">Authenticate API requests in live mode.</div>
                      </div>
                      <div className="bg-blue-600 text-white text-xs px-3 py-1 rounded">Regenerate</div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Key ID</div>
                        <div className="font-mono text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">rzp_live_abc123xyz</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Key Secret</div>
                        <div className="font-mono text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-400">••••••••••••••••••••••••••••</div>
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
            
            <p className="text-[15px] text-slate-600 dark:text-slate-400 mb-6 font-medium">
              After connecting your keys, copy the Webhook URL and Secret from Clorefy. Then, navigate back to Razorpay Settings → Webhooks.
            </p>
            
            {/* Dashboard Mockup - Webhooks */}
            <DashboardMockup title="dashboard.razorpay.com/app/webhooks">
              <div className="flex min-h-[20rem] text-sm">
                {/* Sidebar */}
                <div className="w-48 bg-[#0B1527] border-r border-[#1C2C47] p-4 hidden sm:block text-slate-400 shrink-0">
                  <div className="h-6 w-24 bg-[#1C2C47] rounded mb-6"></div>
                  <div className="space-y-3">
                    <div className="pt-4 mt-4 border-t border-[#1C2C47]">
                      <div className="flex items-center gap-2 text-white font-semibold bg-[#1C2C47] px-2 py-1.5 rounded-lg -ml-2">
                        <div className="w-4 h-4 rounded bg-slate-600"></div>
                        Account & Settings
                      </div>
                      <div className="ml-6 mt-2 space-y-2">
                        <div className="text-slate-400">API Keys</div>
                        <div className="text-blue-400 font-medium">Webhooks</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 overflow-y-auto min-w-[280px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Webhooks</h3>
                    <div className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded">+ Add New Webhook</div>
                  </div>
                  
                  {/* Webhook Form Simulation */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm relative">
                    <div className="absolute top-4 right-4 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Active</div>
                    <div className="text-xs text-slate-500 mb-1">Webhook URL</div>
                    <div className="font-mono text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 break-all mb-4">
                      https://clorefy.com/api/razorpay/webhook/your-id
                    </div>
                    <div className="text-xs text-slate-500 mb-1">Secret</div>
                    <div className="font-mono text-[10px] sm:text-xs bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-slate-400 mb-4">
                      ••••••••••••••••
                    </div>
                    <div className="text-xs text-slate-500 mb-2">Active Events</div>
                    <div className="space-y-1">
                       <div className="flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                         <span className="text-blue-600">☑</span> payment_link.paid
                       </div>
                       <div className="flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                         <span className="text-blue-600">☑</span> payment_link.partially_paid
                       </div>
                       <div className="flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                         <span className="text-blue-600">☑</span> payment_link.expired
                       </div>
                       <div className="flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300">
                         <span className="text-blue-600">☑</span> payment_link.cancelled
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </DashboardMockup>
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