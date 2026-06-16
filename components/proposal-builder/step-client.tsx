"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CLIENT_INDUSTRIES, type ProposalFormData } from "@/lib/proposal-types"
import { useState, useEffect } from "react"
import { useSupabase } from "@/components/auth-provider"
import { Search, User, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepClientProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
}

interface SavedClient {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

/**
 * Step 2 — Client Details
 * Collects: client business name, contact, email, industry, goal, digital presence
 * Auto-fills from saved client records.
 */
export function StepClient({ form, onChange }: StepClientProps) {
  const supabase = useSupabase()
  const [clients, setClients] = useState<SavedClient[]>([])
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  // Load saved clients
  useEffect(() => {
    supabase.from("clients").select("id, name, email, phone, address").limit(50)
      .then(({ data }) => { if (data) setClients(data) })
  }, [supabase])

  const filtered = query.trim()
    ? clients.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : clients.slice(0, 8)

  function selectClient(c: SavedClient) {
    onChange({
      savedClientId: c.id,
      clientBusinessName: c.name,
      clientEmail: c.email || "",
      clientPhone: c.phone || "",
      clientAddress: c.address || "",
    })
    setQuery(c.name)
    setShowDropdown(false)
  }

  function clearClient() {
    onChange({ savedClientId: undefined })
    setQuery("")
  }

  return (
    <div className="space-y-5">
      {/* Client search — auto-fill from saved records */}
      {clients.length > 0 && (
        <div className="space-y-1.5 relative">
          <Label>Quick Fill from Client Book</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search saved clients…"
              className="pl-9"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            />
            {form.savedClientId && (
              <button
                onClick={clearClient}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {showDropdown && filtered.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              {filtered.map(c => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent flex items-center gap-2 text-sm"
                  onMouseDown={() => selectClient(c)}
                >
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{c.name}</span>
                  {c.email && <span className="text-muted-foreground text-xs ml-auto">{c.email}</span>}
                </button>
              ))}
            </div>
          )}
          {form.savedClientId && (
            <p className="text-xs text-emerald-600 font-medium">✓ Auto-filled from client record</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Business Name */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="clientBusinessName">
            Client Business Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="clientBusinessName"
            placeholder="e.g. Nimai Hyundai"
            value={form.clientBusinessName}
            onChange={e => onChange({ clientBusinessName: e.target.value })}
          />
        </div>

        {/* Contact Name */}
        <div className="space-y-1.5">
          <Label htmlFor="clientContactName">Contact Person</Label>
          <Input
            id="clientContactName"
            placeholder="e.g. Rahul Sharma"
            value={form.clientContactName}
            onChange={e => onChange({ clientContactName: e.target.value })}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="clientEmail">
            Client Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="clientEmail"
            type="email"
            placeholder="client@business.com"
            value={form.clientEmail}
            onChange={e => onChange({ clientEmail: e.target.value })}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="clientPhone">Phone</Label>
          <Input
            id="clientPhone"
            placeholder="+91 98765 43210"
            value={form.clientPhone}
            onChange={e => onChange({ clientPhone: e.target.value })}
          />
        </div>

        {/* Industry */}
        <div className="space-y-1.5">
          <Label htmlFor="clientIndustry">
            Industry <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.clientIndustry || ""}
            onValueChange={v => onChange({ clientIndustry: v as ProposalFormData["clientIndustry"] })}
          >
            <SelectTrigger id="clientIndustry">
              <SelectValue placeholder="Select industry…" />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_INDUSTRIES.map(i => (
                <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Address */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="clientAddress">Client Address</Label>
          <Textarea
            id="clientAddress"
            placeholder="123 Business Street, City, State"
            value={form.clientAddress}
            onChange={e => onChange({ clientAddress: e.target.value })}
            rows={2}
          />
        </div>
      </div>

      {/* Digital Presence */}
      <div className="space-y-2">
        <Label>Current Digital Presence</Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "none", label: "None", desc: "Not online yet" },
            { value: "basic", label: "Basic", desc: "Website/1-2 channels" },
            { value: "active", label: "Active", desc: "Multiple channels" },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ clientDigitalPresence: opt.value as ProposalFormData["clientDigitalPresence"] })}
              className={cn(
                "flex flex-col gap-0.5 p-3 rounded-lg border-2 cursor-pointer transition-colors text-left",
                form.clientDigitalPresence === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Goal */}
      <div className="space-y-2">
        <Label>
          Primary Goal <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: "brand_awareness", label: "Brand Awareness" },
            { value: "lead_generation", label: "Lead Generation" },
            { value: "sales", label: "Drive Sales" },
            { value: "community_building", label: "Community Building" },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ clientPrimaryGoal: opt.value as ProposalFormData["clientPrimaryGoal"] })}
              className={cn(
                "flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors",
                form.clientPrimaryGoal === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              )}
            >
              <span className="text-sm font-medium text-center">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
