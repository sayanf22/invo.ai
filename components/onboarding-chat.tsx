"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, Check, Paperclip, FileText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"

// ── Types ──────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: "user" | "assistant"
    content: string
}

export interface CollectedData {
    businessType?: string
    country?: string
    businessName?: string
    ownerName?: string
    email?: string
    phone?: string
    address?: {
        street?: string
        city?: string
        state?: string
        postalCode?: string
    }
    taxId?: string
    clientCountries?: string[]
    defaultCurrency?: string
    paymentTerms?: string
    paymentInstructions?: string
    bankDetails?: {
        bankName?: string
        accountName?: string
        accountNumber?: string
        ifscCode?: string
        swiftCode?: string
        routingNumber?: string
    }
    bankDetailsSkipped?: boolean
    logoUrl?: string | null
    signatureUrl?: string | null
    additionalNotes?: string
}

interface OnboardingChatProps {
    onComplete: (data: CollectedData) => void
    userEmail?: string
}

// ── Field Labels for Display ───────────────────────────────────────────

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
}

const REQUIRED_FIELDS = [
    "businessType", "country", "businessName", "ownerName",
    "email", "phone", "address", "clientCountries",
    "defaultCurrency", "paymentTerms"
]

const COUNTRY_FLAGS: Record<string, string> = {
    IN: "🇮🇳", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", CA: "🇨🇦",
    AU: "🇦🇺", SG: "🇸🇬", AE: "🇦🇪", PH: "🇵🇭", FR: "🇫🇷", NL: "🇳🇱",
}

const SESSION_KEY = "invo_onboarding_session"

// ── Component ──────────────────────────────────────────────────────────

