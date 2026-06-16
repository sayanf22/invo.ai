"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  type ProposalFormData,
  type PricingTier,
  type PricingLineItem,
  type PricingAddOn,
} from "@/lib/proposal-types"
import { Plus, Trash2, Star } from "lucide-react"
import { cn } from "@/lib/utils"

function genId() { return Math.random().toString(36).slice(2, 8) }

interface StepPricingProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
}

const PAYMENT_METHODS = [
  "Bank Transfer", "UPI", "Razorpay", "Cashfree", "Stripe", "PayPal", "Cash", "Other",
]

/**
 * Step 4 — Pricing Structure
 * Supports three modes: Single Price, Tiered Plans, Custom Quote
 * Validates: no duplicate rates on tiered plans, at least one item/tier
 */
export function StepPricing({ form, onChange }: StepPricingProps) {
  const currencySymbol = form.currency === "INR" ? "₹" : form.currency

  // ── Single / Custom line items ─────────────────────────────────────────────

  function addLineItem() {
    onChange({
      lineItems: [
        ...form.lineItems,
        { id: genId(), description: "", quantity: 1, rate: 0 },
      ],
    })
  }

  function updateLineItem(id: string, updates: Partial<PricingLineItem>) {
    onChange({ lineItems: form.lineItems.map(i => i.id === id ? { ...i, ...updates } : i) })
  }

  function removeLineItem(id: string) {
    onChange({ lineItems: form.lineItems.filter(i => i.id !== id) })
  }

  const lineItemTotal = form.lineItems.reduce((s, i) => s + i.quantity * i.rate, 0)
  const lineItemTotalWithTax = form.taxApplicable
    ? lineItemTotal * (1 + form.taxRate / 100)
    : lineItemTotal

  // ── Tiered plans ───────────────────────────────────────────────────────────

  function updateTier(id: string, updates: Partial<PricingTier>) {
    onChange({ tiers: form.tiers.map(t => t.id === id ? { ...t, ...updates } : t) })
  }

  function addTierInclusion(tierId: string) {
    onChange({
      tiers: form.tiers.map(t =>
        t.id === tierId ? { ...t, inclusions: [...t.inclusions, ""] } : t
      ),
    })
  }

  function updateTierInclusion(tierId: string, index: number, value: string) {
    onChange({
      tiers: form.tiers.map(t =>
        t.id === tierId
          ? { ...t, inclusions: t.inclusions.map((inc, i) => i === index ? value : inc) }
          : t
      ),
    })
  }

  function removeTierInclusion(tierId: string, index: number) {
    onChange({
      tiers: form.tiers.map(t =>
        t.id === tierId
          ? { ...t, inclusions: t.inclusions.filter((_, i) => i !== index) }
          : t
      ),
    })
  }

  function addTier() {
    if (form.tiers.length >= 4) return
    onChange({
      tiers: [
        ...form.tiers,
        { id: genId(), name: "", description: "", inclusions: [""], monthlyRate: 0 },
      ],
    })
  }

  function removeTier(id: string) {
    if (form.tiers.length <= 2) return
    onChange({ tiers: form.tiers.filter(t => t.id !== id) })
  }

  function toggleRecommended(id: string) {
    onChange({ tiers: form.tiers.map(t => ({ ...t, isRecommended: t.id === id ? !t.isRecommended : false })) })
  }

  // Detect duplicate rates for tier validation
  const tierRates = form.tiers.map(t => t.monthlyRate).filter(r => r > 0)
  const hasDuplicateRates = tierRates.length !== new Set(tierRates).size

  // ── Add-ons ────────────────────────────────────────────────────────────────

  function addAddOn() {
    onChange({ addOns: [...form.addOns, { id: genId(), description: "", rate: 0 }] })
  }

  function updateAddOn(id: string, updates: Partial<PricingAddOn>) {
    onChange({ addOns: form.addOns.map(a => a.id === id ? { ...a, ...updates } : a) })
  }

  function removeAddOn(id: string) {
    onChange({ addOns: form.addOns.filter(a => a.id !== id) })
  }

  return (
    <div className="space-y-6">
      {/* Pricing Model Selector */}
      <div className="space-y-2">
        <Label>
          Pricing Model <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "single", label: "Single Price", desc: "One table, one total" },
            { value: "tiered", label: "Tiered Plans", desc: "2–4 plans, client picks one" },
            { value: "custom", label: "Custom Quote", desc: "Free-form line items" },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ pricingModel: opt.value as ProposalFormData["pricingModel"] })}
              className={cn(
                "flex flex-col gap-0.5 p-3 rounded-lg border-2 cursor-pointer transition-colors text-left",
                form.pricingModel === opt.value
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

      {/* ── Single / Custom Line Items ── */}
      {(form.pricingModel === "single" || form.pricingModel === "custom") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Line Items <span className="text-destructive">*</span></Label>
            <Button type="button" variant="ghost" size="sm" onClick={addLineItem} className="text-xs h-7">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
            </Button>
          </div>

          {/* Header */}
          <div className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-0.5">
            <span>Description</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Rate ({currencySymbol})</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {form.lineItems.map(item => {
            const amount = item.quantity * item.rate
            return (
              <div key={item.id} className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 items-center">
                <Input
                  placeholder="Service or deliverable description"
                  value={item.description}
                  onChange={e => updateLineItem(item.id, { description: e.target.value })}
                  className="text-sm"
                />
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 1 })}
                  className="text-sm text-center"
                />
                <Input
                  type="number"
                  min={0}
                  value={item.rate || ""}
                  placeholder="0"
                  onChange={e => updateLineItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                  className="text-sm text-right"
                />
                <div className="text-sm font-medium text-right pr-1">
                  {amount > 0 ? `${currencySymbol}${amount.toLocaleString("en-IN")}` : "—"}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLineItem(item.id)}
                  disabled={form.lineItems.length === 1}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )
          })}

          {/* Totals */}
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{currencySymbol}{lineItemTotal.toLocaleString("en-IN")}</span>
            </div>
            {form.taxApplicable && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({form.taxRate}%)</span>
                <span>{currencySymbol}{(lineItemTotal * form.taxRate / 100).toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t pt-1">
              <span>Total Investment</span>
              <span>{currencySymbol}{lineItemTotalWithTax.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tiered Plans ── */}
      {form.pricingModel === "tiered" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Pricing Tiers <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5">2–4 plans. Each must have a unique rate. Client picks one.</p>
            </div>
            {form.tiers.length < 4 && (
              <Button type="button" variant="ghost" size="sm" onClick={addTier} className="text-xs h-7">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Tier
              </Button>
            )}
          </div>

          {hasDuplicateRates && (
            <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              Each pricing tier must have a unique monthly rate. Duplicate rates are not allowed.
            </div>
          )}

          <div className="space-y-3">
            {form.tiers.map((tier, ti) => (
              <div key={tier.id} className={cn(
                "border-2 rounded-xl p-4 space-y-3 transition-colors",
                tier.isRecommended ? "border-primary bg-primary/3" : "border-border"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      placeholder={`Plan name (e.g. ${["Basic", "Standard", "Premium", "Enterprise"][ti]})`}
                      value={tier.name}
                      onChange={e => updateTier(tier.id, { name: e.target.value })}
                      className="font-semibold flex-1"
                    />
                    {tier.isRecommended && (
                      <Badge variant="default" className="shrink-0 text-xs">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Toggle recommended"
                      onClick={() => toggleRecommended(tier.id)}
                      className={cn(
                        "p-1.5 rounded-md transition-colors",
                        tier.isRecommended
                          ? "text-yellow-500 bg-yellow-50"
                          : "text-muted-foreground hover:text-yellow-500"
                      )}
                    >
                      <Star className="w-4 h-4" fill={tier.isRecommended ? "currentColor" : "none"} />
                    </button>
                    {form.tiers.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTier(tier.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Monthly Rate ({currencySymbol}) *</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tier.monthlyRate || ""}
                      placeholder="35000"
                      onChange={e => updateTier(tier.id, { monthlyRate: parseFloat(e.target.value) || 0 })}
                      className={hasDuplicateRates && tierRates.filter(r => r === tier.monthlyRate).length > 1
                        ? "border-destructive"
                        : ""}
                    />
                    {tier.monthlyRate > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {currencySymbol}{tier.monthlyRate.toLocaleString("en-IN")}/month
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Short Description</Label>
                    <Input
                      placeholder="e.g. Best for growing brands"
                      value={tier.description}
                      onChange={e => updateTier(tier.id, { description: e.target.value })}
                    />
                  </div>
                </div>

                {/* Inclusions list */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">What's Included</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addTierInclusion(tier.id)}
                      className="h-6 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {tier.inclusions.map((inc, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs shrink-0">•</span>
                      <Input
                        placeholder="e.g. 16 Instagram posts/month"
                        value={inc}
                        onChange={e => updateTierInclusion(tier.id, i, e.target.value)}
                        className="text-sm h-8 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTierInclusion(tier.id, i)}
                        disabled={tier.inclusions.length === 1}
                        className="h-8 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Add-ons <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                <p className="text-xs text-muted-foreground">Optional extras the client can add to any plan</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={addAddOn} className="text-xs h-7">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            {form.addOns.map(addon => (
              <div key={addon.id} className="flex items-center gap-2">
                <Input
                  placeholder="Add-on description"
                  value={addon.description}
                  onChange={e => updateAddOn(addon.id, { description: e.target.value })}
                  className="flex-1 text-sm"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground shrink-0">{currencySymbol}</span>
                  <Input
                    type="number"
                    min={0}
                    value={addon.rate || ""}
                    placeholder="0"
                    onChange={e => updateAddOn(addon.id, { rate: parseFloat(e.target.value) || 0 })}
                    className="w-24 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAddOn(addon.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Payment Terms ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="advancePercent">Advance Payment (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="advancePercent"
              type="number"
              min={0}
              max={100}
              value={form.advancePaymentPercent}
              onChange={e => onChange({ advancePaymentPercent: parseFloat(e.target.value) || 50 })}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">% due on acceptance</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paymentMethod">
            Payment Method <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.paymentMethod}
            onValueChange={v => onChange({ paymentMethod: v })}
          >
            <SelectTrigger id="paymentMethod">
              <SelectValue placeholder="Select method…" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tax */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="taxApplicable"
          checked={form.taxApplicable}
          onCheckedChange={v => onChange({ taxApplicable: !!v })}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <label htmlFor="taxApplicable" className="text-sm font-medium cursor-pointer">
            Tax / GST Applicable
          </label>
          {form.taxApplicable && (
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.taxRate}
                onChange={e => onChange({ taxRate: parseFloat(e.target.value) || 0 })}
                className="w-20 text-sm"
              />
              <span className="text-sm text-muted-foreground">% tax rate</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
