"use client"

import { useState, useRef, useCallback } from "react"
import {
    Upload,
    FileText,
    Check,
    X,
    Loader2,
    AlertCircle,
    RefreshCw,
    ArrowRight,
    SkipForward,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { authFetch } from "@/lib/auth-fetch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import type { CollectedData } from "@/components/onboarding-chat"

// ── Interfaces ─────────────────────────────────────────────────────────

export interface UploadedFile {
    id: string
    file: File
    status: "pending" | "uploading" | "analyzing" | "complete" | "failed"
    storagePath?: string
    extractedData?: Partial<CollectedData>
    fieldsFound?: number
    error?: string
}

interface UploadScreenProps {
    onContinue: (extractedData: CollectedData) => void
    onSkip: () => void
}

// ── Constants ──────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ── Exported pure functions ────────────────────────────────────────────

export function validateFile(file: { type: string; size: number }): { valid: boolean; error?: string } {
    if (!ALLOWED_TYPES.includes(file.type)) {
        return { valid: false, error: "Unsupported format. Please upload PDF, PNG, or JPEG files." }
    }
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: "File too large. Maximum size is 10MB." }
    }
    return { valid: true }
}

export function generateStoragePath(userId: string, fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "bin"
    const uuid = crypto.randomUUID()
    return `documents/${userId}/${uuid}.${ext}`
}