export function OnboardingChat({ onComplete, userEmail }: OnboardingChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [stagedFile, setStagedFile] = useState<File | null>(null)
    const [collectedData, setCollectedData] = useState<CollectedData>({
        email: userEmail || "",
    })
    const [allComplete, setAllComplete] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load existing session on mount
    useEffect(() => {
        loadSession()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Save session to localStorage whenever data changes
    useEffect(() => {
        if (messages.length > 0 || Object.keys(collectedData).length > 1) {
            saveSession()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, collectedData])

    function loadSession() {
        try {
            const saved = localStorage.getItem(SESSION_KEY)
            if (saved) {
                const session = JSON.parse(saved)
                if (session.messages?.length > 0) {
                    setMessages(session.messages)
                    setCollectedData(prev => ({ ...prev, ...(session.collectedData || {}) }))
                    toast.success("Resumed your onboarding session", { duration: 3000 })
                    return
                }
            }
        } catch (error) {
            console.error("Error loading session:", error)
        }
        // No valid session found, start fresh
        sendInitialGreeting()
    }

    function saveSession() {
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                messages,
                collectedData,
                updatedAt: new Date().toISOString(),
            }))
        } catch (error) {
            console.error("Error saving session:", error)
        }
    }

    function deleteSession() {
        try {
            localStorage.removeItem(SESSION_KEY)
        } catch (error) {
            console.error("Error deleting session:", error)
        }
    }

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages])

    const sendInitialGreeting = async () => {
        setIsLoading(true)
        try {
            const response = await authFetch("/api/ai/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: "Hi, I want to set up my business profile." }],
                    collectedData: { email: userEmail || "" },
                }),
            })
            const result = await response.json()
            if (result.message) {
                setMessages([{ role: "assistant", content: result.message }])
            } else {
                setMessages([{
                    role: "assistant",
                    content: "Hi! 👋 I'm Clorefy AI. I'll help you set up your business profile in just a few minutes. What type of business do you run?"
                }])
            }
        } catch {
            setMessages([{
                role: "assistant",
                content: "Hi! 👋 I'm Clorefy AI. I'll help you set up your business profile. What type of business do you run? (e.g., freelancer, agency, e-commerce)"
            }])
        } finally {
            setIsLoading(false)
        }
    }

    // Text-only chat — ALWAYS uses DeepSeek (via /api/ai/onboarding)
    // GPT is NEVER used for text messages — only DeepSeek handles chat
    const handleSendMessage = useCallback(async () => {
        if (!inputValue.trim() || isLoading) return

        const userMessage = inputValue.trim()
        setInputValue("")

        const newMessages: ChatMessage[] = [
            ...messages,
            { role: "user", content: userMessage }
        ]
        setMessages(newMessages)
        setIsLoading(true)

        try {
            const response = await authFetch("/api/ai/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: newMessages,
                    collectedData,
                }),
            })

            const result = await response.json()

            if (result.error) {
                throw new Error(result.error)
            }

            // Merge extracted data — but ONLY if AI is confident (not seeking clarification)
            const hasExtractedData = result.extractedData && Object.keys(result.extractedData).length > 0
            const needsClarification = result.needsClarification || false

            if (hasExtractedData && !needsClarification) {
                setCollectedData(prev => {
                    const updated = { ...prev }
                    for (const [key, value] of Object.entries(result.extractedData)) {
                        if (key === "address" && typeof value === "object" && value !== null) {
                            updated.address = { ...prev.address, ...(value as Record<string, string>) }
                        } else if (key === "bankDetails" && typeof value === "object" && value !== null) {
                            updated.bankDetails = { ...prev.bankDetails, ...(value as Record<string, string>) }
                        } else {
                            (updated as any)[key] = value
                        }
                    }
                    return updated
                })
                const fieldCount = Object.keys(result.extractedData).length
                if (fieldCount > 0) {
                    toast.success(`${fieldCount} field${fieldCount > 1 ? "s" : ""} captured!`, {
                        duration: 2000,
                    })
                }
            } else if (needsClarification) {
                toast.info("Need a bit more detail — please see the question above.", {
                    duration: 3000,
                })
            }

            // Add assistant response
            if (result.message) {
                setMessages(prev => [...prev, { role: "assistant", content: result.message }])
            }

            // Check completion
            if (result.allFieldsComplete) {
                setAllComplete(true)
            }

        } catch (err: any) {
            console.error("Chat error:", err)
            setMessages(prev => [...prev, {
                role: "assistant",
                content: "Something went wrong. Please try sending your message again."
            }])
        } finally {
            setIsLoading(false)
            inputRef.current?.focus()
        }
    }, [inputValue, isLoading, messages, collectedData])

    // File upload — uses GPT (via /api/ai/analyze-file) for extraction ONLY
    // After extraction, the follow-up goes to DeepSeek (via /api/ai/onboarding)
    // GPT is ONLY invoked when a file is physically attached — never for text-only messages
    const handleFileUpload = useCallback(async (file: File, userText?: string) => {
        setIsUploading(true)
        setMessages(prev => [...prev, {
            role: "user",
            content: userText ? `📎 ${file.name}\n${userText}` : `📎 Uploaded: ${file.name}`
        }])
        setMessages(prev => [...prev, {
            role: "assistant",
            content: "Analyzing your document... This may take a moment."
        }])

        try {
            const formData = new FormData()
            formData.append("file", file)
            if (userText) formData.append("message", userText)

            // Get auth token using Supabase client
            const { createClient } = await import("@/lib/supabase")
            const supabase = createClient()
            const { data: { session: authSession } } = await supabase.auth.getSession()
            const accessToken = authSession?.access_token || ""

            const res = await fetch("/api/ai/analyze-file", {
                method: "POST",
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                body: formData,
            })

            if (!res.ok) {
                if (res.status === 429) {
                    // Rate limited — wait 5 seconds and retry once
                    setMessages(prev => {
                        const filtered = prev.filter(m => m.content !== "Analyzing your document... This may take a moment.")
                        return [...filtered, { role: "assistant", content: "Processing... please wait a moment." }]
                    })
                    await new Promise(resolve => setTimeout(resolve, 5000))
                    const retryRes = await fetch("/api/ai/analyze-file", {
                        method: "POST",
                        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                        body: formData,
                    })
                    if (!retryRes.ok) {
                        throw new Error("Please wait a minute and try uploading again.")
                    }
                    const retryResult = await retryRes.json()
                    if (retryResult.extracted) {
                        // Use retry result — fall through to the extraction logic below
                        const result = retryResult
                        const extracted = result.extracted
                        setCollectedData(prev => {
                            const updated = { ...prev }
                            for (const [key, value] of Object.entries(extracted)) {
                                if (value === null || value === "") continue
                                if (key === "address" && typeof value === "object") updated.address = { ...prev.address, ...(value as any) }
                                else if (key === "bankDetails" && typeof value === "object") updated.bankDetails = { ...prev.bankDetails, ...(value as any) }
                                else if (key === "additionalContext") updated.additionalNotes = (prev.additionalNotes || "") + "\n" + String(value)
                                else if (key === "phone2" && value) updated.additionalNotes = (prev.additionalNotes || "") + "\nSecondary phone: " + String(value)
                                else (updated as any)[key] = value
                            }
                            return updated
                        })
                        const fieldCount = result.fieldsFound || 0
                        setMessages(prev => {
                            const filtered = prev.filter(m => m.content !== "Processing... please wait a moment." && m.content !== "Analyzing your document... This may take a moment.")
                            return [...filtered, { role: "assistant", content: `Done! Extracted ${fieldCount} fields from your document. Let me check what's still needed...` }]
                        })
                        toast.success(`${fieldCount} fields extracted!`)
                        setIsUploading(false)
                        return
                    }
                    throw new Error("Could not analyze the file. Please try again.")
                }
                const err = await res.json()
                throw new Error(err.error || "Failed to analyze file")
            }

            const result = await res.json()
            const extracted = result.extracted

            if (extracted) {
                // Merge extracted data into collectedData
                setCollectedData(prev => {
                    const updated = { ...prev }
                    for (const [key, value] of Object.entries(extracted)) {
                        if (value === null || value === "") continue
                        if (key === "address" && typeof value === "object") {
                            updated.address = { ...prev.address, ...(value as any) }
                        } else if (key === "bankDetails" && typeof value === "object") {
                            updated.bankDetails = { ...prev.bankDetails, ...(value as any) }
                        } else if (key === "additionalContext") {
                            updated.additionalNotes = (prev.additionalNotes || "") + "\n" + String(value)
                        } else if (key === "phone2" && value) {
                            // Store secondary phone in additional notes
                            updated.additionalNotes = (prev.additionalNotes || "") + "\nSecondary phone: " + String(value)
                        } else {
                            (updated as any)[key] = value
                        }
                    }
                    return updated
                })

                const fieldCount = result.fieldsFound || 0
                // Remove the "analyzing" message and add success
                setMessages(prev => {
                    const filtered = prev.filter(m => m.content !== "Analyzing your document... This may take a moment.")
                    return [...filtered, {
                        role: "assistant",
                        content: `✅ I extracted ${fieldCount} fields from your document! I've auto-filled what I found. Let me check what's still missing...`
                    }]
                })

                toast.success(`${fieldCount} fields extracted from document!`)

                // Send a follow-up to the AI to check what's still needed
                setTimeout(async () => {
                    try {
                        const followUp = await authFetch("/api/ai/onboarding", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                messages: [...messages, { role: "user", content: "I just uploaded a document and the system extracted my business info. What fields are still missing?" }],
                                collectedData: { ...collectedData, ...extracted },
                            }),
                        })
                        const followResult = await followUp.json()
                        if (followResult.message) {
                            setMessages(prev => [...prev, { role: "assistant", content: followResult.message }])
                        }
                        if (followResult.allFieldsComplete) {
                            setAllComplete(true)
                        }
                    } catch {}
                }, 500)
            }
        } catch (err: any) {
            const errMsg = err.message || ""
            const isRateLimit = errMsg.toLowerCase().includes("rate limit") || errMsg.includes("429")
            setMessages(prev => {
                const filtered = prev.filter(m => m.content !== "Analyzing your document... This may take a moment.")
                return [...filtered, {
                    role: "assistant",
                    content: isRateLimit
                        ? "Please wait a moment before uploading another file. In the meantime, you can type your business details directly."
                        : `File analysis is temporarily unavailable. Please type your business details directly — I'll guide you through each field.`
                }]
            })
        } finally {
            setIsUploading(false)
        }
    }, [messages, collectedData])

    const handleComplete = () => {
        deleteSession()
        onComplete(collectedData)
    }

    const handleReset = () => {
        setMessages([])
        setCollectedData({ email: userEmail || "" })
        setAllComplete(false)
        deleteSession()
        setTimeout(() => sendInitialGreeting(), 100)
    }

    // Count completed required fields
    const completedCount = REQUIRED_FIELDS.filter(f => {
        const val = (collectedData as any)[f]
        if (Array.isArray(val)) return val.length > 0
        if (typeof val === "object" && val !== null) {
            return Object.values(val).some(v => v && String(v).trim().length > 0)
        }
        return val && String(val).trim().length > 0
    }).length

    const progressPercent = Math.round((completedCount / REQUIRED_FIELDS.length) * 100)

    return (
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 h-full max-w-7xl mx-auto w-full">
            {/* ── Main Chat Panel ────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile progress bar */}
                <div className="lg:hidden h-1 bg-muted shrink-0">
                    <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-5 pb-4 max-w-3xl mx-auto">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                                    msg.role === "user" ? "justify-end" : "justify-start"
                                )}
                            >
                                <div className={cn(
                                    "max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-br-sm shadow-md"
                                        : "bg-card text-foreground rounded-bl-sm border border-border/50 shadow-sm"
                                )}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start w-full animate-in fade-in duration-200">
                                <div className="bg-muted rounded-2xl px-5 py-4 space-x-1.5 flex items-center rounded-bl-md">
                                    <span className="w-2.5 h-2.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-2.5 h-2.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-2.5 h-2.5 bg-foreground/40 rounded-full animate-bounce" />
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="px-4 py-4 bg-background border-t shrink-0">
                    {(allComplete || progressPercent >= 100) ? (
                        <div className="flex items-center gap-3 max-w-3xl mx-auto">
                            <div className="flex-1 text-base text-muted-foreground">
                                All information collected. Ready to complete setup.
                            </div>
                            <Button onClick={handleComplete} className="gap-2 h-11 px-6 text-base">
                                <Check className="w-5 h-5" />
                                Complete Setup
                            </Button>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto">
                            {/* Prompt box with file card inside */}
                            <div className={cn(
                                "rounded-2xl border bg-card transition-all duration-300",
                                (isLoading || isUploading)
                                    ? "border-primary/40 shadow-md"
                                    : "border-border shadow-sm focus-within:border-primary/40 focus-within:shadow-md"
                            )}>
                                {/* Staged file card — Claude style */}
                                {stagedFile && (
                                    <div className="px-4 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="inline-flex items-start gap-0 rounded-xl border border-border/50 bg-muted/40 overflow-hidden shadow-sm max-w-[180px]">
                                            <div className="w-full px-3 py-2.5">
                                                <div className="w-10 h-10 rounded-lg bg-background border border-border/50 flex flex-col items-center justify-center mb-1.5 shadow-sm">
                                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-[7px] font-bold text-muted-foreground mt-0.5 leading-none uppercase">
                                                        {stagedFile.type === "application/pdf" ? "PDF" : stagedFile.type.startsWith("image/") ? "IMG" : "FILE"}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-medium text-foreground truncate leading-tight">{stagedFile.name.length > 16 ? stagedFile.name.slice(0, 14) + "..." : stagedFile.name}</p>
                                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                                    {stagedFile.size < 1024 ? `${stagedFile.size} B` : stagedFile.size < 1024 * 1024 ? `${(stagedFile.size / 1024).toFixed(1)} KB` : `${(stagedFile.size / (1024 * 1024)).toFixed(1)} MB`}
                                                </p>
                                            </div>
                                            <button type="button" onClick={() => setStagedFile(null)}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Text input */}
                                <div className="relative">
                                    <input
                                        ref={fileInputRef}
                                        id="onboarding-file-input"
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) setStagedFile(file)
                                            e.target.value = ""
                                        }}
                                    />
                                    <Input
                                        ref={inputRef}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                if (stagedFile) {
                                                    handleFileUpload(stagedFile, inputValue.trim() || undefined)
                                                    setStagedFile(null)
                                                    setInputValue("")
                                                } else {
                                                    handleSendMessage()
                                                }
                                            }
                                        }}
                                        placeholder={stagedFile ? "Add a note about this file..." : "Tell me about your business..."}
                                        disabled={isLoading || isUploading}
                                        className="border-none shadow-none h-12 px-4 text-[15px] focus-visible:ring-0 bg-transparent"
                                        autoFocus
                                    />
                                </div>

                                {/* Bottom bar with attach + send */}
                                <div className="flex items-center justify-between px-3 pb-3">
                                    <label
                                        htmlFor={!(isLoading || isUploading) ? "onboarding-file-input" : undefined}
                                        className={cn(
                                            "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200",
                                            (isLoading || isUploading)
                                                ? "opacity-40 cursor-not-allowed text-muted-foreground"
                                                : "cursor-pointer text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {isUploading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Paperclip className="w-[18px] h-[18px]" />}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (stagedFile) {
                                                handleFileUpload(stagedFile, inputValue.trim() || undefined)
                                                setStagedFile(null)
                                                setInputValue("")
                                            } else {
                                                handleSendMessage()
                                            }
                                        }}
                                        disabled={(!inputValue.trim() && !stagedFile) || isLoading || isUploading}
                                        className={cn(
                                            "flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200",
                                            (inputValue.trim() || stagedFile)
                                                ? "bg-foreground text-background hover:opacity-80 active:scale-90"
                                                : "bg-muted/60 text-muted-foreground/30 cursor-not-allowed"
                                        )}
                                    >
                                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Collected Data Sidebar ─────────────────────────── */}
            <div className="hidden lg:block lg:w-80 shrink-0 space-y-4">
                {/* Progress */}
                <div className="border rounded-2xl bg-card shadow-sm p-5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-base">Profile Progress</span>
                        <span className="text-muted-foreground text-base">{progressPercent}%</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {completedCount} of {REQUIRED_FIELDS.length} required fields
                    </p>
                </div>

                {/* Fields */}
                <div className="border rounded-2xl bg-card shadow-sm p-5 space-y-2.5">
                    <h4 className="text-base font-semibold mb-3">Collected Info</h4>
                    {REQUIRED_FIELDS.map((field) => {
                        const val = (collectedData as any)[field]
                        const hasValue = (() => {
                            if (Array.isArray(val)) return val.length > 0
                            if (typeof val === "object" && val !== null) {
                                return Object.values(val).some(v => v && String(v).trim().length > 0)
                            }
                            return val && String(val).trim().length > 0
                        })()

                        const displayValue = (() => {
                            if (!hasValue) return null
                            if (field === "clientCountries" && Array.isArray(val)) {
                                return val.map((c: string) => COUNTRY_FLAGS[c] || c).join(" ")
                            }
                            if (field === "country") {
                                return `${COUNTRY_FLAGS[val] || ""} ${val}`.trim()
                            }
                            if (field === "address" && typeof val === "object") {
                                const a = val as Record<string, string>
                                return [a.city, a.state].filter(Boolean).join(", ") || "Provided"
                            }
                            return String(val)
                        })()

                        return (
                            <div
                                key={field}
                                className={cn(
                                    "flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-sm transition-colors",
                                    hasValue ? "bg-primary/5" : "bg-transparent"
                                )}
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                                    hasValue ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"
                                )}>
                                    {hasValue && <Check className="w-3 h-3" />}
                                </div>
                                <span className={cn(
                                    "font-medium text-sm",
                                    hasValue ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {FIELD_LABELS[field] || field}
                                </span>
                                {displayValue && (
                                    <span className="ml-auto text-sm text-muted-foreground truncate max-w-[120px]" title={displayValue}>
                                        {displayValue}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
