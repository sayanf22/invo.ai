"use client"

import { useState, useRef, useCallback, useEffect } from "react"
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
import { motion, AnimatePresence } from "framer-motion"
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
    const [mergedData, setMergedData] = useState<CollectedData>(() => {
        // Restore extracted data from localStorage on mount
        if (typeof window === "undefined") return {}
        try {
            const saved = localStorage.getItem("clorefy_upload_extracted")
            return saved ? JSON.parse(saved) : {}
        } catch { return {} }
    })
    const [isDragOver, setIsDragOver] = useState(false)
    const [visibleFields, setVisibleFields] = useState<string[]>(() => {
        // On mount, immediately show all previously extracted fields (no stagger on restore)
        if (typeof window === "undefined") return []
        try {
            const saved = localStorage.getItem("clorefy_upload_extracted")
            if (!saved) return []
            const data = JSON.parse(saved) as CollectedData
            return Object.entries(data)
                .filter(([, v]) => {
                    if (v === null || v === undefined || v === "") return false
                    if (typeof v === "object" && !Array.isArray(v)) {
                        return Object.values(v).some(val => val && String(val).trim().length > 0)
                    }
                    if (Array.isArray(v)) return v.length > 0
                    return String(v).trim().length > 0
                })
                .map(([k]) => k)
        } catch { return [] }
    })
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Persist extracted data to localStorage whenever it changes
    useEffect(() => {
        const hasData = Object.keys(mergedData).length > 0
        if (hasData) {
            localStorage.setItem("clorefy_upload_extracted", JSON.stringify(mergedData))
        }
    }, [mergedData])

    // Stagger extracted fields one by one when mergedData changes
    useEffect(() => {
        const allKeys = Object.entries(mergedData)
            .filter(([, v]) => {
                if (v === null || v === undefined || v === "") return false
                if (typeof v === "object" && !Array.isArray(v)) {
                    return Object.values(v).some(val => val && String(val).trim().length > 0)
                }
                if (Array.isArray(v)) return v.length > 0
                return String(v).trim().length > 0
            })
            .map(([k]) => k)

        // Find new keys not yet visible
        const newKeys = allKeys.filter(k => !visibleFields.includes(k))
        if (newKeys.length === 0) return

        // Stagger each new field with 150ms delay
        newKeys.forEach((key, i) => {
            setTimeout(() => {
                setVisibleFields(prev => prev.includes(key) ? prev : [...prev, key])
            }, i * 150)
        })
    }, [mergedData]) // eslint-disable-line react-hooks/exhaustive-deps

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
            const analyzeFormData = new FormData()
            analyzeFormData.append("file", uploadedFile.file)

            let res = await fetch("/api/ai/analyze-file", {
                method: "POST",
                body: analyzeFormData,
            })

            // Handle 429 with retry
            if (res.status === 429) {
                await new Promise(resolve => setTimeout(resolve, 5000))
                res = await fetch("/api/ai/analyze-file", {
                    method: "POST",
                    body: analyzeFormData,
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
    const hasRestoredData = Object.keys(mergedData).length > 0 && files.length === 0
    const isProcessing = files.some(f => f.status === "uploading" || f.status === "analyzing")
    const extractedFieldCount = countExtractedFields(mergedData)

    const handleContinue = () => {
        // Clean up upload-specific localStorage — the parent persists extractedData separately
        localStorage.removeItem("clorefy_upload_extracted")
        onContinue(mergedData)
    }

    // ── Render ─────────────────────────────────────────────────────────

    return (
        <div className="flex-1 flex flex-col items-center overflow-hidden h-full">
            <ScrollArea className="flex-1 w-full">
                <div className="max-w-lg mx-auto px-5 py-6 sm:px-6 sm:py-8 space-y-5">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h2 className="text-base sm:text-xl font-semibold text-foreground leading-snug">
                            Upload your business documents
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                            Upload catalogues, business cards, or invoices — we&apos;ll extract your details automatically.
                        </p>
                    </div>

                    {/* Drop zone — minimal, monochromatic */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleBrowseClick}
                        className={cn(
                            "relative border border-dashed rounded-2xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-200",
                            isDragOver
                                ? "border-foreground/40 bg-muted/50 scale-[1.01]"
                                : "border-border hover:border-foreground/30 hover:bg-muted/20"
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
                        <div className="flex flex-col items-center gap-2">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                isDragOver ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
                            )}>
                                <Upload className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">
                                    {isDragOver ? "Drop files here" : "Tap to upload"}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    PDF, PNG, or JPEG — up to 10MB
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* File list — animated, monochromatic */}
                    <AnimatePresence mode="popLayout">
                        {files.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="space-y-2 overflow-hidden"
                            >
                                <div className="space-y-1.5">
                                    <AnimatePresence mode="popLayout">
                                        {files.map((f, idx) => (
                                            <motion.div
                                                key={f.id}
                                                layout
                                                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.97, y: -8 }}
                                                transition={{ duration: 0.3, delay: idx * 0.05, ease: "easeOut" }}
                                                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300",
                                                    f.status === "complete" ? "bg-foreground/10 text-foreground"
                                                        : f.status === "failed" ? "bg-destructive/10 text-destructive"
                                                        : (f.status === "analyzing" || f.status === "uploading") ? "bg-muted text-muted-foreground"
                                                        : "bg-muted text-muted-foreground"
                                                )}>
                                                    {f.status === "complete" ? (
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                                                            <Check className="w-3.5 h-3.5" />
                                                        </motion.div>
                                                    ) : f.status === "failed" ? <AlertCircle className="w-3.5 h-3.5" />
                                                    : (f.status === "uploading" || f.status === "analyzing") ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <FileText className="w-3.5 h-3.5" />}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-foreground truncate">
                                                        {f.file.name}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                                        <span>{formatFileSize(f.file.size)}</span>
                                                        {f.status === "pending" && <><span>·</span><span>Queued</span></>}
                                                        {f.status === "uploading" && <><span>·</span><span>Uploading…</span></>}
                                                        {f.status === "analyzing" && <><span>·</span><span>Analyzing…</span></>}
                                                        {f.status === "complete" && (
                                                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                                                <span>·</span> {f.fieldsFound} fields found
                                                            </motion.span>
                                                        )}
                                                        {f.status === "failed" && <><span>·</span><span className="text-destructive line-clamp-1">{f.error || "Failed"}</span></>}
                                                    </div>
                                                </div>

                                                <div className="flex items-center shrink-0">
                                                    {f.status === "failed" && (
                                                        <button type="button" onClick={() => retryFile(f.id)}
                                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                            aria-label="Retry">
                                                            <RefreshCw className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {(f.status === "pending" || f.status === "failed") && (
                                                        <button type="button" onClick={() => removeFile(f.id)}
                                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                            aria-label="Remove">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Extracted fields — monochromatic, staggered */}
                    <AnimatePresence>
                        {visibleFields.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="rounded-2xl border border-border bg-card p-4 space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Extracted details
                                    </h3>
                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                        {visibleFields.length} fields
                                    </span>
                                </div>
                                <div className="space-y-0.5">
                                    <AnimatePresence mode="popLayout">
                                        {visibleFields.map((key) => {
                                            const value = (mergedData as any)[key]
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
                                                <motion.div
                                                    key={key}
                                                    layout
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                                    className="flex items-baseline gap-2 py-1.5 border-b border-border/40 last:border-0"
                                                >
                                                    <span className="text-[11px] text-muted-foreground shrink-0 w-20 sm:w-24">{label}</span>
                                                    <span className="text-xs font-medium text-foreground truncate flex-1">
                                                        {displayValue.length > 40 ? displayValue.slice(0, 37) + "…" : displayValue}
                                                    </span>
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 pt-1 pb-8">
                        <Button
                            onClick={handleContinue}
                            disabled={(!hasCompleteFile && !hasRestoredData) || isProcessing}
                            className="w-full gap-2 h-11 text-sm font-medium rounded-xl"
                        >
                            {isProcessing ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                            ) : (
                                <><span>Continue</span> <ArrowRight className="w-4 h-4" /></>
                            )}
                        </Button>
                        <button
                            type="button"
                            onClick={onSkip}
                            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2.5"
                        >
                            Skip — I&apos;ll type my details
                        </button>
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
