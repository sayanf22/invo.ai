import { writeFileSync } from 'fs'

const code = `"use client"

import { useState, useEffect, useCallback } from "react"
import { authFetch } from "@/lib/auth-fetch"
import { useUser } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ExternalLink, Trash2, Loader2, Eye, EyeOff, CheckCircle2, Lock, Pencil, Copy, Check, ChevronDown } from "lucide-react"

type Gateway = "razorpay" | "stripe" | "cashfree"

interface GatewaySettings {
  razorpay?: { keyId: string; accountName?: string; testMode: boolean; webhookSecret?: string; webhookRegistered: boolean } | null
  stripe?: { testMode: boolean; webhookRegistered: boolean } | null
  cashfree?: { clientId: string; testMode: boolean } | null
  updatedAt?: string
}

interface GatewayDef {
  id: Gateway
  name: string
  description: string
  countries: string
  accentBg: string
  Icon: React.FC<{ size?: number }>
  apiKeyUrl: string
  webhookPath: string
}

function RazorpayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.153 0H2.847A2.847 2.847 0 0 0 0 2.847v18.306A2.847 2.847 0 0 0 2.847 24h18.306A2.847 2.847 0 0 0 24 21.153V2.847A2.847 2.847 0 0 0 21.153 0zM9.927 16.17l-1.496-3.99H6.44v3.99H4.5V7.83h4.388c1.98 0 3.195 1.08 3.195 2.7 0 1.26-.72 2.16-1.8 2.52l1.71 4.12H9.927zm5.58 0l-3.51-8.34h2.07l2.43 6.03 2.43-6.03h2.07l-3.51 8.34h-1.98z"/>
    </svg>
  )
}

function StripeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  )
}

function CashfreeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.75 15.25h-1.5v-4.5H9v-1.5h2.25V9h1.5v2.25H15v1.5h-2.25v4.5z"/>
    </svg>
  )
}

const GATEWAYS: GatewayDef[] = [
  { id: "razorpay", name: "Razorpay", description: "UPI, cards, netbanking, wallets", countries: "India", accentBg: "#072654", Icon: RazorpayIcon, apiKeyUrl: "https://dashboard.razorpay.com/app/keys", webhookPath: "/integrations/payments/razorpay" },
  { id: "stripe", name: "Stripe", description: "Cards, wallets, 135+ currencies", countries: "Global", accentBg: "#635BFF", Icon: StripeIcon, apiKeyUrl: "https://dashboard.stripe.com/apikeys", webhookPath: "/integrations/payments/stripe" },
  { id: "cashfree", name: "Cashfree", description: "Fast settlements, payment links", countries: "India", accentBg: "#00A550", Icon: CashfreeIcon, apiKeyUrl: "https://merchant.cashfree.com/merchants/developer/api-keys", webhookPath: "/integrations/payments/cashfree" },
]

function GatewayAvatar({ gw, size = 44 }: { gw: GatewayDef; size?: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: size, height: size, background: gw.accentBg }}>
      <gw.Icon size={Math.round(size * 0.5)} />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[13px] font-medium text-foreground/70 mb-1.5 leading-none">{children}</label>
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={cn("w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground font-normal",
        "placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all duration-150")} />
  )
}

function SecretInput({ value, onChange, placeholder, show, onToggle }: { value: string; onChange: (v: string) => void; placeholder?: string; show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <TextInput value={value} onChange={onChange} placeholder={placeholder} type={show ? "text" : "password"} />
      <button type="button" onClick={onToggle} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors">
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/50 mb-1.5">{label}</label>
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30">
        <code className="flex-1 text-xs font-mono text-foreground/80 truncate">{value}</code>
        <button type="button" onClick={copy} className="shrink-0 p-1 rounded-lg text-foreground/40 hover:text-foreground hover:bg-muted transition-colors">
          {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}

function WebhookPanel({ gateway, webhookSecret }: { gateway: Gateway; webhookSecret?: string }) {
  const [open, setOpen] = useState(false)
  const appUrl = typeof window !== "undefined" ? window.location.origin : ""
  const webhookUrl = appUrl + (gateway === "razorpay" ? "/api/razorpay/webhook" : "/api/cashfree/webhook")
  const gwName = gateway === "razorpay" ? "Razorpay" : "Cashfree"
  return (
    <div className="mx-4 mb-3 rounded-xl border border-border/50 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground/70">Configure Webhook</span>
          <span className="text-[10px] text-foreground/40">Required for payment status updates</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={"/integrations/payments/" + gateway} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
            Guide <ExternalLink size={10} />
          </a>
          <ChevronDown size={14} className={cn("text-foreground/40 transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="p-3 space-y-2.5 border-t border-border/40 bg-background/50">
            <p className="text-xs text-foreground/55">Copy these into your {gwName} Dashboard under Settings &rarr; Webhooks</p>
            <CopyField label="Webhook URL" value={webhookUrl} />
            {webhookSecret && <CopyField label="Webhook Secret" value={webhookSecret} />}
          </div>
        </div>
      </div>
    </div>
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

function CredentialForm({ gw, isUpdate, saving, showSecret, setShowSecret,
  rzpKeyId, setRzpKeyId, rzpKeySecret, setRzpKeySecret, rzpAccountName, setRzpAccountName,
  stripeSecretKey, setStripeSecretKey,
  cfClientId, setCfClientId, cfClientSecret, setCfClientSecret, cfTestMode, setCfTestMode,
  onSave, onCancel }: CredFormProps) {
  return (
    <div className="px-4 pb-5 pt-4 space-y-4 border-t border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">{isUpdate ? "Update credentials" : "Enter credentials"}</span>
        <a href={gw.apiKeyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Get API Keys <ExternalLink size={11} />
        </a>
      </div>
      <div className="space-y-3">
        {gw.id === "razorpay" && (<>
          <div><FieldLabel>Key ID</FieldLabel><TextInput value={rzpKeyId} onChange={setRzpKeyId} placeholder="rzp_live_xxxxxxxxxxxx" /></div>
          <div><FieldLabel>Key Secret</FieldLabel><SecretInput value={rzpKeySecret} onChange={setRzpKeySecret} placeholder={isUpdate ? "Re-enter to update" : "Your Razorpay Key Secret"} show={showSecret} onToggle={() => setShowSecret(!showSecret)} /></div>
          <div><FieldLabel>Account / Business Name (optional)</FieldLabel><TextInput value={rzpAccountName} onChange={setRzpAccountName} placeholder="Acme Corp" /></div>
        </>)}
        {gw.id === "stripe" && (
          <div><FieldLabel>Secret Key</FieldLabel><SecretInput value={stripeSecretKey} onChange={setStripeSecretKey} placeholder={isUpdate ? "Re-enter to update" : "sk_live_xxxxxxxxxxxx"} show={showSecret} onToggle={() => setShowSecret(!showSecret)} /></div>
        )}
        {gw.id === "cashfree" && (<>
          <div><FieldLabel>Client ID (App ID)</FieldLabel><TextInput value={cfClientId} onChange={setCfClientId} placeholder="Your Cashfree App ID" /></div>
          <div><FieldLabel>Client Secret</FieldLabel><SecretInput value={cfClientSecret} onChange={setCfClientSecret} placeholder={isUpdate ? "Re-enter to update" : "Your Cashfree Secret Key"} show={showSecret} onToggle={() => setShowSecret(!showSecret)} /></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setCfTestMode(!cfTestMode)}
              className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0", cfTestMode ? "bg-amber-400" : "bg-muted")}>
              <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200", cfTestMode ? "translate-x-[18px]" : "translate-x-0.5")} />
            </button>
            <span className="text-xs text-foreground/65">{cfTestMode ? "Sandbox / Test mode" : "Production mode"}</span>
          </div>
        </>)}
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving}
          className={cn("flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold",
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 shadow-sm",
            "disabled:opacity-60 disabled:cursor-not-allowed")}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : isUpdate ? "Save Changes" : "Connect " + gw.name}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-foreground/65 hover:text-foreground hover:bg-muted/60 transition-colors duration-150 disabled:opacity-50">
          Cancel
        </button>
      </div>
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
  const [rzpKeyId, setRzpKeyId] = useState("")
  const [rzpKeySecret, setRzpKeySecret] = useState("")
  const [rzpAccountName, setRzpAccountName] = useState("")
  const [stripeSecretKey, setStripeSecretKey] = useState("")
  const [cfClientId, setCfClientId] = useState("")
  const [cfClientSecret, setCfClientSecret] = useState("")
  const [cfTestMode, setCfTestMode] = useState(false)

  const resetForm = () => {
    setRzpKeyId(""); setRzpKeySecret(""); setRzpAccountName("")
    setStripeSecretKey(""); setCfClientId(""); setCfClientSecret(""); setCfTestMode(false); setShowSecret(false)
  }

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/payments/settings")
      if (res.ok) { const data = await res.json(); setSettings(data.settings) }
    } catch { toast.error("Failed to load payment settings") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user) fetchSettings() }, [user, fetchSettings])

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
    const body = buildBody(selectedGateway)
    if (!body) return
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
    const body = buildBody(editingGateway)
    if (!body) return
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

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-foreground/40" /></div>

  const sharedFormProps = {
    saving, showSecret, setShowSecret,
    rzpKeyId, setRzpKeyId, rzpKeySecret, setRzpKeySecret, rzpAccountName, setRzpAccountName,
    stripeSecretKey, setStripeSecretKey,
    cfClientId, setCfClientId, cfClientSecret, setCfClientSecret, cfTestMode, setCfTestMode,
  }

  return (
    <div className="space-y-8 max-w-2xl font-sans">
      {connectedGateways.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 px-0.5">Connected</p>
          <div className="space-y-2">
            {connectedGateways.map(gw => {
              const s = settings![gw.id]!
              const isEditing = editingGateway === gw.id
              return (
                <div key={gw.id} className={cn("rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200", isEditing ? "border-primary/50 ring-2 ring-primary/10" : "border-border")}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <GatewayAvatar gw={gw} size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{gw.name}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle2 size={10} />Connected
                        </span>
                        {(s as any).testMode && <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Test Mode</span>}
                      </div>
                      <p className="text-xs text-foreground/60 mt-0.5">{gw.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { if (isEditing) { setEditingGateway(null); resetForm() } else { setEditingGateway(gw.id); setSelectedGateway(null); resetForm() } }}
                        className={cn("inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium border border-border hover:bg-muted/60 transition-colors duration-150", isEditing && "bg-muted/60 border-primary/30")}>
                        <Pencil size={11} />Update Keys
                      </button>
                      <button onClick={() => handleRemove(gw.id)} disabled={removing === gw.id}
                        className="p-1.5 rounded-xl text-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors duration-150 disabled:opacity-50" title="Disconnect">
                        {removing === gw.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                  {(gw.id === "razorpay" || gw.id === "cashfree") && (
                    <WebhookPanel gateway={gw.id} webhookSecret={gw.id === "razorpay" ? (s as any).webhookSecret : undefined} />
                  )}
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/50 px-0.5">
            {connectedGateways.length > 0 ? "Add Another Gateway" : "Connect a Gateway"}
          </p>
          <div className="space-y-2">
            {unconnectedGateways.map(gw => {
              const isSelected = selectedGateway === gw.id
              return (
                <div key={gw.id} className={cn("rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200", isSelected ? "border-primary ring-2 ring-primary/15" : "border-border")}>
                  <button type="button"
                    onClick={() => { if (isSelected) { setSelectedGateway(null); resetForm() } else { setSelectedGateway(gw.id); setEditingGateway(null); resetForm() } }}
                    className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/20 transition-colors duration-150">
                    <GatewayAvatar gw={gw} size={48} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-foreground leading-tight">{gw.name}</p>
                      <p className="text-sm text-foreground/65 mt-0.5">{gw.description}</p>
                      <p className="text-xs text-foreground/50 mt-1 font-medium">{gw.countries}</p>
                    </div>
                    {isSelected && <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg shrink-0">Selected</span>}
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

      <div className="flex items-center justify-center gap-2 py-2 text-xs text-foreground/45 select-none">
        <Lock size={11} className="text-emerald-500 shrink-0" />
        <span>AES-256 encrypted \u00b7 Keys never logged</span>
      </div>
    </div>
  )
}
`

writeFileSync('components/payment-settings.tsx', code, 'utf8')
console.log('Written:', code.split('\n').length, 'lines')
