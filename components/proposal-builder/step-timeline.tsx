"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { type ProposalFormData, type ProposalMilestone, getSuggestedMilestones } from "@/lib/proposal-types"
import { Plus, Trash2, Calendar, Zap } from "lucide-react"

function genId() { return Math.random().toString(36).slice(2, 8) }

interface StepTimelineProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
}

/**
 * Step 6 — Timeline
 * Collects project start date and milestone table.
 * Auto-suggests milestones based on service category.
 */
export function StepTimeline({ form, onChange }: StepTimelineProps) {
  const hasMilestones = form.milestones.length > 0
  const suggestions = getSuggestedMilestones(form.serviceCategory)

  function loadSuggestions() {
    onChange({ milestones: suggestions.map(m => ({ ...m, id: genId() })) })
  }

  function addMilestone() {
    onChange({
      milestones: [
        ...form.milestones,
        { id: genId(), phase: "", description: "", duration: "" },
      ],
    })
  }

  function updateMilestone(id: string, updates: Partial<ProposalMilestone>) {
    onChange({ milestones: form.milestones.map(m => m.id === id ? { ...m, ...updates } : m) })
  }

  function removeMilestone(id: string) {
    onChange({ milestones: form.milestones.filter(m => m.id !== id) })
  }

  return (
    <div className="space-y-5">
      {/* Project Start Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="projectStartDate">
            Project Start Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="projectStartDate"
            type="date"
            value={form.projectStartDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={e => onChange({ projectStartDate: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">When work commences after advance payment</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="durationMonths">Engagement Duration</Label>
          <div className="flex items-center gap-2">
            <Input
              id="durationMonths"
              type="number"
              min={1}
              max={24}
              value={form.durationMonths}
              onChange={e => onChange({ durationMonths: parseInt(e.target.value) || 3 })}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">months</span>
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Project Milestones</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Key phases and delivery dates
            </p>
          </div>
          <div className="flex items-center gap-2">
            {form.serviceCategory && !hasMilestones && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadSuggestions}
                className="text-xs h-7 gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                Auto-suggest
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addMilestone}
              className="text-xs h-7"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>

        {!hasMilestones ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No milestones added yet.</p>
            {form.serviceCategory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadSuggestions}
                className="mt-2 text-primary text-xs"
              >
                <Zap className="w-3.5 h-3.5 mr-1" />
                Auto-suggest for {form.serviceCategory.replace("_", " ")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_100px_32px] gap-2 text-xs font-medium text-muted-foreground px-0.5">
              <span>Phase</span>
              <span>Description</span>
              <span>Duration</span>
              <span />
            </div>

            {form.milestones.map((m, i) => (
              <div key={m.id} className="grid grid-cols-[1fr_1fr_100px_32px] gap-2 items-start">
                <Input
                  placeholder={`Phase ${i + 1}`}
                  value={m.phase}
                  onChange={e => updateMilestone(m.id, { phase: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="What happens in this phase"
                  value={m.description}
                  onChange={e => updateMilestone(m.id, { description: e.target.value })}
                  className="text-sm"
                />
                <Input
                  placeholder="e.g. 2 weeks"
                  value={m.duration}
                  onChange={e => updateMilestone(m.id, { duration: e.target.value })}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMilestone(m.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive mt-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
