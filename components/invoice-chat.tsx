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
import { AgenticThinkingBlock, type ActivityItem } from "@/components/ui/agentic-thinking-block"
import { authFetch } from "@/lib/auth-fetch"
import { createClient } from "@/lib/supabase"
import { ClientSelector } from "@/components/clients/client-selector"
import { ChatSendCard } from "@/components/chat-send-card"
import { ChatShareCard } from "@/components/chat-share-card"
import { ChatPaymentCard } from "@/components/chat-payment-card"
import { SendEmailDialog } from "@/components/send-email-dialog"
import { usePaymentMethods } from "@/hooks/use-payment-methods"

// ── Send intent detection ─────────────────────────────────────────────────────

const SEND_INTENT_REGEX = /\b(send|email|mail|deliver|dispatch|forward)\b/i
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/

// ── Payment intent detection ──────────────────────────────────────────────────
const PAYMENT_INTENT_REGEX = /\b(payment\s*(gateway|method|link|option)|connect\s*(razorpay|stripe|cashfree|payment)|add\s*(payment|gateway)|online\s*payment|accept\s*payment|pay\s*online|payment\s*setup)\b/i

function detectPaymentIntent(prompt: string): boolean {
    return PAYMENT_INTENT_REGEX.test(prompt)
}

function detectSendIntent(prompt: string): { hasSendIntent: boolean; email: string } {
    const hasSendIntent = SEND_INTENT_REGEX.test(prompt)
    const emailMatch = prompt.match(EMAIL_REGEX)
    return { hasSendIntent, email: emailMatch ? emailMatch[0] : "" }
}

// ── Share intent detection (WhatsApp, link, general share) ────────────────────
const SHARE_INTENT_REGEX = /\b(share\s*(it|this|document|invoice|contract|quotation|proposal)?(\s*(via|on|through|to))?\s*(whatsapp|wa)?|whatsapp|wa\b)/i
const GENERAL_SHARE_REGEX = /\b(share|share\s*(it|this|document|invoice|contract|quotation|proposal))\s*$/i

function detectShareIntent(prompt: string): { hasShareIntent: boolean; method: "whatsapp" | "link" | "general" | "none" } {
    const lower = prompt.toLowerCase().trim()
    if (/whatsapp|wa\b/.test(lower)) return { hasShareIntent: true, method: "whatsapp" }
    if (/\b(copy\s*link|share\s*(via|on|through)?\s*link|get\s*link|share\s*url)\b/.test(lower)) return { hasShareIntent: true, method: "link" }
    if (GENERAL_SHARE_REGEX.test(lower) || /^share$/i.test(lower.trim())) return { hasShareIntent: true, method: "general" }
    if (SHARE_INTENT_REGEX.test(lower)) return { hasShareIntent: true, method: "general" }
    return { hasShareIntent: false, method: "none" }
}

