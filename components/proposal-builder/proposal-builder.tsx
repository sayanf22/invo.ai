"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import {
  type ProposalFormData,
  type GeneratedProposalSections,
  PROPOSAL_STEPS,
  getInitialProposalFormData,
  validateStep,
  proposalToInvoiceData,
  getDefaultTCClauses,
  getSuggestedKPIs,
  getSuggestedMilestones,
} from "@/lib/proposal-types"
import { StepBasics } from "@/components/proposal-builder/step-basics"
import { StepClient } from "@/components/proposal-builder/step-client"
import { StepScope } from "@/components/proposal-builder/step-scope"
import { StepPricing } from "@/components/proposal-builder/step-pricing"
import { StepKPIs } from "@/components/proposal-builder/step-kpis"
import { StepTimeline } from "@/components/proposal-builder/step-timeline"
import { StepAgency } from "@/components/proposal-builder/step-agency"
import { StepReview } from "@/components/proposal-builder/step-review"
import { useSupabase, useUser } from "@/components/auth-provider"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import { cn } from "@/lib/utils"

interface ProposalBuilderProps {
  onBack: () => void
  onComplete?: (sessionId: string) => void
}

/**
 * ProposalBuilder — Multi-step form for structured proposal creation.
 *
 * Flow: 8 steps → AI generation → Saved as document_session → Opens in PromptScreen
 *
 * The builder collects all structured data needed before touching the AI.
 * AI generates 6 prose sections (in parallel); pricing/timeline/T&C are
 * assembled programmatically from the form data.
 */
