"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  type ProposalFormData,
  type TCClause,
  getDefaultTCClauses,
  validateStep,
  PROPOSAL_SERVICE_CATEGORIES,
  CLIENT_INDUSTRIES,
} from "@/lib/proposal-types"
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Plus, Trash2, Edit2 } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

function genId() { return Math.random().toString(36).slice(2, 8) }

interface StepReviewProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground min-w-[120px] shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  )
}

/**
 * Step 8 — Review & Generate
 * Shows a summary of all collected data, T&C clauses editor, validation checklist.
 * Generate button is blocked until all validations pass.
 */
export function StepReview({ form, onChange }: StepReviewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basics: true,
    client: true,
    pricing: false,
    kpis: false,
    tc: false,
  })

  // Auto-populate T&C clauses if empty
  useEffect(() => {
    if (form.tcClauses.length === 0) {
      onChange({ tcClauses: getDefaultTCClauses(form) })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function updateClause(id: string, updates: Partial<TCClause>) {
    onChange({ tcClauses: form.tcClauses.map(c => c.id === id ? { ...c, ...updates } : c) })
  }

  function addClause() {
    onChange({
      tcClauses: [
        ...form.tcClauses,
        { id: genId(), label: "Custom Clause", text: "", isCustom: true },
      ],
    })
  }

  function removeClause(id: string) {
    onChange({ tcClauses: form.tcClauses.filter(c => c.id !== id) })
  }

  // Run validation for all steps
  const allErrors: { step: number; label: string; errors: string[] }[] = []
  for (let s = 1; s <= 7; s++) {
    const result = validateStep(s, form)
    if (!result.isValid) {
      const stepLabel = ["", "Basics", "Client", "Scope", "Pricing", "KPIs", "Timeline", "Agency"][s]
      allErrors.push({ step: s, label: stepLabel, errors: result.errors })
    }
  }

  const isValid = allErrors.length === 0

  const catLabel = PROPOSAL_SERVICE_CATEGORIES.find(c => c.value === form.serviceCategory)?.label || form.serviceCategory
  const industryLabel = CLIENT_INDUSTRIES.find(i => i.value === form.clientIndustry)?.label || form.clientIndustry
  const currencySymbol = form.currency === "INR" ? "₹" : form.currency

  function getPricePreview() {
    if (form.pricingModel === "tiered") {
      const valid = form.tiers.filter(t => t.name && t.monthlyRate > 0)
      if (valid.length === 0) return "—"
      return valid.map(t => `${t.name}: ${currencySymbol}${t.monthlyRate.toLocaleString("en-IN")}/mo`).join(" · ")
    }
    const total = form.lineItems.reduce((s, i) => s + i.quantity * i.rate, 0)
    return total > 0 ? `${currencySymbol}${total.toLocaleString("en-IN")}` : "—"
  }

  return (
    <div className="space-y-4">
      {/* Validation checklist */}
      <div className={cn(
        "rounded-xl p-4 space-y-2",
        isValid ? "bg-emerald-50 border border-emerald-200" : "bg-destructive/5 border border-destructive/20"
      )}>
        <div className="flex items-center gap-2">
          {isValid
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            : <XCircle className="w-5 h-5 text-destructive" />
          }
          <p className="text-sm font-medium">
            {isValid ? "All checks passed — ready to generate" : "Fix the following before generating"}
          </p>
        </div>

        {allErrors.length > 0 && (
          <div className="space-y-1.5 mt-2">
            {allErrors.map(({ step, label, errors }) => (
              <div key={step} className="space-y-0.5">
                <p className="text-xs font-semibold text-destructive">{label}</p>
                {errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80 pl-3">• {e}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary sections */}
      <div className="space-y-2">
        {/* Proposal basics */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("basics")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 text-sm font-medium"
          >
            Proposal Basics
            {expandedSections.basics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.basics && (
            <div className="px-4 py-3">
              <SummaryRow label="Title" value={form.title} />
              <SummaryRow label="Number" value={form.proposalNumber} />
              <SummaryRow label="Category" value={catLabel} />
              <SummaryRow label="Issue Date" value={form.issueDate} />
              <SummaryRow label="Valid Until" value={form.validUntilDate} />
              <SummaryRow label="Currency" value={form.currency} />
            </div>
          )}
        </div>

        {/* Client details */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("client")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 text-sm font-medium"
          >
            Client Details
            {expandedSections.client ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.client && (
            <div className="px-4 py-3">
              <SummaryRow label="Business" value={form.clientBusinessName} />
              <SummaryRow label="Contact" value={form.clientContactName} />
              <SummaryRow label="Email" value={form.clientEmail} />
              <SummaryRow label="Industry" value={industryLabel} />
              <SummaryRow label="Goal" value={(form.clientPrimaryGoal || "").replace("_", " ")} />
              <SummaryRow label="Digital Presence" value={form.clientDigitalPresence || ""} />
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("pricing")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 text-sm font-medium"
          >
            Pricing
            {expandedSections.pricing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.pricing && (
            <div className="px-4 py-3">
              <SummaryRow label="Model" value={form.pricingModel} />
              <SummaryRow label="Investment" value={getPricePreview()} />
              <SummaryRow label="Advance" value={`${form.advancePaymentPercent}%`} />
              <SummaryRow label="Payment Method" value={form.paymentMethod} />
              <SummaryRow label="Tax" value={form.taxApplicable ? `${form.taxRate}% applicable` : "Not applicable"} />
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("kpis")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 text-sm font-medium"
          >
            KPIs ({form.kpis.length})
            {expandedSections.kpis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.kpis && (
            <div className="px-4 py-3">
              {form.kpis.map(kpi => (
                <SummaryRow key={kpi.id} label={kpi.label} value={kpi.target} />
              ))}
            </div>
          )}
        </div>

        {/* T&C Clauses */}
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("tc")}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 text-sm font-medium"
          >
            Terms & Conditions ({form.tcClauses.length} clauses)
            {expandedSections.tc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedSections.tc && (
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Edit any clause or add custom clauses. These are embedded in the proposal PDF.
              </p>
              {form.tcClauses.map(clause => (
                <div key={clause.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={clause.label}
                      onChange={e => updateClause(clause.id, { label: e.target.value })}
                      className="h-7 text-sm font-medium flex-1"
                    />
                    {clause.isCustom && (
                      <button
                        type="button"
                        onClick={() => removeClause(clause.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={clause.text}
                    onChange={e => updateClause(clause.id, { text: e.target.value })}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addClause}
                className="text-xs h-7 w-full"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Custom Clause
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Final message */}
      {isValid && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-center">
          <p className="text-sm text-primary font-medium">
            Click "Generate Proposal" below to create your professional proposal.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The AI will generate 6 sections individually. This takes about 30–60 seconds.
          </p>
        </div>
      )}
    </div>
  )
}
