"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { useParams } from "next/navigation"
import { SignaturePad } from "@/components/signature-pad"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { InvoLogo } from "@/components/invo-logo"
import {
    Loader2,
    CheckCircle2,
    XCircle,
    FileText,
    Shield,
    Clock,
    ExternalLink,
    ChevronDown,
    AlertTriangle,
    MessageSquare,
} from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"

interface BusinessData {
    name: string
    logo_url: string | null
}

interface SignatureData {
    id: string
    signer_name: string | null
    signer_email: string
    party: string
    signed_at: string | null
    expires_at: string | null
    verification_url: string | null
    documents: {
        id: string
        type: string
        data: Record<string, unknown>
        status: string | null
    }
    session_id?: string | null
}

interface ConfirmationData {
    signerName: string
    documentReference: string
    signedAt: string
    verificationUrl: string | null
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })
}

function formatUTC(dateStr: string): string {
    return new Date(dateStr).toUTCString()
}

function getDocumentReference(signature: SignatureData): string {
    const data = signature.documents?.data as Record<string, unknown> | undefined
    if (!data) return ""
    return (data.invoiceNumber as string) || (data.referenceNumber as string) || ""
}

function getDocumentType(signature: SignatureData): string {
    const type = signature.documents?.type
    if (!type) return "Document"
    return type.charAt(0).toUpperCase() + type.slice(1)
}

// ── Inline PDF Viewer for signing page ───────────────────────────────────────
// Renders the actual document PDF so the signer can read what they're signing.
// Uses the same PDF templates as the rest of the app.

const PDF_OPTIONS = { standardFontDataUrl: "/standard_fonts/", cMapUrl: "/cmaps/", cMapPacked: true } as const

