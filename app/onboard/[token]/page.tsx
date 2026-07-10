"use client"

/**
 * Public client onboarding fill page — /onboard/[token]
 *
 * No login. The client opens the tokenized link on any device, fills the form,
 * progress autosaves, files upload to R2, and submit finalizes the answers.
 * Mirrors the public signing page pattern (client component + public API).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import {
  Loader2, CheckCircle2, AlertTriangle, Upload, FileText, ImageIcon, X, Clock, CloudUpload, ExternalLink,
  ArrowLeft, ArrowRight, List, Rows,
} from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import { compressImage } from "@/lib/compress-image"

type FieldType = "short_text" | "long_text" | "file" | "external_link"
interface Field {
  id: string
  type: FieldType
  label: string
  required: boolean
  placeholder?: string
  section?: string
  accept?: string
  multiple?: boolean
  externalUrl?: string
}
interface FileRef { fileId: string; fileName: string }
type AnswerValue = string | FileRef[]

interface ClientFile { id: string; fileName: string; mimeType: string; fileSize: number }

interface OnboardFormData {
  token: string
  title: string | null
  status: "in_progress" | "submitted" | "expired"
  allowUploads: boolean
  fields: Field[]
  clientName: string | null
  clientEmail: string | null
  clientFiles: ClientFile[]
  /** Client-safe document preview data, present only once status === "submitted". */
  preview: Record<string, unknown> | null
  draftAnswers: Record<string, AnswerValue>
  answers: Record<string, AnswerValue> | null
  submittedAt: string | null
}
interface Business { name: string; logoUrl: string | null }

type Screen = "loading" | "active" | "submitted" | "expired" | "error"

export default function OnboardFillPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ""

  const [screen, setScreen] = useState<Screen>("loading")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [form, setForm] = useState<OnboardFormData | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Fill mode: "all" = single scroll form, "step" = one question at a time.
  const [fillMode, setFillMode] = useState<"all" | "step">("all")
  const [stepIndex, setStepIndex] = useState(0)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didInit = useRef(false)

  // ── Load the form ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/onboarding?token=${encodeURIComponent(token)}`)
        if (cancelled) return
        if (res.status === 410) { setScreen("expired"); return }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setErrorMsg(d.error || "This form link is invalid.")
          setScreen("error")
          return
        }
        const data = await res.json()
        const f: OnboardFormData = data.form
        setForm(f)
        setBusiness(data.business)
        setClientName(f.clientName || "")
        setClientEmail(f.clientEmail || "")
        setAnswers((f.answers ?? f.draftAnswers ?? {}) as Record<string, AnswerValue>)
        setScreen(f.status === "submitted" ? "submitted" : "active")
      } catch {
        if (!cancelled) { setErrorMsg("Could not load the form. Please try again."); setScreen("error") }
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // ── Autosave (debounced) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "active") return
    if (!didInit.current) { didInit.current = true; return } // skip first render
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch("/api/onboarding/autosave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, answers }),
        })
      } catch { /* non-fatal */ } finally { setSaving(false) }
    }, 900)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [answers, screen, token])

  const setText = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setValidationError(null)
  }, [])

  const handleFileUpload = useCallback(async (field: Field, files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingField(field.id)
    try {
      for (const rawFile of Array.from(files)) {
        // Compress images client-side before upload (the Worker can't run canvas).
        // Non-images (PDF) and already-small files pass through unchanged.
        const file = await compressImage(rawFile).catch(() => rawFile)
        const fd = new FormData()
        fd.append("token", token)
        fd.append("fieldId", field.id)
        fd.append("file", file)
        const res = await fetch("/api/onboarding/upload", { method: "POST", body: fd })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) { setValidationError(d.error || `Could not upload ${file.name}.`); continue }
        setAnswers((prev) => {
          const existing = Array.isArray(prev[field.id]) ? (prev[field.id] as FileRef[]) : []
          return { ...prev, [field.id]: [...existing, { fileId: d.fileId, fileName: d.fileName }] }
        })
      }
    } finally {
      setUploadingField(null)
    }
  }, [token])

  const removeFile = useCallback((fieldId: string, fileId: string) => {
    setAnswers((prev) => {
      const existing = Array.isArray(prev[fieldId]) ? (prev[fieldId] as FileRef[]) : []
      return { ...prev, [fieldId]: existing.filter((f) => f.fileId !== fileId) }
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!form || submitting) return
    // Client-side required validation.
    for (const field of form.fields) {
      if (!field.required) continue
      const v = answers[field.id]
      const empty = field.type === "file"
        ? !Array.isArray(v) || v.length === 0
        : typeof v !== "string" || v.trim().length === 0
      if (empty) { setValidationError(`Please answer: ${field.label}`); return }
    }
    setSubmitting(true)
    setValidationError(null)
    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          answers,
          clientName: clientName.trim() || undefined,
          clientEmail: clientEmail.trim() || undefined,
        }),
      })
      if (res.ok) { setScreen("submitted"); return }
      const d = await res.json().catch(() => ({}))
      setValidationError(d.error || "Could not submit. Please try again.")
    } catch {
      setValidationError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [form, answers, clientName, clientEmail, submitting, token])

  // ── Screens ──────────────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading form…</p>
      </Centered>
    )
  }

  if (screen === "expired") {
    return (
      <Centered>
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
          <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">This form link has expired</h1>
        <p className="text-sm text-muted-foreground max-w-sm">Please contact the sender to request a new link.</p>
      </Centered>
    )
  }

  if (screen === "error") {
    return (
      <Centered>
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{errorMsg}</p>
      </Centered>
    )
  }

  if (screen === "submitted") {
    return (
      <SubmittedScreen
        business={business}
        form={form}
        token={token}
      />
    )
  }

  // Active form
  return (
    <ActiveForm
      form={form}
      business={business}
      answers={answers}
      clientName={clientName}
      clientEmail={clientEmail}
      setClientName={setClientName}
      setClientEmail={setClientEmail}
      setText={setText}
      handleFileUpload={handleFileUpload}
      removeFile={removeFile}
      uploadingField={uploadingField}
      saving={saving}
      submitting={submitting}
      validationError={validationError}
      setValidationError={setValidationError}
      handleSubmit={handleSubmit}
      fillMode={fillMode}
      setFillMode={setFillMode}
      stepIndex={stepIndex}
      setStepIndex={setStepIndex}
    />
  )
}