// ── Document generation progress detection (client-side, zero extra API calls) ─
const DOC_PROGRESS_FIELDS: Array<{ key: string; pattern: RegExp; label: string; action: ActivityItem["action"] }> = [
    { key: "doctype", pattern: /"documentType"\s*:/, label: "Setting document type", action: "generate" },
    { key: "from", pattern: /"fromName"\s*:/, label: "Adding sender details", action: "read" },
    { key: "to", pattern: /"toName"\s*:/, label: "Setting client details", action: "generate" },
    { key: "items", pattern: /"items"\s*:\s*\[/, label: "Adding line items", action: "generate" },
    { key: "tax", pattern: /"taxRate"\s*:/, label: "Applying tax rules", action: "search" },
    { key: "terms", pattern: /"terms"\s*:/, label: "Writing terms & conditions", action: "generate" },
    { key: "notes", pattern: /"notes"\s*:/, label: "Adding notes", action: "generate" },
    { key: "design", pattern: /"design"\s*:\s*\{/, label: "Applying template design", action: "context" },
    { key: "description", pattern: /"description"\s*:/, label: "Writing description", action: "generate" },
    { key: "message", pattern: /"message"\s*:\s*"/, label: "Composing message", action: "generate" },
]

function detectDocumentProgress(content: string, lastKey: string): ActivityItem[] {
    const newSteps: ActivityItem[] = []
    let foundLast = lastKey === ""

    for (const field of DOC_PROGRESS_FIELDS) {
        if (!foundLast) {
            if (field.key === lastKey) foundLast = true
            continue
        }
        if (field.pattern.test(content)) {
            const step: ActivityItem = {
                id: `progress-${field.key}`,
                action: field.action,
                label: field.label,
            }
            // For items step, try to extract item count from partial content
            if (field.key === "items") {
                const itemMatches = content.match(/"description"\s*:\s*"/g)
                if (itemMatches && itemMatches.length > 0) {
                    step.detail = `${itemMatches.length} item${itemMatches.length > 1 ? "s" : ""}`
                }
            }
            newSteps.push(step)
        }
    }
    return newSteps
}

interface InvoiceChatProps {
    data: InvoiceData
    onChange: (updates: Partial<InvoiceData>) => void
    selectedSessionId?: string
    onSessionChange?: (sessionId: string) => void
    onLinkedSessionCreate?: (sessionId: string, docType: string) => void
    onChainSessionSelect?: (sessionId: string) => void
    onMessageCountChange?: (count: number) => void
    onLockDocument?: () => void
    onPaymentLinkCancelled?: () => void
    initialPrompt?: string
    /** Called once the session is ready with a function to persist context to DB */
    onSaveContext?: (saveFn: (data: InvoiceData) => Promise<void>) => void
}

export function InvoiceChat({ data, onChange, selectedSessionId, onSessionChange, onLinkedSessionCreate, onChainSessionSelect, onMessageCountChange, onLockDocument, onPaymentLinkCancelled, initialPrompt, onSaveContext }: InvoiceChatProps) {
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
    const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "thinking"; content: string; sendCard?: { email: string }; shareCard?: boolean; paymentCard?: boolean; cancelledCard?: boolean; activities?: ActivityItem[]; isWorking?: boolean; reasoningText?: string; isThinking?: boolean; thinkingStartTime?: number }>>([])
    const [streamingContent, setStreamingContent] = useState<string | null>(null)
    const [thinkingMode, setThinkingMode] = useState<"fast" | "thinking">("fast")
    const [welcomeLoaded, setWelcomeLoaded] = useState(false)
    const [documentGenerated, setDocumentGenerated] = useState(false)
    const [fileContext, setFileContext] = useState<string | null>(null)
    const [messageLimitReached, setMessageLimitReached] = useState(false)
    const [limitInfo, setLimitInfo] = useState<{ currentMessages: number; limit: number; tier: string } | null>(null)
    const [documentLimitReached, setDocumentLimitReached] = useState(false)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeInfo, setUpgradeInfo] = useState<{ tier: string; currentUsage?: number; limit?: number; errorType: "limit" | "type_restriction" | "feature_restricted"; message?: string } | null>(null)
    // Send dialog state (opened from chat card "Customize" button)
    const [sendDialogOpen, setSendDialogOpen] = useState(false)
    const [sendDialogEmail, setSendDialogEmail] = useState("")

    // Payment methods hook — to check if any gateway is connected
    const { hasAnyGateway } = usePaymentMethods()

    const scrollRef = useRef<HTMLDivElement>(null)
    const initialPromptSentRef = useRef(false)
    const lastSyncedSessionRef = useRef<string | null>(null)
    const pendingAutoGenerateRef = useRef<string | null>(null)

    // Expose updateSessionContext to parent once session is ready
    useEffect(() => {
        if (!session || !onSaveContext) return
        onSaveContext(updateSessionContext)
    }, [session?.id, onSaveContext, updateSessionContext]) // eslint-disable-line react-hooks/exhaustive-deps

    // Inject "payment link cancelled" card when parent signals cancellation
    const prevCancelledRef = useRef(false)
    useEffect(() => {
        if (!onPaymentLinkCancelled) return
        // Register a trigger: when parent calls onPaymentLinkCancelled, inject the card
        // We do this by watching the function reference change (parent passes new fn each time)
        // This is a fire-once pattern — inject card on first call
        const originalFn = onPaymentLinkCancelled
        return () => {
            // When the effect re-runs (fn changed), it means parent triggered it
            if (prevCancelledRef.current) {
                setMessages(prev => [...prev, {
                    role: "assistant" as const,
                    content: "",
                    cancelledCard: true,
                }])
            }
            prevCancelledRef.current = true
        }
    }, [onPaymentLinkCancelled]) // eslint-disable-line react-hooks/exhaustive-deps

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
                // Strip payment link fields — PaymentLinkButton fetches authoritative state from invoice_payments table
                const { paymentLink: _pl, paymentLinkStatus: _pls, showPaymentLinkInPdf: _spdf, ...cleanCtx } = ctx as any
                onChange(cleanCtx as Partial<InvoiceData>)
                setDocumentGenerated(true)
            }
        } else {
            // Check if this is a linked session with seed context (no messages yet)
            const ctx = session.context
            const hasSeedData = ctx && typeof ctx === "object" && !Array.isArray(ctx) && Object.keys(ctx).length > 1

            if (hasSeedData && session.chain_id) {
                // Linked session — show seed data in preview and auto-generate
                // Strip payment link fields — each session has its own payment link
                const { paymentLink: _pl, paymentLinkStatus: _pls, showPaymentLinkInPdf: _spdf, ...cleanCtx } = ctx as any
                onChange(cleanCtx as Partial<InvoiceData>)
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
    // Load logo from business profile and warm cache
    // Runs on mount AND when session changes to ensure logo is always available
    useEffect(() => {
        let cancelled = false
        async function loadProfileLogo() {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user || cancelled) return

                const { data: biz, error: bizError } = await supabase
                    .from("businesses")
                    .select("logo_url, logo_data_url")
                    .eq("user_id", user.id)
                    .single() as any

                if (bizError || !biz?.logo_url) return
                if (cancelled) return

                const { warmLogoCache } = await import("@/hooks/use-logo-url")

                // Use cached data_url if valid (starts with data:)
                if (biz.logo_data_url && typeof biz.logo_data_url === "string" && biz.logo_data_url.startsWith("data:")) {
                    warmLogoCache(biz.logo_url, biz.logo_data_url)
                } else {
                    // logo_data_url is missing or corrupted — re-fetch from R2 and repair DB
                    try {
                        const { authFetch } = await import("@/lib/auth-fetch")
                        const res = await authFetch(`/api/storage/image?key=${encodeURIComponent(biz.logo_url)}`)
                        if (res.ok) {
                            const json = await res.json()
                            if (json.dataUrl && json.dataUrl.startsWith("data:")) {
                                warmLogoCache(biz.logo_url, json.dataUrl)
                                // Repair the DB entry so next load is instant
                                await supabase
                                    .from("businesses")
                                    .update({ logo_data_url: json.dataUrl } as any)
                                    .eq("user_id", user.id)
                                    .then(() => {}, () => {}) // non-blocking, ignore errors
                            }
                        }
                    } catch { /* R2 fetch failed — logo will be missing from PDF but not a crash */ }
                }

                if (!cancelled && !data.fromLogo) {
                    onChange({ fromLogo: biz.logo_url })
                }
            } catch (err) {
                console.warn("[logo] Failed to load profile logo:", err)
            }
        }
        loadProfileLogo()
        return () => { cancelled = true }
    }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load saved signature from profile and auto-fill into document
    useEffect(() => {
        let cancelled = false
        async function loadProfileSignature() {
            try {
                // Only auto-fill if document doesn't already have a sender signature
                // AND the user hasn't explicitly turned off the signature toggle
                if (data.senderSignatureDataUrl) return
                if (data.showSenderSignature === false) return
                const { authFetch: af } = await import("@/lib/auth-fetch")
                const res = await af("/api/profile/signature")
                if (!res.ok || cancelled) return
                const d = await res.json()
                if (d.signatureDataUrl && !cancelled) {
                    onChange({ senderSignatureDataUrl: d.signatureDataUrl, showSenderSignature: true })
                }
            } catch { /* non-fatal */ }
        }
        loadProfileSignature()
        return () => { cancelled = true }
    }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // Save design changes to session context (debounced 800ms)
    // This ensures design persists and propagates to linked sessions
    const designSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        if (!session || !data.design) return
        // Only save if session already has content (don't save on initial empty state)
        const sessionCtx = session.context as any
        if (!sessionCtx || Object.keys(sessionCtx).length === 0) return

        if (designSaveTimerRef.current) clearTimeout(designSaveTimerRef.current)
        designSaveTimerRef.current = setTimeout(async () => {
            try {
                await updateSessionContext({ ...data, design: data.design })
            } catch { /* non-fatal */ }
        }, 800)
        return () => {
            if (designSaveTimerRef.current) clearTimeout(designSaveTimerRef.current)
        }
    }, [data.design]) // eslint-disable-line react-hooks/exhaustive-deps

    // Core send function — ALWAYS uses DeepSeek (via /api/ai/stream)
    // This is called for ALL text-only messages AND as step 2 after file extraction
    // GPT is NEVER used here — only DeepSeek for document generation/chat
    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !session) return

        const userMessage = messageText.trim()

        // ── Pre-flight document type switch guard ──────────────────────────────
        const DOC_TYPE_KEYWORDS: Record<string, string[]> = {
            invoice:   ["invoice", "invoices"],
            contract:  ["contract", "contracts", "agreement", "agreements"],
            quotation: ["quotation", "quotations", "quote", "quotes", "estimate", "estimates"],
            proposal:  ["proposal", "proposals", "pitch", "pitches"],
        }
        const CREATE_VERBS = /\b(create|make|generate|build|write|draft|produce|give me|i need|i want)\b/i
        const msgLower = userMessage.toLowerCase()
        if (CREATE_VERBS.test(msgLower)) {
            for (const [targetType, keywords] of Object.entries(DOC_TYPE_KEYWORDS)) {
                if (targetType === docType) continue // same type — fine
                if (keywords.some(kw => new RegExp(`\\b${kw}\\b`, "i").test(msgLower))) {
                    const targetLabel = targetType.charAt(0).toUpperCase() + targetType.slice(1)
                    const currentLabel = docType.charAt(0).toUpperCase() + docType.slice(1)

                    // Check if the target type is allowed for this user's tier
                    // We check the upgrade info from the session context
                    const isRestrictedType = upgradeInfo?.errorType === "type_restriction" ||
                        (targetType === "quotation" || targetType === "proposal")

                    // We'll let the server enforce — but give a helpful message
                    const guidanceMsg = `This is a **${currentLabel}** session — I can only generate ${currentLabel}s here.\n\n**To create a ${targetLabel}:**\n1. Click the **New Doc** button below (after generating a document) or the **+** button in the top bar\n2. Select **${targetLabel}** as the document type\n3. Ask me the same thing there\n\nYour ${currentLabel} is safe and unchanged. 👍`
                    setInputValue("")
                    setMessages(prev => [...prev, { role: "user" as const, content: userMessage }, { role: "assistant" as const, content: guidanceMsg }])
                    await saveMessage("user", userMessage)
                    await saveMessage("assistant", guidanceMsg)
                    return
                }
            }
        }
        // ── End pre-flight guard ───────────────────────────────────────────────

        // ── Payment intent guard — show card if no gateway connected ──────────
        if (docType === "invoice" && detectPaymentIntent(userMessage) && !hasAnyGateway) {
            setInputValue("")
            setMessages(prev => [...prev,
                { role: "user" as const, content: userMessage },
                { role: "assistant" as const, content: "To accept online payments on your invoices, you'll need to connect a payment gateway. Here's how to get started:", paymentCard: true },
            ])
            await saveMessage("user", userMessage)
            await saveMessage("assistant", "To accept online payments on your invoices, you'll need to connect a payment gateway.")
            return
        }
        // ── End payment intent guard ──────────────────────────────────────────

        // Display only the user's text, not the enriched file context
        const displayText = userMessage.includes("[CLIENT DETAILS FROM ATTACHED FILE")
            ? userMessage.split("\n\n[CLIENT DETAILS")[0].trim() || "📎 Generate from attached file"
            : userMessage
        setInputValue("")
        setMessages(prev => [...prev, { role: "user" as const, content: displayText }, { role: "thinking" as const, content: "", activities: [], isWorking: true, thinkingStartTime: Date.now() }])
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
                    thinkingMode,
                    // Send currentData if this is a follow-up OR if this is a linked session with seed data
                    currentData: (messages.length > 1 || session.chain_id) ? data : undefined,
                    conversationHistory: messages.length > 1 ? messages.slice(-20) : [],
                    ...(fileContext ? { fileContext } : {}),
                    // Pass parent context for linked sessions so AI knows the client details
                    // from the original document (email, address, etc.)
                    // Only pass the immediate parent's data — strip internal/sensitive fields
                    // and only include client-relevant fields the AI needs.
                    ...(session.chain_id && session.context && typeof session.context === "object" && !Array.isArray(session.context) && Object.keys(session.context).length > 0
                        ? (() => {
                            const ctx = session.context as Record<string, any>
                            // Extract only the client-facing fields — never send signatures, logos, or internal markers
                            const safeParentData: Record<string, any> = {}
                            const clientFields = ["toName", "toEmail", "toAddress", "toPhone", "currency", "paymentTerms", "items", "taxRate", "taxLabel", "total", "subtotal"]
                            for (const field of clientFields) {
                                if (ctx[field] != null) safeParentData[field] = ctx[field]
                            }
                            // Only inject if there's actually useful client data
                            if (!safeParentData.toName && !safeParentData.toEmail) return {}
                            return {
                                parentContext: {
                                    // Use the stored parent document type, not the current session's type
                                    documentType: ctx._parentDocumentType || "document",
                                    data: safeParentData,
                                }
                            }
                        })()
                        : {}),
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
            let thinkingDone = false // true once first content chunk arrives (reasoning phase over)
            let isDocumentJSON = false // true once we detect this is a JSON document response
            let lastDetectedStep = "" // tracks last detected progress step to avoid duplicates
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
                        if (parsed.type === "activity") {
                            // Append/update activity in the thinking message
                            setMessages(prev => {
                                const updated = [...prev]
                                const thinkingMsg = updated.find(m => m.role === "thinking" && m.isWorking)
                                if (thinkingMsg && thinkingMsg.activities) {
                                    // Check if this is an update to an existing activity (same action + label, now has detail)
                                    const existing = thinkingMsg.activities.find(
                                        a => a.action === parsed.action && a.label === parsed.label && !a.detail
                                    )
                                    if (existing && parsed.detail) {
                                        existing.detail = parsed.detail
                                        // Store content as reasoningText for expandable display
                                        if (parsed.content) {
                                            existing.reasoningText = parsed.content
                                        }
                                    } else if (!existing) {
                                        thinkingMsg.activities.push({
                                            id: `activity-${Date.now()}-${thinkingMsg.activities.length}`,
                                            action: parsed.action,
                                            label: parsed.label,
                                            detail: parsed.detail,
                                            reasoningText: parsed.content,
                                        })
                                    }
                                }
                                return [...updated]
                            })
                        } else if (parsed.type === "reasoning") {
                            // Accumulate real reasoning tokens from DeepSeek into a "think" activity
                            setMessages(prev => {
                                const updated = [...prev]
                                const thinkingMsg = updated.find(m => m.role === "thinking" && m.isWorking)
                                if (thinkingMsg && thinkingMsg.activities) {
                                    // Find or create the last "think" activity
                                    let thinkActivity = [...thinkingMsg.activities].reverse().find(a => a.action === "think")
                                    if (!thinkActivity) {
                                        thinkActivity = { id: `think-${Date.now()}`, action: "think", label: "Think", reasoningText: "" }
                                        thinkingMsg.activities.push(thinkActivity)
                                    }
                                    thinkActivity.reasoningText = (thinkActivity.reasoningText || "") + parsed.data
                                }
                                return [...updated]
                            })
                        } else if (parsed.type === "chunk") {
                            fullContent += parsed.data

                            // Detect if this is JSON (document generation) vs text (chat)
                            if (!isStreamingText && !isDocumentJSON && fullContent.length > 50) {
                                const trimmed = fullContent.trimStart()
                                isDocumentJSON = trimmed.startsWith("{") || trimmed.startsWith("[")
                                    || trimmed.includes("```json") || trimmed.includes('"document"')
                                    || trimmed.includes('"documentType"')
                            }

                            // For chat text: close thinking on first chunk (existing behavior)
                            if (!isDocumentJSON && !thinkingDone) {
                                thinkingDone = true
                                setMessages(prev => {
                                    const updated = [...prev]
                                    const thinkingMsg = updated.find(m => m.role === "thinking" && m.isWorking)
                                    if (thinkingMsg) {
                                        thinkingMsg.isWorking = false
                                    }
                                    return [...updated]
                                })
                            }

                            // For document JSON: detect progress and keep thinking open
                            if (isDocumentJSON) {
                                const trimmed = fullContent.trimStart()
                                const progressSteps = detectDocumentProgress(trimmed, lastDetectedStep)
                                if (progressSteps.length > 0) {
                                    lastDetectedStep = progressSteps[progressSteps.length - 1].id.replace("progress-", "")
                                    setMessages(prev => {
                                        const updated = [...prev]
                                        const thinkingMsg = updated.find(m => m.role === "thinking" && m.isWorking)
                                        if (thinkingMsg && thinkingMsg.activities) {
                                            for (const step of progressSteps) {
                                                // Don't add duplicates
                                                if (!thinkingMsg.activities.find(a => a.id === step.id)) {
                                                    thinkingMsg.activities.push(step)
                                                } else {
                                                    // Update detail if it changed (e.g. item count)
                                                    const existing = thinkingMsg.activities.find(a => a.id === step.id)
                                                    if (existing && step.detail && existing.detail !== step.detail) {
                                                        existing.detail = step.detail
                                                    }
                                                }
                                            }
                                        }
                                        return [...updated]
                                    })
                                }
                                // Also update item count on subsequent chunks (items grow over time)
                                if (lastDetectedStep === "items" || trimmed.includes('"items"')) {
                                    const itemMatches = trimmed.match(/"description"\s*:\s*"/g)
                                    if (itemMatches && itemMatches.length > 0) {
                                        const newDetail = `${itemMatches.length} item${itemMatches.length > 1 ? "s" : ""}`
                                        setMessages(prev => {
                                            const updated = [...prev]
                                            const thinkingMsg = updated.find(m => m.role === "thinking" && m.isWorking)
                                            if (thinkingMsg && thinkingMsg.activities) {
                                                const itemStep = thinkingMsg.activities.find(a => a.id === "progress-items")
                                                if (itemStep && itemStep.detail !== newDetail) {
                                                    itemStep.detail = newDetail
                                                    return [...updated]
                                                }
                                            }
                                            return prev // no change needed
                                        })
                                    }
                                }
                            }

                            // Only stream live if we're confident this is NOT a JSON response.
                            if (!isStreamingText && fullContent.length > 200) {
                                const trimmed = fullContent.trimStart()
                                const looksLikeJSON = trimmed.startsWith("{") || trimmed.startsWith("[") 
                                    || trimmed.includes("```json") || trimmed.includes('"document"')
                                    || trimmed.includes('"documentType"')
                                if (!looksLikeJSON) {
                                    isStreamingText = true
                                    setIsLoading(false)
                                    setStreamingContent(fullContent)
                                }
                            } else if (isStreamingText) {
                                setStreamingContent(fullContent)
                            }
                        } else if (parsed.type === "complete") {
                            completeData = parsed.data
                            // Mark thinking as done
                            setMessages(prev => {
                                const updated = [...prev]
                                const thinkingMsg = updated.find(m => m.role === "thinking" && m.isWorking)
                                if (thinkingMsg) {
                                    thinkingMsg.isWorking = false
                                }
                                return updated
                            })
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
            
            // Strip markdown code fences — handle both "starts with" and "embedded" patterns
            // Pattern 1: Response starts with ```json
            if (cleaned.startsWith("```json")) {
                cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
            } else if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "")
            }
            // Pattern 2: Response has text before ```json (e.g., "Here's the invoice:\n\n```json\n{...}\n```")
            // Extract the JSON block from inside the code fence
            else if (cleaned.includes("```json")) {
                const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)```/)
                if (jsonMatch?.[1]) {
                    cleaned = jsonMatch[1].trim()
                }
            } else if (cleaned.includes("```")) {
                const codeMatch = cleaned.match(/```\s*([\s\S]*?)```/)
                if (codeMatch?.[1] && codeMatch[1].trim().startsWith("{")) {
                    cleaned = codeMatch[1].trim()
                }
            }
            // Pattern 3: Response has text before raw JSON (no code fence)
            // e.g., "Here's your invoice:\n\n{"document": {...}}"
            if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
                const jsonStart = cleaned.indexOf("\n{")
                if (jsonStart !== -1) {
                    cleaned = cleaned.slice(jsonStart + 1).trim()
                }
            }
            cleaned = cleaned.trim()

            if (cleaned.startsWith("{")) {
                // This is JSON — clear any streaming text that may have leaked
                setStreamingContent(null)
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

                    // ── Document type isolation guard ──────────────────────────────────
                    // If the AI generated a different document type than the current session,
                    // block the update and guide the user to start a new session.
                    // This prevents e.g. asking for a "contract" in an invoice session from
                    // silently overwriting the invoice with contract data.
                    const currentSessionType = docType.toLowerCase()
                    const generatedType = (docData.documentType || "").toLowerCase()
                    const typeChanged = generatedType && generatedType !== currentSessionType

                    if (typeChanged) {
                        const generatedLabel = docData.documentType || generatedType
                        const currentLabel = currentSessionType.charAt(0).toUpperCase() + currentSessionType.slice(1)
                        const guidanceMsg = `I generated a **${generatedLabel}** for you, but this is a **${currentLabel}** session — I can't apply it here because it would overwrite your ${currentLabel}.\n\n**To create a ${generatedLabel}:**\n1. Click the **New Doc** button below or the **+** button in the top bar\n2. Select **${generatedLabel}** as the document type\n3. Ask me the same thing there\n\nYour ${currentLabel} is safe and unchanged. 👍`
                        setMessages(prev => [...prev, { role: "assistant", content: guidanceMsg }])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", guidanceMsg)
                        setIsLoading(false)
                        return
                    }

                    // If AI omitted documentType, force it to the current session type
                    if (!generatedType) {
                        docData.documentType = currentSessionType.charAt(0).toUpperCase() + currentSessionType.slice(1)
                    }
                    // ── End isolation guard ────────────────────────────────────────────

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

                    // ── Send intent detection ──────────────────────────────────────────
                    // If the user's prompt contained a send intent (e.g. "send to xyz@email.com"),
                    // append a send card after the assistant message.
                    // The AI message is kept brief — the card IS the action.
                    const { hasSendIntent, email: detectedEmail } = detectSendIntent(userMessage)
                    if (hasSendIntent) {
                        const cardEmail = detectedEmail || docData.toEmail || ""
                        setMessages(prev => [...prev, {
                            role: "assistant",
                            content: "",
                            sendCard: { email: cardEmail },
                        }])
                    }
                    // ── End send intent detection ──────────────────────────────────────
                } else {
                    // JSON parse completely failed — show a friendly error instead of raw JSON
                    console.error("Failed to parse AI response as JSON:", cleaned.slice(0, 200))
                    const fallbackMsg = "I generated your document but had trouble processing the response. Please try again."
                    setMessages(prev => [...prev, { role: "assistant", content: fallbackMsg }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", fallbackMsg)
                }
            } else {
                // Not JSON — plain text response from AI (e.g., clarification question)
                // ── Send intent detection for plain-text responses ─────────────────
                // If user asked to send and document already exists, show send card ONLY
                // Replace the AI's "click Send button" instructions with a minimal message
                if (documentGenerated && session) {
                    // Check for share intent first
                    const shareIntent = detectShareIntent(userMessage)

                    // General "share" — show multi-option share card
                    if (shareIntent.hasShareIntent && shareIntent.method === "general") {
                        const shareMsg = `How would you like to share your ${docType}?`
                        setMessages(prev => [...prev,
                            { role: "assistant", content: shareMsg },
                            { role: "assistant", content: "", shareCard: true },
                        ])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", shareMsg)
                        return
                    }

                    if (shareIntent.hasShareIntent && shareIntent.method === "whatsapp") {
                        const clientName = data.toName || ""
                        const ref = data.invoiceNumber || data.referenceNumber || ""
                        const platformLink = `${window.location.origin}/pay/${session.id}`
                        const defaultMsg = `Hi ${clientName},\n\nPlease find the ${docType} ${ref}.\n\n${platformLink}\n\nThank you,\n${data.fromName || ""}`
                        const waMsg = `Sure! Opening WhatsApp with a pre-filled message for your ${docType}.`
                        setMessages(prev => [...prev, { role: "assistant", content: waMsg }])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", waMsg)
                        window.open(`https://wa.me/?text=${encodeURIComponent(defaultMsg)}`, "_blank")
                        onLockDocument?.()
                        return
                    }
                    if (shareIntent.hasShareIntent && shareIntent.method === "link") {
                        const platformLink = `${window.location.origin}/pay/${session.id}`
                        try { await navigator.clipboard.writeText(platformLink) } catch {}
                        const linkMsg = `Done! Here's your shareable link:\n\n\`${platformLink}\`\n\nIt's been copied to your clipboard.`
                        setMessages(prev => [...prev, { role: "assistant", content: linkMsg }])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", linkMsg)
                        return
                    }

                    const { hasSendIntent, email: detectedEmail } = detectSendIntent(userMessage)
                    if (hasSendIntent) {
                        const cardEmail = detectedEmail || data.toEmail || ""
                        // Show a minimal message + card instead of the AI's verbose instructions
                        const minimalMsg = `Sure! Fill in the details below to send your ${docType}.`
                        setMessages(prev => [...prev, { role: "assistant", content: minimalMsg }, {
                            role: "assistant",
                            content: "",
                            sendCard: { email: cardEmail },
                        }])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", minimalMsg)
                        return
                    }
                }
                // ── End send intent detection ──────────────────────────────────────
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
            // Mark thinking message as complete on error
            setMessages(prev => {
                const updated = [...prev]
                const thinkingMsg = updated.find(m => m.role === "thinking" && m.isWorking)
                if (thinkingMsg) {
                    thinkingMsg.isWorking = false
                }
                return [...updated, { role: "assistant" as const, content: assistantMsg }]
            })
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

            {/* Sent/Locked banner — shown when session is finalized or signed */}
            {session && (session.status === "finalized" || session.status === "signed") && (
                <div className="shrink-0 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/40 flex items-center gap-2">
                    <span className="text-amber-600 dark:text-amber-400 text-sm shrink-0">🔒</span>
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">
                        {session.status === "signed"
                            ? "This document has been signed and is locked."
                            : "This document has been sent. You can still edit it, but it cannot be resent from this session."}
                    </p>
                </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 bg-background">
                <div className="px-4 py-5 space-y-4 pb-4 max-w-xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div key={`${session?.id}-${idx}`} className={cn(
                            "flex w-full animate-in fade-in slide-in-from-bottom-1 duration-300",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}>
                            {msg.role === "thinking" ? (
                                (msg.activities && msg.activities.length > 0 || msg.isWorking) ? (
                                <div className="w-full max-w-[85%]">
                                    <AgenticThinkingBlock
                                        activities={msg.activities || []}
                                        isWorking={msg.isWorking ?? false}
                                    />
                                </div>
                                ) : null
                            ) : msg.sendCard ? (
                                // Inline send card — only shown when send intent detected
                                <ChatSendCard
                                    sessionId={session!.id}
                                    invoiceData={data}
                                    documentType={docType}
                                    detectedEmail={msg.sendCard.email}
                                    onDismiss={() => setMessages(prev => prev.filter((_, i) => i !== idx))}
                                    onLockDocument={onLockDocument}
                                    onSent={() => {
                                        // Card handles its own sent state
                                    }}
                                />
                            ) : msg.shareCard ? (
                                // Inline share options card — shown when user types "share"
                                <ChatShareCard
                                    sessionId={session!.id}
                                    documentType={docType}
                                    clientName={data.toName || ""}
                                    fromName={data.fromName || ""}
                                    referenceNumber={data.invoiceNumber || data.referenceNumber || ""}
                                    toEmail={data.toEmail || ""}
                                    onSelectEmail={(email) => {
                                        // Replace share card with send card
                                        setMessages(prev => prev.map((m, i) =>
                                            i === idx ? { role: "assistant" as const, content: "", sendCard: { email } } : m
                                        ))
                                    }}
                                    onDismiss={() => setMessages(prev => prev.filter((_, i) => i !== idx))}
                                    onLockDocument={onLockDocument}
                                />
                            ) : msg.paymentCard ? (
                                // Inline payment gateway card — shown when payment intent detected without gateway
                                <div className="w-full space-y-2">
                                    <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/50 text-sm leading-relaxed text-foreground"
                                        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                                    >
                                        <MarkdownMessage content={msg.content} />
                                    </div>
                                    <ChatPaymentCard
                                        onDismiss={() => setMessages(prev => prev.map((m, i) => i === idx ? { ...m, paymentCard: false } : m))}
                                        onConfigure={() => window.open("/settings?tab=payments", "_blank")}
                                    />
                                </div>
                            ) : msg.cancelledCard ? (
                                // Payment link cancelled notification card
                                <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 px-4 py-3 flex items-center gap-3"
                                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                                >
                                    <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                                        <span className="text-sm">🔗</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Payment link cancelled</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">The invoice is now editable again</p>
                                    </div>
                                </div>
                            ) : msg.role === "user" ? (
                                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300 break-words overflow-hidden"
                                    style={{ boxShadow: "0 2px 8px hsl(var(--primary) / 0.25)", wordBreak: "break-word", overflowWrap: "anywhere" }}
                                >
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                            ) : (
                                <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/50 text-sm leading-relaxed text-foreground animate-in fade-in slide-in-from-bottom-2 duration-400 break-words overflow-hidden"
                                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)", wordBreak: "break-word", overflowWrap: "anywhere" }}
                                >
                                    <MarkdownMessage content={msg.content} />
                                </div>
                            )}
                        </div>
                    ))}
                    {/* Live streaming bubble */}
                    {streamingContent && (
                        <div className="flex justify-start w-full animate-in fade-in duration-200">
                            <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/50 text-sm leading-relaxed text-foreground break-words overflow-hidden"
                                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)", wordBreak: "break-word", overflowWrap: "anywhere" }}
                            >
                                <MarkdownMessage content={streamingContent} />
                                <span className="inline-block w-0.5 h-3.5 bg-foreground/40 ml-0.5 animate-pulse align-middle" />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input area */}
            <div className="border-t border-border/40 shrink-0 bg-card/95 backdrop-blur-sm"
              style={{ boxShadow: "0 -1px 0 0 rgba(0,0,0,0.04), 0 -4px 16px -4px rgba(0,0,0,0.06)" }}
            >
                {/* Unified toolbar: New Doc + Select Client in one row, collapsible panel below */}
                {documentGenerated && !isLoading && !isUploading && session && (
                    <div className="px-4 pt-2.5 pb-0">
                        <div className="max-w-xl mx-auto">
                            <NextStepsBar
                                clientName={data.toName || null}
                                currentDocType={docType}
                                parentSessionId={session.id}
                                onCreateLinked={handleCreateLinked}
                                invoiceData={data}
                                onPaymentLinkChange={(shortUrl, status) => {
                                    onChange({
                                        paymentLink: shortUrl,
                                        paymentLinkStatus: status as any,
                                        showPaymentLinkInPdf: true,
                                    })
                                }}
                                clientSelectorSlot={
                                    <ClientSelector
                                        onChange={(fields) =>
                                            onChange({
                                                toName: fields.toName,
                                                toEmail: fields.toEmail,
                                                toAddress: fields.toAddress,
                                                toPhone: fields.toPhone,
                                                toTaxId: fields.toTaxId,
                                            })
                                        }
                                    />
                                }
                            />
                        </div>
                    </div>
                )}

                {/* Main input wrapper — pb-safe for iOS home indicator */}
                <div className="px-4 pt-2.5 pb-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
                <div className="max-w-xl mx-auto">
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
                        /* When doc not yet generated, show Select Client above input */
                        !documentGenerated ? (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <ClientSelector
                                        onChange={(fields) =>
                                            onChange({
                                                toName: fields.toName,
                                                toEmail: fields.toEmail,
                                                toAddress: fields.toAddress,
                                                toPhone: fields.toPhone,
                                                toTaxId: fields.toTaxId,
                                            })
                                        }
                                    />
                                </div>
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
                                    thinkingMode={thinkingMode}
                                    onThinkingModeChange={setThinkingMode}
                                />
                            </>
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
                                thinkingMode={thinkingMode}
                                onThinkingModeChange={setThinkingMode}
                            />
                        )
                    )}
                </div>
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

            {/* Send Email Dialog — opened from chat card "Customize" button */}
            {session && sendDialogOpen && (
                <SendEmailDialog
                    open={sendDialogOpen}
                    onClose={() => setSendDialogOpen(false)}
                    sessionId={session.id}
                    invoiceData={data}
                    documentType={docType}
                    defaultEmail={sendDialogEmail}
                    onEmailSent={() => {
                        setSendDialogOpen(false)
                        toast.success("Document sent!")
                    }}
                />
            )}
        </div>
    )
}
