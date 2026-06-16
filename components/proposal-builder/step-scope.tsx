"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SOCIAL_PLATFORMS, type ProposalFormData, type SocialPlatform } from "@/lib/proposal-types"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepScopeProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
}

/**
 * Step 3 — Service Scope
 * Adapts based on service category. For social media: platform picker + options.
 * For all types: client needs description + custom deliverables.
 */
export function StepScope({ form, onChange }: StepScopeProps) {
  const isSocialMedia = form.serviceCategory === "social_media"

  function togglePlatform(platform: SocialPlatform) {
    const current = form.targetPlatforms
    const updated = current.includes(platform)
      ? current.filter(p => p !== platform)
      : [...current, platform]

    // Update platformScopes accordingly
    const updatedScopes = form.platformScopes.filter(s => updated.includes(s.platform))
    updated.forEach(p => {
      if (!updatedScopes.find(s => s.platform === p)) {
        updatedScopes.push({ platform: p, postsPerMonth: 12 })
      }
    })

    onChange({ targetPlatforms: updated, platformScopes: updatedScopes })
  }

  function updatePostFrequency(platform: SocialPlatform, value: number) {
    const scopes = form.platformScopes.map(s =>
      s.platform === platform ? { ...s, postsPerMonth: value } : s
    )
    onChange({ platformScopes: scopes })
  }

  function addDeliverable() {
    onChange({ customDeliverables: [...form.customDeliverables, ""] })
  }

  function updateDeliverable(index: number, value: string) {
    const updated = [...form.customDeliverables]
    updated[index] = value
    onChange({ customDeliverables: updated })
  }

  function removeDeliverable(index: number) {
    onChange({ customDeliverables: form.customDeliverables.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-6">
      {/* Social Media — Platform Selector */}
      {isSocialMedia && (
        <div className="space-y-3">
          <div>
            <Label>
              Target Platforms <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Select all platforms you'll manage for this client</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SOCIAL_PLATFORMS.map(platform => (
              <button
                key={platform.value}
                type="button"
                onClick={() => togglePlatform(platform.value)}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-lg border-2 text-sm font-medium transition-colors text-left",
                  form.targetPlatforms.includes(platform.value)
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/40 text-foreground"
                )}
              >
                <Checkbox
                  checked={form.targetPlatforms.includes(platform.value)}
                  className="pointer-events-none"
                />
                {platform.label}
              </button>
            ))}
          </div>

          {/* Posting frequency per selected platform */}
          {form.targetPlatforms.length > 0 && (
            <div className="space-y-2 p-3 bg-muted/40 rounded-lg">
              <Label className="text-sm">Posts per Month (per platform)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {form.targetPlatforms.map(platform => {
                  const scope = form.platformScopes.find(s => s.platform === platform)
                  const label = SOCIAL_PLATFORMS.find(p => p.value === platform)?.label || platform
                  return (
                    <div key={platform} className="flex items-center gap-2">
                      <span className="text-sm min-w-[100px] text-muted-foreground">{label}</span>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        value={scope?.postsPerMonth || 12}
                        onChange={e => updatePostFrequency(platform, parseInt(e.target.value) || 12)}
                        className="w-20 h-8 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">posts/mo</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Social media options */}
          <div className="space-y-2">
            <Label className="text-sm">Included Services</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { field: "includesPhotographyShoot", label: "Photo/Video Shoots" },
                { field: "includesCommunityManagement", label: "Community Management" },
                { field: "includesMonthlyReporting", label: "Monthly Reporting" },
                { field: "includesPaidAdsManagement", label: "Paid Ads Management" },
              ].map(({ field, label }) => (
                <label
                  key={field}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={form[field as keyof ProposalFormData] as boolean}
                    onCheckedChange={v => onChange({ [field]: !!v })}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Client Needs Description — all categories */}
      <div className="space-y-1.5">
        <Label htmlFor="clientNeedsDescription">
          What Does the Client Need? <span className="text-muted-foreground text-xs font-normal">(Personalises the AI output)</span>
        </Label>
        <Textarea
          id="clientNeedsDescription"
          placeholder="Describe the client's situation and needs in 2–3 sentences. E.g. 'Nimai Hyundai is an automotive dealership in Tripura looking to increase showroom footfall and brand visibility across Instagram and Facebook. They currently have a basic Facebook page but minimal content strategy.'"
          value={form.clientNeedsDescription}
          onChange={e => onChange({ clientNeedsDescription: e.target.value })}
          rows={4}
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground text-right">
          {form.clientNeedsDescription.length}/1000 — more detail = better AI output
        </p>
      </div>

      {/* Custom Deliverables */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Additional Deliverables <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addDeliverable}
            className="text-xs h-7"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
        {form.customDeliverables.length > 0 ? (
          <div className="space-y-2">
            {form.customDeliverables.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder={`Deliverable ${i + 1}…`}
                  value={d}
                  onChange={e => updateDeliverable(i, e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDeliverable(i)}
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-1">
            Any specific deliverables you want to list explicitly in the proposal
          </p>
        )}
      </div>
    </div>
  )
}
