"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, Check, Paperclip, FileText, X, Info, Sparkles, ArrowRight, Edit2, Save, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import { motion, AnimatePresence } from "framer-motion"

// ── Types ──────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: "user" | "assistant"
    content: string
    isExtractionReview?: boolean
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
    taxRegistered?: boolean
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
    services?: string
}

interface OnboardingChatProps {
    onComplete: (data: CollectedData) => void
    userEmail?: string
    initialData?: CollectedData
}

// ── Field Labels for Display ───────────────────────────────────────────

const TRACKED_STEPS = [
    { id: "businessType", label: "Business Type", placeholder: "e.g. Agency, Freelancer" },
    { id: "country", label: "Country", placeholder: "e.g. US, IN, GB" },
    { id: "businessName", label: "Business Name", placeholder: "Your company name" },
    { id: "ownerName", label: "Owner Name", placeholder: "Your full name" },
    { id: "email", label: "Email", placeholder: "hello@example.com" },
    { id: "phone", label: "Phone", placeholder: "+1 234 567 8900" },
    { id: "address", label: "Address", placeholder: "City, State, etc." },
    { id: "taxDetails", label: "Tax Registration", placeholder: "Tax ID if registered" },
    { id: "services", label: "Services", placeholder: "e.g. Web Design" },
    { id: "clientCountries", label: "Client Countries", placeholder: "e.g. US, UK, all" },
    { id: "defaultCurrency", label: "Currency", placeholder: "e.g. USD, INR" },
    { id: "bankDetails", label: "Bank Details", placeholder: "Optional bank info" },
    { id: "additionalNotes", label: "Additional Info", placeholder: "Any other details?" },
]

const COUNTRY_FLAGS: Record<string, string> = {
    IN: "🇮🇳", US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", CA: "🇨🇦",
    AU: "🇦🇺", SG: "🇸🇬", AE: "🇦🇪", PH: "🇵🇭", FR: "🇫🇷", NL: "🇳🇱",
}

const SESSION_KEY = "invo_onboarding_session"

// ── Component ──────────────────────────────────────────────────────────

