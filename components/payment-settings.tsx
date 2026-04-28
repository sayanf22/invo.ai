"use client"

import React, { useState, useEffect, useCallback } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { useUser } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ExternalLink, Trash2, Loader2, Eye, EyeOff, CheckCircle2, Lock, Pencil, Copy, Check, ChevronDown, ChevronUp, Banknote, Building2, Smartphone, CreditCard, Globe, Plus, X, AlertTriangle } from "lucide-react"

type Gateway = "razorpay" | "stripe" | "cashfree"
interface GatewaySettings {
  razorpay?: {
    keyIdHint?: string | null
    accountName?: string | null
    testMode: boolean
    webhookConfigured: boolean
    webhookRegistered: boolean
  } | null
  stripe?: {
    testMode: boolean
    webhookConfigured: boolean
    webhookRegistered: boolean
  } | null
  cashfree?: {
    clientIdHint?: string | null
    testMode: boolean
    webhookConfigured: boolean
  } | null
  updatedAt?: string
}
interface OfflineMethod { id: string; label: string; details: string; enabled: boolean }
interface GatewayDef { id: Gateway; name: string; description: string; countries: string; accentBg: string; Icon: React.FC<{ size?: number }>; apiKeyUrl: string; webhookPath: string }

function RazorpayIcon({ size = 20 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 20L10.5 4H14L20 20H16.5L15.2 16.5H9.3L8 20H4ZM10.4 13.5H14.1L12.25 8.2L10.4 13.5Z" fill="white"/></svg> }
function StripeIcon({ size = 20 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" fill="white"/></svg> }
function CashfreeIcon({ size = 20 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm-1-11v2H9v2h2v4h2v-4h2v-2h-2V8h-2z" fill="white"/></svg> }

const GATEWAYS: GatewayDef[] = [
  { id: "razorpay", name: "Razorpay", description: "UPI, cards, netbanking, wallets", countries: "India", accentBg: "#2563EB", Icon: RazorpayIcon, apiKeyUrl: "https://dashboard.razorpay.com/app/keys", webhookPath: "/integrations/payments/razorpay" },
  { id: "stripe", name: "Stripe", description: "Cards, wallets, 135+ currencies", countries: "Global", accentBg: "#635BFF", Icon: StripeIcon, apiKeyUrl: "https://dashboard.stripe.com/apikeys", webhookPath: "/integrations/payments/stripe" },
  { id: "cashfree", name: "Cashfree", description: "Fast settlements, payment links", countries: "India", accentBg: "#00A550", Icon: CashfreeIcon, apiKeyUrl: "https://merchant.cashfree.com/merchants/developer/api-keys", webhookPath: "/integrations/payments/cashfree" },
]

const DEFAULT_OFFLINE_METHODS: OfflineMethod[] = [
  { id: "bank_transfer", label: "Bank Transfer", details: "", enabled: true },
  { id: "upi", label: "UPI", details: "", enabled: true },
  { id: "cash", label: "Cash", details: "", enabled: true },
  { id: "check", label: "Check / Cheque", details: "", enabled: false },
  { id: "neft", label: "NEFT", details: "", enabled: false },
  { id: "rtgs", label: "RTGS", details: "", enabled: false },
  { id: "imps", label: "IMPS", details: "", enabled: false },
  { id: "wire", label: "Wire Transfer / SWIFT", details: "", enabled: false },
  { id: "ach", label: "ACH Transfer", details: "", enabled: false },
  { id: "sepa", label: "SEPA Transfer", details: "", enabled: false },
  { id: "paypal", label: "PayPal", details: "", enabled: false },
  { id: "google_pay", label: "Google Pay", details: "", enabled: false },
  { id: "phonepe", label: "PhonePe", details: "", enabled: false },
  { id: "paytm", label: "Paytm", details: "", enabled: false },
  { id: "crypto", label: "Cryptocurrency", details: "", enabled: false },
]

const METHOD_PLACEHOLDERS: Record<string, string> = {
  bank_transfer: "Bank: HDFC Bank\nAccount No: 50100123456789\nIFSC: HDFC0001234",
  upi: "UPI ID: yourname@hdfc\nor QR code link",
  cash: "Cash accepted at our office.\nContact us to arrange.",
  check: "Payable to: Your Business Name\nMail to: 123 Main St, City",
  neft: "Bank: SBI\nAccount: 12345678901\nIFSC: SBIN0001234",
  rtgs: "Bank: ICICI Bank\nAccount: 123456789012\nIFSC: ICIC0001234",
  imps: "Bank: Axis Bank\nAccount: 9876543210\nIFSC: UTIB0001234",
  wire: "Bank: Citibank\nSWIFT: CITIINBX\nAccount: 1234567890\nIBAN: IN12345678",
  ach: "Bank: Chase\nRouting: 021000021\nAccount: 1234567890",
  sepa: "IBAN: DE89370400440532013000\nBIC: COBADEFFXXX",
  paypal: "PayPal: payments@yourbusiness.com",
  google_pay: "Google Pay: +91 98765 43210\nor UPI: yourname@okaxis",
  phonepe: "PhonePe: +91 98765 43210",
  paytm: "Paytm: +91 98765 43210",
  crypto: "BTC: 1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf\nETH: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  bank_transfer: Building2, upi: Smartphone, cash: Banknote, check: CreditCard,
  neft: Building2, rtgs: Building2, imps: Building2, wire: Globe,
  ach: Globe, sepa: Globe, paypal: Globe, google_pay: Smartphone,
  phonepe: Smartphone, paytm: Smartphone, crypto: Globe,
}

function GatewayAvatar({ gw, size = 44 }: { gw: GatewayDef; size?: number }) {
  return <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: size, height: size, background: gw.accentBg, boxShadow: `0 4px 12px ${gw.accentBg}40` }}><gw.Icon size={Math.round(size * 0.5)} /></div>
}
function FieldLabel({ children }: { children: React.ReactNode }) { return <label className="block text-[13px] font-medium text-foreground/70 mb-1.5 leading-none">{children}</label> }
function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-150" />
}
function SecretInput({ value, onChange, placeholder, show, onToggle }: { value: string; onChange: (v: string) => void; placeholder?: string; show: boolean; onToggle: () => void }) {
  return <div className="relative"><Input value={value} onChange={onChange} placeholder={placeholder} type={show ? "text" : "password"} /><button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors" tabIndex={-1}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
}
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return <div><label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-1.5">{label}</label><div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30"><code className="flex-1 text-xs font-mono text-foreground/80 truncate">{value}</code><button type="button" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="shrink-0 p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-colors">{copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}</button></div></div>
}

// ── Webhook Panel (collapsed by default, secure) ──────────────────────────────
// RESEARCH FINDINGS (verified from official docs):
// - Razorpay: Secret is a CUSTOM string YOU create — NOT your API key secret.
//   You generate it here, then paste it into Razorpay Dashboard → Settings → Webhooks.
//   Razorpay docs: "The secret does not need to be the Razorpay API key secret."
// - Stripe: Webhook auto-registered via API. Signing secret starts with "whsec_".
//   Found in Dashboard → Developers → Webhooks → click endpoint → Signing secret → Reveal.
// - Cashfree: No separate webhook secret — uses Client Secret for HMAC-SHA256 signing.
//   Just add the webhook URL in Dashboard → Payment Gateway → Developers → Webhooks.
//
// WEBHOOK STATUS LOGIC:
// - Stripe: webhookRegistered = auto-registered via API (definitive check)
// - Razorpay/Cashfree: webhookConfigured = secret exists in DB = URL is ready to use

const WEBHOOK_INSTRUCTIONS: Record<string, { steps: string[]; secretNote: string; events: string[] }> = {
  razorpay: {
    steps: [
      "Copy the Webhook URL below",
      "Open a new tab → go to dashboard.razorpay.com",
      "Click Account & Settings (top right) → Webhooks",
      "Click + Add New Webhook",
      "Paste the Webhook URL in the URL field",
      "Click Reveal Secret below, then copy it and paste into the Secret field",
      "Tick these 4 events: payment_link.paid, payment_link.partially_paid, payment_link.expired, payment_link.cancelled",
      "Click Save — done! ✅",
    ],
    secretNote: "The Secret below is a random code we created for you. It is NOT your Razorpay API Key. You just need to copy it and paste it into the Razorpay webhook form. That's it — Razorpay uses it to prove the payment notifications are genuine.",
    events: ["payment_link.paid", "payment_link.partially_paid", "payment_link.expired", "payment_link.cancelled"],
  },
  stripe: {
    steps: [
      "Stripe webhook was set up automatically when you connected — nothing to do!",
      "To double-check: open dashboard.stripe.com → Developers → Webhooks",
      "You should see an endpoint pointing to this app with status Enabled",
      "If it's missing, disconnect Stripe and reconnect to re-register it",
    ],
    secretNote: "Stripe automatically registered the webhook when you connected your account. The signing secret is stored securely and you don't need to do anything.",
    events: ["checkout.session.completed", "payment_link.completed"],
  },
  cashfree: {
    steps: [
      "Copy the Webhook URL below",
      "Open a new tab → go to merchant.cashfree.com",
      "Click Developers in the left menu",
      "Click Webhooks → Add Webhook Endpoint",
      "Paste the Webhook URL",
      "Select version: 2025-01-01",
      "Click Save — that's it! No secret needed ✅",
    ],
    secretNote: "Cashfree does not need a separate secret. It uses your Client Secret (already saved) to sign the notifications automatically. Just add the URL above and you're done.",
    events: ["PAYMENT_LINK_EVENT"],
  },
}

// ── Razorpay Secret Reveal (fetched from secure API) ─────────────────────────
function RazorpaySecretReveal({ gateway }: { gateway: string }) {
  const [secret, setSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSecret = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/payments/webhook-secret?gateway=${gateway}`)
      if (res.ok) {
        const data = await res.json()
        setSecret(data.secret)
        // Auto-hide after 60 seconds
        setTimeout(() => setSecret(null), 60000)
      } else {
        setError("Could not load secret")
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (secret) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
          <code className="flex-1 text-[11px] font-mono text-foreground break-all select-all">{secret}</code>
          <button type="button" onClick={copy} className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          <button type="button" onClick={() => setSecret(null)} className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <EyeOff size={13} />
          </button>
        </div>
        <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Lock size={10} /> Auto-hides in 60s · Copy this and paste into Razorpay
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <button type="button" onClick={fetchSecret} disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-50">
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
        {loading ? "Loading..." : "Reveal Webhook Secret"}
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <p className="text-[10px] text-muted-foreground">Paste this into the Secret field in Razorpay</p>
    </div>
  )
}

function WebhookPanel({ gateway, webhookUrl, webhookConfigured, webhookRegistered }: {
  gateway: string; webhookUrl: string; webhookConfigured?: boolean; webhookRegistered?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const isStripe = gateway === "stripe"
  const isCashfree = gateway === "cashfree"
  const isReady = isStripe ? webhookRegistered : webhookConfigured
  const info = WEBHOOK_INSTRUCTIONS[gateway]

  return (
    <div className={cn(
      "mx-3 mb-3 rounded-xl border overflow-hidden transition-all duration-200",
      isReady
        ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/10"
        : "border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/10"
    )}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isReady
            ? <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            : <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
          }
          <span className={cn("text-[12px] font-semibold truncate", isReady ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {isReady
              ? isStripe ? "Webhook auto-configured" : "Webhook URL ready — add to dashboard"
              : "Action required: add webhook to dashboard"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-3 pt-1 border-t border-border/30 space-y-3">

            {/* Step-by-step instructions */}
            {info && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">Setup Steps</p>
                <ol className="space-y-1.5">
                  {info.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="text-[11px] text-foreground/80 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Webhook URL */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-1.5">
                {isStripe ? "Your Webhook URL (auto-registered)" : "Step 1 — Copy this Webhook URL"}
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-background/80">
                <code className="flex-1 text-[11px] font-mono text-foreground/80 break-all">{webhookUrl}</code>
                <CopyBtn value={webhookUrl} />
              </div>
            </div>

            {/* Secret info — gateway-specific */}
            {info && (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Lock size={12} className="text-muted-foreground shrink-0" />
                  <p className="text-[11px] font-semibold text-foreground">
                    {isCashfree ? "✅ No separate secret needed" : isStripe ? "✅ Webhook signing secret (auto-managed)" : "Step 2 — Copy your Webhook Secret"}
                  </p>
                  {webhookConfigured && !isCashfree && !isStripe && <CheckCircle2 size={11} className="text-emerald-500 shrink-0 ml-auto" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{info.secretNote}</p>
                {/* Show reveal button for Razorpay/Cashfree */}
                {!isStripe && !isCashfree && webhookConfigured && (
                  <RazorpaySecretReveal gateway={gateway} />
                )}
              </div>
            )}

            {/* Required events */}
            {info && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-1.5">
                  {isStripe ? "Handled Events" : "Enable These Events"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {info.events.map(ev => (
                    <span key={ev} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/8 dark:bg-primary/15 text-primary text-[10px] font-mono font-semibold">
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* External link */}
            <a href={
              gateway === "razorpay" ? "https://dashboard.razorpay.com/app/webhooks" :
              gateway === "stripe" ? "https://dashboard.stripe.com/webhooks" :
              "https://merchant.cashfree.com/merchants/developer/webhooks"
            } target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline">
              Open {gateway.charAt(0).toUpperCase() + gateway.slice(1)} Webhooks Dashboard
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="shrink-0 p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-colors">
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  )
}

interface CredFormProps {
  gw: GatewayDef; isUpdate?: boolean; saving: boolean
  showSecret: boolean; setShowSecret: (v: boolean) => void
  rzpKeyId: string; setRzpKeyId: (v: string) => void
  rzpKeySecret: string; setRzpKeySecret: (v: string) => void
  rzpAccountName: string; setRzpAccountName: (v: string) => void
  stripeSecretKey: string; setStripeSecretKey: (v: string) => void
  cfClientId: string; setCfClientId: (v: string) => void
  cfClientSecret: string; setCfClientSecret: (v: string) => void
  cfTestMode: boolean; setCfTestMode: (v: boolean) => void
  onSave: () => void; onCancel: () => void
}

function CredentialForm({ gw, isUpdate, saving, showSecret, setShowSecret, rzpKeyId, setRzpKeyId, rzpKeySecret, setRzpKeySecret, rzpAccountName, setRzpAccountName, stripeSecretKey, setStripeSecretKey, cfClientId, setCfClientId, cfClientSecret, setCfClientSecret, cfTestMode, setCfTestMode, onSave, onCancel }: CredFormProps) {
  return (
    <div className="px-4 pb-4 pt-3 space-y-4 border-t border-border/50 bg-muted/10">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">{isUpdate ? "Update credentials" : "Enter credentials"}</span>
        <a href={gw.apiKeyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Get API Keys <ExternalLink size={11} /></a>
      </div>
      <div className="space-y-3">
        {gw.id === "razorpay" && (<>
          <div><FieldLabel>Key ID</FieldLabel><Input value={rzpKeyId} onChange={setRzpKeyId} placeholder="rzp_live_xxxxxxxxxxxx" /></div>
          <div><FieldLabel>Key Secret</FieldLabel><SecretInput value={rzpKeySecret} onChange={setRzpKeySecret} placeholder={isUpdate ? "Re-enter to update" : "Your Razorpay Key Secret"} show={showSecret} onToggle={() => setShowSecret(!showSecret)} /></div>
          <div><FieldLabel>Account / Business Name (optional)</FieldLabel><Input value={rzpAccountName} onChange={setRzpAccountName} placeholder="Acme Corp" /></div>
        </>)}
        {gw.id === "stripe" && <div><FieldLabel>Secret Key</FieldLabel><SecretInput value={stripeSecretKey} onChange={setStripeSecretKey} placeholder={isUpdate ? "Re-enter to update" : "sk_live_xxxxxxxxxxxx"} show={showSecret} onToggle={() => setShowSecret(!showSecret)} /></div>}
        {gw.id === "cashfree" && (<>
          <div><FieldLabel>Client ID (App ID)</FieldLabel><Input value={cfClientId} onChange={setCfClientId} placeholder="Your Cashfree App ID" /></div>
          <div><FieldLabel>Client Secret</FieldLabel><SecretInput value={cfClientSecret} onChange={setCfClientSecret} placeholder={isUpdate ? "Re-enter to update" : "Your Cashfree Secret Key"} show={showSecret} onToggle={() => setShowSecret(!showSecret)} /></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCfTestMode(!cfTestMode)} className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0", cfTestMode ? "bg-amber-400" : "bg-muted")}>
              <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200", cfTestMode ? "translate-x-[18px]" : "translate-x-0.5")} />
            </button>
            <span className="text-xs text-foreground/60">{cfTestMode ? "Sandbox / Test mode" : "Production mode"}</span>
          </div>
        </>)}
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving…" : isUpdate ? "Save Changes" : "Connect " + gw.name}
        </button>
        <button onClick={onCancel} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50">Cancel</button>
      </div>
    </div>
  )
}

function OfflineMethodsSection() {
  const [methods, setMethods] = useState<OfflineMethod[]>(DEFAULT_OFFLINE_METHODS)
  const [addingCustom, setAddingCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load saved methods on mount
  useEffect(() => {
    authFetch("/api/payments/offline-methods")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.methods) && data.methods.length > 0) {
          setMethods(data.methods)
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Auto-save when methods change (debounced)
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(async () => {
      setSaving(true)
      try {
        await authFetch("/api/payments/offline-methods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ methods }),
        })
      } catch { /* silent */ }
      finally { setSaving(false) }
    }, 800)
    return () => clearTimeout(t)
  }, [methods, loaded])

  const enabledMethods = methods.filter(m => m.enabled)
  const disabledMethods = methods.filter(m => !m.enabled)
  const toggle = (id: string) => setMethods(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m))
  const updateDetails = (id: string, details: string) => setMethods(prev => prev.map(m => m.id === id ? { ...m, details } : m))
  const addCustom = () => {
    if (!customLabel.trim()) return
    setMethods(prev => [...prev, { id: `custom_${Date.now()}`, label: customLabel.trim(), details: "", enabled: true }])
    setCustomLabel(""); setAddingCustom(false)
  }
  const removeCustom = (id: string) => setMethods(prev => prev.filter(m => m.id !== id))

  return (
    <div className="space-y-4">
      {/* Auto-save indicator */}
      {saving && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 size={11} className="animate-spin" /> Saving...
        </div>
      )}
      {enabledMethods.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 px-0.5">Active Methods</p>
          <div className="space-y-1.5">
            {enabledMethods.map(method => {
              const Icon = METHOD_ICONS[method.id] || CreditCard
              const isExpanded = expandedId === method.id
              const isCustom = method.id.startsWith("custom_")
              return (
                <div key={method.id} className="rounded-2xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)" }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{method.label}</p>
                      {method.details && <p className="text-xs text-muted-foreground truncate mt-0.5">{method.details}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setExpandedId(isExpanded ? null : method.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isCustom && <button type="button" onClick={() => removeCustom(method.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"><Trash2 size={14} /></button>}
                      <button type="button" onClick={() => toggle(method.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Disable"><X size={14} /></button>
                    </div>
                  </div>
                  <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]", isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="px-4 pb-4 pt-1 border-t border-border/40">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Payment Details (shown on invoice)</label>
                        <textarea value={method.details} onChange={e => updateDetails(method.id, e.target.value)} rows={3}
                          placeholder={METHOD_PLACEHOLDERS[method.id] || "Payment details..."}
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground font-mono placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {disabledMethods.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 px-0.5">Add More</p>
          <div className="grid grid-cols-2 gap-1.5">
            {disabledMethods.map(method => {
              const Icon = METHOD_ICONS[method.id] || CreditCard
              return (
                <button key={method.id} type="button" onClick={() => toggle(method.id)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-150 text-left group">
                  <Icon size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate">{method.label}</span>
                  <Plus size={12} className="ml-auto text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}
      {addingCustom ? (
        <div className="flex gap-2">
          <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCustom(); if (e.key === "Escape") setAddingCustom(false) }} placeholder="e.g. Wise, Venmo, M-Pesa..." autoFocus className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" />
          <button type="button" onClick={addCustom} disabled={!customLabel.trim()} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">Add</button>
          <button type="button" onClick={() => { setAddingCustom(false); setCustomLabel("") }} className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAddingCustom(true)} className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          <Plus size={13} /> Add custom method
        </button>
      )}
    </div>
  )
}

export function PaymentSettings() {
  const user = useUser()
  const [settings, setSettings] = useState<GatewaySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null)
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<Gateway | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState<Gateway | null>(null)
  const [activeTab, setActiveTab] = useState<"gateways" | "offline">("gateways")
  const [rzpKeyId, setRzpKeyId] = useState("")
  const [rzpKeySecret, setRzpKeySecret] = useState("")
  const [rzpAccountName, setRzpAccountName] = useState("")
  const [stripeSecretKey, setStripeSecretKey] = useState("")
  const [cfClientId, setCfClientId] = useState("")
  const [cfClientSecret, setCfClientSecret] = useState("")
  const [cfTestMode, setCfTestMode] = useState(false)

  const resetForm = () => { setRzpKeyId(""); setRzpKeySecret(""); setRzpAccountName(""); setStripeSecretKey(""); setCfClientId(""); setCfClientSecret(""); setCfTestMode(false); setShowSecret(false) }

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/payments/settings")
      if (res.ok) { const data = await res.json(); setSettings(data.settings) }
    } catch { toast.error("Failed to load payment settings") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user) fetchSettings() }, [user, fetchSettings])

  const handleTestWebhook = async (gateway: Gateway) => {
    setTestingWebhook(gateway)
    try {
      const res = await authFetch("/api/payments/test-webhook", { method: "POST", body: JSON.stringify({ gateway }) })
      const data = await res.json()
      if (data.success) toast.success(data.message || `${gateway} webhook is working!`)
      else toast.error(data.error || data.message || "Webhook test failed")
    } catch { toast.error("Failed to test webhook") }
    finally { setTestingWebhook(null) }
  }

  const connectedGateways = settings ? GATEWAYS.filter(g => settings[g.id] != null) : []
  const unconnectedGateways = GATEWAYS.filter(g => !connectedGateways.some(c => c.id === g.id))

  const buildBody = (gateway: Gateway): Record<string, unknown> | null => {
    let body: Record<string, unknown> = { gateway }
    if (gateway === "razorpay") {
      if (!rzpKeyId || !rzpKeySecret) { toast.error("Key ID and Secret are required"); return null }
      body = { ...body, keyId: rzpKeyId, keySecret: rzpKeySecret, accountName: rzpAccountName }
    } else if (gateway === "stripe") {
      if (!stripeSecretKey) { toast.error("Secret Key is required"); return null }
      body = { ...body, secretKey: stripeSecretKey }
    } else if (gateway === "cashfree") {
      if (!cfClientId || !cfClientSecret) { toast.error("Client ID and Secret are required"); return null }
      body = { ...body, clientId: cfClientId, clientSecret: cfClientSecret, testMode: cfTestMode }
    }
    return body
  }

  const handleSave = async () => {
    if (!selectedGateway) return
    const body = buildBody(selectedGateway); if (!body) return
    setSaving(true)
    try {
      const res = await authFetch("/api/payments/settings", { method: "POST", body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Failed to save settings"); return }
      toast.success(selectedGateway.charAt(0).toUpperCase() + selectedGateway.slice(1) + " connected successfully")
      setSelectedGateway(null); resetForm(); await fetchSettings()
    } catch { toast.error("Something went wrong") }
    finally { setSaving(false) }
  }

  const handleUpdate = async () => {
    if (!editingGateway) return
    const body = buildBody(editingGateway); if (!body) return
    setSaving(true)
    try {
      const res = await authFetch("/api/payments/settings", { method: "POST", body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Failed to update settings"); return }
      toast.success(editingGateway.charAt(0).toUpperCase() + editingGateway.slice(1) + " updated successfully")
      setEditingGateway(null); resetForm(); await fetchSettings()
    } catch { toast.error("Something went wrong") }
    finally { setSaving(false) }
  }

  const handleRemove = async (gateway: Gateway) => {
    setRemoving(gateway)
    try {
      const res = await authFetch("/api/payments/settings?gateway=" + gateway, { method: "DELETE" })
      if (res.ok) { toast.success(gateway + " disconnected"); await fetchSettings() }
      else toast.error("Failed to disconnect gateway")
    } catch { toast.error("Something went wrong") }
    finally { setRemoving(null) }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>

  const sharedFormProps = { saving, showSecret, setShowSecret, rzpKeyId, setRzpKeyId, rzpKeySecret, setRzpKeySecret, rzpAccountName, setRzpAccountName, stripeSecretKey, setStripeSecretKey, cfClientId, setCfClientId, cfClientSecret, setCfClientSecret, cfTestMode, setCfTestMode }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 font-sans">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border/50">
        {(["gateways", "offline"] as const).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200", activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {tab === "gateways" ? "Online Gateways" : "Offline Methods"}
          </button>
        ))}
      </div>

      {/* Animated tab content */}
      <div className="relative">
        {/* Online Gateways */}
        <div className={cn(
          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          activeTab === "gateways" ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none absolute inset-0 overflow-hidden"
        )}>
          <div className="space-y-5">
            {connectedGateways.length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 px-0.5">Connected</p>
                <div className="space-y-2">
                  {connectedGateways.map(gw => {
                    const s = settings![gw.id]!
                    const isEditing = editingGateway === gw.id
                    return (
                      <div key={gw.id} className={cn("rounded-2xl border bg-card overflow-hidden transition-all duration-200", isEditing ? "border-primary/50 ring-2 ring-primary/10 shadow-md" : "border-border shadow-sm hover:shadow-md")} style={{ boxShadow: isEditing ? undefined : "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)" }}>
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <GatewayAvatar gw={gw} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{gw.name}</span>
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 size={10} /> Connected</span>
                              {(s as any).testMode && <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Test Mode</span>}
                            </div>
                            <p className="text-xs text-foreground/50 mt-0.5 font-mono truncate">
                              {(s as any).keyIdHint || (s as any).clientIdHint || gw.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => handleTestWebhook(gw.id)} disabled={testingWebhook === gw.id}
                              className="hidden sm:inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-xl font-medium border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50">
                              {testingWebhook === gw.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                              <span className="hidden md:inline ml-1">Test</span>
                            </button>
                            <button onClick={() => { if (isEditing) { setEditingGateway(null); resetForm() } else { setEditingGateway(gw.id); setSelectedGateway(null); resetForm() } }}
                              className={cn("inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-xl font-medium border transition-colors", isEditing ? "bg-muted/60 border-primary/30" : "border-border hover:bg-muted/60")}>
                              <Pencil size={11} /><span className="hidden sm:inline ml-1">{isEditing ? "Cancel" : "Edit"}</span>
                            </button>
                            <button onClick={() => handleRemove(gw.id)} disabled={removing === gw.id}
                              className="p-1.5 rounded-xl text-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">
                              {removing === gw.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            </button>
                          </div>
                        </div>
                        <WebhookPanel
                          gateway={gw.id}
                          webhookUrl={`${typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/${gw.id}/webhook`}
                          webhookConfigured={(s as any).webhookConfigured}
                          webhookRegistered={(s as any).webhookRegistered}
                        />
                        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]", isEditing ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                          <div className="min-h-0 overflow-hidden">
                            <CredentialForm {...sharedFormProps} gw={gw} onSave={handleUpdate} onCancel={() => { setEditingGateway(null); resetForm() }} isUpdate />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
            {unconnectedGateways.length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 px-0.5">{connectedGateways.length > 0 ? "Add Another Gateway" : "Connect a Gateway"}</p>
                <div className="space-y-2">
                  {unconnectedGateways.map(gw => {
                    const isSelected = selectedGateway === gw.id
                    return (
                      <div key={gw.id} className={cn("rounded-2xl border bg-card overflow-hidden transition-all duration-200", isSelected ? "border-primary ring-2 ring-primary/15 shadow-md" : "border-border shadow-sm hover:shadow-md")} style={{ boxShadow: isSelected ? undefined : "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px -4px rgba(0,0,0,0.08)" }}>
                        <button type="button" onClick={() => { if (isSelected) { setSelectedGateway(null); resetForm() } else { setSelectedGateway(gw.id); setEditingGateway(null); resetForm() } }}
                          className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-muted/20 transition-colors">
                          <GatewayAvatar gw={gw} size={44} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold text-foreground leading-tight">{gw.name}</p>
                            <p className="text-xs text-foreground/60 mt-0.5">{gw.description}</p>
                            <p className="text-[11px] text-foreground/40 mt-0.5 font-medium">{gw.countries}</p>
                          </div>
                          {isSelected ? <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg shrink-0">Selected</span> : <Plus size={18} className="text-muted-foreground/40 shrink-0" />}
                        </button>
                        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]", isSelected ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                          <div className="min-h-0 overflow-hidden">
                            <CredentialForm {...sharedFormProps} gw={gw} onSave={handleSave} onCancel={() => { setSelectedGateway(null); resetForm() }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-foreground/40 select-none">
              <Lock size={11} className="text-emerald-500 shrink-0" />
              <span>AES-256 encrypted · Keys never sent to browser</span>
            </div>
          </div>
        </div>

        {/* Offline Methods */}
        <div className={cn(
          "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          activeTab === "offline" ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none absolute inset-0 overflow-hidden"
        )}>
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 px-4 py-3">
              <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                These methods appear in the <strong>Payment Method</strong> dropdown in the document editor and are printed on your invoices. Add bank details so clients know how to pay you.
              </p>
            </div>
            <OfflineMethodsSection />
          </div>
        </div>
      </div>
    </div>
  )
}