function SigningDocumentPreview({ context, documentType }: { context: any; documentType: string | null }) {
    const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
    const [rendering, setRendering] = useState(false)
    const [open, setOpen] = useState(false) // collapsed by default on mobile
    const [ViewerComponents, setViewerComponents] = useState<{ Document: any; Page: any } | null>(null)
    const [numPages, setNumPages] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(0)
    const optionsRef = useRef(PDF_OPTIONS)

    // Load react-pdf viewer
    useEffect(() => {
        let cancelled = false
        import("react-pdf").then(m => {
            m.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
            if (!cancelled) setViewerComponents({ Document: m.Document, Page: m.Page })
        })
        return () => { cancelled = true }
    }, [])

    // Measure container width
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const obs = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width))
        obs.observe(el)
        setContainerWidth(el.clientWidth)
        return () => obs.disconnect()
    }, [])

    // Generate PDF when context is available and panel is opened
    useEffect(() => {
        if (!context || !open) return
        let cancelled = false
        const generate = async () => {
            setRendering(true)
            try {
                const { pdf } = await import("@react-pdf/renderer")
                const { resolveLogoUrl } = await import("@/lib/resolve-logo-url")
                const templates = await import("@/lib/pdf-templates")
                const docData = cleanDataForExport(context as InvoiceData)
                const logoUrl = await resolveLogoUrl(docData.fromLogo)
                const docType = (docData.documentType || documentType || "").toLowerCase()

                let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
                switch (docType) {
                    case "contract": PdfComponent = templates.ContractPDF; break
                    case "quotation": PdfComponent = templates.QuotationPDF; break
                    case "proposal": PdfComponent = templates.ProposalPDF; break
                    default: PdfComponent = templates.InvoicePDF; break
                }

                const blob = await pdf(<PdfComponent data={docData} logoUrl={logoUrl} />).toBlob()
                if (cancelled) return
                const buf = await blob.arrayBuffer()
                setPdfBytes(new Uint8Array(buf))
            } catch (err) {
                console.error("Sign page PDF render error:", err)
            } finally {
                if (!cancelled) setRendering(false)
            }
        }
        generate()
        return () => { cancelled = true }
    }, [context, documentType, open])

    const fileData = useMemo(() => pdfBytes ? { data: pdfBytes.slice() } : null, [pdfBytes])
    const pageWidth = containerWidth > 0 ? Math.min(containerWidth - 16, 560) : 400

    if (!context) return null

    return (
        <div className="rounded-xl border border-border overflow-hidden">
            {/* Toggle header */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold text-foreground">View Document</span>
                    <span className="text-xs text-muted-foreground">(read before signing)</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>

            {/* PDF content */}
            {open && (
                <div ref={containerRef} className="bg-neutral-100 dark:bg-neutral-900 overflow-auto max-h-[70vh]">
                    {rendering && (
                        <div className="flex items-center justify-center py-12">
                            <div className="flex items-center gap-2.5 bg-card px-4 py-2.5 rounded-xl shadow border border-border/60">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Loading document...</span>
                            </div>
                        </div>
                    )}
                    {fileData && ViewerComponents && !rendering && (
                        <div className="flex flex-col items-center gap-4 py-4 px-2">
                            <ViewerComponents.Document
                                file={fileData}
                                onLoadSuccess={({ numPages: n }: { numPages: number }) => setNumPages(n)}
                                options={optionsRef.current}
                                loading={
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                }
                            >
                                {Array.from({ length: numPages }, (_, i) => (
                                    <div key={i} className="shadow-lg rounded-lg overflow-hidden bg-white mb-4">
                                        <ViewerComponents.Page
                                            pageNumber={i + 1}
                                            width={pageWidth}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                        />
                                    </div>
                                ))}
                            </ViewerComponents.Document>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function SigningPage() {
    const params = useParams()
    const token = params.token as string

    const [isLoading, setIsLoading] = useState(true)
    const [signature, setSignature] = useState<SignatureData | null>(null)
    const [business, setBusiness] = useState<BusinessData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isExpired, setIsExpired] = useState(false)
    const [isCancelled, setIsCancelled] = useState(false)
    const [isAlreadySigned, setIsAlreadySigned] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null)
    const [autoInvoiceOnSign, setAutoInvoiceOnSign] = useState(false)
    const [sessionContext, setSessionContext] = useState<any>(null)
    const [documentType, setDocumentType] = useState<string | null>(null)

    // Signature image for already-signed screen (loaded from R2 via API)
    const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null)

    // Form state
    const [consentChecked, setConsentChecked] = useState(false)
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)

    // Decline / revision state
    const [showDeclinePanel, setShowDeclinePanel] = useState(false)
    const [showRevisionPanel, setShowRevisionPanel] = useState(false)
    const [declineReason, setDeclineReason] = useState("")
    const [revisionReason, setRevisionReason] = useState("")
    const [isResponding, setIsResponding] = useState(false)
    const [responseResult, setResponseResult] = useState<{ action: "declined" | "revision_requested"; message: string } | null>(null)

    useEffect(() => {
        async function loadSignature() {
            try {
                const response = await fetch(`/api/signatures?token=${token}`)
                const data = await response.json()

                if (response.status === 410) {
                    const data410 = await response.json().catch(() => ({}))
                    if (data410.cancelled) {
                        setIsCancelled(true)
                    } else {
                        setIsExpired(true)
                    }
                    return
                }

                if (!response.ok) {
                    setError(data.error || "Failed to load signing request")
                    return
                }

                const sig: SignatureData = data.signature
                setBusiness(data.business ?? null)
                setAutoInvoiceOnSign(!!data.autoInvoiceOnSign)
                setSessionContext(data.sessionContext ?? null)
                setDocumentType(data.documentType ?? null)
                setSignature(sig)

                // Sub-task 13.4: already-signed state
                if (sig.signed_at) {
                    setIsAlreadySigned(true)
                    if (data.signatureImageDataUrl) {
                        setSignedImageUrl(data.signatureImageDataUrl)
                    }
                }
            } catch (err) {
                setError("Failed to load signing request")
                console.error(err)
            } finally {
                setIsLoading(false)
            }
        }

        if (token) {
            loadSignature()
        } else {
            setError("Invalid signing link")
            setIsLoading(false)
        }
    }, [token])

    const handleSubmitSignature = async () => {
        if (!signatureDataUrl || !consentChecked || !signature) {
            toast.error("Please draw your signature and check the consent box")
            return
        }

        setIsSubmitting(true)

        try {
            const response = await fetch("/api/signatures/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, signatureDataUrl }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit signature")
            }

            // Sub-task 13.5: show confirmation screen
            const docRef = getDocumentReference(signature)
            setConfirmation({
                signerName: signature.signer_name ?? "Signer",
                documentReference: docRef,
                signedAt: new Date().toISOString(),
                verificationUrl: data.verificationUrl ?? signature.verification_url ?? null,
            })
        } catch (err) {
            console.error("Signing error:", err)
            toast.error(err instanceof Error ? err.message : "Failed to submit signature. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRespond = async (action: "declined" | "revision_requested", reason: string) => {
        if (action === "revision_requested" && !reason.trim()) {
            toast.error("Please describe the changes you need")
            return
        }
        setIsResponding(true)
        try {
            const response = await fetch("/api/signatures/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, action, reason: reason.trim() || undefined }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to submit response")
            setResponseResult({ action, message: data.message })
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to submit. Please try again.")
        } finally {
            setIsResponding(false)
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Sub-task 13.4: Expired token — do NOT render signature pad
    if (isExpired) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <header className="border-b py-4 px-6 flex items-center justify-between">
                    <InvoLogo />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shield className="h-4 w-4 text-green-500" />
                        Secured by Invo.ai
                    </div>
                </header>
                <main className="flex-1 flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-md text-center space-y-4">
                        <Clock className="h-16 w-16 text-amber-500 mx-auto" />
                        <h1 className="text-2xl font-semibold">Signing Link Expired</h1>
                        <p className="text-muted-foreground">
                            This signing link has expired and is no longer valid. Please contact the
                            document owner to request a new signing link.
                        </p>
                    </div>
                </main>
            </div>
        )
    }

    // Generic error state
    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
                <div className="w-full max-w-md text-center space-y-4">
                    <XCircle className="h-16 w-16 text-destructive mx-auto" />
                    <h1 className="text-2xl font-semibold">Unable to Sign</h1>
                    <p className="text-muted-foreground">{error}</p>
                </div>
            </div>
        )
    }

    // Cancelled state — professional message
    if (isCancelled) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <header className="border-b py-4 px-6 flex items-center justify-between">
                    <InvoLogo />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shield className="h-4 w-4 text-green-500" />
                        Secured by Clorefy
                    </div>
                </header>
                <main className="flex-1 flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-md">
                        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                            <div className="px-8 py-8 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                                    <XCircle className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-xl font-semibold text-foreground">
                                        This signing request is no longer available
                                    </h1>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        The document owner has withdrawn this signing request. This link is no longer valid and cannot be used to sign the document.
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-border/50">
                                    <p className="text-xs text-muted-foreground">
                                        If you believe this is an error, please contact the sender directly to request a new signing link.
                                    </p>
                                </div>
                            </div>
                            <div className="px-8 py-4 bg-muted/30 border-t border-border/50">
                                <p className="text-xs text-muted-foreground text-center">
                                    Powered by <span className="font-semibold text-foreground">Clorefy</span> · Secure Electronic Signatures
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    if (isAlreadySigned && signature) {
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <header className="border-b py-4 px-6 flex items-center justify-between">
                    <InvoLogo />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shield className="h-4 w-4 text-green-500" />
                        Secured by Invo.ai
                    </div>
                </header>
                <main className="flex-1 flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-md text-center space-y-4">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                        <h1 className="text-2xl font-semibold">Already Signed</h1>
                        <p className="text-muted-foreground">
                            You already signed this document on{" "}
                            <span className="font-medium text-foreground">
                                {formatUTC(signature.signed_at!)}
                            </span>
                            .
                        </p>
                        {signature.verification_url && (
                            <a
                                href={signature.verification_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                                View verification <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                        {signedImageUrl && (
                            <div className="flex flex-col items-center pt-2">
                                <p className="text-sm text-muted-foreground mb-2">Your Signature</p>
                                <img
                                    src={signedImageUrl}
                                    alt="Your signature"
                                    className="max-w-[200px] h-auto border border-border rounded-lg p-2 bg-white"
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>
        )
    }

    // Response result (declined or revision requested)
    if (responseResult) {
        const isDeclined = responseResult.action === "declined"
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <header className="border-b py-4 px-6 flex items-center justify-between">
                    <InvoLogo />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shield className="h-4 w-4 text-green-500" />
                        Secured by Invo.ai
                    </div>
                </header>
                <main className="flex-1 flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-md text-center space-y-4">
                        {isDeclined ? (
                            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                        ) : (
                            <MessageSquare className="h-16 w-16 text-amber-500 mx-auto" />
                        )}
                        <h1 className="text-2xl font-semibold">
                            {isDeclined ? "Signature Declined" : "Revision Requested"}
                        </h1>
                        <p className="text-muted-foreground">{responseResult.message}</p>
                    </div>
                </main>
            </div>
        )
    }

    // Sub-task 13.5: Confirmation screen after successful submission
    if (confirmation) {
        const sessionId = (signature as any)?.session_id
        return (
            <div className="min-h-screen flex flex-col bg-background">
                <header className="border-b py-4 px-6 flex items-center justify-between">
                    <InvoLogo />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Shield className="h-4 w-4 text-green-500" />
                        Secured by Invo.ai
                    </div>
                </header>
                <main className="flex-1 px-4 py-10">
                    <div className="w-full max-w-md mx-auto space-y-6">
                        <div className="text-center space-y-2">
                            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                            <h1 className="text-2xl font-semibold">Signature Complete</h1>
                            <p className="text-muted-foreground">
                                Your signature has been recorded successfully.
                            </p>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-5 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Signer</span>
                                <span className="font-medium">{confirmation.signerName}</span>
                            </div>
                            {confirmation.documentReference && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Document</span>
                                    <span className="font-medium">{confirmation.documentReference}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Signed at</span>
                                <span className="font-medium">{formatUTC(confirmation.signedAt)}</span>
                            </div>
                            {signatureDataUrl && (
                                <div className="flex flex-col items-center pt-3 border-t border-border">
                                    <span className="text-muted-foreground text-xs mb-2">Your Signature</span>
                                    <img
                                        src={signatureDataUrl}
                                        alt="Your signature"
                                        className="max-w-[200px] h-auto border border-border rounded-lg p-2 bg-white"
                                    />
                                </div>
                            )}
                            {confirmation.verificationUrl && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Verification</span>
                                    <a
                                        href={confirmation.verificationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                    >
                                        Verify <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* View signed PDF button */}
                        {sessionId && (
                            <a
                                href={`/view/${sessionId}`}
                                className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                            >
                                <FileText className="h-4 w-4" />
                                View Signed Document
                            </a>
                        )}

                        <p className="text-xs text-center text-muted-foreground">
                            A confirmation email will be sent to {signature?.signer_email}
                        </p>
                        {autoInvoiceOnSign && (
                            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800/50 p-4">
                                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                                    An invoice has been automatically generated and sent to <strong>{signature?.signer_email}</strong>.
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        )
    }

    // Main signing form
    const docType = signature ? getDocumentType(signature) : "Document"
    const docRef = signature ? getDocumentReference(signature) : ""
    const isValidLogo =
        business?.logo_url &&
        (business.logo_url.startsWith("https://") || business.logo_url.startsWith("http://"))

    const canSubmit = consentChecked && !!signatureDataUrl && !isSubmitting

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="border-b py-4 px-6 flex items-center justify-between">
                <InvoLogo />
                {/* Sub-task 13.1: "Secured by Invo.ai" trust badge */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4 text-green-500" />
                    Secured by Invo.ai
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-lg space-y-8">

                    {/* Sub-task 13.1: Business branding */}
                    {business && (
                        <div className="flex items-center gap-3">
                            {isValidLogo && (
                                <Image
                                    src={business.logo_url!}
                                    alt={business.name}
                                    width={40}
                                    height={40}
                                    className="rounded-lg object-cover"
                                />
                            )}
                            <span className="text-lg font-semibold">{business.name}</span>
                        </div>
                    )}

                    {/* Sub-task 13.2: Document preview card */}
                    <div className="rounded-lg border bg-muted/30 p-5 space-y-3">
                        <div className="flex items-start gap-3">
                            <FileText className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0 space-y-1">
                                <p className="font-semibold text-base">{docType}</p>
                                {docRef && (
                                    <p className="text-sm text-muted-foreground">
                                        Reference: <span className="font-medium text-foreground">{docRef}</span>
                                    </p>
                                )}
                                {/* Sub-task 13.1: Expiry date */}
                                {signature?.expires_at && (
                                    <p className="text-sm text-muted-foreground">
                                        Expires:{" "}
                                        <span className="font-medium text-foreground">
                                            {formatDate(signature.expires_at)}
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Document PDF Preview — signer reads the actual document before signing */}
                    <SigningDocumentPreview context={sessionContext} documentType={documentType} />

                    {/* Signer info (readonly) */}
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Your Name</Label>
                            <Input value={signature?.signer_name || ""} disabled className="min-h-[44px]" />
                        </div>
                        <div className="space-y-2">
                            <Label>Your Email</Label>
                            <Input value={signature?.signer_email || ""} disabled className="min-h-[44px]" />
                        </div>
                    </div>

                    {/* Signature pad */}
                    <div className="space-y-2">
                        <Label>Your Signature</Label>
                        <SignaturePad onSignature={setSignatureDataUrl} />
                        {signatureDataUrl && (
                            <p className="text-sm text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" />
                                Signature captured
                            </p>
                        )}
                    </div>

                    {/* Sub-task 13.3: Consent checkbox with exact legal text */}
                    <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
                        <input
                            type="checkbox"
                            checked={consentChecked}
                            onChange={(e) => setConsentChecked(e.target.checked)}
                            className="mt-1 h-5 w-5 min-h-[20px] min-w-[20px] rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground leading-relaxed">
                            I agree that this electronic signature is legally binding and constitutes
                            my intent to sign this document electronically.
                        </span>
                    </label>

                    {/* Auto-invoice notice — shown when contract has auto_invoice_on_sign enabled */}
                    {autoInvoiceOnSign && (
                        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-800/50 p-4">
                            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                                    Invoice will be sent automatically
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                                    By signing this contract, an invoice will be automatically generated and sent to your email address.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sub-task 13.6: Submit button with min 44×44px touch target */}
                    <Button
                        onClick={handleSubmitSignature}
                        disabled={!canSubmit}
                        className="w-full min-h-[44px]"
                        size="lg"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Sign Document"
                        )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                        This signing session is encrypted and your signature will be securely stored.
                    </p>

                    {/* Decline / Request Revision section */}
                    <div className="border-t pt-6 space-y-3">
                        <p className="text-xs text-center text-muted-foreground">
                            Not ready to sign?
                        </p>
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 min-h-[44px] text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                onClick={() => { setShowDeclinePanel(true); setShowRevisionPanel(false) }}
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Decline
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 min-h-[44px] text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
                                onClick={() => { setShowRevisionPanel(true); setShowDeclinePanel(false) }}
                            >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Request Changes
                            </Button>
                        </div>

                        {/* Decline panel */}
                        {showDeclinePanel && (
                            <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 font-medium">Decline to sign</p>
                                </div>
                                <p className="text-xs text-red-600">
                                    The document owner will be notified that you declined. You can optionally provide a reason.
                                </p>
                                <Textarea
                                    placeholder="Reason for declining (optional)…"
                                    value={declineReason}
                                    onChange={(e) => setDeclineReason(e.target.value)}
                                    rows={3}
                                    className="text-sm"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => setShowDeclinePanel(false)}
                                        disabled={isResponding}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                        onClick={() => handleRespond("declined", declineReason)}
                                        disabled={isResponding}
                                    >
                                        {isResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Decline"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Request revision panel */}
                        {showRevisionPanel && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <MessageSquare className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-700 font-medium">Request changes</p>
                                </div>
                                <p className="text-xs text-amber-600">
                                    Describe what needs to be changed. The document owner will be notified and can send you a revised version.
                                </p>
                                <Textarea
                                    placeholder="Describe the changes you need…"
                                    value={revisionReason}
                                    onChange={(e) => setRevisionReason(e.target.value)}
                                    rows={3}
                                    className="text-sm"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => setShowRevisionPanel(false)}
                                        disabled={isResponding}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                                        onClick={() => handleRespond("revision_requested", revisionReason)}
                                        disabled={isResponding || !revisionReason.trim()}
                                    >
                                        {isResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Request"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
