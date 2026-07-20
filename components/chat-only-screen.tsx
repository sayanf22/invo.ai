"use client"

/**
 * ChatOnlyScreen — the new pre-document advisory chat experience.
 *
 * This is the screen that sits between the Start screen (app-shell.tsx, view='start')
 * and the split-screen (prompt-screen.tsx, view='prompt'). When a user types a
 * prompt that the intent classifier routes as `chat-only` (questions, ambiguous
 * requests, mismatches), they land here.
 *
 * Behavior:
 *   1. On mount: creates a chat-only document_sessions row (or resumes one),
 *      sends the initialPrompt to /api/ai/stream with documentType='chat'.
 *   2. The AI replies conversationally, never with document JSON.
 *   3. After the user confirms (yes/sure/ok) OR types an explicit "create X
 *      for Y" message, the AI emits a [CREATE_CARD:{...}] signal at the end of
 *      its response. We parse it and render a ChatCreateCard inline.
 *   4. Clicking the Create card promotes the session via /api/sessions/promote
 *      and calls onPromote() which transitions to the split-screen.
 *
 * Visual rules: monochromatic only. No accent / primary colors inside the chat
 * surface (chrome can use the standard header colors).
 *
 * Implements requirements 1.4, 1.5, 1.6, 1.7, 3.*, 5.*, 8.* from the spec.
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { ArrowLeft } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/auth-fetch"
import { useSupabase } from "@/components/auth-provider"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading"
import { MarkdownMessage } from "@/components/markdown-message"
import { ChatCreateCard } from "@/components/chat-create-card"
import { DisambiguationCard } from "@/components/disambiguation-card"
import {
    parseCreateCardSignal,
    stripCreateCardSignal,
    type ParsedCreateCard,
} from "@/lib/chat-only-prompts"
import type { IntentSuggestion } from "@/lib/intent-router"
import type { DocumentType } from "@/lib/document-type-registry"

// ── Confirmation detection ──
// A user confirmation = a short affirmative message AFTER an AI message that
// suggested a document type. When this fires, we hint the AI to emit a
// CREATE_CARD signal in its next response.
const CONFIRMATION_REGEX =
    /^\s*(yes|yeah|yep|ok|okay|sure|do it|go ahead|create it|sounds good|please|let'?s do it|proceed|absolutely|definitely)[.! ]*$/i

function isConfirmation(text: string): boolean {
    return CONFIRMATION_REGEX.test(text.trim())
}

// ── Explicit mid-chat create detection ──
// "create invoice for X", "make a contract for Y", etc. — these should
// short-circuit the suggest/confirm dance and immediately surface a create card.
const EXPLICIT_CREATE_REGEX =
    /\b(create|generate|make|draft|prepare|build|new)\b.{0,30}\b(invoice|contract|quotation|quote|estimate|proposal|bill)\b/i

function detectExplicitCreate(text: string): "invoice" | "contract" | "quote" | "estimate" | "proposal" | null {
    const lower = text.toLowerCase()
    if (!EXPLICIT_CREATE_REGEX.test(lower)) return null
    if (/\b(invoice|bill)\b/.test(lower)) return "invoice"
    if (/\b(contract|agreement)\b/.test(lower)) return "contract"
    if (/\b(estimate|ballpark)\b/.test(lower)) return "estimate"
    if (/\b(quotation|quote)\b/.test(lower)) return "quote"
    if (/\b(proposal)\b/.test(lower)) return "proposal"
    return null
}

// ── Types ──

/** Canonical document types supported in chat-only flow (legacy "quotation" is normalized to "quote"). */
type DocType = "invoice" | "contract" | "quote" | "estimate" | "proposal" | "sow" | "change_order" | "nda" | "client_onboarding_form" | "payment_followup" | "recurring_invoice"

interface ChatMessage {
    id: string
    role: "user" | "assistant"
    content: string
    /** When set, render a ChatCreateCard beneath this message. */
    createCard?: ParsedCreateCard
    /** True while a promotion request is in flight for this card. */
    isCreating?: boolean
    /** When set, render a disambiguation card beneath this message (Req 3.3a). */
    disambiguationCard?: {
        suggestions: IntentSuggestion[]
        /** True while a type selection is being processed. */
        isSelecting?: boolean
        /** True once the user has dismissed/selected (removes the card). */
        dismissed?: boolean
    }
    /** When set, render an upgrade card (tier limit reached). */
    upgradeCard?: {
        tier: string
        currentUsage?: number
        limit?: number
        message: string
        restrictionType?: "document_type" | "quota"
        requestedType?: string
    }
}

