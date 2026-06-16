"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { type ProposalFormData, type ProposalKPI, getSuggestedKPIs } from "@/lib/proposal-types"
import { Plus, Trash2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

function genId() { return Math.random().toString(36).slice(2, 8) }

interface StepKPIsProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
}

/**
 * Step 5 — Goals and KPIs
 * At least one KPI is required. Suggests KPIs based on service category + goal.
 */
export function StepKPIs({ form, onChange }: StepKPIsProps) {
  const suggestions = getSuggestedKPIs(form.serviceCategory, form.clientPrimaryGoal || "")
  const usedLabels = new Set(form.kpis.map(k => k.label))
  const unusedSuggestions = suggestions.filter(s => !usedLabels.has(s.label))

  function addKPI() {
    onChange({ kpis: [...form.kpis, { id: genId(), label: "", target: "" }] })
  }

  function addSuggested(kpi: ProposalKPI) {
    onChange({ kpis: [...form.kpis, { ...kpi, id: genId() }] })
  }

  function addAllSuggestions() {
    const toAdd = unusedSuggestions.map(s => ({ ...s, id: genId() }))
    onChange({ kpis: [...form.kpis, ...toAdd] })
  }

  function updateKPI(id: string, updates: Partial<ProposalKPI>) {
    onChange({ kpis: form.kpis.map(k => k.id === id ? { ...k, ...updates } : k) })
  }

  function removeKPI(id: string) {
    onChange({ kpis: form.kpis.filter(k => k.id !== id) })
  }

  return (
    <div className="space-y-5">
      {/* Suggestions */}
      {unusedSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <Label className="text-sm">Suggested KPIs</Label>
              <span className="text-xs text-muted-foreground">
                based on {form.serviceCategory?.replace("_", " ")} + {form.clientPrimaryGoal?.replace("_", " ")}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addAllSuggestions}
              className="text-xs h-7 text-primary"
            >
              Add all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {unusedSuggestions.map(kpi => (
              <button
                key={kpi.id}
                type="button"
                onClick={() => addSuggested(kpi)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-muted hover:bg-accent border border-border rounded-full transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span className="font-medium">{kpi.label}</span>
                <span className="text-muted-foreground">— {kpi.target}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>
              KPIs <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">At least one is required. Be specific with numbers.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={addKPI} className="text-xs h-7">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add KPI
          </Button>
        </div>

        {form.kpis.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground">
            Add at least one KPI to continue.
            <br />
            <span className="text-xs">Use the suggestions above or click "Add KPI" to add manually.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_32px] gap-2 text-xs font-medium text-muted-foreground px-0.5">
              <span>KPI Label</span>
              <span>Target</span>
              <span />
            </div>

            {form.kpis.map((kpi, i) => (
              <div key={kpi.id} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                <Input
                  placeholder="e.g. Follower Growth"
                  value={kpi.label}
                  onChange={e => updateKPI(kpi.id, { label: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="e.g. 500 new followers/month"
                  value={kpi.target}
                  onChange={e => updateKPI(kpi.id, { target: e.target.value })}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeKPI(kpi.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {form.kpis.length > 0 && (
        <div className="bg-muted/40 rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
          {form.kpis
            .filter(k => k.label && k.target)
            .map((kpi, i) => (
              <p key={kpi.id} className="text-sm">
                <span className="font-medium">• {kpi.label}:</span>{" "}
                <span className="text-muted-foreground">{kpi.target}</span>
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
