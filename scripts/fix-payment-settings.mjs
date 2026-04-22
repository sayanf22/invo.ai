import { readFileSync, writeFileSync } from 'fs'

let c = readFileSync('components/payment-settings.tsx', 'utf8')

// Replace WebhookPanel with collapsible version
const oldFn = /function WebhookPanel\(\{[^}]+\}[^{]+\{[\s\S]+?\n\}\n/
const newFn = `function WebhookPanel({ gateway, webhookSecret }: { gateway: Gateway; webhookSecret?: string }) {
  const [open, setOpen] = useState(false)
  const appUrl = typeof window !== "undefined" ? window.location.origin : ""
  const webhookUrl = appUrl + (gateway === "razorpay" ? "/api/razorpay/webhook" : "/api/cashfree/webhook")
  const gwName = gateway === "razorpay" ? "Razorpay" : "Cashfree"
  return (
    <div className="mx-4 mb-3 rounded-xl border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground/70">Configure Webhook</span>
          <span className="text-[10px] text-foreground/40 font-normal">Required for payment status updates</span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={"/integrations/payments/" + gateway}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Guide <ExternalLink size={10} />
          </a>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={"text-foreground/40 transition-transform duration-200 " + (open ? "rotate-180" : "")}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      <div className={"grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] " + (open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="p-3 space-y-2.5 border-t border-border/40 bg-background/50">
            <p className="text-xs text-foreground/55">
              Copy these into your {gwName} Dashboard under Settings &rarr; Webhooks
            </p>
            <CopyField label="Webhook URL" value={webhookUrl} />
            {webhookSecret && <CopyField label="Webhook Secret" value={webhookSecret} />}
          </div>
        </div>
      </div>
    </div>
  )
}
`

const match = c.match(oldFn)
if (match) {
  c = c.replace(match[0], newFn)
  console.log('WebhookPanel replaced')
} else {
  console.log('WebhookPanel pattern not found, trying line-based replacement')
  // Find by function signature
  const start = c.indexOf('function WebhookPanel(')
  if (start === -1) { console.log('ERROR: WebhookPanel not found'); process.exit(1) }
  // Find the closing brace by counting braces
  let depth = 0, i = start, inFn = false
  while (i < c.length) {
    if (c[i] === '{') { depth++; inFn = true }
    if (c[i] === '}') { depth-- }
    if (inFn && depth === 0) { i++; break }
    i++
  }
  // Skip trailing newline
  if (c[i] === '\n') i++
  c = c.slice(0, start) + newFn + c.slice(i)
  console.log('WebhookPanel replaced via brace counting')
}

// Remove the // @ts-reset comment if present (no longer needed)
c = c.replace('// @ts-reset\n', '')

writeFileSync('components/payment-settings.tsx', c, 'utf8')
console.log('Done. Size:', c.length, 'chars')
