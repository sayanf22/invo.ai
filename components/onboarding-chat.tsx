"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Sparkles, Loader2, RefreshCw, Check, Paperclip, FileText, X } from "lucide-react"
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
                content: "I'm having trouble connecting right now. Please try again."
            }])
        } finally {
            setIsLoading(false)
            inputRef.current?.focus()
        }
    }, [inputValue, isLoading, messages, collectedData])

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

            // Get auth token
            const tokenKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.includes("-auth-token"))
            const tokenRaw = tokenKey ? localStorage.getItem(tokenKey) : null
            let accessToken = ""
            if (tokenRaw) {
                try {
                    const parsed = JSON.parse(tokenRaw.startsWith("%7B") ? decodeURIComponent(tokenRaw) : tokenRaw)
                    accessToken = parsed.access_token || ""
                } catch {}
            }

            const res = await fetch("/api/ai/analyze-file", {
                method: "POST",
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                body: formData,
            })

            if (!res.ok) {
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
            setMessages(prev => {
                const filtered = prev.filter(m => m.content !== "Analyzing your document... This may take a moment.")
                return [...filtered, {
                    role: "assistant",
                    content: `❌ ${err.message || "Could not analyze the file. Please try again or enter your details manually."}`
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
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-5rem)] max-w-7xl mx-auto w-full">
            {/* ── Main Chat Panel ────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 border rounded-2xl bg-card shadow-sm overflow-hidden">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-5 border-b flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="p-2.5 bg-primary/15 rounded-xl">
                            <Sparkles className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Clorefy AI</h3>
                            <p className="text-sm text-muted-foreground">Setting up your business profile</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleReset} title="Start over">
                        <RefreshCw className="w-5 h-5" />
                    </Button>
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
                                    "max-w-[85%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap",
                                    msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-br-md"
                                        : "bg-muted text-foreground rounded-bl-md"
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
                <div className="p-5 bg-background border-t shrink-0">
                    {(allComplete || progressPercent >= 100) ? (
                        <div className="flex items-center gap-3 max-w-3xl mx-auto">
                            <div className="flex-1 text-base text-muted-foreground">
                                ✅ All information collected! Ready to complete setup.
                            </div>
                            <Button onClick={handleComplete} className="gap-2 h-11 px-6 text-base">
                                <Check className="w-5 h-5" />
                                Complete Setup
                            </Button>
                        </div>
                    ) : (
                        <div className="relative flex items-center gap-2.5 max-w-3xl mx-auto">
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) setStagedFile(file)
                                    e.target.value = ""
                                }}
                            />

                            {/* Staged file indicator */}
                            {stagedFile && (
                                <div className="absolute -top-10 left-0 right-0 flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-xl text-xs">
                                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="truncate flex-1 text-foreground">{stagedFile.name}</span>
                                    <button type="button" onClick={() => setStagedFile(null)} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-xl h-12 w-12 shrink-0"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading || isUploading}
                                title="Attach a document (PDF, image)"
                            >
                                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                            </Button>
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
                                placeholder={stagedFile ? "Add a note about this file (optional)..." : "Tell me about your business..."}
                                disabled={isLoading || isUploading}
                                className="flex-1 rounded-xl h-12 px-5 text-[15px]"
                                autoFocus
                            />
                            <Button
                                size="icon"
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
                                className="rounded-xl h-12 w-12 shrink-0"
                            >
                                {isLoading
                                    ? <Loader2 className="w-5 h-5 animate-spin" />
                                    : <Send className="w-5 h-5" />
                                }
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Collected Data Sidebar ─────────────────────────── */}
            <div className="lg:w-80 shrink-0 space-y-4">
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
