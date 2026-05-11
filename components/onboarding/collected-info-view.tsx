"use client"

import { memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X, Edit2, Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { CollectedData } from "@/components/onboarding-chat"

export interface TrackedStep {
    id: string
    label: string
    placeholder: string
}

const COUNTRY_FLAGS: Record<string, string> = {
    IN: "🇮🇳", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", CA: "🇨🇦",
    AU: "🇦🇺", SG: "🇸🇬", AE: "🇦🇪", PH: "🇵🇭", FR: "🇫🇷", NL: "🇳🇱",
}

interface CollectedInfoViewProps {
    trackedSteps: TrackedStep[]
    progressPercent: number
    completedCount: number
    totalSteps: number
    collectedData: CollectedData
    expandedField: string | null
    allComplete: boolean
    onToggleExpand: (field: string | null) => void
    onUpdateField: (field: string, value: any) => void
    onUpdateNestedField: (parent: "address" | "bankDetails", field: string, value: string) => void
}

// Smooth collapse easing — Apple-style "cubic-bezier(0.32, 0.72, 0, 1)"
const COLLAPSE_EASING = [0.32, 0.72, 0, 1] as const

function CollectedInfoViewInner({
    trackedSteps,
    progressPercent,
    completedCount,
    totalSteps,
    collectedData,
    expandedField,
    allComplete,
    onToggleExpand,
    onUpdateField,
    onUpdateNestedField,
}: CollectedInfoViewProps) {
    return (
        <div className="space-y-4 pb-10 w-full min-w-0">
            {/* Progress Card */}
            <div className="border rounded-2xl bg-card shadow-sm p-5 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="flex items-center justify-between text-sm relative z-10">
                    <span className="font-semibold text-base">Profile Progress</span>
                    <span className="text-muted-foreground text-base font-medium">{progressPercent}%</span>
                </div>
                {/* Smooth continuous progress bar — animates on value change only, NOT on mount */}
                <div className="w-full h-2.5 rounded-full bg-muted/60 overflow-hidden mt-2 relative z-10">
                    <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={false}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
                <p className="text-xs text-muted-foreground relative z-10">
                    {completedCount} of {totalSteps} steps completed
                </p>
            </div>

            {/* Extracted Information Card */}
            <div className="border rounded-2xl bg-card shadow-sm p-3 space-y-1.5 relative z-10 overflow-hidden">
                <div className="flex items-center justify-between px-2 mb-2">
                    <h4 className="text-sm font-semibold text-foreground/80">Extracted Information</h4>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Click to edit</span>
                </div>

                <div className="space-y-1.5">
                    {trackedSteps.map((step) => {
                        const field = step.id
                        const isExpanded = expandedField === field

                        let hasValue = false
                        let displayValue: string | null = null

                        if (field === "taxDetails") {
                            hasValue = collectedData.taxRegistered !== undefined
                            displayValue = collectedData.taxRegistered ? (collectedData.taxId || "Registered") : "Not Registered"
                        } else if (field === "bankDetails") {
                            hasValue = !!((collectedData.bankDetails && Object.keys(collectedData.bankDetails).length > 0) || collectedData.bankDetailsSkipped)
                            displayValue = collectedData.bankDetailsSkipped ? "Skipped" : (collectedData.bankDetails?.bankName || "Provided")
                        } else if (field === "additionalNotes") {
                            hasValue = !!(collectedData.additionalNotes || allComplete)
                            displayValue = collectedData.additionalNotes ? "Notes added" : "Skipped/Done"
                        } else {
                            const val = (collectedData as any)[field]
                            if (Array.isArray(val)) {
                                hasValue = val.length > 0
                                if (field === "clientCountries") {
                                    displayValue = val.map((c: string) => COUNTRY_FLAGS[c] || c).join(" ")
                                } else {
                                    displayValue = val.join(", ")
                                }
                            } else if (typeof val === "object" && val !== null) {
                                hasValue = Object.values(val).some(v => v && String(v).trim().length > 0)
                                if (field === "address") {
                                    const a = val as Record<string, string>
                                    displayValue = [a.city, a.state].filter(Boolean).join(", ") || "Provided"
                                } else {
                                    displayValue = "Provided"
                                }
                            } else {
                                hasValue = val && String(val).trim().length > 0
                                if (field === "country") {
                                    displayValue = `${COUNTRY_FLAGS[val] || ""} ${val}`.trim()
                                } else {
                                    displayValue = String(val)
                                }
                            }
                        }

                        return (
                            <div
                                key={field}
                                className={cn(
                                    "rounded-xl overflow-hidden border transition-colors",
                                    isExpanded
                                        ? "bg-card border-primary/20 shadow-md"
                                        : "bg-transparent border-transparent hover:bg-muted/50",
                                    (hasValue && !isExpanded) ? "bg-primary/[0.02] border-primary/5" : ""
                                )}
                            >
                                {/* Header Row — always visible */}
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 py-2.5 px-3 select-none text-left cursor-pointer"
                                    onClick={() => onToggleExpand(isExpanded ? null : field)}
                                >
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                                        hasValue
                                            ? (isExpanded ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary")
                                            : "border-2 border-muted-foreground/30 text-muted-foreground/30"
                                    )}>
                                        {hasValue ? (
                                            <Check className="w-3.5 h-3.5" />
                                        ) : (
                                            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                                        )}
                                    </div>
                                    <span className={cn(
                                        "font-medium text-[13px] flex-1 truncate transition-colors",
                                        isExpanded ? "text-primary" : (hasValue ? "text-foreground" : "text-muted-foreground")
                                    )}>
                                        {step.label}
                                    </span>
                                    {!isExpanded && displayValue && hasValue && (
                                        <span className="text-[12px] text-muted-foreground truncate max-w-[100px] lg:max-w-[130px]" title={displayValue}>
                                            {displayValue}
                                        </span>
                                    )}
                                    <motion.div
                                        className="shrink-0 w-5 h-5 flex items-center justify-center"
                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                        transition={{ duration: 0.25, ease: COLLAPSE_EASING }}
                                    >
                                        {isExpanded
                                            ? <X className="w-3.5 h-3.5 text-muted-foreground" />
                                            : <Edit2 className="w-3.5 h-3.5 text-muted-foreground/50" />}
                                    </motion.div>
                                </button>

                                {/* Expandable edit area — smooth height + opacity */}
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            key="edit-area"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                                height: "auto",
                                                opacity: 1,
                                                transition: {
                                                    height: { duration: 0.3, ease: COLLAPSE_EASING },
                                                    opacity: { duration: 0.25, delay: 0.05 },
                                                }
                                            }}
                                            exit={{
                                                height: 0,
                                                opacity: 0,
                                                transition: {
                                                    height: { duration: 0.25, ease: COLLAPSE_EASING },
                                                    opacity: { duration: 0.15 },
                                                }
                                            }}
                                            style={{ overflow: "hidden" }}
                                        >
                                            <div className="px-3 pb-3 pt-2 border-t border-border/50 bg-muted/20">
                                                <div className="space-y-3 mt-2">
                                                    {field === "address" ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <Input placeholder="Street" className="col-span-2 h-8 text-xs" value={collectedData.address?.street || ""} onChange={e => onUpdateNestedField("address", "street", e.target.value)} />
                                                            <Input placeholder="City" className="h-8 text-xs" value={collectedData.address?.city || ""} onChange={e => onUpdateNestedField("address", "city", e.target.value)} />
                                                            <Input placeholder="State" className="h-8 text-xs" value={collectedData.address?.state || ""} onChange={e => onUpdateNestedField("address", "state", e.target.value)} />
                                                            <Input placeholder="Zip" className="col-span-2 h-8 text-xs" value={collectedData.address?.postalCode || ""} onChange={e => onUpdateNestedField("address", "postalCode", e.target.value)} />
                                                        </div>
                                                    ) : field === "taxDetails" ? (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between bg-background p-2 rounded-lg border shadow-sm">
                                                                <Label htmlFor="tax-registered" className="text-xs">Registered for Tax?</Label>
                                                                <Switch
                                                                    id="tax-registered"
                                                                    checked={collectedData.taxRegistered === true}
                                                                    onCheckedChange={(c) => onUpdateField("taxRegistered", c)}
                                                                />
                                                            </div>
                                                            {collectedData.taxRegistered && (
                                                                <Input placeholder="Tax ID Number" className="h-8 text-xs" value={collectedData.taxId || ""} onChange={e => onUpdateField("taxId", e.target.value)} />
                                                            )}
                                                        </div>
                                                    ) : field === "bankDetails" ? (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between bg-background p-2 rounded-lg border shadow-sm mb-2">
                                                                <Label htmlFor="skip-bank" className="text-xs">Skip Bank Details?</Label>
                                                                <Switch
                                                                    id="skip-bank"
                                                                    checked={collectedData.bankDetailsSkipped === true}
                                                                    onCheckedChange={(c) => {
                                                                        onUpdateField("bankDetailsSkipped", c)
                                                                        if (c) onUpdateField("bankDetails", {})
                                                                    }}
                                                                />
                                                            </div>
                                                            {!collectedData.bankDetailsSkipped && (
                                                                <>
                                                                    <Input placeholder="Bank Name" className="h-8 text-xs" value={collectedData.bankDetails?.bankName || ""} onChange={e => onUpdateNestedField("bankDetails", "bankName", e.target.value)} />
                                                                    <Input placeholder="Account Name" className="h-8 text-xs" value={collectedData.bankDetails?.accountName || ""} onChange={e => onUpdateNestedField("bankDetails", "accountName", e.target.value)} />
                                                                    <Input placeholder="Account Number" className="h-8 text-xs" value={collectedData.bankDetails?.accountNumber || ""} onChange={e => onUpdateNestedField("bankDetails", "accountNumber", e.target.value)} />
                                                                    <Input placeholder="Routing / IFSC Code" className="h-8 text-xs" value={collectedData.bankDetails?.routingNumber || collectedData.bankDetails?.ifscCode || ""} onChange={e => onUpdateNestedField("bankDetails", "routingNumber", e.target.value)} />
                                                                </>
                                                            )}
                                                        </div>
                                                    ) : field === "clientCountries" ? (
                                                        <Input
                                                            placeholder="e.g. US, IN, GB (comma separated)"
                                                            className="h-8 text-xs"
                                                            value={(collectedData.clientCountries || []).join(", ")}
                                                            onChange={e => onUpdateField("clientCountries", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                                        />
                                                    ) : (
                                                        <Input
                                                            placeholder={step.placeholder}
                                                            className="h-8 text-xs bg-background shadow-sm"
                                                            value={(collectedData as any)[field] || ""}
                                                            onChange={e => onUpdateField(field, e.target.value)}
                                                        />
                                                    )}

                                                    <div className="flex justify-end pt-1">
                                                        <Button size="sm" className="h-7 text-[11px] gap-1 px-3 shadow-sm" onClick={() => onToggleExpand(null)}>
                                                            <Save className="w-3 h-3" /> Save
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export const CollectedInfoView = memo(CollectedInfoViewInner)