interface MismatchRedirect {
    requestedType: DocType
    suggestedType: DocType
    reason: string
    initialMessage: string
}

export interface ChatOnlyScreenProps {
    /** The first user prompt (from the Start screen). Empty when resuming. */
    initialPrompt: string
    /** Optional: an existing chat session id to resume from history. */
    resumeSessionId?: string
    /** Optional: pre-loaded mismatch context that triggered the chat-only route. */
    mismatch?: MismatchRedirect
    /**
     * Optional: disambiguation context when the intent classifier returned
     * two or more plausible document types (Requirement 3.3a).
     * When provided, a DisambiguationCard is shown as the first assistant
     * message instead of firing an AI stream turn.
     */
    disambiguation?: {
        suggestions: IntentSuggestion[]
    }
    onBack: () => void
    onPromote: (params: { sessionId: string; documentType: DocType; initialPrompt: string }) => void
}

// ── Component ──

export function ChatOnlyScreen({
    initialPrompt,
    resumeSessionId,
    mismatch,
    disambiguation,
    onBack,
    onPromote,
}: ChatOnlyScreenProps) {
    const supabase = useSupabase()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState("")
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [streamingId, setStreamingId] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const initRef = useRef(false)
    const abortRef = useRef<AbortController | null>(null)

    // ── File attachment state ──
    const [stagedFile, setStagedFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)

    // Generate a unique id for messages (React-key stable, not crypto-strength)
    const nextId = useRef(0)
    const newId = useCallback(() => `m-${++nextId.current}-${Date.now()}`, [])

    // Auto-scroll to bottom on new content
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }, [messages, isLoading])

    // Cleanup on unmount: abort in-flight stream
    useEffect(() => {
        return () => {
            abortRef.current?.abort()
        }
    }, [])

    // ── Stream a turn from /api/ai/stream ──
    const streamTurn = useCallback(
        async (
            prompt: string,
            options: { sessionId: string; saveAsAssistantId: string; hint?: string }
        ): Promise<{ ok: boolean; finalContent: string; createCard?: ParsedCreateCard; rateLimitData?: Record<string, unknown> | null; statusCode?: number }> => {
            const controller = new AbortController()
            abortRef.current?.abort()
            abortRef.current = controller

            const fullPrompt = options.hint ? `${prompt}\n\n${options.hint}` : prompt

            try {
                const res = await authFetch("/api/ai/stream", {
                    method: "POST",
                    body: JSON.stringify({
                        prompt: fullPrompt,
                        documentType: "chat",
                        sessionId: options.sessionId,
                        thinkingMode: "fast",
                        // Pass conversation history so Kimi K2.5 has full context.
                        // We exclude the current user message (it's in `prompt`).
                        conversationHistory: messages
                            .filter(m => m.role === "user" || m.role === "assistant")
                            .filter(m => m.content.trim().length > 0)
                            .map(m => ({ role: m.role, content: m.content })),
                    }),
                    signal: controller.signal,
                })

                if (!res.ok || !res.body) {
                    let errMessage = "Chat is unavailable right now."
                    let rateLimitData: Record<string, unknown> | null = null
                    try {
                        const data = await res.json()
                        if (data?.error) errMessage = data.error
                        // Surface rate limit data so the caller can show an upgrade card
                        if (res.status === 429 || res.status === 403) {
                            rateLimitData = data
                        }
                    } catch { /* not JSON */ }
                    return { ok: false, finalContent: errMessage, rateLimitData, statusCode: res.status }
                }

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ""
                let accum = ""
                let foundMismatch: MismatchRedirect | null = null

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split("\n")
                    buffer = lines.pop() || ""

                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (!trimmed.startsWith("data:")) continue
                        const data = trimmed.slice(5).trim()
                        if (!data) continue
                        try {
                            const ev = JSON.parse(data)
                            // Mismatch redirect (typed-session pre-flight) — should not happen
                            // in chat-only mode, but handle defensively.
                            if (ev.type === "mismatch-redirect") {
                                foundMismatch = {
                                    requestedType: ev.requestedType,
                                    suggestedType: ev.suggestedType,
                                    reason: ev.reason,
                                    initialMessage: ev.initialMessage,
                                }
                                accum = ev.initialMessage || accum
                                break
                            }
                            if (ev.type === "chunk" && typeof ev.data === "string") {
                                accum += ev.data
                                // Live-update the streaming message
                                const visible = stripCreateCardSignal(accum)
                                setMessages(prev =>
                                    prev.map(m =>
                                        m.id === options.saveAsAssistantId
                                            ? { ...m, content: visible }
                                            : m
                                    )
                                )
                            } else if (ev.type === "complete" && typeof ev.data === "string") {
                                accum = ev.data
                            } else if (ev.type === "error") {
                                accum = accum || (typeof ev.data === "string" ? ev.data : "Something went wrong.")
                            }
                        } catch {
                            // Ignore unparseable lines
                        }
                    }
                    if (foundMismatch) break
                }

                const card = parseCreateCardSignal(accum)
                const visible = stripCreateCardSignal(accum)
                return { ok: true, finalContent: visible, createCard: card ?? undefined }
            } catch (err: any) {
                if (err?.name === "AbortError") {
                    return { ok: false, finalContent: "" }
                }
                console.error("Chat stream error:", err)
                return { ok: false, finalContent: "Connection issue. Please try again." }
            } finally {
                if (abortRef.current === controller) abortRef.current = null
            }
        },
        []
    )

    // ── Analyze an attached file via Kimi vision, return enriched context string ──
    // Images go directly; PDFs are rasterized to images client-side (Kimi can't
    // read PDFs natively). The raw content is used only as HIDDEN AI context —
    // the visible chat shows just an attachment chip + the user's typed text.
    const analyzeFile = useCallback(async (file: File, userText: string): Promise<string> => {
        try {
            const { analyzeAttachment } = await import("@/lib/attachment-analysis")
            const result = await analyzeAttachment({ file, message: userText, mode: "extract" })
            if (!result.ok || !result.summary) return userText

            const fileName = file.name
            const fileType = file.type.startsWith("image/") ? "image" : "document"
            return userText
                ? `${userText}\n\n[ATTACHED ${fileType.toUpperCase()}: ${fileName}]\n${result.summary}`
                : `I've attached a ${fileType} (${fileName}). Here's what it contains:\n${result.summary}\n\nWhat document should I create from this?`
        } catch (err) {
            console.error("File analysis error:", err)
            return userText
        }
    }, [])

    // ── Send a user message ──
    const sendMessage = useCallback(
        async (text: string, opts: { skipUserMessage?: boolean; hint?: string; file?: File } = {}) => {
            const trimmed = text.trim()
            if ((!trimmed && !opts.file) || isLoading || !sessionId) return

            // If a file is attached, analyze it first (GPT vision → extract context)
            let enrichedText = trimmed
            let fileDisplayName: string | undefined
            if (opts.file) {
                setIsUploading(true)
                fileDisplayName = opts.file.name
                enrichedText = await analyzeFile(opts.file, trimmed)
                setIsUploading(false)
                setStagedFile(null)
            }

            // Detect explicit create — if found, short-circuit to direct promotion
            // by injecting a hint that asks the AI to emit a CREATE_CARD immediately.
            const explicitType = detectExplicitCreate(enrichedText)
            const lastAi = [...messages].reverse().find(m => m.role === "assistant")
            const lastSuggestedConfirmation =
                lastAi && /create|invoice|contract|quotation|proposal/i.test(lastAi.content)
            const isConfirm = lastSuggestedConfirmation && isConfirmation(trimmed)

            let hint = opts.hint
            if (explicitType) {
                hint = `[HINT: user explicitly requested to create a ${explicitType}. Include CREATE_CARD signal in your response.]`
            } else if (isConfirm) {
                hint = `[HINT: user confirmed they want to create the document you suggested. Include CREATE_CARD signal in your response.]`
            }

            // Display text: show original user text + file name if attached
            const displayText = fileDisplayName
                ? (trimmed ? `${trimmed}\n📎 ${fileDisplayName}` : `📎 ${fileDisplayName}`)
                : trimmed

            // Optimistic user message
            const userMsgId = newId()
            const assistantMsgId = newId()
            if (!opts.skipUserMessage) {
                setMessages(prev => [
                    ...prev,
                    { id: userMsgId, role: "user", content: displayText },
                ])
            }
            // Empty assistant placeholder for streaming
            setMessages(prev => [
                ...prev,
                { id: assistantMsgId, role: "assistant", content: "" },
            ])
            setStreamingId(assistantMsgId)
            setIsLoading(true)
            setInputValue("")

            // Persist user message to DB (best effort)
            if (!opts.skipUserMessage) {
                supabase
                    .from("chat_messages")
                    .insert({ session_id: sessionId, role: "user", content: displayText })
                    .then(({ error }) => {
                        if (error) console.warn("Failed to save user message:", error.message)
                    })
            }

            // Stream the AI response — use enrichedText (with file context) for the AI
            const result = await streamTurn(enrichedText, {
                sessionId,
                saveAsAssistantId: assistantMsgId,
                hint,
            })

            setStreamingId(null)
            setIsLoading(false)

            if (!result.ok && !result.finalContent) {
                // Show an upgrade card for 429 (rate limit) or 403 (type restriction)
                if ((result.statusCode === 429 || result.statusCode === 403) && result.rateLimitData) {
                    const d = result.rateLimitData as any
                    setMessages(prev =>
                        prev
                            .filter(m => m.id !== assistantMsgId)
                            .concat([{
                                id: newId(),
                                role: "assistant",
                                content: "",
                                upgradeCard: {
                                    tier: d.tier || "free",
                                    currentUsage: d.currentMessages,
                                    limit: d.limit,
                                    message: d.message || result.finalContent || "Chat limit reached for this session.",
                                    restrictionType: result.statusCode === 403 ? "document_type" : undefined,
                                    requestedType: d.requestedType,
                                },
                            }])
                    )
                    return
                }
                // Aborted or hard failure — remove placeholder
                setMessages(prev => prev.filter(m => m.id !== assistantMsgId))
                return
            }

            // Finalize the assistant message with stripped content + optional CREATE_CARD
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                              ...m,
                              content: result.finalContent,
                              createCard: result.createCard,
                          }
                        : m
                )
            )

            // Persist assistant message to DB
            if (result.finalContent) {
                supabase
                    .from("chat_messages")
                    .insert({
                        session_id: sessionId,
                        role: "assistant",
                        content: result.finalContent,
                        metadata: result.createCard ? { createCard: result.createCard as any } : null,
                    })
                    .then(({ error }) => {
                        if (error) console.warn("Failed to save assistant message:", error.message)
                    })
            }
        },
        [isLoading, sessionId, messages, supabase, streamTurn, newId, analyzeFile]
    )

    // ── Initialize: create or resume session, fire initial prompt ──
    useEffect(() => {
        if (initRef.current) return
        initRef.current = true

        const init = async () => {
            try {
                // Resume an existing session?
                if (resumeSessionId) {
                    const { data: sessionData } = await supabase
                        .from("document_sessions")
                        .select("id, document_type")
                        .eq("id", resumeSessionId)
                        .maybeSingle()
                    if (sessionData?.document_type === "chat") {
                        setSessionId(sessionData.id)
                        const { data: msgs } = await supabase
                            .from("chat_messages")
                            .select("id, role, content, metadata, created_at")
                            .eq("session_id", sessionData.id)
                            .order("created_at", { ascending: true })
                        if (msgs) {
                            const restored: ChatMessage[] = (msgs as any[]).map(m => {
                                const md = (m.metadata || {}) as any
                                return {
                                    id: m.id,
                                    role: m.role as "user" | "assistant",
                                    content: m.content,
                                    createCard: md.createCard
                                        ? (md.createCard as ParsedCreateCard)
                                        : undefined,
                                }
                            })
                            setMessages(restored)
                        }
                        return
                    }
                    // Resume id pointed to a non-chat session — fall through to fresh creation
                }

                // Create a fresh chat-only session
                const res = await authFetch("/api/sessions/create-chat", {
                    method: "POST",
                    body: JSON.stringify({ initialPrompt: initialPrompt || undefined }),
                })
                const data = await res.json()
                if (!res.ok || !data?.success) {
                    toast.error(data?.error || "Could not start chat. Please try again.")
                    return
                }
                setSessionId(data.session.id)

                // If a mismatch redirect was passed in (start-screen detected mismatch),
                // render the AI's redirect message immediately as the first assistant
                // message — no API call needed.
                if (mismatch) {
                    const card: ParsedCreateCard = {
                        type: mismatch.suggestedType,
                        summary: `Suggested ${mismatch.suggestedType} based on your request`,
                    }
                    if (initialPrompt) {
                        setMessages([
                            { id: newId(), role: "user", content: initialPrompt },
                            {
                                id: newId(),
                                role: "assistant",
                                content: stripCreateCardSignal(mismatch.initialMessage),
                                createCard: card,
                            },
                        ])
                        // Persist both messages
                        supabase
                            .from("chat_messages")
                            .insert([
                                { session_id: data.session.id, role: "user", content: initialPrompt },
                                {
                                    session_id: data.session.id,
                                    role: "assistant",
                                    content: stripCreateCardSignal(mismatch.initialMessage),
                                    metadata: { createCard: card as any },
                                },
                            ])
                            .then(({ error }) => {
                                if (error) console.warn("Failed to save mismatch messages:", error.message)
                            })
                    }
                    return
                }

                // ── Disambiguation path (Requirement 3.3a) ──────────────────────
                // When the intent classifier returned 2+ plausible types, show a
                // disambiguation card as the first assistant message — no AI call.
                if (disambiguation && disambiguation.suggestions.length >= 2) {
                    const disambigId = newId()
                    const initMessages: ChatMessage[] = []
                    if (initialPrompt) {
                        initMessages.push({ id: newId(), role: "user", content: initialPrompt })
                    }
                    initMessages.push({
                        id: disambigId,
                        role: "assistant",
                        content: "",
                        disambiguationCard: { suggestions: disambiguation.suggestions },
                    })
                    setMessages(initMessages)
                    // Persist user message only (the disambiguation card is ephemeral UI)
                    if (initialPrompt) {
                        supabase
                            .from("chat_messages")
                            .insert({ session_id: data.session.id, role: "user", content: initialPrompt })
                            .then(({ error }) => {
                                if (error) console.warn("Failed to save user message:", error.message)
                            })
                    }
                    return
                }

                // Normal path: fire the initial prompt as the first turn.
                if (initialPrompt) {
                    setMessages([
                        { id: newId(), role: "user", content: initialPrompt },
                    ])
                    // Use sendMessage with skipUserMessage since we already added it.
                    // We need to wait for sessionId state to settle, but we have it locally.
                    setTimeout(() => {
                        // Use the local id, not the state (state may not be updated yet)
                        const aiId = newId()
                        setMessages(prev => [
                            ...prev,
                            { id: aiId, role: "assistant", content: "" },
                        ])
                        setStreamingId(aiId)
                        setIsLoading(true)
                        streamTurn(initialPrompt, {
                            sessionId: data.session.id,
                            saveAsAssistantId: aiId,
                        }).then(result => {
                            setStreamingId(null)
                            setIsLoading(false)
                            if (!result.ok && !result.finalContent) {
                                setMessages(prev => prev.filter(m => m.id !== aiId))
                                return
                            }
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === aiId
                                        ? { ...m, content: result.finalContent, createCard: result.createCard }
                                        : m
                                )
                            )
                            if (result.finalContent) {
                                supabase
                                    .from("chat_messages")
                                    .insert({
                                        session_id: data.session.id,
                                        role: "assistant",
                                        content: result.finalContent,
                                        metadata: result.createCard
                                            ? { createCard: result.createCard as any }
                                            : null,
                                    })
                                    .then(({ error }) => {
                                        if (error)
                                            console.warn("Failed to save initial assistant message:", error.message)
                                    })
                            }
                        })
                    }, 0)
                }
            } catch (err) {
                console.error("ChatOnlyScreen init error:", err)
                toast.error("Could not start chat. Please try again.")
            }
        }
        init()
    }, [initialPrompt, resumeSessionId, mismatch, disambiguation, supabase, streamTurn, newId])

    // ── Promote: chat-only → typed session ──
    const handlePromote = useCallback(
        async (messageId: string, card: ParsedCreateCard) => {
            if (!sessionId) return
            // Mark the card as creating
            setMessages(prev =>
                prev.map(m => (m.id === messageId ? { ...m, isCreating: true } : m))
            )
            try {
                const res = await authFetch("/api/sessions/promote", {
                    method: "POST",
                    body: JSON.stringify({ sessionId, targetType: card.type }),
                })
                const data = await res.json()
                if (!res.ok || !data?.success) {
                    // Reset creating state
                    setMessages(prev =>
                        prev.map(m => (m.id === messageId ? { ...m, isCreating: false } : m))
                    )
                    // Inline upgrade card on 429 / 403
                    if (res.status === 429 || res.status === 403) {
                        setMessages(prev => [
                            ...prev,
                            {
                                id: newId(),
                                role: "assistant",
                                content: "",
                                upgradeCard: {
                                    tier: data.tier || "free",
                                    currentUsage: data.currentUsage,
                                    limit: data.limit,
                                    message: data.message || data.error || "Upgrade required to continue.",
                                    restrictionType: data.restrictionType || (res.status === 403 ? "document_type" : "quota"),
                                    requestedType: data.requestedType,
                                },
                            },
                        ])
                        return
                    }
                    toast.error(data?.error || "Could not create the document. Please try again.")
                    return
                }

                // Success — bubble up to AppShell which will switch to split-screen
                onPromote({
                    sessionId,
                    documentType: card.type,
                    initialPrompt: card.summary,
                })
            } catch (err) {
                console.error("Promote error:", err)
                setMessages(prev =>
                    prev.map(m => (m.id === messageId ? { ...m, isCreating: false } : m))
                )
                toast.error("Could not create the document. Please try again.")
            }
        },
        [sessionId, onPromote, newId]
    )

    // ── Disambiguation handlers (Requirement 3.3a) ──────────────────────────

    /**
     * Called when the user picks a specific type from the disambiguation card.
     * Promotes the session to the chosen type (same flow as ChatCreateCard).
     */
    const handleDisambiguationSelect = useCallback(
        async (messageId: string, type: DocumentType) => {
            if (!sessionId) return
            // Mark the disambiguation card as processing
            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, disambiguationCard: m.disambiguationCard ? { ...m.disambiguationCard, isSelecting: true } : undefined }
                        : m
                )
            )
            try {
                const res = await authFetch("/api/sessions/promote", {
                    method: "POST",
                    body: JSON.stringify({ sessionId, targetType: type }),
                })
                const data = await res.json()
                if (!res.ok || !data?.success) {
                    // Reset selecting state
                    setMessages(prev =>
                        prev.map(m =>
                            m.id === messageId
                                ? { ...m, disambiguationCard: m.disambiguationCard ? { ...m.disambiguationCard, isSelecting: false } : undefined }
                                : m
                        )
                    )
                    // Inline upgrade card on 429 / 403
                    if (res.status === 429 || res.status === 403) {
                        // Dismiss the disambiguation card first
                        setMessages(prev =>
                            prev.map(m =>
                                m.id === messageId
                                    ? { ...m, disambiguationCard: m.disambiguationCard ? { ...m.disambiguationCard, dismissed: true } : undefined }
                                    : m
                            )
                        )
                        setMessages(prev => [
                            ...prev,
                            {
                                id: newId(),
                                role: "assistant",
                                content: "",
                                upgradeCard: {
                                    tier: data.tier || "free",
                                    currentUsage: data.currentUsage,
                                    limit: data.limit,
                                    message: data.message || data.error || "Upgrade required to continue.",
                                    restrictionType: data.restrictionType || (res.status === 403 ? "document_type" : "quota"),
                                    requestedType: data.requestedType,
                                },
                            },
                        ])
                        return
                    }
                    toast.error(data?.error || "Could not create the document. Please try again.")
                    return
                }
                // Dismiss the card and transition to split-screen
                setMessages(prev =>
                    prev.map(m =>
                        m.id === messageId
                            ? { ...m, disambiguationCard: m.disambiguationCard ? { ...m.disambiguationCard, dismissed: true } : undefined }
                            : m
                    )
                )
                onPromote({
                    sessionId,
                    documentType: type as DocType,
                    initialPrompt: initialPrompt,
                })
            } catch (err) {
                console.error("Disambiguation select error:", err)
                setMessages(prev =>
                    prev.map(m =>
                        m.id === messageId
                            ? { ...m, disambiguationCard: m.disambiguationCard ? { ...m.disambiguationCard, isSelecting: false } : undefined }
                            : m
                    )
                )
                toast.error("Could not create the document. Please try again.")
            }
        },
        [sessionId, onPromote, newId, initialPrompt]
    )

    /**
     * Called when the user clicks "Something else" on the disambiguation card.
     * Dismisses the card and fires the initial prompt into the normal AI chat flow.
     */
    const handleDisambiguationFallthrough = useCallback(
        async (messageId: string) => {
            // Dismiss the disambiguation card
            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, disambiguationCard: m.disambiguationCard ? { ...m.disambiguationCard, dismissed: true } : undefined }
                        : m
                )
            )
            // Fire the initial prompt into AI chat now
            if (initialPrompt && sessionId) {
                const aiId = newId()
                setMessages(prev => [
                    ...prev,
                    { id: aiId, role: "assistant", content: "" },
                ])
                setStreamingId(aiId)
                setIsLoading(true)
                const result = await streamTurn(initialPrompt, {
                    sessionId,
                    saveAsAssistantId: aiId,
                })
                setStreamingId(null)
                setIsLoading(false)
                if (!result.ok && !result.finalContent) {
                    setMessages(prev => prev.filter(m => m.id !== aiId))
                    return
                }
                setMessages(prev =>
                    prev.map(m =>
                        m.id === aiId
                            ? { ...m, content: result.finalContent, createCard: result.createCard }
                            : m
                    )
                )
                if (result.finalContent) {
                    supabase
                        .from("chat_messages")
                        .insert({
                            session_id: sessionId,
                            role: "assistant",
                            content: result.finalContent,
                            metadata: result.createCard ? { createCard: result.createCard as any } : null,
                        })
                        .then(({ error }) => {
                            if (error) console.warn("Failed to save fallthrough response:", error.message)
                        })
                }
            }
        },
        [initialPrompt, sessionId, newId, streamTurn, supabase]
    )

    return (
        <div className="h-dvh flex flex-col bg-background overflow-hidden">
            {/* ── Header (matches PromptScreen, but no tab switcher) ── */}
            <header
                className="flex items-center px-3 py-2.5 border-b border-border bg-card shrink-0 relative gap-2"
                style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.06), 0 4px 16px -4px rgba(0,0,0,0.1)" }}
            >
                <div className="flex items-center gap-2 shrink-0 z-10">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center justify-center w-9 h-9 rounded-2xl bg-background border border-border text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 active:scale-95 shrink-0"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <ClorefyLogo size={24} />
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 ml-1 rounded-full text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted border border-border/60">
                        Chat
                    </span>
                </div>

                <div className="flex-1 min-w-0" />

                <div className="flex items-center gap-2 shrink-0 justify-end z-10">
                    <div className="shrink-0 w-10 h-10 relative">
                        <HamburgerMenu />
                    </div>
                </div>
            </header>

            {/* ── Messages list ── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
                <div className="max-w-3xl mx-auto w-full px-4 lg:px-6 py-6 flex flex-col">
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center py-16 gap-3 text-muted-foreground">
                            <div className="text-2xl font-display font-medium text-foreground">
                                Hi, I can help you figure out the right document.
                            </div>
                            <div className="text-sm max-w-md leading-relaxed">
                                Ask anything about your business documents — invoices, contracts, quotes, estimates, proposals and more. I&apos;ll suggest the right one and you can decide when to create it.
                            </div>
                        </div>
                    )}

                    <div className="space-y-5">
                        <AnimatePresence initial={false}>
                            {messages.map(msg => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                    className={cn(
                                        "flex w-full",
                                        msg.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className="flex flex-col gap-2 max-w-[85%] lg:max-w-[80%]">
                                        {msg.content && (
                                            <div
                                                className={cn(
                                                    "rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm border",
                                                    msg.role === "user"
                                                        ? "bg-foreground text-background border-foreground rounded-br-sm"
                                                        : "bg-card text-foreground border-border/60 rounded-bl-sm"
                                                )}
                                            >
                                                {msg.role === "assistant" ? (
                                                    <MarkdownMessage content={msg.content} />
                                                ) : (
                                                    <span className="whitespace-pre-wrap">{msg.content}</span>
                                                )}
                                            </div>
                                        )}
                                        {/* Streaming dots placeholder when content is empty */}
                                        {msg.role === "assistant" && !msg.content && streamingId === msg.id && !msg.disambiguationCard && (
                                            <div className="bg-muted rounded-2xl rounded-bl-sm px-5 py-4 space-x-1.5 flex items-center border border-border/40 shadow-sm">
                                                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                                            </div>
                                        )}
                                        {/* Create card */}
                                        {msg.createCard && (
                                            <ChatCreateCard
                                                documentType={msg.createCard.type}
                                                summary={msg.createCard.summary}
                                                isCreating={!!msg.isCreating}
                                                onConfirm={() => handlePromote(msg.id, msg.createCard!)}
                                            />
                                        )}
                                        {/* Disambiguation card (Requirement 3.3a) */}
                                        {msg.disambiguationCard && !msg.disambiguationCard.dismissed && (
                                            <DisambiguationCard
                                                suggestions={msg.disambiguationCard.suggestions}
                                                isSelecting={!!msg.disambiguationCard.isSelecting}
                                                onSelect={(type) => handleDisambiguationSelect(msg.id, type)}
                                                onSelectChat={() => handleDisambiguationFallthrough(msg.id)}
                                            />
                                        )}
                                        {/* Inline upgrade card */}
                                        {msg.upgradeCard && (
                                            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm max-w-[420px] flex flex-col gap-3">
                                                <div className="flex items-start gap-3">
                                                    {/* Icon */}
                                                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                                        <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                            {msg.upgradeCard.restrictionType === "document_type" ? (
                                                                // Lock icon for type restriction
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                                            ) : (
                                                                // Chart icon for quota exhaustion
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                                                            )}
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-foreground leading-tight">
                                                            {msg.upgradeCard.restrictionType === "document_type"
                                                                ? `${msg.upgradeCard.requestedType ? msg.upgradeCard.requestedType.charAt(0).toUpperCase() + msg.upgradeCard.requestedType.slice(1) + "s" : "This document type"} need a higher plan`
                                                                : msg.upgradeCard.currentUsage !== undefined
                                                                    ? "Chat message limit reached"
                                                                    : "Monthly limit reached"
                                                            }
                                                        </p>
                                                        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                                                            {msg.upgradeCard.message}
                                                        </p>
                                                        {msg.upgradeCard.restrictionType !== "document_type" &&
                                                            msg.upgradeCard.currentUsage !== undefined &&
                                                            msg.upgradeCard.limit !== undefined && (
                                                                <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
                                                                    {msg.upgradeCard.currentUsage} / {msg.upgradeCard.limit} messages used in this session
                                                                </p>
                                                            )}
                                                    </div>
                                                </div>
                                                <a
                                                    href="/billing"
                                                    className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors active:scale-[0.98]"
                                                >
                                                    {msg.upgradeCard.restrictionType === "document_type" ? "See plans" : "Upgrade plan"}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    <div ref={scrollRef} />
                </div>
            </div>

            {/* ── Input ── */}
            <div className="shrink-0 border-t border-border/60 bg-background">
                <div className="max-w-3xl mx-auto w-full px-4 lg:px-6 py-3">
                    <AIInputWithLoading
                        value={inputValue}
                        onValueChange={setInputValue}
                        placeholder={stagedFile ? "Describe what to do with this file..." : "Ask anything, or describe what you want to create..."}
                        isLoading={isLoading}
                        isUploading={isUploading}
                        disabled={!sessionId}
                        showAttachButton
                        stagedFile={stagedFile}
                        onFileSelect={(file) => {
                            // Validate file type and size before staging
                            const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]
                            if (!allowed.includes(file.type)) {
                                toast.error("Unsupported file type. Please attach an image or PDF.")
                                return
                            }
                            if (file.size > 10 * 1024 * 1024) {
                                toast.error("File too large. Maximum 10MB.")
                                return
                            }
                            setStagedFile(file)
                        }}
                        onFileRemove={() => setStagedFile(null)}
                        onSubmit={async value => {
                            await sendMessage(value, { file: stagedFile ?? undefined })
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