export function OnboardingChat({ onComplete, userEmail, initialData }: OnboardingChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [stagedFile, setStagedFile] = useState<File | null>(null)
    const [collectedData, setCollectedData] = useState<CollectedData>({
        email: userEmail || "",
        ...initialData,
    })
    const [allComplete, setAllComplete] = useState(false)

    // For inline editing
    const [expandedField, setExpandedField] = useState<string | null>(null)
    const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

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
    }, [messages, isLoading])

    const sendInitialGreeting = async () => {
        setIsLoading(true)
        try {
            const mergedData = { email: userEmail || "", ...initialData }
            
            // Count how many fields are already filled
            const filledFields = Object.entries(mergedData).filter(([k, v]) => {
                if (!v) return false
                if (typeof v === "string" && v.trim() === "") return false
                if (Array.isArray(v) && v.length === 0) return false
                if (typeof v === "object" && !Array.isArray(v) && Object.values(v as Record<string, unknown>).every(val => !val || String(val).trim() === "")) return false
                return true
            })
            
            const userMsg = filledFields.length >= 5
                ? "I've already uploaded a file with my business details. Please check what's already collected and only ask me for the missing fields."
                : "Hi, I want to set up my business profile."

            const response = await authFetch("/api/ai/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: userMsg }],
                    collectedData: mergedData,
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

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error("429 rate limit")
                }
                const errBody = await response.json().catch(() => ({}))
                throw new Error(errBody.error || `API error: ${response.status}`)
            }

            const result = await response.json()

            if (result.error) {
                throw new Error(result.error)
            }

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

            if (result.message) {
                setMessages(prev => [...prev, { role: "assistant", content: result.message }])
            }

            if (result.allFieldsComplete) {
                setAllComplete(true)
            }

        } catch (err: any) {
            console.error("Chat error:", err)
            const errorMsg = err?.message || ""
            const isRateLimit = errorMsg.includes("429") || errorMsg.toLowerCase().includes("rate limit") || errorMsg.toLowerCase().includes("high traffic")
            const isNetwork = errorMsg.includes("fetch") || errorMsg.includes("network") || errorMsg.includes("Failed to fetch")
            
            let assistantMsg = "Something went wrong. Please try sending your message again."
            if (isRateLimit) {
                assistantMsg = "⏳ The AI is experiencing high demand. Please wait a moment and try again."
            } else if (isNetwork) {
                assistantMsg = "Looks like there's a connection issue. Check your internet and try again."
            }
            
            setMessages(prev => [...prev, {
                role: "assistant",
                content: assistantMsg
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
                        processExtraction(retryResult.extracted, retryResult.fieldsFound || 0)
                        setIsUploading(false)
                        return
                    }
                    throw new Error("Could not analyze the file. Please try again.")
                }
                const err = await res.json()
                throw new Error(err.error || "Failed to analyze file")
            }

            const result = await res.json()
            if (result.extracted) {
                processExtraction(result.extracted, result.fieldsFound || 0)
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

    const processExtraction = async (extracted: any, fieldCount: number) => {
        // Set message first
        setMessages(prev => {
            const filtered = prev.filter(m => m.content !== "Analyzing your document... This may take a moment." && m.content !== "Processing... please wait a moment.")
            return [...filtered, {
                role: "assistant",
                content: `✅ I extracted ${fieldCount} fields from your document!`,
                isExtractionReview: true // Flag to show review button
            }]
        })
        toast.success(`${fieldCount} fields extracted!`)

        // Extract valid entries to update sequentially for animation
        const entries = Object.entries(extracted).filter(([k, v]) => v !== null && v !== "")
        let latestData = { ...collectedData }

        // Stagger the state updates so the UI animates smoothly
        for (const [key, value] of entries) {
            await new Promise(r => setTimeout(r, 250)) // 250ms stagger between fields
            setCollectedData(prev => {
                const updated = { ...prev }
                if (key === "address" && typeof value === "object") {
                    updated.address = { ...prev.address, ...(value as any) }
                } else if (key === "bankDetails" && typeof value === "object") {
                    updated.bankDetails = { ...prev.bankDetails, ...(value as any) }
                } else if (key === "additionalContext") {
                    updated.additionalNotes = (prev.additionalNotes || "") + "\n" + String(value)
                } else if (key === "phone2" && value) {
                    updated.additionalNotes = (prev.additionalNotes || "") + "\nSecondary phone: " + String(value)
                } else if (key === "services" && typeof value === "string" && value.trim().length > 0) {
                    updated.services = String(value)
                } else if (key === "paymentTerms" && typeof value === "string" && value.trim().length > 0) {
                    updated.paymentTerms = String(value)
                } else {
                    (updated as any)[key] = value
                }
                latestData = updated
                return updated
            })
        }

        // Send a follow-up to the AI to check what's still needed
        setTimeout(async () => {
            try {
                const followUp = await authFetch("/api/ai/onboarding", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: [...messages, { role: "user", content: "I just uploaded a document and the system extracted my business info. What fields are still missing?" }],
                        collectedData: latestData,
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
        }, 800)
    }

    const handleComplete = () => {
        deleteSession()
        onComplete(collectedData)
    }

    // Determine completion out of 12 tracked steps
    const completedCount = TRACKED_STEPS.filter(step => {
        const field = step.id
        if (field === "taxDetails") return collectedData.taxRegistered !== undefined
        if (field === "bankDetails") return (collectedData.bankDetails && Object.keys(collectedData.bankDetails).length > 0) || collectedData.bankDetailsSkipped === true
        if (field === "additionalNotes") return (collectedData.additionalNotes && collectedData.additionalNotes.trim() !== "") || allComplete === true

        const val = (collectedData as any)[field]
        if (Array.isArray(val)) return val.length > 0
        if (typeof val === "object" && val !== null) return Object.values(val).some(v => v && String(v).trim().length > 0)
        return val && String(val).trim().length > 0
    }).length

    const totalSteps = TRACKED_STEPS.length
    const progressPercent = Math.round((completedCount / totalSteps) * 100)

    // Inline edit handlers
    const updateField = (field: string, value: any) => {
        setCollectedData(prev => ({ ...prev, [field]: value }))
    }

    const updateNestedField = (parent: "address" | "bankDetails", field: string, value: string) => {
        setCollectedData(prev => ({
            ...prev,
            [parent]: {
                ...((prev[parent] as any) || {}),
                [field]: value
            }
        }))
    }

    // Derived view component for the field list
    const CollectedInfoView = () => (
        <div className="space-y-4 pb-10">
            <div className="border rounded-2xl bg-card shadow-sm p-5 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="flex items-center justify-between text-sm relative z-10">
                    <span className="font-semibold text-base">Profile Progress</span>
                    <span className="text-muted-foreground text-base font-medium">{progressPercent}%</span>
                </div>
                <div className="flex items-center gap-1 w-full h-2 mt-2 relative z-10">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div key={i} className="h-full flex-1 rounded-full overflow-hidden bg-muted/50">
                            <motion.div 
                                className="h-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{ width: i < completedCount ? '100%' : '0%' }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                            />
                        </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground relative z-10">
                    {completedCount} of {totalSteps} steps completed
                </p>
            </div>

            <div className="border rounded-2xl bg-card shadow-sm p-3 space-y-1.5 relative z-10">
                <div className="flex items-center justify-between px-2 mb-2">
                    <h4 className="text-sm font-semibold text-foreground/80">Extracted Information</h4>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Click to edit</span>
                </div>
                
                <AnimatePresence initial={false}>
                    {TRACKED_STEPS.map((step) => {
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
                            <motion.div
                                key={field}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "rounded-xl transition-all duration-200 overflow-hidden border",
                                    isExpanded ? "bg-card border-primary/20 shadow-md my-2" : "bg-transparent border-transparent hover:bg-muted/50 cursor-pointer",
                                    (hasValue && !isExpanded) ? "bg-primary/[0.02] border-primary/5" : ""
                                )}
                            >
                                {/* Header (Always visible) */}
                                <div 
                                    className="flex items-center gap-3 py-2.5 px-3 select-none"
                                    onClick={() => setExpandedField(isExpanded ? null : field)}
                                >
                                    <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors",
                                        hasValue 
                                            ? (isExpanded ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary") 
                                            : "border-2 border-muted-foreground/30 text-muted-foreground/30"
                                    )}>
                                        <AnimatePresence mode="wait">
                                            {hasValue ? (
                                                <motion.div
                                                    key="check"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="dot"
                                                    exit={{ scale: 0 }}
                                                >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
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
                                    <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                                        {isExpanded ? <X className="w-3.5 h-3.5 text-muted-foreground" /> : <Edit2 className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                    </div>
                                </div>

                                {/* Expanded Edit Area */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/20"
                                        >
                                            <div className="space-y-3 mt-2">
                                                {/* Field specific inputs */}
                                                {field === "address" ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Input placeholder="Street" className="col-span-2 h-8 text-xs" value={collectedData.address?.street || ""} onChange={e => updateNestedField("address", "street", e.target.value)} />
                                                        <Input placeholder="City" className="h-8 text-xs" value={collectedData.address?.city || ""} onChange={e => updateNestedField("address", "city", e.target.value)} />
                                                        <Input placeholder="State" className="h-8 text-xs" value={collectedData.address?.state || ""} onChange={e => updateNestedField("address", "state", e.target.value)} />
                                                        <Input placeholder="Zip" className="col-span-2 h-8 text-xs" value={collectedData.address?.postalCode || ""} onChange={e => updateNestedField("address", "postalCode", e.target.value)} />
                                                    </div>
                                                ) : field === "taxDetails" ? (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between bg-background p-2 rounded-lg border shadow-sm">
                                                            <Label htmlFor="tax-registered" className="text-xs">Registered for Tax?</Label>
                                                            <Switch 
                                                                id="tax-registered" 
                                                                checked={collectedData.taxRegistered === true}
                                                                onCheckedChange={(c) => updateField("taxRegistered", c)}
                                                            />
                                                        </div>
                                                        {collectedData.taxRegistered && (
                                                            <Input placeholder="Tax ID Number" className="h-8 text-xs" value={collectedData.taxId || ""} onChange={e => updateField("taxId", e.target.value)} />
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
                                                                    updateField("bankDetailsSkipped", c)
                                                                    if (c) updateField("bankDetails", {})
                                                                }}
                                                            />
                                                        </div>
                                                        {!collectedData.bankDetailsSkipped && (
                                                            <>
                                                                <Input placeholder="Bank Name" className="h-8 text-xs" value={collectedData.bankDetails?.bankName || ""} onChange={e => updateNestedField("bankDetails", "bankName", e.target.value)} />
                                                                <Input placeholder="Account Name" className="h-8 text-xs" value={collectedData.bankDetails?.accountName || ""} onChange={e => updateNestedField("bankDetails", "accountName", e.target.value)} />
                                                                <Input placeholder="Account Number" className="h-8 text-xs" value={collectedData.bankDetails?.accountNumber || ""} onChange={e => updateNestedField("bankDetails", "accountNumber", e.target.value)} />
                                                                <Input placeholder="Routing / IFSC Code" className="h-8 text-xs" value={collectedData.bankDetails?.routingNumber || collectedData.bankDetails?.ifscCode || ""} onChange={e => updateNestedField("bankDetails", "routingNumber", e.target.value)} />
                                                            </>
                                                        )}
                                                    </div>
                                                ) : field === "clientCountries" ? (
                                                    <Input 
                                                        placeholder="e.g. US, IN, GB (comma separated)" 
                                                        className="h-8 text-xs" 
                                                        value={(collectedData.clientCountries || []).join(", ")} 
                                                        onChange={e => updateField("clientCountries", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} 
                                                    />
                                                ) : (
                                                    <Input 
                                                        placeholder={step.placeholder}
                                                        className="h-8 text-xs bg-background shadow-sm"
                                                        value={(collectedData as any)[field] || ""}
                                                        onChange={e => updateField(field, e.target.value)}
                                                    />
                                                )}
                                                
                                                <div className="flex justify-end pt-1">
                                                    <Button size="sm" className="h-7 text-[11px] gap-1 px-3 shadow-sm" onClick={() => setExpandedField(null)}>
                                                        <Save className="w-3 h-3" /> Save
                                                    </Button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    )

    return (
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 h-full max-w-7xl mx-auto w-full relative">
            
            {/* ── Main Chat Panel ────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0 w-full rounded-2xl lg:border lg:bg-card/50 lg:shadow-sm overflow-hidden relative bg-background">
                {/* Mobile Sticky Header */}
                <div className="lg:hidden bg-background/80 backdrop-blur-xl border-b shadow-sm px-4 py-3 flex flex-col gap-2 shrink-0 relative z-40">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">Profile Setup</span>
                        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="secondary" size="sm" className="gap-2 h-8 text-xs rounded-full shadow-sm bg-background border hover:border-primary/50">
                                    <Eye className="w-3.5 h-3.5" />
                                    Review Details
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[320px] sm:w-[400px] overflow-y-auto pt-10 px-4">
                                <SheetHeader className="mb-4">
                                    <SheetTitle className="text-left">Review Information</SheetTitle>
                                </SheetHeader>
                                <CollectedInfoView />
                            </SheetContent>
                        </Sheet>
                    </div>
                    {/* Segmented Progress Bar */}
                    <div className="flex items-center gap-1 w-full h-1.5 mt-1">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div key={i} className="h-full flex-1 rounded-full overflow-hidden bg-muted/50">
                                <motion.div 
                                    className="h-full bg-primary shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: i < completedCount ? '100%' : '0%' }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4 lg:p-6 pb-36">
                    <div className="space-y-6 max-w-3xl mx-auto">
                        <AnimatePresence initial={false}>
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className={cn(
                                        "flex w-full",
                                        msg.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className="flex flex-col gap-2 max-w-[85%] lg:max-w-[80%]">
                                        <div className={cn(
                                            "rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap shadow-sm",
                                            msg.role === "user"
                                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                                : "bg-card text-foreground rounded-bl-sm border border-border/50"
                                        )}>
                                            {msg.content}
                                        </div>
                                        
                                        {/* Optional Review Button inside Assistant Message after Extraction */}
                                        {msg.isExtractionReview && (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                transition={{ delay: 0.4 }}
                                                className="flex justify-start pl-2"
                                            >
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="gap-2 h-8 text-xs rounded-full shadow-sm bg-background border border-border/50 hover:border-primary/30"
                                                    onClick={() => setMobileSheetOpen(true)}
                                                >
                                                    <Edit2 className="w-3 h-3" />
                                                    Review Extracted Info
                                                </Button>
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            {isLoading && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-start w-full"
                                >
                                    <div className="bg-muted rounded-2xl px-5 py-4 space-x-1.5 flex items-center rounded-bl-md shadow-sm border border-border/30">
                                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div ref={scrollRef} className="h-8" />
                    </div>
                </ScrollArea>

                {/* Input Area / Completion State - Fixed to bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 shrink-0 pointer-events-none">
                    <div className="max-w-3xl mx-auto pointer-events-auto">
                        <AnimatePresence mode="wait">
                            {allComplete ? (
                                <motion.div
                                    key="complete-state"
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                    className="relative group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl transition-all duration-500 group-hover:blur-2xl opacity-70" />
                                    <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-card border shadow-xl overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                                        
                                        <div className="flex items-center gap-4 z-10">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                                <Sparkles className="w-6 h-6 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-foreground text-lg">All Set!</h3>
                                                <p className="text-sm text-muted-foreground">Your business profile is ready.</p>
                                            </div>
                                        </div>
                                        
                                        <Button 
                                            onClick={handleComplete} 
                                            size="lg"
                                            className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20 z-10 transition-transform active:scale-95 rounded-xl h-12 px-6"
                                        >
                                            Complete Setup
                                            <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="input-state"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                >
                                    <div className={cn(
                                        "rounded-2xl border bg-card/95 backdrop-blur-md transition-all duration-300 relative z-20",
                                        (isLoading || isUploading)
                                            ? "border-primary/40 shadow-lg"
                                            : "border-border shadow-md focus-within:border-primary/40 focus-within:shadow-xl focus-within:-translate-y-0.5"
                                    )}>
                                        {/* Staged file card */}
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
                                                className="border-none shadow-none h-14 px-4 text-[15px] focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/50"
                                                autoFocus
                                            />
                                        </div>

                                        {/* Bottom bar with attach + send */}
                                        <div className="flex items-center justify-between px-3 pb-3">
                                            <label
                                                htmlFor={!(isLoading || isUploading) ? "onboarding-file-input" : undefined}
                                                className={cn(
                                                    "flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                                                    (isLoading || isUploading)
                                                        ? "opacity-40 cursor-not-allowed text-muted-foreground"
                                                        : "cursor-pointer text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 hover:shadow-inner"
                                                )}
                                            >
                                                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
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
                                                    "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200",
                                                    (inputValue.trim() || stagedFile)
                                                        ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-95 shadow-md hover:shadow-lg"
                                                        : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                                                )}
                                            >
                                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 translate-x-px translate-y-px" />}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* ── Collected Data Sidebar (Desktop) ─────────────────────────── */}
            <div className="hidden lg:block lg:w-[320px] shrink-0">
                <ScrollArea className="h-full pr-4">
                    <CollectedInfoView />
                </ScrollArea>
            </div>
        </div>
    )
}
