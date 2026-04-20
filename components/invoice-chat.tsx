"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Sparkles } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading"
import { toast } from "sonner"
import type { InvoiceData } from "@/lib/invoice-types"
import { useDocumentSession } from "@/hooks/use-document-session"
import { MarkdownMessage } from "@/components/markdown-message"
import { NextStepsBar } from "@/components/next-steps-bar"
import { ChainNavigator } from "@/components/chain-navigator"
import { MessageLimitBanner } from "@/components/message-limit-banner"
import { UpgradeModal } from "@/components/upgrade-modal"
import AIThinkingBlock from "@/components/ui/ai-thinking-block"
import { authFetch } from "@/lib/auth-fetch"
import { createClient } from "@/lib/supabase"

interface InvoiceChatProps {
    data: InvoiceData
    onChange: (updates: Partial<InvoiceData>) => void
    selectedSessionId?: string
    onSessionChange?: (sessionId: string) => void
    onLinkedSessionCreate?: (sessionId: string, docType: string) => void
    onChainSessionSelect?: (sessionId: string) => void
    onMessageCountChange?: (count: number) => void
    initialPrompt?: string
}

export function InvoiceChat({ data, onChange, selectedSessionId, onSessionChange, onLinkedSessionCreate, onChainSessionSelect, onMessageCountChange, initialPrompt }: InvoiceChatProps) {
    const docType = data.documentType?.toLowerCase() || "invoice"

    // Hook handles session init + switching when selectedSessionId changes
    const {
        session,
        messages: savedMessages,
        isLoading: sessionLoading,
        isSaving,
        limitError,
        saveMessage,
        updateSessionContext,
        updateClientName,
        saveGeneration,
        startNewSession,
    } = useDocumentSession(docType, selectedSessionId)

    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [stagedFile, setStagedFile] = useState<File | null>(null)
    const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
    const [streamingContent, setStreamingContent] = useState<string | null>(null)
    const [welcomeLoaded, setWelcomeLoaded] = useState(false)
    const [documentGenerated, setDocumentGenerated] = useState(false)
    const [fileContext, setFileContext] = useState<string | null>(null)
    const [messageLimitReached, setMessageLimitReached] = useState(false)
    const [limitInfo, setLimitInfo] = useState<{ currentMessages: number; limit: number; tier: string } | null>(null)
    const [documentLimitReached, setDocumentLimitReached] = useState(false)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeInfo, setUpgradeInfo] = useState<{ tier: string; currentUsage?: number; limit?: number; errorType: "limit" | "type_restriction" | "feature_restricted"; message?: string } | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const initialPromptSentRef = useRef(false)
    const lastSyncedSessionRef = useRef<string | null>(null)
    const pendingAutoGenerateRef = useRef<string | null>(null)

    // Sync messages from hook when session changes (new session loaded or switched)
    useEffect(() => {
        if (sessionLoading) return
        if (!session) return

        // Only sync when the session actually changed
        if (lastSyncedSessionRef.current === session.id) return
        lastSyncedSessionRef.current = session.id

        // Reset chat state for the new session
        setDocumentGenerated(false)
        setFileContext(null)
        setMessageLimitReached(false)
        setDocumentLimitReached(false)
        setLimitInfo(null)
        setIsLoading(false)

        if (savedMessages.length > 0) {
            // Loaded an existing session with messages
            setMessages(savedMessages.map(msg => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
            })))
            setWelcomeLoaded(true)

            // Restore document preview from session context
            const ctx = session.context
            if (ctx && typeof ctx === "object" && !Array.isArray(ctx) && Object.keys(ctx).length > 0) {
                onChange(ctx as Partial<InvoiceData>)
                setDocumentGenerated(true)
            }
        } else {
            // Check if this is a linked session with seed context (no messages yet)
            const ctx = session.context
            const hasSeedData = ctx && typeof ctx === "object" && !Array.isArray(ctx) && Object.keys(ctx).length > 1

            if (hasSeedData && session.chain_id) {
                // Linked session — show seed data in preview and auto-generate
                onChange(ctx as Partial<InvoiceData>)
                const clientName = (ctx as any).toName || "the client"
                const welcomeMsg = `I've loaded the details from your previous document for ${clientName}. Generating your ${docType} now...`
                setMessages([{ role: "assistant", content: welcomeMsg }])
                setWelcomeLoaded(true)
                // Queue auto-generation (will be picked up by a separate effect that has fresh refs)
                pendingAutoGenerateRef.current = `Generate a ${docType} using the linked document details for ${clientName}`
            } else {
                // New session with no messages — load welcome
                setMessages([])
                setWelcomeLoaded(false)
                loadWelcome()
            }
        }
    }, [session, sessionLoading, savedMessages]) // eslint-disable-line react-hooks/exhaustive-deps

    // Handle pending auto-generation for linked sessions (separate effect to avoid stale closures)
    useEffect(() => {
        if (!pendingAutoGenerateRef.current || isLoading || !session) return
        const prompt = pendingAutoGenerateRef.current
        pendingAutoGenerateRef.current = null
        const timer = setTimeout(() => sendMessage(prompt), 300)
        return () => clearTimeout(timer)
    }, [session, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load welcome message
    const loadWelcome = useCallback(async () => {
        const msg = `Hi! I'm your AI assistant. I can help you create invoices, contracts, quotations, and proposals — or just answer your business questions.\n\nTry something like:\n• "Create an invoice for $5,000 for web design to Acme Corp"\n• "What is GST and how does it apply to my business?"\n• Upload a file and ask me about it`
        setMessages([{ role: "assistant", content: msg }])
        setWelcomeLoaded(true)
    }, [])

    // Notify parent of message count changes
    useEffect(() => {
        if (onMessageCountChange) {
            // Count only user messages (matches backend counting)
            const userMsgCount = messages.filter(m => m.role === "user").length
            onMessageCountChange(userMsgCount)
        }
    }, [messages, onMessageCountChange])

    // Load logo from business profile and warm cache
    // Always runs to ensure the cache has the dataUrl for PDF rendering
    useEffect(() => {
        let cancelled = false
        async function loadProfileLogo() {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user || cancelled) return
                const { data: biz } = await supabase
                    .from("businesses")
                    .select("logo_url, logo_data_url")
                    .eq("user_id", user.id)
                    .single() as any
                if (!cancelled && biz?.logo_url) {
                    // Always warm the cache so PDF rendering works
                    if (biz.logo_data_url) {
                        const { warmLogoCache } = await import("@/hooks/use-logo-url")
                        warmLogoCache(biz.logo_url, biz.logo_data_url)
                    }
                    // Only set fromLogo if not already set (don't override session-specific logo)
                    if (!data.fromLogo) {
                        onChange({ fromLogo: biz.logo_url })
                    }
                }
            } catch { /* ignore — logo is optional */ }
        }
        loadProfileLogo()
        return () => { cancelled = true }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Handle document limit error from session creation
    useEffect(() => {
        if (limitError) {
            setDocumentLimitReached(true)
            setUpgradeInfo({
                tier: limitError.tier,
                currentUsage: limitError.currentUsage,
                limit: limitError.limit,
                errorType: "limit",
                message: limitError.message,
            })
        }
    }, [limitError])

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Core send function — ALWAYS uses DeepSeek (via /api/ai/stream)
    // This is called for ALL text-only messages AND as step 2 after file extraction
    // GPT is NEVER used here — only DeepSeek for document generation/chat
    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !session) return

        const userMessage = messageText.trim()
        // Display only the user's text, not the enriched file context
        const displayText = userMessage.includes("[CLIENT DETAILS FROM ATTACHED FILE")
            ? userMessage.split("\n\n[CLIENT DETAILS")[0].trim() || "📎 Generate from attached file"
            : userMessage
        setInputValue("")
        setMessages(prev => [...prev, { role: "user" as const, content: displayText }])
        // NOTE: User message is NOT saved to DB here — it's saved only after a successful
        // AI response. This prevents error responses from counting against the message limit.
        setIsLoading(true)

        try {
            const response = await authFetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: userMessage,
                    documentType: docType,
                    sessionId: session.id,
                    // Send currentData if this is a follow-up OR if this is a linked session with seed data
                    currentData: (messages.length > 1 || session.chain_id) ? data : undefined,
                    conversationHistory: messages.length > 1 ? messages.slice(-20) : [],
                    ...(fileContext ? { fileContext } : {}),
                }),
            })

            if (!response.ok) {
                if (response.status === 429) {
                    const errorData = await response.json()
                    if (errorData.error === "Session message limit reached") {
                        setMessageLimitReached(true)
                        setLimitInfo({
                            currentMessages: errorData.currentMessages,
                            limit: errorData.limit,
                            tier: errorData.tier,
                        })
                        setMessages(prev => [...prev, {
                            role: "assistant" as const,
                            content: `You've reached the message limit (${errorData.currentMessages}/${errorData.limit}) for this session. You can create a new document to continue.`
                        }])
                        setIsLoading(false)
                        return
                    }
                    if (errorData.error === "Monthly document limit reached") {
                        setDocumentLimitReached(true)
                        setUpgradeInfo({
                            tier: errorData.tier || "free",
                            currentUsage: errorData.currentUsage,
                            limit: errorData.limit,
                            errorType: "limit",
                            message: errorData.message,
                        })
                        setShowUpgradeModal(true)
                        setMessages(prev => [...prev, {
                            role: "assistant" as const,
                            content: `You've reached your monthly document limit (${errorData.currentUsage}/${errorData.limit}). Upgrade your plan to create more documents.`
                        }])
                        setIsLoading(false)
                        return
                    }
                }
                if (response.status === 403) {
                    const errorData = await response.json()
                    if (errorData.tier) {
                        const errorType = errorData.error === "Document type not available on your plan"
                            ? "type_restriction" as const
                            : "feature_restricted" as const
                        setUpgradeInfo({
                            tier: errorData.tier,
                            currentUsage: errorData.currentUsage,
                            limit: errorData.limit,
                            errorType,
                            message: errorData.message,
                        })
                        setShowUpgradeModal(true)
                        setMessages(prev => [...prev, {
                            role: "assistant" as const,
                            content: errorData.message || "This feature is not available on your current plan. Please upgrade to continue."
                        }])
                        setIsLoading(false)
                        return
                    }
                }
                throw new Error(`API error: ${response.status}`)
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let fullContent = ""
            let sseBuffer = "" // Buffer for incomplete SSE lines across chunks
            let streamError: string | null = null
            let completeData: string | null = null
            let isStreamingText = false // true once we detect this is a plain-text (non-JSON) response
            if (!reader) throw new Error("No response body")

            // Phase 1: Read the stream, accumulate content + stream text progressively
            while (true) {
                const { done, value: chunk } = await reader.read()
                if (done) break
                const text = decoder.decode(chunk, { stream: true })
                sseBuffer += text
                
                // Process complete lines from the buffer
                const parts = sseBuffer.split("\n")
                sseBuffer = parts.pop() || "" // Keep incomplete last line in buffer
                
                for (const rawLine of parts) {
                    const line = rawLine.trim()
                    if (!line.startsWith("data: ")) continue
                    try {
                        const parsed = JSON.parse(line.slice(6))
                        if (parsed.type === "chunk") {
                            fullContent += parsed.data
                            // Once we have enough content to know it's not JSON, stream it live
                            if (!isStreamingText && fullContent.length > 10 && !fullContent.trimStart().startsWith("{")) {
                                isStreamingText = true
                                setIsLoading(false)
                                setStreamingContent(fullContent)
                            } else if (isStreamingText) {
                                setStreamingContent(fullContent)
                            }
                        } else if (parsed.type === "complete") {
                            // Backend sends the full cleaned content — use it as authoritative source
                            completeData = parsed.data
                        } else if (parsed.type === "error") {
                            streamError = parsed.data
                        }
                    } catch (sseErr) {
                        // Skip malformed SSE lines
                    }
                }
            }
            // Clear streaming state — final message will be committed below
            setStreamingContent(null)

            // Phase 2: Handle errors
            if (streamError) {
                throw new Error(streamError)
            }

            // Phase 3: Parse the complete response
            // Prefer backend's cleaned data, fall back to our accumulated content
            let cleaned = (completeData || fullContent).trim()
            if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
            else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "")
            cleaned = cleaned.trim()

            if (cleaned.startsWith("{")) {
                let result: any = null
                try {
                    result = JSON.parse(cleaned)
                } catch (parseErr) {
                    // Try to salvage — sometimes there's trailing garbage after the JSON
                    const lastBrace = cleaned.lastIndexOf("}")
                    if (lastBrace > 0) {
                        try {
                            result = JSON.parse(cleaned.slice(0, lastBrace + 1))
                        } catch {
                            // Truly unparseable
                        }
                    }
                }

                if (result && typeof result === "object") {
                    const docData = result.document || result
                    const aiMessage = result.message || ""

                    if (docData.documentType) {
                        const t = docData.documentType.toLowerCase()
                        docData.documentType = t === "invoice" ? "Invoice"
                            : t === "contract" ? "Contract"
                            : t === "quotation" ? "Quotation"
                            : t === "proposal" ? "Proposal"
                            : docData.documentType
                    }

                    // Ensure every item has a unique id (AI often omits them)
                    if (Array.isArray(docData.items)) {
                        docData.items = docData.items.map((item: any, i: number) => ({
                            ...item,
                            id: item.id || `ai-${Date.now()}-${i}`,
                            quantity: Number(item.quantity) || 1,
                            rate: Number(item.rate) || 0,
                            discount: item.discount ? Number(item.discount) || 0 : 0,
                        }))
                    }

                    // Strip AI-invented payment info if user didn't ask for it
                    const promptLower = userMessage.toLowerCase()
                    const mentionsPayment = /\b(payment method|bank transfer|bank details|payment info|pay via|pay by|wire|paypal|stripe|credit card|upi|ach)\b/i.test(promptLower)
                    if (!mentionsPayment) {
                        if (docData.paymentMethod) docData.paymentMethod = ""
                        if (docData.paymentInstructions) docData.paymentInstructions = ""
                    }

                    // Strip markdown formatting from all text fields — PDF renders raw asterisks
                    const stripMarkdown = (s: string) => s.replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "").replace(/^[-*]\s+/gm, "• ")
                    const textFields = ["notes", "terms", "description", "paymentInstructions"] as const
                    for (const field of textFields) {
                        if (typeof docData[field] === "string" && docData[field]) {
                            docData[field] = stripMarkdown(docData[field])
                        }
                    }
                    if (Array.isArray(docData.items)) {
                        for (const item of docData.items) {
                            if (typeof item.description === "string") {
                                item.description = stripMarkdown(item.description)
                            }
                        }
                    }

                    // Recalculate totals client-side — LLMs can't do math reliably
                    if (Array.isArray(docData.items) && docData.items.length > 0) {
                        docData.taxRate = Number(docData.taxRate) || 0
                        docData.discountValue = Number(docData.discountValue) || 0
                        docData.shippingFee = Number(docData.shippingFee) || 0
                        if (docData.discountType && docData.discountType !== "percent" && docData.discountType !== "flat") {
                            docData.discountType = "percent"
                        }

                        // Prevent double-discounting
                        const hasPerItemDiscounts = docData.items.some((item: any) => item.discount && item.discount > 0)
                        if (hasPerItemDiscounts && docData.discountValue > 0) {
                            docData.discountValue = 0
                        }

                        // Strip any AI-computed total fields — system calculates these
                        delete (docData as any).subtotal
                        delete (docData as any).total
                        delete (docData as any).taxAmount
                        delete (docData as any).discountAmount
                        delete (docData as any).grandTotal
                    }

                    onChange(docData)
                    await updateSessionContext(docData)
                    await saveGeneration(userMessage, docData, null, true)
                    setDocumentGenerated(true)

                    // Update client name on session for chain grouping
                    const clientName = docData.toName || docData.clientName || docData.preparedFor
                    if (clientName) await updateClientName(clientName)

                    const displayMsg = aiMessage || "✅ Document generated! Check the preview. Need changes? Just tell me."
                    setMessages(prev => [...prev, { role: "assistant", content: displayMsg }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", displayMsg)
                    toast.success("Document updated!")
                } else {
                    // JSON parse completely failed — show the raw text as a chat message
                    console.error("Failed to parse AI response as JSON:", cleaned.slice(0, 200))
                    setMessages(prev => [...prev, { role: "assistant", content: cleaned }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", cleaned)
                }
            } else {
                // Not JSON — plain text response from AI (e.g., clarification question)
                setMessages(prev => [...prev, { role: "assistant", content: cleaned }])
                await saveMessage("user", displayText)
                await saveMessage("assistant", cleaned)
            }
        } catch (err: any) {
            const errorMsg = err.message || "Something went wrong"
            const assistantMsg = errorMsg.includes("429") || errorMsg.includes("rate limit")
                ? "⏳ High demand right now. Please wait a minute and try again."
                : "Something went wrong. Please try again."
            setStreamingContent(null)
            setMessages(prev => [...prev, { role: "assistant", content: assistantMsg }])
            // NOTE: Do NOT save user or error messages to DB on failure —
            // this prevents errors from counting against the message limit.
            // The error message is shown in the UI only.
            await saveGeneration(messageText, {}, null, false, errorMsg)
        } finally {
            setStreamingContent(null)
            setIsLoading(false)
        }
    }, [isLoading, messages, data, docType, onChange, session, saveMessage, updateSessionContext, saveGeneration, fileContext])

    // File upload handler — supports both extract and generate modes
    // MODE ROUTING: File with generation request → GPT generates complete document
    // File without generation request → GPT extracts content, stores as fileContext
    const handleFileUpload = useCallback(async (file: File, userText?: string) => {
        if (!session) return
        setIsUploading(true)

        // Determine mode: if user provides text that looks like a generation request, use generate mode
        // Otherwise, use extract mode to just read the file
        const generationKeywords = /\b(create|generate|make|build|invoice|quotation|contract|proposal)\b/i
        const isGenerationRequest = userText ? generationKeywords.test(userText) : false
        const mode = isGenerationRequest ? "generate" : "extract"

        const displayText = userText ? `📎 ${file.name}\n${userText}` : `📎 Attached: ${file.name}`
        setMessages(prev => [...prev, { role: "user", content: displayText }])
        await saveMessage("user", displayText)

        if (mode === "generate") {
            setMessages(prev => [...prev, { role: "assistant", content: "Reading your document and generating..." }])
        } else {
            setMessages(prev => [...prev, { role: "assistant", content: "Reading your document..." }])
        }

        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("mode", mode)
            formData.append("documentType", docType)
            if (userText) formData.append("message", userText)

            // Pass business context so GPT can use it as the sender
            if (data.fromName || data.fromEmail) {
                const ctx = [data.fromName, data.fromEmail, data.fromPhone, data.fromAddress].filter(Boolean).join(", ")
                formData.append("businessContext", ctx)
            }

            const supabase = createClient()
            const { data: { session: authSession } } = await supabase.auth.getSession()
            const accessToken = authSession?.access_token

            const res = await fetch("/api/ai/analyze-file", {
                method: "POST",
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                body: formData,
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Failed to process file")
            }

            const result = await res.json()

            if (result.mode === "generate" && result.document) {
                // GPT generated the full document — apply it directly
                const docData = result.document

                // Ensure items have IDs
                if (Array.isArray(docData.items)) {
                    docData.items = docData.items.map((item: any, i: number) => ({
                        ...item,
                        id: item.id || `gpt-${Date.now()}-${i}`,
                        quantity: Number(item.quantity) || 1,
                        rate: Number(item.rate) || 0,
                    }))
                }

                // Strip any AI-computed totals
                delete docData.subtotal
                delete docData.total
                delete docData.taxAmount
                delete docData.discountAmount

                onChange(docData)
                await updateSessionContext(docData)
                await saveGeneration(displayText, docData, null, true)
                setDocumentGenerated(true)

                const clientName = docData.toName || docData.clientName
                if (clientName) await updateClientName(clientName)

                setMessages(prev => {
                    const filtered = prev.filter(m => m.content !== "Reading your document and generating...")
                    return [...filtered, { role: "assistant", content: result.message || "✅ Document generated from your file! Check the preview." }]
                })
                await saveMessage("assistant", result.message || "Document generated from file.")
                toast.success("Document generated!")
            } else if (result.mode === "extract") {
                // Extract mode — store file context for follow-up questions
                const summary = result.summary || ""
                setFileContext(summary)

                const assistantMsg = "I've read your file. You can ask me questions about it or say \"create an invoice from this\" to generate a document."
                setMessages(prev => {
                    const filtered = prev.filter(m => m.content !== "Reading your document...")
                    return [...filtered, { role: "assistant", content: assistantMsg }]
                })
                await saveMessage("assistant", assistantMsg)
            } else {
                throw new Error("Could not process the file")
            }
        } catch (err: any) {
            setMessages(prev => {
                const filtered = prev.filter(m => m.content !== "Reading your document and generating..." && m.content !== "Reading your document...")
                return [...filtered, {
                    role: "assistant",
                    content: `${err.message || "Could not process the file. Try describing your document instead."}`
                }]
            })
            await saveMessage("assistant", `Could not analyze file: ${err.message}`)
        } finally {
            setIsUploading(false)
        }
    }, [session, docType, data, onChange, saveMessage, updateSessionContext, saveGeneration, updateClientName])

    // Auto-send initial prompt ONCE
    useEffect(() => {
        if (initialPrompt && session && !sessionLoading && !initialPromptSentRef.current && welcomeLoaded) {
            initialPromptSentRef.current = true
            sendMessage(initialPrompt.trim())
        }
    }, [initialPrompt, session, sessionLoading, welcomeLoaded, sendMessage])

    // Handle "New" conversation
    const handleNewConversation = useCallback(async () => {
        initialPromptSentRef.current = true // prevent re-send of initialPrompt
        lastSyncedSessionRef.current = null
        setWelcomeLoaded(false)
        setDocumentGenerated(false)
        setFileContext(null)

        const newSession = await startNewSession()
        if (newSession && onSessionChange) {
            onSessionChange(newSession.id)
        }
        toast.success("Started new conversation")
    }, [startNewSession, onSessionChange])

    // Handle creating a linked document from the Next Steps bar
    const handleCreateLinked = useCallback(async (parentSessionId: string, targetType: string) => {
        try {
            const res = await authFetch("/api/sessions/create-linked", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentSessionId, targetDocumentType: targetType }),
            })
            const result = await res.json()
            if (!res.ok || !result.success) {
                toast.error(result.error || "Failed to create linked document")
                return
            }
            // Navigate to the new linked session
            if (onLinkedSessionCreate) {
                onLinkedSessionCreate(result.session.id, targetType)
            }
            toast.success(`${targetType.charAt(0).toUpperCase() + targetType.slice(1)} created from ${docType}`)
        } catch {
            toast.error("Failed to create linked document")
        }
    }, [docType, onLinkedSessionCreate])

    return (
        <div className="flex flex-col h-full">
            {/* Chain Navigator — shows when session is part of a linked chain */}
            <ChainNavigator
                currentSessionId={selectedSessionId}
                onSessionSelect={onChainSessionSelect || (() => {})}
            />

            {/* Message count bar — desktop only, shows session usage */}
            {messages.filter(m => m.role === "user").length > 0 && (
                <div className="hidden md:flex items-center px-5 py-1.5 border-b border-border/30 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                        <Sparkles className="w-3 h-3" />
                        <span>{messages.filter(m => m.role === "user").length} message{messages.filter(m => m.role === "user").length !== 1 ? "s" : ""} this session</span>
                    </div>
                </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-5 bg-background">
                <div className="space-y-4 pb-4 max-w-xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div key={`${session?.id}-${idx}`} className={cn(
                            "flex w-full animate-in fade-in slide-in-from-bottom-1 duration-300",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}>
                            {msg.role === "user" ? (
                                <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300"
                                    style={{ boxShadow: "0 2px 8px hsl(var(--primary) / 0.25)" }}
                                >
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                            ) : (
                                <div className="max-w-[88%] px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/50 text-sm leading-relaxed text-foreground animate-in fade-in slide-in-from-bottom-2 duration-400"
                                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                                >
                                    <MarkdownMessage content={msg.content} />
                                </div>
                            )}
                        </div>
                    ))}
                    {/* Live streaming bubble */}
                    {streamingContent && (
                        <div className="flex justify-start w-full animate-in fade-in duration-200">
                            <div className="max-w-[88%] px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/50 text-sm leading-relaxed text-foreground"
                                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                            >
                                <MarkdownMessage content={streamingContent} />
                                <span className="inline-block w-0.5 h-3.5 bg-foreground/40 ml-0.5 animate-pulse align-middle" />
                            </div>
                        </div>
                    )}
                    {isLoading && !streamingContent && (
                        <div className="flex justify-start w-full animate-in fade-in duration-200">
                            <AIThinkingBlock label="Thinking..." />
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input + Next Steps */}
            <div className="px-4 py-3 border-t border-border/40 shrink-0 bg-card/95 backdrop-blur-sm"
              style={{ boxShadow: "0 -1px 0 0 rgba(0,0,0,0.04), 0 -4px 16px -4px rgba(0,0,0,0.06)" }}
            >
                <div className="max-w-xl mx-auto">
                    {/* Next Steps Bar — shows after generation is complete */}
                    {documentGenerated && !isLoading && !isUploading && session && (
                        <div className="mb-2.5">
                            <NextStepsBar
                                clientName={data.toName || null}
                                currentDocType={docType}
                                parentSessionId={session.id}
                                onCreateLinked={handleCreateLinked}
                            />
                        </div>
                    )}

                    {messageLimitReached && limitInfo ? (
                        <MessageLimitBanner
                            currentMessages={limitInfo.currentMessages}
                            limit={limitInfo.limit}
                            tier={limitInfo.tier}
                            currentDocType={docType}
                            hasChain={!!session?.chain_id}
                            parentSessionId={session?.id || ""}
                            onCreateDocument={(targetType) => {
                                handleCreateLinked(session!.id, targetType)
                            }}
                        />
                    ) : documentLimitReached && upgradeInfo ? (
                        <div className="rounded-2xl border bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                            <div className="flex items-start gap-3 mb-3">
                                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                        Monthly document limit reached
                                    </p>
                                    <p className="text-amber-600 dark:text-amber-400 text-sm mt-0.5">
                                        {upgradeInfo.currentUsage}/{upgradeInfo.limit} documents used this month
                                    </p>
                                </div>
                            </div>
                            <a
                                href="/pricing"
                                className="ml-8 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.97] shadow-sm"
                            >
                                <Sparkles className="w-4 h-4" />
                                Upgrade Plan
                            </a>
                        </div>
                    ) : (
                        <AIInputWithLoading
                            value={inputValue}
                            onValueChange={setInputValue}
                            isLoading={isLoading}
                            isUploading={isUploading}
                            onSubmit={(val) => {
                                if (stagedFile) {
                                    handleFileUpload(stagedFile, val.trim() || undefined)
                                    setStagedFile(null)
                                    setInputValue("")
                                } else {
                                    sendMessage(val)
                                }
                            }}
                            placeholder="Ask a question or describe a document..."
                            disabled={sessionLoading || !session}
                            statusText={isSaving ? "Saving..." : undefined}
                            showAttachButton={true}
                            stagedFile={stagedFile}
                            onFileSelect={(file) => setStagedFile(file)}
                            onFileRemove={() => setStagedFile(null)}
                        />
                    )}
                </div>
            </div>

            {/* Upgrade Modal — shown when tier limit or restriction is hit */}
            {upgradeInfo && (
                <UpgradeModal
                    open={showUpgradeModal}
                    onOpenChange={setShowUpgradeModal}
                    tier={upgradeInfo.tier}
                    currentUsage={upgradeInfo.currentUsage}
                    limit={upgradeInfo.limit}
                    errorType={upgradeInfo.errorType}
                    message={upgradeInfo.message}
                    onUpgradeSuccess={() => {
                        // Reset limit state so user can immediately continue
                        setDocumentLimitReached(false)
                        setUpgradeInfo(null)
                    }}
                />
            )}
        </div>
    )
}