// ── Active form (all-at-once + step-by-step modes) ─────────────────────────────

interface ActiveFormProps {
  form: OnboardFormData | null
  business: Business | null
  answers: Record<string, AnswerValue>
  clientName: string
  clientEmail: string
  setClientName: (v: string) => void
  setClientEmail: (v: string) => void
  setText: (id: string, v: string) => void
  handleFileUpload: (field: Field, files: FileList | null) => void
  removeFile: (fieldId: string, fileId: string) => void
  uploadingField: string | null
  saving: boolean
  submitting: boolean
  validationError: string | null
  setValidationError: (v: string | null) => void
  handleSubmit: () => void
  fillMode: "all" | "step"
  setFillMode: (m: "all" | "step") => void
  stepIndex: number
  setStepIndex: (updater: number | ((prev: number) => number)) => void
}

/** A step is either the client's own details or a single form field. */
type Step = { kind: "details" } | { kind: "field"; field: Field }

function ActiveForm(props: ActiveFormProps) {
  const {
    form, business, answers, clientName, clientEmail, setClientName, setClientEmail,
    setText, handleFileUpload, removeFile, uploadingField, saving, submitting,
    validationError, setValidationError, handleSubmit, fillMode, setFillMode,
    stepIndex, setStepIndex,
  } = props

  const fields = form?.fields ?? []
  const sections = groupBySection(fields)

  // Flat ordered step list for the one-by-one wizard.
  const steps: Step[] = [{ kind: "details" }, ...fields.map((field) => ({ kind: "field", field } as Step))]
  const totalSteps = steps.length
  const safeIndex = Math.min(stepIndex, totalSteps - 1)
  const current = steps[safeIndex]
  const isLastStep = safeIndex === totalSteps - 1
  const progressPct = Math.round(((safeIndex + 1) / totalSteps) * 100)

  const goNext = () => {
    // Validate the current step before advancing.
    if (current?.kind === "field" && current.field.required) {
      const v = answers[current.field.id]
      const empty = current.field.type === "file"
        ? !Array.isArray(v) || v.length === 0
        : typeof v !== "string" || v.trim().length === 0
      if (empty) { setValidationError(`Please answer: ${current.field.label}`); return }
    }
    setValidationError(null)
    if (isLastStep) { handleSubmit(); return }
    setStepIndex((i) => Math.min(i + 1, totalSteps - 1))
  }

  const goBack = () => {
    setValidationError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  const Header = (
    <div className="flex items-center gap-3 mb-6">
      {business?.logoUrl
        ? <img src={business.logoUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-border" />
        : <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">{(business?.name || "?").charAt(0)}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{business?.name || "Onboarding"}</p>
        <h1 className="text-lg font-semibold text-foreground truncate">{form?.title || "Client Onboarding"}</h1>
      </div>
    </div>
  )

  // Mode toggle — segmented control.
  const ModeToggle = (
    <div className="inline-flex items-center rounded-xl border border-border bg-card p-1 mb-6">
      <button
        type="button"
        onClick={() => setFillMode("all")}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${fillMode === "all" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Rows className="w-3.5 h-3.5" /> All at once
      </button>
      <button
        type="button"
        onClick={() => { setValidationError(null); setStepIndex(0); setFillMode("step") }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${fillMode === "step" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
      >
        <List className="w-3.5 h-3.5" /> One by one
      </button>
    </div>
  )

  const ErrorBanner = validationError ? (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      <p className="text-sm text-destructive">{validationError}</p>
    </div>
  ) : null

  const SavedIndicator = (
    <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
      {saving ? (<><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>) : "Saved"}
    </span>
  )

  // ── Step-by-step mode ────────────────────────────────────────────────────────
  if (fillMode === "step") {
    return (
      <div className="min-h-dvh bg-muted/30">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
          {Header}
          {ModeToggle}

          {/* Progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Step {safeIndex + 1} of {totalSteps}</span>
              <span className="text-xs font-medium text-muted-foreground">{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-foreground transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Current step card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6 mb-4 min-h-[180px]">
            {current?.kind === "details" ? (
              <div className="flex flex-col gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your details</p>
                <TextField label="Full name" value={clientName} onChange={setClientName} placeholder="Your name" />
                <TextField label="Email" value={clientEmail} onChange={setClientEmail} placeholder="you@company.com" type="email" />
              </div>
            ) : current?.kind === "field" ? (
              <div>
                {current.field.section && (
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">{current.field.section}</p>
                )}
                <FieldRenderer
                  field={current.field}
                  value={answers[current.field.id]}
                  onText={(v) => setText(current.field.id, v)}
                  onUpload={(files) => handleFileUpload(current.field, files)}
                  onRemoveFile={(fileId) => removeFile(current.field.id, fileId)}
                  uploading={uploadingField === current.field.id}
                />
              </div>
            ) : null}
          </div>

          {ErrorBanner}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 mt-2">
            <button
              type="button"
              onClick={goBack}
              disabled={safeIndex === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              {SavedIndicator}
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isLastStep ? (submitting ? "Submitting…" : "Submit form") : "Next"}
                {!isLastStep && !submitting ? <ArrowRight className="w-4 h-4" /> : null}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/70 text-center mt-8">
            Powered by <a href="https://clorefy.com" className="hover:underline">Clorefy</a>. Your information is kept confidential.
          </p>
        </div>
      </div>
    )
  }

  // ── All-at-once mode ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        {Header}
        {ModeToggle}

        <p className="text-sm text-muted-foreground mb-6">
          Please complete the form below. Your progress saves automatically.
        </p>

        {/* Your details */}
        <SectionCard title="Your details">
          <TextField label="Full name" value={clientName} onChange={setClientName} placeholder="Your name" />
          <TextField label="Email" value={clientEmail} onChange={setClientEmail} placeholder="you@company.com" type="email" />
        </SectionCard>

        {/* Dynamic sections */}
        {sections.map(([section, sectionFields]) => (
          <SectionCard key={section} title={section}>
            {sectionFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={answers[field.id]}
                onText={(v) => setText(field.id, v)}
                onUpload={(files) => handleFileUpload(field, files)}
                onRemoveFile={(fileId) => removeFile(field.id, fileId)}
                uploading={uploadingField === field.id}
              />
            ))}
          </SectionCard>
        ))}

        {ErrorBanner}

        {/* Submit bar */}
        <div className="flex items-center justify-between gap-3 mt-2">
          {SavedIndicator}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? "Submitting…" : "Submit form"}
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground/70 text-center mt-8">
          Powered by <a href="https://clorefy.com" className="hover:underline">Clorefy</a>. Your information is kept confidential.
        </p>
      </div>
    </div>
  )
}

// ── Small presentational helpers ───────────────────────────────────────────────

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/30 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">{children}</div>
    </div>
  )
}

// ── Post-submission screen: thank-you + document preview + downloads ───────────

function SubmittedScreen({ business, form, token }: {
  business: Business | null
  form: OnboardFormData | null
  token: string
}) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleDownloadPdf = useCallback(async () => {
    if (!form?.preview || downloading) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const { ClientOnboardingFormPDF } = await import("@/lib/pdf-templates")
      const logoUrl = business?.logoUrl || null
      const blob = await pdf(
        <ClientOnboardingFormPDF data={form.preview as any} logoUrl={logoUrl} />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `onboarding-${(form.preview as any).referenceNumber || "form"}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setDownloadError("Could not generate the PDF. Please try again.")
    } finally {
      setDownloading(false)
    }
  }, [form, business, downloading])

  const handleDownloadFile = useCallback((fileId: string, fileName: string) => {
    const a = document.createElement("a")
    a.href = `/api/onboarding/upload?token=${encodeURIComponent(token)}&fileId=${encodeURIComponent(fileId)}`
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [token])

  const preview = form?.preview as any
  const clientFiles = form?.clientFiles ?? []

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <div className="flex flex-col items-center gap-3 text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Thank you!</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your responses have been sent to {business?.name || "the sender"}.
          </p>
        </div>

        {/* Document preview */}
        {preview && (
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your submitted form</p>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
            </div>
            {downloadError && <p className="text-xs text-destructive mb-3">{downloadError}</p>}

            <div className="space-y-3">
              {preview.projectName && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Project</p>
                  <p className="text-sm text-foreground font-medium">{preview.projectName}</p>
                </div>
              )}
              {Array.isArray(preview.customQuestions) && preview.customQuestions.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  {preview.customQuestions.map((qa: { question: string; answer: string }, i: number) => (
                    <div key={i} className="border-t border-border/60 pt-2.5 first:border-t-0 first:pt-0">
                      <p className="text-xs font-medium text-foreground">{qa.question}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{qa.answer || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Client's own uploaded files */}
        {clientFiles.length > 0 && (
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 sm:p-6 mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Your uploaded files</p>
            <div className="space-y-1.5">
              {clientFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleDownloadFile(f.id, f.fileName)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                >
                  {/\.(png|jpe?g|webp|gif)$/i.test(f.fileName)
                    ? <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  <span className="text-xs text-foreground truncate flex-1">{f.fileName}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">Download</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center mt-2">You can close this page.</p>
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5 mb-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-4">{title}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
      />
    </div>
  )
}

function FieldRenderer({ field, value, onText, onUpload, onRemoveFile, uploading }: {
  field: Field
  value: AnswerValue | undefined
  onText: (v: string) => void
  onUpload: (files: FileList | null) => void
  onRemoveFile: (fileId: string) => void
  uploading: boolean
}) {
  const label = (
    <label className="text-sm font-medium text-foreground mb-1.5 block">
      {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )

  if (field.type === "external_link") {
    if (!field.externalUrl) return null
    return (
      <div>
        {label}
        <a
          href={field.externalUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-colors px-4 py-4"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <CloudUpload className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{field.placeholder || "Drop your assets here"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Opens a secure folder in a new tab</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
        </a>
      </div>
    )
  }

  if (field.type === "file") {
    const files = Array.isArray(value) ? value : []
    return (
      <div>
        {label}
        <label className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 transition-colors px-4 py-6 cursor-pointer text-center">
          <input
            type="file"
            accept={field.accept}
            multiple={field.multiple}
            className="hidden"
            onChange={(e) => { onUpload(e.target.files); if (e.target) e.target.value = "" }}
          />
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
          </div>
          <span className="text-sm text-foreground">{uploading ? "Uploading…" : (field.placeholder || "Click to upload")}</span>
          <span className="text-[11px] text-muted-foreground">Images or PDF only · max 10MB · no videos</span>
        </label>
        {files.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {files.map((f) => (
              <div key={f.fileId} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
                {/\.(png|jpe?g|webp|gif)$/i.test(f.fileName) ? <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <span className="text-xs text-foreground truncate flex-1">{f.fileName}</span>
                <button type="button" onClick={() => onRemoveFile(f.fileId)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remove file">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const text = typeof value === "string" ? value : ""
  if (field.type === "long_text") {
    return (
      <div>
        {label}
        <textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
        />
      </div>
    )
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder={field.placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
      />
    </div>
  )
}

function groupBySection(fields: Field[]): Array<[string, Field[]]> {
  const map = new Map<string, Field[]>()
  for (const f of fields) {
    const key = f.section || "Questions"
    const arr = map.get(key) ?? []
    arr.push(f)
    map.set(key, arr)
  }
  return Array.from(map.entries())
}