export function ProposalBuilder({ onBack, onComplete }: ProposalBuilderProps) {
  const supabase = useSupabase()
  const user = useUser()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState<ProposalFormData>(getInitialProposalFormData)
  const [generating, setGenerating] = useState(false)
  const [generationPhase, setGenerationPhase] = useState("")
  const [stepErrors, setStepErrors] = useState<string[]>([])
  const [profileIncomplete, setProfileIncomplete] = useState(false)

  // Load business profile for agency step auto-fill
  useEffect(() => {
    if (!user?.id) return

    supabase
      .from("businesses")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (!data) {
          setProfileIncomplete(true)
          return
        }

        const addr = data.address as Record<string, string> | null
        const addrStr = addr
          ? [addr.street, addr.city, addr.state, addr.postal_code, addr.country]
              .filter(Boolean)
              .join(", ")
          : ""

        setForm(prev => ({
          ...prev,
          agencyName: data.name || "",
          agencyEmail: data.email || "",
          agencyPhone: data.phone || "",
          agencyAddress: addrStr,
          agencyWebsite: typeof data.additional_notes === "string" && data.additional_notes.includes("http")
            ? ""  // don't use notes as website
            : "",
          agencyServices: data.additional_notes || "",
          agencyLogoUrl: data.logo_url || undefined,
          currency: data.default_currency || prev.currency,
          paymentMethod: (data.default_payment_instructions?.split("\n")[0] || prev.paymentMethod),
        }))

        setProfileIncomplete(!data.name || !data.email)
      })
  }, [user?.id, supabase])

  // Auto-populate KPIs and milestones when service category or goal change
  useEffect(() => {
    if (form.serviceCategory && form.kpis.length === 0) {
      const suggestions = getSuggestedKPIs(form.serviceCategory, form.clientPrimaryGoal || "")
      setForm(prev => ({ ...prev, kpis: suggestions }))
    }
  }, [form.serviceCategory, form.clientPrimaryGoal]) // eslint-disable-line

  useEffect(() => {
    if (form.serviceCategory && form.milestones.length === 0) {
      const suggestions = getSuggestedMilestones(form.serviceCategory)
      setForm(prev => ({
        ...prev,
        milestones: suggestions.map(m => ({ ...m, id: Math.random().toString(36).slice(2) })),
      }))
    }
  }, [form.serviceCategory]) // eslint-disable-line

  function handleChange(updates: Partial<ProposalFormData>) {
    setForm(prev => ({ ...prev, ...updates }))
    // Clear errors on change
    if (stepErrors.length > 0) setStepErrors([])
  }

  function validateAndProceed() {
    const validation = validateStep(currentStep, form)
    if (!validation.isValid) {
      setStepErrors(validation.errors)
      // Scroll to top of form
      document.getElementById("proposal-step-content")?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    setStepErrors([])
    setCurrentStep(prev => Math.min(8, prev + 1))
    // Scroll top on step change
    setTimeout(() => {
      document.getElementById("proposal-step-content")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
  }

  function goBack() {
    setStepErrors([])
    if (currentStep === 1) {
      onBack()
    } else {
      setCurrentStep(prev => prev - 1)
    }
  }

  async function handleGenerate() {
    // Final validation
    const finalValidation = validateStep(8, form)
    if (!finalValidation.isValid) {
      setStepErrors(finalValidation.errors)
      return
    }

    setGenerating(true)
    setGenerationPhase("Sending your brief to the AI…")

    try {
      // Populate T&C if not done
      const formWithTC: ProposalFormData = {
        ...form,
        tcClauses: form.tcClauses.length > 0 ? form.tcClauses : getDefaultTCClauses(form),
      }

      setGenerationPhase("Generating Executive Summary and About Us…")

      const resp = await authFetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: formWithTC }),
      })

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || "Generation failed")
      }

      setGenerationPhase("Assembling proposal document…")
      const { sections } = (await resp.json()) as { sections: GeneratedProposalSections }

      // Convert form + sections to InvoiceData for the existing document pipeline
      const invoiceData = proposalToInvoiceData(formWithTC, sections, form.agencyLogoUrl)

      setGenerationPhase("Saving proposal…")

      // Save the fully assembled proposal via the dedicated save route
      const sessionResp = await authFetch("/api/proposals/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalNumber: form.proposalNumber,
          clientName: form.clientBusinessName,
          invoiceData,
          formData: formWithTC,
          sections,
        }),
      })

      if (!sessionResp.ok) {
        const errData = await sessionResp.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to save proposal")
      }

      const { sessionId } = await sessionResp.json()
      toast.success("Proposal generated successfully!")
      onComplete?.(sessionId)

    } catch (err: any) {
      toast.error(err.message || "Failed to generate proposal. Please try again.")
      setGenerating(false)
      setGenerationPhase("")
    }
  }

  const progress = ((currentStep - 1) / (PROPOSAL_STEPS.length - 1)) * 100

  // ── Render step content ───────────────────────────────────────────────────────

  function renderStep() {
    switch (currentStep) {
      case 1: return <StepBasics form={form} onChange={handleChange} />
      case 2: return <StepClient form={form} onChange={handleChange} />
      case 3: return <StepScope form={form} onChange={handleChange} />
      case 4: return <StepPricing form={form} onChange={handleChange} />
      case 5: return <StepKPIs form={form} onChange={handleChange} />
      case 6: return <StepTimeline form={form} onChange={handleChange} />
      case 7: return <StepAgency form={form} onChange={handleChange} profileIncomplete={profileIncomplete} />
      case 8: return <StepReview form={form} onChange={handleChange} />
      default: return null
    }
  }

  const currentStepInfo = PROPOSAL_STEPS[currentStep - 1]
  const isLastStep = currentStep === 8

  // Validate current step for the Next button indicator
  const currentValidation = validateStep(currentStep, form)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/60 bg-background hover:bg-accent transition-colors text-muted-foreground shrink-0"
            disabled={generating}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Proposal Builder</span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                Step {currentStep} of {PROPOSAL_STEPS.length}
              </span>
            </div>
            <p className="text-sm font-semibold leading-tight truncate">{currentStepInfo.title}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-0.5 scrollbar-none">
          {PROPOSAL_STEPS.map(step => {
            const stepValidation = validateStep(step.id, form)
            const isComplete = step.id < currentStep && stepValidation.isValid
            const isCurrent = step.id === currentStep
            const hasError = step.id < currentStep && !stepValidation.isValid

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setStepErrors([])
                  setCurrentStep(step.id)
                }}
                disabled={generating}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 transition-colors",
                  isCurrent && "bg-primary text-primary-foreground",
                  isComplete && "bg-emerald-100 text-emerald-700",
                  hasError && "bg-destructive/10 text-destructive",
                  !isCurrent && !isComplete && !hasError && "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {isComplete && <CheckCircle2 className="w-3 h-3" />}
                {hasError && <AlertCircle className="w-3 h-3" />}
                {step.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Step Content ── */}
      <div
        id="proposal-step-content"
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
      >
        {/* Step description */}
        <div className="mb-1">
          <p className="text-sm text-muted-foreground">{currentStepInfo.description}</p>
        </div>

        {/* Step errors */}
        {stepErrors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 space-y-1">
            {stepErrors.map((e, i) => (
              <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {e}
              </p>
            ))}
          </div>
        )}

        {renderStep()}
      </div>

      {/* ── Footer Actions ── */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          disabled={generating}
          className="flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          {currentStep === 1 ? "Cancel" : "Back"}
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !validateStep(8, form).isValid}
            className="flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{generationPhase || "Generating…"}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Proposal
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={validateAndProceed}
            className="flex items-center gap-1.5"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
