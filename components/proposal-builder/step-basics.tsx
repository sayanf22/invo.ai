"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROPOSAL_SERVICE_CATEGORIES, type ProposalFormData } from "@/lib/proposal-types"
import { Lightbulb } from "lucide-react"
import { useEffect } from "react"

interface StepBasicsProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
}

/**
 * Step 1 — Proposal Basics
 * Collects: title, proposal number, dates, service category
 */
export function StepBasics({ form, onChange }: StepBasicsProps) {
  // Auto-suggest title when service category changes
  useEffect(() => {
    if (form.serviceCategory && !form.title) {
      const cat = PROPOSAL_SERVICE_CATEGORIES.find(c => c.value === form.serviceCategory)
      if (cat) {
        onChange({ title: `${cat.label} Proposal` })
      }
    }
  }, [form.serviceCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Service Category — first, so title can auto-suggest */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="serviceCategory">
            Service Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.serviceCategory || ""}
            onValueChange={(v) => onChange({ serviceCategory: v as ProposalFormData["serviceCategory"] })}
          >
            <SelectTrigger id="serviceCategory">
              <SelectValue placeholder="Select service type…" />
            </SelectTrigger>
            <SelectContent>
              {PROPOSAL_SERVICE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Proposal Title */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="title">
            Proposal Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. Social Media Management Proposal"
            value={form.title}
            onChange={e => onChange({ title: e.target.value })}
          />
          {form.serviceCategory && !form.title && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Title auto-suggested based on service category
            </p>
          )}
        </div>

        {/* Proposal Number */}
        <div className="space-y-1.5">
          <Label htmlFor="proposalNumber">
            Proposal Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="proposalNumber"
            placeholder="PROP-2026-06-001"
            value={form.proposalNumber}
            onChange={e => onChange({ proposalNumber: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Auto-generated — edit if needed</p>
        </div>

        {/* Currency */}
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Select
            value={form.currency}
            onValueChange={(v) => onChange({ currency: v })}
          >
            <SelectTrigger id="currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["INR", "USD", "GBP", "EUR", "CAD", "AUD", "SGD", "AED"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Issue Date */}
        <div className="space-y-1.5">
          <Label htmlFor="issueDate">
            Issue Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="issueDate"
            type="date"
            value={form.issueDate}
            onChange={e => onChange({ issueDate: e.target.value })}
          />
        </div>

        {/* Valid Until Date */}
        <div className="space-y-1.5">
          <Label htmlFor="validUntilDate">
            Valid Until <span className="text-destructive">*</span>
          </Label>
          <Input
            id="validUntilDate"
            type="date"
            value={form.validUntilDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={e => onChange({ validUntilDate: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Default: 30 days from today</p>
        </div>
      </div>
    </div>
  )
}