export function mergeExtractedData(
    existing: CollectedData,
    extracted: Record<string, unknown>
): CollectedData {
    const updated = { ...existing }

    for (const [key, value] of Object.entries(extracted)) {
        if (value === null || value === undefined || value === "") continue

        if (key === "address" && typeof value === "object") {
            updated.address = { ...existing.address, ...(value as Record<string, string>) }
        } else if (key === "bankDetails" && typeof value === "object") {
            updated.bankDetails = { ...existing.bankDetails, ...(value as Record<string, string>) }
        } else if (key === "additionalContext") {
            updated.additionalNotes = (existing.additionalNotes || "") + "\n" + String(value)
        } else if (key === "phone2" && value) {
            updated.additionalNotes = (existing.additionalNotes || "") + "\nSecondary phone: " + String(value)
        } else if (key === "services" && typeof value === "string" && value.trim().length > 0) {
            updated.services = String(value)
        } else if (key === "paymentTerms" && typeof value === "string" && value.trim().length > 0) {
            updated.paymentTerms = String(value)
        } else if (key in updated || [
            "businessType", "country", "businessName", "ownerName", "email",
            "phone", "taxId", "defaultCurrency", "paymentInstructions",
        ].includes(key)) {
            (updated as any)[key] = value
        } else if (key === "clientCountries" && Array.isArray(value)) {
            updated.clientCountries = value as string[]
        }
    }

    return updated
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function countExtractedFields(data: CollectedData): number {
    let count = 0
    for (const [, value] of Object.entries(data)) {
        if (value === null || value === undefined || value === "") continue
        if (typeof value === "object" && !Array.isArray(value)) {
            const hasValue = Object.values(value).some(v => v && String(v).trim().length > 0)
            if (hasValue) count++
        } else if (Array.isArray(value)) {
            if (value.length > 0) count++
        } else if (String(value).trim().length > 0) {
            count++
        }
    }
    return count
}

const FIELD_LABELS: Record<string, string> = {
    businessType: "Business Type",
    country: "Country",
    businessName: "Business Name",
    ownerName: "Owner Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    taxId: "Tax ID",
    clientCountries: "Client Countries",
    defaultCurrency: "Currency",
    paymentTerms: "Payment Terms",
    services: "Services",
    bankDetails: "Bank Details",
    additionalNotes: "Additional Notes",
    paymentInstructions: "Payment Instructions",
}

// ── Component ──────────────────────────────────────────────────────────

export function UploadScreen({ onContinue, onSkip }: UploadScreenProps) {
    const { user } = useAuth()
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [mergedData, setMergedData] = useState<CollectedData>({})
    const [isDragOver, setIsDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ── File processing pipeline ───────────────────────────────────────

    const processFile = useCallback(async (uploadedFile: UploadedFile) => {
        if (!user) return

        // Step 1: Upload to R2 via presigned URL
        setFiles(prev => prev.map(f => f.id === uploadedFile.id ? { ...f, status: "uploading" as const } : f))

        try {
            const formData = new FormData()
            formData.append("file", uploadedFile.file)
            formData.append("category", "documents")

            const uploadRes = await authFetch("/api/storage/upload", {
                method: "POST",
                body: formData,
            })

            if (!uploadRes.ok) {
                const err = await uploadRes.json().catch(() => ({}))
                setFiles(prev => prev.map(f =>
                    f.id === uploadedFile.id
                        ? { ...f, status: "failed" as const, error: err.error || "Upload failed. Tap to retry." }
                        : f
                ))
                return
            }

            const { objectKey } = await uploadRes.json()

            setFiles(prev => prev.map(f =>
                f.id === uploadedFile.id
                    ? { ...f, status: "analyzing" as const, storagePath: objectKey }
                    : f
            ))

            // Step 2: Analyze via /api/ai/analyze-file (unchanged)
            const formData = new FormData()
            formData.append("file", uploadedFile.file)

            let res = await fetch("/api/ai/analyze-file", {
                method: "POST",
                body: formData,
            })

            // Handle 429 with retry
            if (res.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 5000))
                res = await fetch("/api/ai/analyze-file", {
                    method: "POST",
                    body: formData,
                })
                if (!res.ok) {
                    setFiles(prev => prev.map(f =>
                        f.id === uploadedFile.id
                            ? { ...f, status: "failed" as const, error: "Service is busy. You can continue to the chat and type your details." }
                            : f
                    ))
                    return
                }
            } else if (!res.ok) {
                const errBody = await res.json().catch(() => ({}))
                setFiles(prev => prev.map(f =>
                    f.id === uploadedFile.id
                        ? { ...f, status: "failed" as const, error: errBody.error || "Analysis failed." }
                        : f
                ))
                return
            }

            const result = await res.json()
            const extracted = result.extracted || {}
            const fieldsFound = result.fieldsFound || 0

            // Step 3: Merge extracted data (last-write-wins)
            setMergedData(prev => mergeExtractedData(prev, extracted))

            setFiles(prev => prev.map(f =>
                f.id === uploadedFile.id
                    ? { ...f, status: "complete" as const, extractedData: extracted, fieldsFound }
                    : f
            ))

            toast.success(`${fieldsFound} field${fieldsFound !== 1 ? "s" : ""} extracted!`, { duration: 2000 })
        } catch (err: unknown) {
            setFiles(prev => prev.map(f =>
                f.id === uploadedFile.id
                    ? { ...f, status: "failed" as const, error: "Connection issue. Check your internet and try again." }
                    : f
            ))
        }
    }, [user])

    const addFiles = useCallback((newFiles: File[]) => {
        const validFiles: UploadedFile[] = []

        for (const file of newFiles) {
            const validation = validateFile({ type: file.type, size: file.size })
            if (!validation.valid) {
                toast.error(validation.error)
                continue
            }
            validFiles.push({
                id: crypto.randomUUID(),
                file,
                status: "pending",
            })
        }

        if (validFiles.length === 0) return

        setFiles(prev => [...prev, ...validFiles])
        validFiles.forEach(f => processFile(f))
    }, [processFile])

    const retryFile = useCallback((fileId: string) => {
        const file = files.find(f => f.id === fileId)
        if (!file) return
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: "pending" as const, error: undefined } : f))
        processFile({ ...file, status: "pending", error: undefined })
    }, [files, processFile])

    const removeFile = useCallback((fileId: string) => {
        setFiles(prev => prev.filter(f => f.id !== fileId))
    }, [])

    // ── Drag and drop handlers ─────────────────────────────────────────

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        const droppedFiles = Array.from(e.dataTransfer.files)
        addFiles(droppedFiles)
    }, [addFiles])

    const handleBrowseClick = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || [])
        addFiles(selected)
        e.target.value = ""
    }, [addFiles])

    // ── Derived state ──────────────────────────────────────────────────

    const hasCompleteFile = files.some(f => f.status === "complete")
    const isProcessing = files.some(f => f.status === "uploading" || f.status === "analyzing")
    const extractedFieldCount = countExtractedFields(mergedData)

    const handleContinue = () => {
        onContinue(mergedData)
    }

    // ── Render ─────────────────────────────────────────────────────────

    return (
        <div className="flex-1 flex flex-col items-center overflow-hidden">
            <ScrollArea className="flex-1 w-full">
                <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 space-y-6">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
                            Upload Your Business Documents
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Upload catalogues, business cards, letterheads, or invoices and we&apos;ll
                            extract your business details automatically.
                        </p>
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleBrowseClick}
                        className={cn(
                            "relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200",
                            isDragOver
                                ? "border-primary bg-primary/5 scale-[1.01]"
                                : "border-border hover:border-primary/50 hover:bg-muted/30"
                        )}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            multiple
                            className="hidden"
                            onChange={handleFileInputChange}
                        />
                        <div className="flex flex-col items-center gap-3">
                            <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                                isDragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                <Upload className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    {isDragOver ? "Drop files here" : "Drag & drop files here"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    or <span className="text-primary underline underline-offset-2">browse</span> to select
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                PDF, PNG, or JPEG — up to 10MB each
                            </p>
                        </div>
                    </div>

                    {/* File list */}
                    {files.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-foreground">
                                Uploaded Files ({files.length})
                            </h3>
                            <div className="space-y-2">
                                {files.map(f => (
                                    <div
                                        key={f.id}
                                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
                                    >
                                        <div className={cn(
                                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                                            f.status === "complete" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                : f.status === "failed" ? "bg-destructive/10 text-destructive"
                                                : "bg-muted text-muted-foreground"
                                        )}>
                                            {f.status === "complete" ? <Check className="w-4 h-4" />
                                                : f.status === "failed" ? <AlertCircle className="w-4 h-4" />
                                                : <FileText className="w-4 h-4" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {f.file.name}
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{formatFileSize(f.file.size)}</span>
                                                <span>·</span>
                                                {f.status === "pending" && <span>Pending</span>}
                                                {f.status === "uploading" && (
                                                    <span className="flex items-center gap-1">
                                                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                                                    </span>
                                                )}
                                                {f.status === "analyzing" && (
                                                    <span className="flex items-center gap-1">
                                                        <Loader2 className="w-3 h-3 animate-spin" /> Analyzing
                                                    </span>
                                                )}
                                                {f.status === "complete" && (
                                                    <span className="text-emerald-600 dark:text-emerald-400">
                                                        {f.fieldsFound} field{f.fieldsFound !== 1 ? "s" : ""} found
                                                    </span>
                                                )}
                                                {f.status === "failed" && (
                                                    <span className="text-destructive">{f.error || "Failed"}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            {f.status === "failed" && (
                                                <button
                                                    type="button"
                                                    onClick={() => retryFile(f.id)}
                                                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    aria-label="Retry upload"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            )}
                                            {(f.status === "pending" || f.status === "failed") && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(f.id)}
                                                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    aria-label="Remove file"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Extracted fields summary */}
                    {extractedFieldCount > 0 && (
                        <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                            <h3 className="text-sm font-medium text-foreground">
                                Extracted Information ({extractedFieldCount} fields)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(mergedData).map(([key, value]) => {
                                    if (value === null || value === undefined || value === "") return null
                                    const label = FIELD_LABELS[key] || key

                                    let displayValue: string
                                    if (typeof value === "object" && !Array.isArray(value)) {
                                        const parts = Object.values(value).filter(v => v && String(v).trim())
                                        if (parts.length === 0) return null
                                        displayValue = parts.join(", ")
                                    } else if (Array.isArray(value)) {
                                        if (value.length === 0) return null
                                        displayValue = value.join(", ")
                                    } else {
                                        displayValue = String(value)
                                    }

                                    if (!displayValue.trim()) return null

                                    return (
                                        <div key={key} className="text-xs">
                                            <span className="text-muted-foreground">{label}: </span>
                                            <span className="text-foreground font-medium truncate">
                                                {displayValue.length > 60 ? displayValue.slice(0, 57) + "..." : displayValue}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 pb-4">
                        <Button
                            onClick={handleContinue}
                            disabled={!hasCompleteFile || isProcessing}
                            className="w-full sm:w-auto gap-2"
                            size="lg"
                        >
                            Continue
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={onSkip}
                            className="w-full sm:w-auto gap-2 text-muted-foreground"
                            size="lg"
                        >
                            <SkipForward className="w-4 h-4" />
                            Skip, I&apos;ll type my details
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
