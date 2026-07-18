"use client"

// Module-level counter for generating unique activity IDs.
// Using Date.now() alone causes duplicates when multiple activities arrive
// within the same millisecond (common during fast streaming responses).
let _activityCounter = 0
function nextActivityId(): string {
    return `activity-${++_activityCounter}`
}

/**
 * Salvage a JSON string that was truncated mid-output (e.g. when the AI hit
 * its max_tokens limit). Walks the input character-by-character tracking
 * brace/bracket depth (ignoring chars inside string literals) and appends the
 * required closing braces/brackets to rebalance the structure.
 *
 * Handles common truncation points: mid-string, after a key, mid-value (number,
 * boolean), after a colon, or after a trailing comma. The result is a parseable
 * JSON string with the truncated tail dropped (the partial document is still
 * useful — better than a parse error and a "trouble processing" fallback).
 *
 * Returns the rebalanced JSON string, or null if the input is fundamentally
 * unrecoverable (e.g. mismatched brackets, wrong opening char).
 */
function balanceTruncatedJson(input: string): string | null {
    if (!input || input.length === 0) return null
    const trimInput = input.trim()
    if (!trimInput.startsWith("{") && !trimInput.startsWith("[")) return null

    // Walk the input tracking brace/bracket depth and string state. Snapshot
    // the input length and stack depth at the END of the last fully complete
    // VALUE — we can safely truncate to that snapshot and rebalance.
    const stack: Array<"}" | "]"> = []
    let inString = false
    let escapeNext = false
    // The last position where we know the JSON was structurally "safe" to truncate
    // i.e. just after a closing brace, closing bracket, or a complete primitive.
    // We track the index INTO trimInput (length so far) and the stack snapshot at
    // that point.
    let safeLen = 0
    let safeStack: Array<"}" | "]"> = []
    // After a `:` we expect a value — if truncated here, drop the key
    // After a `,` we expect another item — if truncated here, drop the comma
    let pendingColon = false

    for (let i = 0; i < trimInput.length; i++) {
        const ch = trimInput[i]
        if (inString) {
            if (escapeNext) { escapeNext = false; continue }
            if (ch === "\\") { escapeNext = true; continue }
            if (ch === '"') inString = false
            continue
        }
        if (ch === '"') { inString = true; continue }
        if (ch === "{") {
            stack.push("}")
            pendingColon = false
            continue
        }
        if (ch === "[") {
            stack.push("]")
            pendingColon = false
            continue
        }
        if (ch === "}" || ch === "]") {
            if (stack[stack.length - 1] !== ch) return null // mismatched
            stack.pop()
            // After a closer we have a complete value — this is a safe truncation point
            safeLen = i + 1
            safeStack = [...stack]
            pendingColon = false
            continue
        }
        if (ch === ":") { pendingColon = true; continue }
        if (ch === ",") {
            // Comma marks end of previous value — safe truncation point
            safeLen = i // up to BEFORE the comma (we'll drop it)
            safeStack = [...stack]
            pendingColon = false
            continue
        }
        // Whitespace
        if (/\s/.test(ch)) continue
        // Any other char (digit, true/false/null literal, or part of a value)
        // — value is in progress, not yet safe
    }

    // If we never reached a safe checkpoint, the document has nothing we can use
    if (safeLen === 0) {
        // Try the very minimal salvage: if input is just an opening brace + maybe
        // the start of a key, return an empty object so downstream code at least
        // has a shape (it'll fall back to defaults). But this is rarely useful —
        // for now, return null to signal unrecoverable.
        return null
    }

    let result = trimInput.slice(0, safeLen)
    // Append all the open braces/brackets remaining at that snapshot
    for (let j = safeStack.length - 1; j >= 0; j--) result += safeStack[j]
    return result
}

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
import { ensureOnboardingFillLink } from "@/lib/onboarding-link-client"
import { createClient } from "@/lib/supabase"
import { ClientSelector } from "@/components/clients/client-selector"
import { ChatSendCard } from "@/components/chat-send-card"
import { ChatShareCard } from "@/components/chat-share-card"
import { ChatPaymentCard } from "@/components/chat-payment-card"
import { ChatCancelPaymentCard } from "@/components/chat-cancel-payment-card"
import { SendEmailDialog } from "@/components/send-email-dialog"
import { usePaymentMethods } from "@/hooks/use-payment-methods"
import { useContextDocuments } from "@/hooks/use-context-documents"
import { useUserTier, isReferenceContextEnabled } from "@/hooks/use-user-tier"
import { ContextManagerDialog } from "@/components/context-manager"
import { ChatAssetLinkCard } from "@/components/chat-asset-link-card"
import { fetchPublicDocumentLink } from "@/lib/public-document-link-client"
import { classifyDeliveryAction, hasDeliveryHint, type DeliveryAction } from "@/lib/delivery-intent-client"

// ── Send intent detection ─────────────────────────────────────────────────────
// Detects when user wants to SEND/DELIVER the document.
// Returns:
//   method: "email"   → user explicitly wants email (has email address or says "email")
//   method: "general" → user says "send it/this" without specifying how → show options
//   method: "none"    → no send intent detected
// Must NOT trigger on: "add email", "what's the email", "email from previous doc", etc.

// Matches explicit email sending: "email to", "send via email", "mail to", or has an email address
const EMAIL_SEND_REGEX = /\b(email\s+to\b|mail\s+to\b|send\s+(via|through|by)\s+email|forward\s+(via|through|by)\s+email)\b/i
// Matches generic send-document intent: "send it", "send this", "send the proposal", "send to John",
// "please send", "go ahead and send". Does NOT match "send for approval", "send for review",
// "send for confirmation" — those are workflow descriptions, not document-send requests.
const GENERIC_SEND_REGEX = /(?:^|\b)(?:please\s+|go\s+ahead\s+(?:and\s+)?)?send\s+(?:it|this|the\s+\w+|to\b|via\s+email|now|please|out|across|over)\b|(?:^|\b)(?:please\s+)?send\s*$|deliver\s+to\b|forward\s+to\b|dispatch\s+to\b/i
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/

// Non-send email contexts — reject if these match
const NON_SEND_EMAIL_REGEX = /\b(add|get|fetch|retrieve|find|what|which|update|fill|include|use|from|previous|linked|document)\s+(the\s+)?email\b/i
const EMAIL_CONTEXT_REGEX = /\bemail\s+(address|from|of|in|on|for)\b/i

// Non-send "send" contexts — "send for approval/review/confirmation" is a workflow step, not send-doc
const NON_SEND_SEND_REGEX = /\bsend\s+(?:for|as|when|after|before|once|if|and|to\s+(?:be|get|have|make|let))\b/i

// Matches direct "send to [person]" with a name (not a verb like "send to modify")
const SEND_TO_PERSON_REGEX = /\bsend\s+(it\s+)?to\s+([A-Z][a-z]+|[A-Z]{2,}|\w+\s+[A-Z][a-z]+)/

function detectSendIntent(prompt: string): { hasSendIntent: boolean; method: "email" | "general" | "none"; email: string } {
    const lower = prompt.toLowerCase().trim()

    // Guard: reject non-send email contexts
    if (NON_SEND_EMAIL_REGEX.test(lower) || EMAIL_CONTEXT_REGEX.test(lower)) {
        return { hasSendIntent: false, method: "none", email: "" }
    }

    // Guard: reject "send for approval", "send for review", "send for confirmation", etc.
    // These are workflow descriptions (e.g. "posts will be sent for approval"), not send-doc requests.
    if (NON_SEND_SEND_REGEX.test(lower)) {
        return { hasSendIntent: false, method: "none", email: "" }
    }

    const emailMatch = prompt.match(EMAIL_REGEX)
    const hasEmailAddress = !!emailMatch

    // If user provides an email address with a send verb → direct to send card
    if (hasEmailAddress && GENERIC_SEND_REGEX.test(prompt)) {
        return { hasSendIntent: true, method: "email", email: emailMatch![0] }
    }

    // If user explicitly says "email to" / "send via email" / "mail it" → direct to send card
    if (EMAIL_SEND_REGEX.test(prompt)) {
        return { hasSendIntent: true, method: "email", email: emailMatch ? emailMatch[0] : "" }
    }

    // Generic send (no channel specified): "send it", "send this", "send now", "please send"
    // → show 3-option share card so user can pick how they want to send
    if (GENERIC_SEND_REGEX.test(prompt)) {
        return { hasSendIntent: true, method: "general", email: "" }
    }

    return { hasSendIntent: false, method: "none", email: "" }
}

// ── Payment intent detection ──────────────────────────────────────────────────
const PAYMENT_INTENT_REGEX = /\b(payment\s*(gateway|method|link|option)|connect\s*(razorpay|stripe|cashfree|payment)|add\s*(payment|gateway)|online\s*payment|accept\s*payment|pay\s*online|payment\s*setup)\b/i

function detectPaymentIntent(prompt: string): boolean {
    return PAYMENT_INTENT_REGEX.test(prompt)
}

// ── Cancel payment link intent detection ──────────────────────────────────────
// Matches explicit cancellation requests including long descriptive ones:
// "cancel the link", "cancel the payment link", "remove the payment link",
// "I want to cancel the payment link for this invoice", "please remove the razorpay link"
const CANCEL_PAYMENT_LINK_REGEX = /\b(cancel|remove|deactivate|disable|revoke|stop|delete|void|withdraw|take\s*down|get\s*rid\s*of)\b.*\b(payment\s*link|pay\s*link|razorpay\s*link|payment\s*url|invoice\s*link|the\s*link)\b|\b(payment\s*link|pay\s*link|razorpay\s*link|payment\s*url|the\s*link)\b.*\b(cancel|remove|deactivate|disable|revoke|stop|delete|void)\b/i

function detectCancelPaymentLinkIntent(prompt: string): boolean {
    return CANCEL_PAYMENT_LINK_REGEX.test(prompt)
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

// ── Recurring Invoice Card (inline) ───────────────────────────────────────────
function RecurringCard({ mode, sessionId, onDone }: { mode: "setup" | "cancel"; sessionId: string; onDone: (msg: string) => void }) {
    const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly">("monthly")
    const [loading, setLoading] = useState(false)

    if (mode === "cancel") {
        return (
            <div className="px-5 pt-5 pb-5 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-base">🔄</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">Cancel Recurring Invoice</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                            This will stop automatic invoice generation. Already sent invoices are not affected.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2.5">
                    <button type="button" onClick={() => onDone("Recurring invoices kept active. No changes made.")}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border/60 bg-background hover:bg-muted/40 transition-colors active:scale-[0.98]">
                        Keep Active
                    </button>
                    <button type="button" disabled={loading} onClick={async () => {
                        setLoading(true)
                        try {
                            const res = await authFetch(`/api/recurring?sessionId=${sessionId}`, { method: "DELETE" })
                            if (res.ok) { onDone("✅ Recurring invoices cancelled. No more automatic invoices will be generated."); toast.success("Recurring cancelled") }
                            else { onDone("Failed to cancel recurring. Please try again.") }
                        } catch { onDone("Something went wrong.") }
                        finally { setLoading(false) }
                    }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
                        {loading ? "Cancelling..." : "Cancel Recurring"}
                    </button>
                </div>
            </div>
        )
    }

    // Setup mode
    return (
        <div className="px-5 pt-5 pb-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-base">🔄</span>
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">Set Up Recurring Invoice</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                        Automatically generate and send this invoice on a schedule.
                    </p>
                </div>
            </div>
            <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Frequency</p>
                <div className="flex gap-2">
                    {(["weekly", "monthly", "quarterly"] as const).map(f => (
                        <button key={f} type="button" onClick={() => setFrequency(f)}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-semibold transition-colors border",
                                frequency === f
                                    ? "bg-foreground text-background border-foreground"
                                    : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                            )}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex gap-2.5">
                <button type="button" onClick={() => onDone("No recurring schedule set up.")}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border/60 bg-background hover:bg-muted/40 transition-colors active:scale-[0.98]">
                    Cancel
                </button>
                <button type="button" disabled={loading} onClick={async () => {
                    setLoading(true)
                    try {
                        const res = await authFetch("/api/recurring", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ sessionId, frequency, autoSend: true }),
                        })
                        if (res.ok) { onDone(`✅ Recurring invoice set up! Next invoice will be generated ${frequency === "weekly" ? "next week" : frequency === "monthly" ? "next month" : "next quarter"}.`); toast.success("Recurring set up") }
                        else { const d = await res.json().catch(() => ({})); onDone(d.error || "Failed to set up recurring. Please try again.") }
                    } catch { onDone("Something went wrong.") }
                    finally { setLoading(false) }
                }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
                    {loading ? "Setting up..." : "Confirm"}
                </button>
            </div>
        </div>
    )
}

interface InvoiceChatProps {
    data: InvoiceData
    onChange: (updates: Partial<InvoiceData>) => void
    selectedSessionId?: string
    /** Called synchronously before InvoiceChat starts mutating to a new session. */
    onSessionTransitionStart?: () => void
    onSessionChange?: (sessionId: string) => void
    onLinkedSessionCreate?: (sessionId: string, docType: string) => void
    onChainSessionSelect?: (sessionId: string) => void
    onMessageCountChange?: (count: number) => void
    onLockDocument?: (sessionId: string) => void
    onUnlockDocument?: (sessionId: string) => void
    onPaymentLinkCancelled?: () => void
    /** Called whenever a session status changes. The session ID prevents stale
     *  reports from a previous session from affecting the selected document. */
    onDocumentStatusChange?: (sessionId: string, status: string) => void
    /** Authoritative session status from the parent. The chat reconciles its own
     *  session copy to this so EXTERNAL changes made outside the chat (toolbar
     *  send/lock, toolbar cancel) reflect live — banner + send/resend gating.
     *  Chat-originated changes are no-ops (the value already matches). */
    documentStatus?: string
    initialPrompt?: string
    /** Called once the session is ready with a function to persist context to DB */
    onSaveContext?: (saveFn: (data: InvoiceData) => Promise<void>) => void
    /** When non-null, the parent is notifying the chat that a fillable onboarding
     *  link was created outside the chat (e.g. via the toolbar Send dialog).
     *  The chat persists it as a { card: "link" } message so "show me the link"
     *  works on refresh and the link is always visible in the conversation.
     *  Use a fresh string each time (or null to skip). */
    injectedOnboardLink?: string | null
}

export function InvoiceChat({ data, onChange, selectedSessionId, onSessionTransitionStart, onSessionChange, onLinkedSessionCreate, onChainSessionSelect, onMessageCountChange, onLockDocument, onUnlockDocument, onPaymentLinkCancelled, onDocumentStatusChange, documentStatus: externalStatus, initialPrompt, onSaveContext, injectedOnboardLink }: InvoiceChatProps) {
    const docType = data.documentType?.toLowerCase() || "invoice"
    const isOnboardingForm = docType.replace(/[\s-]+/g, "_") === "client_onboarding_form"
    const composerPlaceholder = isOnboardingForm
        ? "Describe changes or paste a shared Drive/Dropbox folder link with project details and assets..."
        : "Ask a question or describe a document..."

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
        updateSessionStatus,
    } = useDocumentSession(docType, selectedSessionId)

    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [stagedFile, setStagedFile] = useState<File | null>(null)
    const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "thinking"; content: string; sendCard?: { email: string }; shareCard?: boolean; paymentCard?: boolean; cancelledCard?: boolean; cancelPaymentCard?: { razorpayId: string; amount: string }; unlockCard?: boolean; linkCard?: string; recurringCard?: "setup" | "cancel"; assetLinkCard?: { method: "email" | "general"; email: string }; activities?: ActivityItem[]; isWorking?: boolean; reasoningText?: string; isThinking?: boolean; thinkingStartTime?: number }>>([])
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
    // Linked document context — fields extracted from parent document
    const [linkedDocContext, setLinkedDocContext] = useState<{ parentType: string; fields: Array<{ label: string; value: string }> } | null>(null)

    // Payment methods hook — to check if any gateway is connected
    const { hasAnyGateway } = usePaymentMethods()

    // Reference-context (RAG) — uploaded docs the AI retrieves on-demand
    const {
        documents: contextDocuments,
        usage: contextUsage,
        uploading: contextUploading,
        upload: uploadContext,
        remove: removeContext,
    } = useContextDocuments(session?.id)
    const [contextOpen, setContextOpen] = useState(false)
    const contextTier = useUserTier()
    const contextEnabled = isReferenceContextEnabled(contextTier)

    const scrollRef = useRef<HTMLDivElement>(null)
    const initialPromptSentRef = useRef(false)
    const lastSyncedSessionRef = useRef<string | null>(null)
    const pendingAutoGenerateRef = useRef<string | null>(null)
    // Track activities accumulated during the current streaming response.
    // This ref is the source of truth for saving to DB — the setMessages
    // callback pattern is async and unreliable for synchronous reads.
    const currentActivitiesRef = useRef<ActivityItem[]>([])
    // AbortController for cancelling streaming requests on unmount
    const abortControllerRef = useRef<AbortController | null>(null)
    // Track the currently selected client so the AI always has the reference
    // even on the first message (before currentData is sent)
    const selectedClientRef = useRef<{
        name: string
        email?: string
        address?: string
        phone?: string
        taxId?: string
    } | null>(null)
    // Display name for the selected client (shown as a badge near the input)
    const [selectedClientName, setSelectedClientName] = useState<string | null>(null)
    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true)

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            // Abort any in-flight streaming request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [])

    // Expose updateSessionContext to parent once session is ready
    useEffect(() => {
        if (!session || !onSaveContext) return
        onSaveContext(updateSessionContext)
    }, [session?.id, onSaveContext, updateSessionContext]) // eslint-disable-line react-hooks/exhaustive-deps

    // Notify parent whenever session status changes so DocumentPreview can react.
    // Include the owning session ID so a delayed effect from the old session
    // cannot mark the newly selected document as finalized.
    useEffect(() => {
        if (session?.id && session.status !== undefined) {
            onDocumentStatusChange?.(session.id, session.status)
        }
    }, [session?.id, session?.status]) // eslint-disable-line react-hooks/exhaustive-deps

    // Inject "payment link cancelled" card when parent signals cancellation
    // Uses a timestamp-based approach: parent sets a timestamp, we detect when it changes
    const lastCancelledAtRef = useRef(0)
    useEffect(() => {
        // onPaymentLinkCancelled is truthy only when a cancellation happened
        // We detect the transition from undefined → defined (first time only)
        if (!onPaymentLinkCancelled) {
            lastCancelledAtRef.current = 0
            return
        }
        // Only inject the card once per cancellation event
        if (lastCancelledAtRef.current === 1) return
        lastCancelledAtRef.current = 1
        setMessages(prev => {
            // Don't add if already has a cancelled card as the last message
            const lastMsg = prev[prev.length - 1]
            if (lastMsg?.cancelledCard) return prev
            return [...prev, {
                role: "assistant" as const,
                content: "",
                cancelledCard: true,
            }]
        })
    }, [onPaymentLinkCancelled]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Reconcile external status changes into the chat's session copy ───
    // The chat owns its own copy of the session. When the document's status is
    // changed OUTSIDE the chat (e.g. cancelled or sent/locked from the preview
    // top bar), the parent updates `externalStatus`. Without this, the chat
    // would keep a stale status — showing the wrong banner and mis-gating
    // send/resend.
    //
    // This effect reacts ONLY to changes in `externalStatus` (tracked via a
    // ref), never to `session.status` — so a chat-originated status change can
    // never be reverted here, and there is no feedback loop. A live ref holds
    // the current session status so we can compare without adding it to deps.
    // A DB refetch follows to pull the full row. Applies to every doc type.
    const sessionStatusRef = useRef<string | undefined>(undefined)
    useEffect(() => { sessionStatusRef.current = session?.status }, [session?.status])

    const lastExternalStatusRef = useRef<string | undefined>(undefined)
    useEffect(() => {
        if (externalStatus === lastExternalStatusRef.current) return
        lastExternalStatusRef.current = externalStatus
        if (!externalStatus) return                          // empty reset on session switch — ignore
        if (sessionStatusRef.current === externalStatus) return // already in sync (chat-originated)
        // Apply the parent's authoritative status directly (no DB refetch): it
        // is the same value driving the preview's lock UI, so chat + preview
        // stay consistent, and the AI reads the real DB status server-side on
        // each message regardless. Avoids a flicker/revert for locks that don't
        // change the DB status row (e.g. payment-link locks).
        updateSessionStatus(externalStatus)
    }, [externalStatus]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Inject onboard link from parent (manual Send dialog) ─────────────
    // When the owner sends an onboarding form via the toolbar's Send dialog (not
    // via chat), the parent passes the fresh fillable link here. We persist it as
    // a { card: "link" } message so it's visible in the conversation and survives
    // a refresh — identical outcome to a chat-originated send.
    const lastInjectedLinkRef = useRef<string | null>(null)
    useEffect(() => {
        if (!injectedOnboardLink) return
        if (injectedOnboardLink === lastInjectedLinkRef.current) return
        lastInjectedLinkRef.current = injectedOnboardLink
        setMessages(prev => [...prev, { role: "assistant" as const, content: "", linkCard: injectedOnboardLink }])
        saveMessage("assistant", "View form link", { card: "link" }).catch(() => {})
    }, [injectedOnboardLink]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Eager cleanup when selectedSessionId changes ─────────────────────
    // Clear all chat state SYNCHRONOUSLY when the user navigates to a different
    // session, so stale UI (e.g. the unlock card from a finalized parent) cannot
    // leak into a newly opened linked session before the new session loads.
    useEffect(() => {
        // Nothing to do on first mount when there's no prior session yet
        if (lastSyncedSessionRef.current === null) return
        // If the prop session id matches the last synced one, no transition
        if (lastSyncedSessionRef.current === selectedSessionId) return
        // Wipe everything that's tied to the previous session immediately
        setMessages([])
        setStreamingContent(null)
        setDocumentGenerated(false)
        setFileContext(null)
        setMessageLimitReached(false)
        setDocumentLimitReached(false)
        setLimitInfo(null)
        setLinkedDocContext(null)
        setWelcomeLoaded(false)
        // Drop the auto-gen queue from the previous session — the new session
        // will set its own pendingAutoGenerateRef inside the sync effect below.
        pendingAutoGenerateRef.current = null
    }, [selectedSessionId])

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
            // Restore activities and special cards from metadata if available
            const restoredMessages: typeof messages = []
            for (const msg of savedMessages) {
                const meta = msg.metadata as Record<string, unknown> | undefined

                // ── Sanitize content on restore ───────────────────────────────────
                // Messages stored BEFORE the JSON-tail-stripper fix may contain
                // raw `{"document":{...}}` content. Strip any trailing JSON block
                // so old sessions don't show raw JSON after refresh.
                const sanitizeRestoredContent = (raw: string): string => {
                    if (!raw || typeof raw !== "string") return raw
                    // If the entire content looks like JSON, replace with a fallback
                    if (raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[")) {
                        return "✅ Document updated. Check the preview."
                    }
                    // Strip any trailing JSON block (prose followed by a JSON object)
                    const jsonTailMatch = raw.match(/^([\s\S]*?)(\n\n?\{[\s\S]*$)/)
                    if (jsonTailMatch?.[1] && jsonTailMatch[1].trim().length > 0) {
                        return jsonTailMatch[1].trim()
                    }
                    return raw
                }
                // ── End sanitizer ─────────────────────────────────────────────────

                if (msg.role === "assistant") {
                    // Inject thinking block if activities saved
                    if (meta?.activities && Array.isArray(meta.activities) && meta.activities.length > 0) {
                        restoredMessages.push({
                            role: "thinking" as const,
                            content: "",
                            activities: meta.activities as ActivityItem[],
                            isWorking: false,
                        })
                    }
                    // Restore special cards from metadata
                    if (meta?.card === "share") {
                        const cleanContent = sanitizeRestoredContent(msg.content)
                        if (cleanContent) restoredMessages.push({ role: "assistant" as const, content: cleanContent })
                        restoredMessages.push({ role: "assistant" as const, content: "", shareCard: true })
                        continue
                    }
                    if (meta?.card === "send") {
                        const cardEmail = (meta?.email as string) || ""
                        const cleanContent = sanitizeRestoredContent(msg.content)
                        // Onboarding forms: once sent (finalized), the compose card is
                        // stale — the send already happened and a { card: "link" }
                        // message carries the durable link. Don't re-show it.
                        if (docType === "client_onboarding_form" &&
                            (session.status === "finalized" || session.status === "signed")) {
                            continue
                        }
                        if (cleanContent) restoredMessages.push({ role: "assistant" as const, content: cleanContent })
                        restoredMessages.push({ role: "assistant" as const, content: "", sendCard: { email: cardEmail } })
                        continue
                    }
                    if (meta?.card === "unlock") {
                        // Only restore unlock card if session is still locked/finalized
                        // If it was already acted on (document is now active), show as text
                        const sessionStatus = session.status
                        if (sessionStatus === "finalized" || sessionStatus === "signed") {
                            restoredMessages.push({ role: "assistant" as const, content: "", unlockCard: true })
                        } else {
                            // Session was unlocked — show neutral resolved text instead of stale card
                            restoredMessages.push({ role: "assistant" as const, content: "Document unlocked. You can now edit and resend." })
                        }
                        continue
                    }
                    if (meta?.card === "link") {
                        // Onboarding forms use a real fillable /onboard/<token> link
                        // that isn't stored client-side — resolved asynchronously
                        // below (this effect isn't async) via a loading sentinel.
                        if (docType === "client_onboarding_form") {
                            restoredMessages.push({ role: "assistant" as const, content: "", linkCard: "__resolving_onboard_link__" })
                        } else {
                            restoredMessages.push({ role: "assistant" as const, content: "", linkCard: "__resolving_public_link__" })
                        }
                        continue
                    }
                    if (meta?.card === "recurring_setup") {
                        restoredMessages.push({ role: "assistant" as const, content: "", recurringCard: "setup" as const })
                        continue
                    }
                    if (meta?.card === "recurring_cancel") {
                        restoredMessages.push({ role: "assistant" as const, content: "", recurringCard: "cancel" as const })
                        continue
                    }
                    if (meta?.card === "asset_link") {
                        const cleanContent = sanitizeRestoredContent(msg.content)
                        // Only restore the actionable card if the document hasn't been
                        // sent yet — otherwise the flow has already moved on.
                        const sessionStatus = session.status
                        const stillActionable = sessionStatus === "active" || sessionStatus === "draft"
                        if (cleanContent) restoredMessages.push({ role: "assistant" as const, content: cleanContent })
                        if (stillActionable) {
                            const method = ((meta?.method as string) === "email" ? "email" : "general") as "email" | "general"
                            const cardEmail = (meta?.email as string) || ""
                            restoredMessages.push({ role: "assistant" as const, content: "", assetLinkCard: { method, email: cardEmail } })
                        }
                        continue
                    }
                }
                // For regular messages (user or assistant without card), sanitize content
                const cleanContent = msg.role === "assistant"
                    ? sanitizeRestoredContent(msg.content)
                    : msg.content
                // Skip empty assistant messages that have no card — they're orphaned blobs
                if (!cleanContent && msg.role === "assistant") continue
                restoredMessages.push({
                    role: msg.role as "user" | "assistant",
                    content: cleanContent,
                })
            }
            setMessages(restoredMessages)
            setWelcomeLoaded(true)

            // Resolve (or securely create) the real onboarding fill link for any
            // restored link card. Token creation remains owner-authenticated.
            if (docType === "client_onboarding_form" && restoredMessages.some(m => m.linkCard === "__resolving_onboard_link__")) {
                ensureOnboardingFillLink(session.id)
                    .then(onboardUrl => {
                        setMessages(prev => prev.map(m => m.linkCard === "__resolving_onboard_link__"
                            ? { ...m, linkCard: onboardUrl, content: "" }
                            : m))
                    })
                    .catch((error) => {
                        setMessages(prev => prev.map(m => m.linkCard === "__resolving_onboard_link__"
                            ? { ...m, linkCard: undefined, content: error instanceof Error ? error.message : "Couldn't create the form link." }
                            : m))
                    })
            }

            if (restoredMessages.some(m => m.linkCard === "__resolving_public_link__")) {
                fetchPublicDocumentLink(session.id)
                    .then(publicUrl => {
                        setMessages(prev => prev.map(m => m.linkCard === "__resolving_public_link__"
                            ? { ...m, linkCard: publicUrl || undefined, content: publicUrl ? "" : "Couldn't create a public document link." }
                            : m))
                    })
                    .catch(() => {
                        setMessages(prev => prev.map(m => m.linkCard === "__resolving_public_link__"
                            ? { ...m, linkCard: undefined, content: "Couldn't look up the document link." }
                            : m))
                    })
            }

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

                // Build linked doc context banner — show what was extracted from parent
                const parentType = ((ctx as any)._parentDocumentType || "document") as string
                const extractedFields: Array<{ label: string; value: string }> = []
                if ((ctx as any).toName) extractedFields.push({ label: "Client", value: (ctx as any).toName })
                if ((ctx as any).toEmail) extractedFields.push({ label: "Email", value: (ctx as any).toEmail })
                if ((ctx as any).toAddress) extractedFields.push({ label: "Address", value: (ctx as any).toAddress })
                if ((ctx as any).toPhone) extractedFields.push({ label: "Phone", value: (ctx as any).toPhone })
                if ((ctx as any).currency) extractedFields.push({ label: "Currency", value: (ctx as any).currency })
                if (extractedFields.length > 0) {
                    setLinkedDocContext({ parentType, fields: extractedFields })
                }

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
        const docTypeLabel = docType === "invoice" ? "Invoice"
            : docType === "contract" ? "Contract"
            : docType === "quote" || docType === "quotation" ? "Quote"
            : docType === "proposal" ? "Proposal"
            : docType === "sow" ? "Statement of Work"
            : docType === "change_order" ? "Change Order"
            : docType === "nda" ? "NDA"
            : docType === "client_onboarding_form" ? "Client Onboarding Form"
            : docType === "payment_followup" ? "Payment Follow-up"
            : "document"

        const tips: Record<string, string[]> = {
            invoice: [
                '• "Create an invoice for ₹5,000 for web design to Acme Corp"',
                '• "Add a 5% late fee clause"',
                '• "Send it to client@example.com"',
                '• "Make this recurring every month"',
            ],
            contract: [
                '• "Create a 6-month service contract for TechCorp"',
                '• "Add a confidentiality clause"',
                '• "Request signature from client@company.com"',
                '• "Create an invoice from this contract"',
            ],
            quote: [
                '• "Create a quote for website redesign for Startup X"',
                '• "Make it valid for 15 days"',
                '• "Send it to client@startup.com"',
            ],
            proposal: [
                '• "Write a proposal for a mobile app project for RetailCo"',
                '• "Add a timeline and milestone breakdown"',
                '• "Send it to decision-maker@retailco.com"',
            ],
            sow: [
                '• "Create an SOW for a 3-month website project"',
                '• "Add 4 milestones and define deliverables"',
                '• "Link this to the contract we already have"',
            ],
            change_order: [
                '• "Add a change order for the extra UI screens"',
                '• "Describe what\'s being changed and the new cost"',
                '• "Send it to the client for approval"',
            ],
            nda: [
                '• "Create a mutual NDA with GlobalCorp"',
                '• "Make it valid for 2 years under Indian law"',
                '• "Send it for signing to legal@globalcorp.com"',
            ],
            client_onboarding_form: [
                '• "Create an onboarding form for a new design client"',
                '• "Add questions about brand guidelines and target audience"',
                '• "Send it to client@newproject.com"',
            ],
            payment_followup: [
                '• "Send a polite payment reminder for Invoice INV-2026-01-001"',
                '• "Make it more urgent — it\'s 30 days overdue"',
                '• "Send the follow-up to accounts@latepayer.com"',
            ],
        }

        const docTips = tips[docType] || tips.invoice
        const msg = `Hi! I'm Clorefy AI — your business document assistant.\n\nI'm here to help you with your **${docTypeLabel}**. Here's what you can say:\n\n${docTips.join("\n")}\n\nI understand context — if you've already filled in client details, just say "send it" and I'll take care of the rest.`
        setMessages([{ role: "assistant", content: msg }])
        setWelcomeLoaded(true)
    }, [docType])

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

    // Auto-scroll on new messages AND when thinking activities grow
    // Compute total activity count across all active thinking blocks
    const totalActivityCount = messages.reduce((sum, m) => {
        if (m.role === "thinking" && m.activities) return sum + m.activities.length
        return sum
    }, 0)

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages, totalActivityCount])

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

    // Ref-based guard to prevent double invocations of sendMessage.
    // React state (isLoading) updates asynchronously, so two rapid calls
    // (e.g., Enter key + button click, or effect re-fires) can both pass
    // the isLoading check before the first call sets it to true.
    const sendingRef = useRef(false)

    // Core send function — ALWAYS uses DeepSeek (via /api/ai/stream)
    // This is called for ALL text-only messages AND as step 2 after file extraction
    // GPT is NEVER used here — only DeepSeek for document generation/chat
    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !session) return
        // Ref-based double-send guard: prevents two calls in the same tick
        if (sendingRef.current) return
        sendingRef.current = true

        try {

        const userMessage = messageText.trim()

        // ── Pre-flight document type switch guard ──────────────────────────────
        // When the user asks to "create a contract" inside an invoice session, block it
        // and guide them to start a new session. Uses registry-driven type list so
        // adding a new doc type doesn't require touching this guard.
        const DOC_TYPE_KEYWORDS: Record<string, string[]> = {
            invoice:               ["invoice", "invoices"],
            contract:              ["contract", "contracts", "agreement", "agreements"],
            quote:                 ["quotation", "quotations", "quote", "quotes", "estimate", "estimates"],
            proposal:              ["proposal", "proposals", "pitch", "pitches"],
            sow:                   ["statement of work", "sow", "scope of work"],
            change_order:          ["change order", "change orders", "amendment", "amendments"],
            nda:                   ["nda", "non-disclosure", "nondisclosure", "confidentiality agreement"],
            client_onboarding_form:["onboarding form", "client form", "intake form", "client intake"],
            payment_followup:      ["payment follow-up", "payment followup", "payment reminder", "follow-up letter"],
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
                        (targetType === "quote" || targetType === "proposal")

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

        // ── Cancel payment link intent guard ──────────────────────────────────
        if (detectCancelPaymentLinkIntent(userMessage) && data.paymentLink && data.paymentLinkStatus === "created") {
            setInputValue("")
            setMessages(prev => [...prev, { role: "user" as const, content: userMessage }])
            // Fetch the Razorpay ID from the API
            try {
                const res = await authFetch(`/api/payments/create-link?sessionId=${session.id}`)
                if (res.ok) {
                    const linkData = await res.json()
                    if (linkData.paymentLink?.razorpay_payment_link_id) {
                        const formattedAmount = `${data.currency} ${(data.items.reduce((s, i) => s + i.quantity * i.rate * (1 - (i.discount || 0) / 100), 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        setMessages(prev => [...prev,
                            { role: "assistant" as const, content: "", cancelPaymentCard: { razorpayId: linkData.paymentLink.razorpay_payment_link_id, amount: formattedAmount } },
                        ])
                        await saveMessage("user", userMessage)
                        return
                    }
                }
                // Fallback: no link found
                setMessages(prev => [...prev, { role: "assistant" as const, content: "I couldn't find an active payment link to cancel." }])
                await saveMessage("user", userMessage)
                await saveMessage("assistant", "I couldn't find an active payment link to cancel.")
            } catch {
                setMessages(prev => [...prev, { role: "assistant" as const, content: "Something went wrong while checking the payment link. Please try again." }])
                await saveMessage("user", userMessage)
            }
            return
        }
        if (detectCancelPaymentLinkIntent(userMessage) && (!data.paymentLink || data.paymentLinkStatus !== "created")) {
            setInputValue("")
            const noLinkMsg = !data.paymentLink
                ? "There's no active payment link to cancel on this document."
                : `The payment link is already ${data.paymentLinkStatus}. No action needed.`
            setMessages(prev => [...prev,
                { role: "user" as const, content: userMessage },
                { role: "assistant" as const, content: noLinkMsg },
            ])
            await saveMessage("user", userMessage)
            await saveMessage("assistant", noLinkMsg)
            return
        }
        // ── End cancel payment link intent guard ──────────────────────────────

        // ── Cancel send / unlock intent guard (pre-API) ───────────────────────
        // Catch "cancel the send", "undo send", "unlock", "make it editable" etc.
        // directly before the API call so the unlock card shows immediately.
        if (documentGenerated && session && (session.status === "finalized" || session.status === "signed" || session.status === "paid")) {
            const CANCEL_SEND_REGEX = /\b(cancel|undo|revert|revoke|unsend)\s*(the\s*)?(send|sent|delivery|email|sharing|link|payment\s*link)|unlock\s*(the\s*)?(document|invoice|contract|quotation|proposal|this)|make\s*(it\s*)?(editable|edit\s*again)|edit\s*again|can\s*(i|we)\s*edit|\bi\s*(want|need|would\s*like)\s*to\s*(edit|make\s*changes|change|update)\b/i
            if (CANCEL_SEND_REGEX.test(userMessage)) {
                setInputValue("")

                // Determine the permanent lock reason (in priority order)
                const isSignedPermanent = session.status === "signed"
                const isPaidPermanent = session.status === "paid"
                    || data.paymentLinkStatus === "paid"
                    || (data as any).manualPaid === true

                if (isSignedPermanent) {
                    const signedMsg = "This document has been signed by all parties and is permanently locked. Signed documents are legally binding and cannot be edited or cancelled."
                    setMessages(prev => [...prev,
                        { role: "user" as const, content: userMessage },
                        { role: "assistant" as const, content: signedMsg },
                    ])
                    await saveMessage("user", userMessage)
                    await saveMessage("assistant", signedMsg)
                    return
                }

                if (isPaidPermanent) {
                    const paidMsg = "This invoice has been paid and is permanently locked. Paid invoices are financial records and cannot be edited or cancelled."
                    setMessages(prev => [...prev,
                        { role: "user" as const, content: userMessage },
                        { role: "assistant" as const, content: paidMsg },
                    ])
                    await saveMessage("user", userMessage)
                    await saveMessage("assistant", paidMsg)
                    return
                }

                // Document is finalized/sent but not signed or paid — unlockable
                setMessages(prev => [...prev,
                    { role: "user" as const, content: userMessage },
                    { role: "assistant" as const, content: "", unlockCard: true },
                ])
                await saveMessage("user", userMessage)
                await saveMessage("assistant", "Unlock document", { card: "unlock" })
                return
            }
        }
        // ── End cancel send intent guard ──────────────────────────────────────

        // ── Pre-API send/share intent guard ───────────────────────────────────
        // If a document is already generated and the user ONLY wants to send/share
        // (no document modification mixed in), handle it immediately without an API call.
        // For mixed messages like "change the rate to 500 and send it", let the AI
        // process the modification first — the post-response handler will show the card.
        if (documentGenerated && session) {
            const MODIFICATION_VERBS = /\b(change|update|modify|add|remove|edit|fix|replace|set|make|increase|decrease|adjust|correct|revise|redo|undo)\b/i
            const hasModification = MODIFICATION_VERBS.test(userMessage)

            if (!hasModification) {
                // ── Onboarding link request (deterministic, no AI needed) ──────
                // Any direct link request creates or reuses the owner's secure
                // /onboard/<token> capability; email delivery is optional.
                if (docType === "client_onboarding_form") {
                    const wantsLink = /\blink\b|\burl\b/i.test(userMessage)
                    if (wantsLink) {
                        setInputValue("")
                        try {
                            const onboardUrl = await ensureOnboardingFillLink(session.id)
                            const msg = "Here's your client's fillable onboarding form link — share it any time:"
                            setMessages(prev => [...prev,
                                { role: "user" as const, content: userMessage },
                                { role: "assistant" as const, content: msg },
                                { role: "assistant" as const, content: "", linkCard: onboardUrl },
                            ])
                            await saveMessage("user", userMessage)
                            await saveMessage("assistant", msg)
                            await saveMessage("assistant", "View form link", { card: "link" })
                        } catch (error) {
                            const msg = error instanceof Error ? error.message : "Couldn't create the form link just now. Please try again."
                            setMessages(prev => [...prev,
                                { role: "user" as const, content: userMessage },
                                { role: "assistant" as const, content: msg },
                            ])
                            await saveMessage("user", userMessage)
                            await saveMessage("assistant", msg)
                        }
                        return
                    }
                }

                // ── Dynamic delivery-intent classification ─────────────────────
                // Understand what the user actually wants (send / link / whatsapp /
                // email) by MEANING via the model, instead of brittle keyword
                // triggers. Only runs when the message hints at delivery, so pure
                // edits and questions skip it and flow straight to the model. Falls
                // back to keyword heuristics if the classifier is unavailable.
                const deliveryAction: DeliveryAction = hasDeliveryHint(userMessage)
                    ? await classifyDeliveryAction(userMessage, { documentType: docType, status: session.status || "" })
                    : "none"

                if (deliveryAction !== "none") {
                    setInputValue("")
                    const knownEmail = data.toEmail || ""
                    const isSent = session.status === "finalized" || session.status === "signed"

                    // Onboarding forms are delivered ONLY as a fillable /onboard/<token>
                    // link, via the asset-link → Send flow.
                    if (docType === "client_onboarding_form") {
                        const isLockedStatus = ["finalized", "signed", "paid"].includes(session.status || "")
                        if (isLockedStatus) {
                            const lockedMsg = "This onboarding form has already been sent, so it's locked. To send it again, cancel it from the preview panel first — that invalidates the old link — then ask me to resend."
                            setMessages(prev => [...prev,
                                { role: "user" as const, content: userMessage },
                                { role: "assistant" as const, content: lockedMsg },
                            ])
                            await saveMessage("user", userMessage)
                            await saveMessage("assistant", lockedMsg)
                            return
                        }
                        const method: "email" | "general" = deliveryAction === "email" ? "email" : "general"
                        const introMsg = "Before you send — add a link where your client can upload their assets (logo, brand files). This is optional; you can skip it."
                        setMessages(prev => [...prev,
                            { role: "user" as const, content: userMessage },
                            { role: "assistant" as const, content: introMsg },
                            { role: "assistant" as const, content: "", assetLinkCard: { method, email: knownEmail } },
                        ])
                        await saveMessage("user", userMessage)
                        await saveMessage("assistant", introMsg, { card: "asset_link", method, email: knownEmail })
                        return
                    }

                    // Email delivery → compose/send card (email editable).
                    if (deliveryAction === "email") {
                        const minimalMsg = isSent
                            ? `Sure! Fill in the details below to resend your ${docType}.`
                            : `Sure! Fill in the details below to send your ${docType}.`
                        setMessages(prev => [...prev,
                            { role: "user" as const, content: userMessage },
                            { role: "assistant" as const, content: minimalMsg },
                            { role: "assistant" as const, content: "", sendCard: { email: knownEmail } },
                        ])
                        await saveMessage("user", userMessage)
                        await saveMessage("assistant", minimalMsg, { card: "send", email: knownEmail })
                        return
                    }

                    // Shareable link → create/return it and show it directly, so
                    // "create a link to send" actually produces the link.
                    if (deliveryAction === "link") {
                        const publicUrl = await fetchPublicDocumentLink(session.id)
                        if (publicUrl) {
                            const linkMsg = `Here's the shareable link for your ${docType}:`
                            setMessages(prev => [...prev,
                                { role: "user" as const, content: userMessage },
                                { role: "assistant" as const, content: linkMsg },
                                { role: "assistant" as const, content: "", linkCard: publicUrl },
                            ])
                            await saveMessage("user", userMessage)
                            await saveMessage("assistant", linkMsg)
                            await saveMessage("assistant", "View document link", { card: "link" })
                            return
                        }
                        // Couldn't mint a link — fall through to the multi-option card.
                    }

                    // WhatsApp or unspecified send → multi-option share card.
                    const shareMsg = deliveryAction === "whatsapp"
                        ? `Sure! Let me help you share your ${docType} on WhatsApp.`
                        : `How would you like to send your ${docType}?`
                    setMessages(prev => [...prev,
                        { role: "user" as const, content: userMessage },
                        { role: "assistant" as const, content: shareMsg },
                        { role: "assistant" as const, content: "", shareCard: true },
                    ])
                    await saveMessage("user", userMessage)
                    await saveMessage("assistant", shareMsg, { card: "share" })
                    return
                }
            }
        }
        // ── End pre-API send/share intent guard ───────────────────────────────

        // Display only the user's text, not the enriched file context
        const displayText = userMessage.includes("[CLIENT DETAILS FROM ATTACHED FILE")
            ? userMessage.split("\n\n[CLIENT DETAILS")[0].trim() || "📎 Generate from attached file"
            : userMessage
        setInputValue("")
        setMessages(prev => [...prev, { role: "user" as const, content: displayText }, { role: "thinking" as const, content: "", activities: [], isWorking: true, thinkingStartTime: Date.now() }])
        // Reset activities ref for this new streaming response
        currentActivitiesRef.current = []
        // NOTE: User message is NOT saved to DB here — it's saved only after a successful
        // AI response. This prevents error responses from counting against the message limit.
        setIsLoading(true)

        // Create AbortController for this request
        abortControllerRef.current = new AbortController()
        const signal = abortControllerRef.current.signal

        try {
            const response = await authFetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: userMessage,
                    documentType: docType,
                    sessionId: session.id,
                    thinkingMode,
                    // Send currentData if this is a follow-up, a linked session, OR a client was pre-selected
                    currentData: (messages.length > 1 || session.chain_id || selectedClientRef.current) ? data : undefined,
                    conversationHistory: messages.length > 1 ? messages.slice(-20) : [],
                    ...(fileContext ? { fileContext } : {}),
                    // Pass pre-selected client context so AI preserves those fields
                    ...(selectedClientRef.current ? { clientContext: selectedClientRef.current } : {}),
                    // Pass parent context for linked sessions so AI knows the client details
                    // from the original document (email, address, etc.)
                    // Always pass for linked sessions — even if current doc already has the data,
                    // the user might ask "what was the email from the previous document"
                    ...(session.chain_id && session.context && typeof session.context === "object" && !Array.isArray(session.context) && Object.keys(session.context).length > 0
                        ? (() => {
                            const ctx = session.context as Record<string, any>
                            // Extract client-facing fields — never send signatures, logos, or internal markers
                            const safeParentData: Record<string, any> = {}
                            const clientFields = ["toName", "toEmail", "toAddress", "toPhone", "currency", "paymentTerms", "items", "taxRate", "taxLabel", "total", "subtotal"]
                            for (const field of clientFields) {
                                if (ctx[field] != null && ctx[field] !== "") safeParentData[field] = ctx[field]
                            }
                            // Bounded, factual summary of the parent document (project,
                            // scope, key terms). Built deterministically at link time so
                            // the AI is grounded and does not hallucinate scope/details.
                            const chainContext = ctx._chainContext && typeof ctx._chainContext === "object" && !Array.isArray(ctx._chainContext)
                                ? ctx._chainContext as Record<string, any>
                                : undefined
                            // Inject for linked sessions when we have EITHER verified client
                            // identity OR a factual chain summary to ground generation.
                            if (!safeParentData.toName && !safeParentData.toEmail && !chainContext) return {}
                            return {
                                parentContext: {
                                    // Use the stored parent document type, not the current session's type
                                    documentType: ctx._parentDocumentType || "document",
                                    data: safeParentData,
                                    ...(chainContext ? { chainContext } : {}),
                                }
                            }
                        })()
                        : {}),
                }),
                signal, // Pass abort signal to fetch
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
                        // Remove the thinking block and add the limit message
                        setMessages(prev => {
                            const withoutThinking = prev.filter(m => !(m.role === "thinking" && m.isWorking))
                            return [...withoutThinking, {
                                role: "assistant" as const,
                                content: `You've reached the message limit (${errorData.currentMessages}/${errorData.limit}) for this session. Create a new document to continue.`
                            }]
                        })
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
                        setMessages(prev => {
                            const withoutThinking = prev.filter(m => !(m.role === "thinking" && m.isWorking))
                            return [...withoutThinking, {
                                role: "assistant" as const,
                                content: `You've reached your monthly document limit (${errorData.currentUsage}/${errorData.limit}). Upgrade your plan to create more documents.`
                            }]
                        })
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
                        setMessages(prev => {
                            const withoutThinking = prev.filter(m => !(m.role === "thinking" && m.isWorking))
                            return [...withoutThinking, {
                                role: "assistant" as const,
                                content: errorData.message || "This feature is not available on your current plan. Please upgrade to continue."
                            }]
                        })
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
                // Check if request was aborted (component unmounted)
                if (signal.aborted || !isMountedRef.current) {
                    reader.cancel()
                    return
                }
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
                            // Append/update activity in the thinking message AND the ref
                            const newActivity: ActivityItem = {
                                id: nextActivityId(),
                                action: parsed.action,
                                label: parsed.label,
                                detail: parsed.detail,
                                reasoningText: parsed.content,
                            }
                            // Update ref (synchronous, always available for saving)
                            const existingRef = currentActivitiesRef.current.find(
                                a => a.action === parsed.action && a.label === parsed.label && !a.detail
                            )
                            if (existingRef && parsed.detail) {
                                existingRef.detail = parsed.detail
                                if (parsed.content) existingRef.reasoningText = parsed.content
                            } else if (!existingRef) {
                                currentActivitiesRef.current.push(newActivity)
                            }
                            // Update UI state
                            setMessages(prev => {
                                const updated = prev.map(m => {
                                    if (m.role !== "thinking" || !m.isWorking || !m.activities) return m
                                    // Check if this is an update to an existing activity (same action + label, no detail yet)
                                    const existingIdx = m.activities.findIndex(
                                        a => a.action === parsed.action && a.label === parsed.label && !a.detail
                                    )
                                    if (existingIdx !== -1 && parsed.detail) {
                                        // Update existing activity immutably
                                        const updatedActivities = m.activities.map((a, i) =>
                                            i === existingIdx
                                                ? { ...a, detail: parsed.detail, ...(parsed.content ? { reasoningText: parsed.content } : {}) }
                                                : a
                                        )
                                        return { ...m, activities: updatedActivities }
                                    } else if (existingIdx === -1) {
                                        // Only add if not already present (guard against double-render in React 18 strict mode)
                                        const alreadyAdded = m.activities.some(a => a.id === newActivity.id)
                                        if (alreadyAdded) return m
                                        return { ...m, activities: [...m.activities, { ...newActivity }] }
                                    }
                                    return m
                                })
                                return updated
                            })
                        } else if (parsed.type === "reasoning") {
                            // Accumulate real reasoning tokens from DeepSeek into a "think" activity
                            setMessages(prev => prev.map(m => {
                                if (m.role !== "thinking" || !m.isWorking || !m.activities) return m
                                const thinkIdx = [...m.activities].reverse().findIndex(a => a.action === "think")
                                const realIdx = thinkIdx === -1 ? -1 : m.activities.length - 1 - thinkIdx
                                if (realIdx === -1) {
                                    // Create new think activity
                                    return { ...m, activities: [...m.activities, { id: `think-${Date.now()}`, action: "think" as const, label: "Clorefy is reasoning", reasoningText: parsed.data }] }
                                }
                                // Update existing think activity immutably
                                const updatedActivities = m.activities.map((a, i) =>
                                    i === realIdx ? { ...a, reasoningText: (a.reasoningText || "") + parsed.data } : a
                                )
                                return { ...m, activities: updatedActivities }
                            }))
                        } else if (parsed.type === "chunk") {
                            fullContent += parsed.data

                            // Detect if this is JSON (document generation) vs text (chat)
                            // Only detect as JSON if it actually starts with JSON syntax
                            if (!isStreamingText && !isDocumentJSON && fullContent.length > 50) {
                                const trimmed = fullContent.trimStart()
                                isDocumentJSON = trimmed.startsWith("{") || trimmed.startsWith("[")
                                    || trimmed.startsWith("```json")
                            }

                            // For chat text: close thinking on first chunk (existing behavior)
                            if (!isDocumentJSON && !thinkingDone) {
                                thinkingDone = true
                                setMessages(prev => prev.map(m =>
                                    m.role === "thinking" && m.isWorking ? { ...m, isWorking: false } : m
                                ))
                            }

                            // For document JSON: detect progress and keep thinking open
                            if (isDocumentJSON) {
                                const trimmed = fullContent.trimStart()
                                const progressSteps = detectDocumentProgress(trimmed, lastDetectedStep)
                                if (progressSteps.length > 0) {
                                    lastDetectedStep = progressSteps[progressSteps.length - 1].id.replace("progress-", "")
                                    setMessages(prev => prev.map(m => {
                                        if (m.role !== "thinking" || !m.isWorking || !m.activities) return m
                                        let activities = [...m.activities]
                                        for (const step of progressSteps) {
                                            const existingIdx = activities.findIndex(a => a.id === step.id)
                                            if (existingIdx === -1) {
                                                activities = [...activities, step]
                                            } else if (step.detail && activities[existingIdx].detail !== step.detail) {
                                                activities = activities.map((a, i) => i === existingIdx ? { ...a, detail: step.detail } : a)
                                            }
                                        }
                                        return { ...m, activities }
                                    }))
                                }
                                // Also update item count on subsequent chunks (items grow over time)
                                if (lastDetectedStep === "items" || trimmed.includes('"items"')) {
                                    const itemMatches = trimmed.match(/"description"\s*:\s*"/g)
                                    if (itemMatches && itemMatches.length > 0) {
                                        const newDetail = `${itemMatches.length} item${itemMatches.length > 1 ? "s" : ""}`
                                        setMessages(prev => prev.map(m => {
                                            if (m.role !== "thinking" || !m.isWorking || !m.activities) return m
                                            const itemIdx = m.activities.findIndex(a => a.id === "progress-items")
                                            if (itemIdx === -1 || m.activities[itemIdx].detail === newDetail) return m
                                            return { ...m, activities: m.activities.map((a, i) => i === itemIdx ? { ...a, detail: newDetail } : a) }
                                        }))
                                    }
                                }
                            }

                            // Only stream live if we're confident this is NOT a JSON response.
                            if (!isStreamingText && fullContent.length > 200) {
                                const trimmed = fullContent.trimStart()
                                const looksLikeJSON = trimmed.startsWith("{") || trimmed.startsWith("[") 
                                    || trimmed.startsWith("```json")
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
                            setMessages(prev => prev.map(m =>
                                m.role === "thinking" && m.isWorking ? { ...m, isWorking: false } : m
                            ))
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

            // ── Strip stray ACTION markers BEFORE JSON detection ──────────────
            // The AI sometimes emits action markers like [ACTION:UNLOCK_DOCUMENT]
            // followed by a chat message AND a full document JSON. We need to
            // strip these markers FIRST so the JSON parsing below still works.
            //
            // For unlock specifically: if the AI hallucinated the marker on a
            // fresh/active session, strip it so the JSON below still parses.
            // For genuinely locked documents, the post-parse handler will
            // detect it and show the unlock card.
            const isActuallyLocked = session && (session.status === "finalized" || session.status === "signed")
            if (cleaned.startsWith("[ACTION:UNLOCK_DOCUMENT]") && !isActuallyLocked) {
                cleaned = cleaned.replace("[ACTION:UNLOCK_DOCUMENT]", "").trim()
            }

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
            // Be aggressive — find the first { that opens a balanced JSON object/array
            // anywhere in the string, not just after a newline. This handles cases
            // where the AI prepends prose with no separating newline, or uses \r\n.
            if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
                // Try newline-prefixed first (most common)
                let jsonStart = cleaned.indexOf("\n{")
                if (jsonStart === -1) jsonStart = cleaned.indexOf("\r\n{")
                // Fallback: any { in the string
                if (jsonStart === -1) jsonStart = cleaned.indexOf("{")
                if (jsonStart !== -1) {
                    // Slice from the { onwards. For \n{ and \r\n{, jsonStart points
                    // at the newline so we add 1 (for \n) or 2 (for \r\n).
                    const ch = cleaned[jsonStart]
                    const offset = ch === "{" ? 0 : (ch === "\r" ? 2 : 1)
                    cleaned = cleaned.slice(jsonStart + offset).trim()
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
                    // Try to salvage — sometimes there's trailing garbage after the JSON.
                    // Walk backwards from the end finding the last '}' that yields valid JSON.
                    let lastBrace = cleaned.lastIndexOf("}")
                    while (lastBrace > 0 && !result) {
                        try {
                            result = JSON.parse(cleaned.slice(0, lastBrace + 1))
                        } catch {
                            // Try the next earlier '}'
                            lastBrace = cleaned.lastIndexOf("}", lastBrace - 1)
                        }
                    }
                    // Last-ditch salvage: if the response was TRUNCATED (e.g. hit
                    // max_tokens mid-output), close the unbalanced braces manually.
                    // Walk forward through the string tracking brace/bracket depth
                    // (ignoring chars inside strings) and append closers until balanced.
                    if (!result) {
                        const closed = balanceTruncatedJson(cleaned)
                        if (closed) {
                            try { result = JSON.parse(closed) } catch { /* unsalvageable */ }
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
                            : t === "quotation" || t === "quote" ? "Quote"
                            : t === "proposal" ? "Proposal"
                            : t === "sow" ? "Sow"
                            : t === "change_order" ? "Change_order"
                            : t === "nda" ? "Nda"
                            : t === "client_onboarding_form" ? "Client_onboarding_form"
                            : t === "payment_followup" ? "Payment_followup"
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

                    // Strip markdown + known artifacts from all text fields.
                    // The PDF renderer prints text literally, so any stray
                    // placeholder brackets, prompt annotations, or orphan
                    // punctuation sequences would be visible to the client.
                    const sanitizeDocText = (s: string) => {
                        let out = s
                        // Remove markdown markers
                        out = out.replace(/\*\*/g, "")
                        out = out.replace(/^#{1,6}\s+/gm, "")
                        // Strip prompt-infrastructure annotations:
                        //   [similarity: 0.8123], [ACTION: SHOW_LINK], [SYSTEM: ...]
                        out = out.replace(/\[(?:similarity|ACTION|SYSTEM)\s*:[^\]]*\]/gi, "")
                        // Strip bracketed placeholder tokens like [Client Name],
                        // [To be provided], [Date], [Provider], [Insert ...].
                        // Only strip when the bracket content is clearly a
                        // placeholder (Title Case words or "to be ..." or
                        // "insert ..."). Leave real brackets inside quoted
                        // content alone by requiring 1–40 chars and no digits
                        // that look like lists.
                        out = out.replace(
                            /\[\s*(?:to\s+be\s+[^\]]{0,40}|insert\s+[^\]]{0,40}|your\s+[^\]]{0,40}|client[^\]]{0,40}|provider[^\]]{0,40}|company[^\]]{0,40}|date|name|email|address|phone)\s*\]/gi,
                            ""
                        )
                        // Strip orphan punctuation sequences left behind when
                        // placeholders are removed, e.g. "( )", "[]", ": ;",
                        // "(); ". Run after bracket stripping so it catches the
                        // leftovers.
                        out = out.replace(/\(\s*\)/g, "")
                        out = out.replace(/\[\s*\]/g, "")
                        out = out.replace(/\{\s*\}/g, "")
                        out = out.replace(/[:;,]\s*[;:,]/g, (m) => m.trim().slice(0, 1))
                        // Collapse repeated spaces and trim per-line
                        out = out.replace(/[ \t]{2,}/g, " ")
                        out = out.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n")
                        // Collapse 3+ blank lines to a single blank line
                        out = out.replace(/\n{3,}/g, "\n\n")
                        // Bullet normalization: keep "- " bullets; convert
                        // asterisk bullets to hyphens
                        out = out.replace(/^\s*\*\s+/gm, "- ")
                        return out.trim()
                    }
                    const textFields = ["notes", "terms", "description", "paymentInstructions"] as const
                    for (const field of textFields) {
                        if (typeof docData[field] === "string" && docData[field]) {
                            docData[field] = sanitizeDocText(docData[field])
                        }
                    }
                    if (Array.isArray(docData.items)) {
                        for (const item of docData.items) {
                            if (typeof item.description === "string") {
                                item.description = sanitizeDocText(item.description)
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

                    // ── Merge parent context client fields for linked documents ──
                    // If this is a linked document and the AI didn't include client fields,
                    // carry them over from the parent document's seed data.
                    // Also handles cases where AI returned placeholder text like [Client Email].
                    if (session.chain_id && session.context && typeof session.context === "object") {
                        const ctx = session.context as Record<string, any>
                        // Helper: treat empty strings AND placeholder patterns as missing
                        const isMissing = (v: any) => {
                            if (!v || typeof v !== "string") return true
                            const t = v.trim()
                            if (!t) return true
                            // Placeholder patterns: [Client Email], [To be provided], N/A, etc.
                            if (/^\[.*\]$/.test(t)) return true
                            if (/^(n\/?a|tbd|pending|to be (provided|shared|confirmed|updated|filled|added)|not (provided|available|specified|applicable))$/i.test(t)) return true
                            return false
                        }
                        if (isMissing(docData.toName) && ctx.toName) docData.toName = ctx.toName
                        if (isMissing(docData.toEmail) && ctx.toEmail) docData.toEmail = ctx.toEmail
                        if (isMissing(docData.toAddress) && ctx.toAddress) docData.toAddress = ctx.toAddress
                        if (isMissing(docData.toPhone) && ctx.toPhone) docData.toPhone = ctx.toPhone
                    }

                    onChange(docData)
                    await updateSessionContext(docData)
                    await saveGeneration(userMessage, docData, null, true)
                    setDocumentGenerated(true)
                    // Clear selected client ref after first generation — the client data
                    // is now embedded in the document context (currentData) for future edits
                    selectedClientRef.current = null
                    setSelectedClientName(null)

                    // Update client name on session for chain grouping
                    const clientName = docData.toName || docData.clientName || docData.preparedFor
                    if (clientName) await updateClientName(clientName)

                    const displayMsg = aiMessage || "✅ Document generated! Check the preview. Need changes? Just tell me."
                    setMessages(prev => [...prev, { role: "assistant", content: displayMsg }])
                    await saveMessage("user", displayText)
                    // Save activities from the ref (synchronous, reliable)
                    const savedActivities = [...currentActivitiesRef.current]
                    await saveMessage("assistant", displayMsg, savedActivities.length > 0 ? { activities: savedActivities } : undefined)
                    toast.success("Document updated!")

                    // ── Send/share intent detection ─────────────────────────────────────
                    // If the user's prompt contained a send/share intent, show the appropriate card.
                    // This handles mixed messages like "change the rate to 500 and send it"
                    // where the AI processes the modification and we show the card after.
                    const shareIntentPost = detectShareIntent(userMessage)
                    const sendIntentPost = detectSendIntent(userMessage)
                    // Onboarding forms are delivered ONLY via the asset-link → Send
                    // flow (fillable /onboard/<token> link). Never the generic share
                    // card, which would expose the read-only /d/<publicId> preview.
                    if (docType === "client_onboarding_form" && (shareIntentPost.hasShareIntent || sendIntentPost.hasSendIntent)) {
                        const isLockedStatus = ["finalized", "signed", "paid"].includes(session?.status || "")
                        if (isLockedStatus) {
                            const lockedMsg = "This onboarding form has already been sent, so it's locked. To send it again, cancel it from the preview panel first — that invalidates the old link — then ask me to resend."
                            setMessages(prev => [...prev, { role: "assistant", content: lockedMsg }])
                            await saveMessage("assistant", lockedMsg)
                        } else {
                            const cardEmail = sendIntentPost.email || docData.toEmail || ""
                            const method: "email" | "general" = sendIntentPost.method === "email" ? "email" : "general"
                            const introMsg = "Before you send — add a link where your client can upload their assets (logo, brand files). This is optional; you can skip it."
                            setMessages(prev => [...prev,
                                { role: "assistant", content: introMsg },
                                { role: "assistant", content: "", assetLinkCard: { method, email: cardEmail } },
                            ])
                            await saveMessage("assistant", introMsg, { card: "asset_link", method, email: cardEmail })
                        }
                    } else if (shareIntentPost.hasShareIntent) {
                        const shareMsg = shareIntentPost.method === "whatsapp"
                            ? `Sure! Let me help you share your ${docType} on WhatsApp.`
                            : shareIntentPost.method === "link"
                                ? `Sure! Let me get a shareable link for your ${docType}.`
                                : `How would you like to send your ${docType}?`
                        setMessages(prev => [...prev,
                            { role: "assistant", content: shareMsg },
                            { role: "assistant", content: "", shareCard: true },
                        ])
                        await saveMessage("assistant", shareMsg, { card: "share" })
                    } else {
                        const { hasSendIntent, method: sendMethod, email: detectedEmail } = sendIntentPost
                        if (hasSendIntent && sendMethod === "email") {
                            const cardEmail = detectedEmail || docData.toEmail || ""
                            setMessages(prev => [...prev, {
                                role: "assistant",
                                content: "",
                                sendCard: { email: cardEmail },
                            }])
                            await saveMessage("assistant", `Sure! Fill in the details below to send your ${docType}.`, { card: "send", email: cardEmail })
                        } else if (hasSendIntent && sendMethod === "general") {
                            const shareMsg = `How would you like to send your ${docType}?`
                            setMessages(prev => [...prev,
                                { role: "assistant", content: shareMsg },
                                { role: "assistant", content: "", shareCard: true },
                            ])
                            await saveMessage("assistant", shareMsg, { card: "share" })
                        }
                    }
                    // ── End send intent detection ──────────────────────────────────────
                } else {
                    // JSON parse completely failed. The most common cause is the
                    // stream getting truncated mid-output (edge timeout, network
                    // hiccup, or the thinking model running out of time).
                    console.error("Failed to parse AI response as JSON:", cleaned.slice(0, 200))
                    const isLikelyTruncation = cleaned.length < 100
                    const isThinkingMode = thinkingMode === "thinking"
                    const fallbackMsg = isThinkingMode && isLikelyTruncation
                        ? "Thinking mode timed out before finishing. Try switching to fast mode (the lightning icon) or shorten your prompt."
                        : "I had trouble processing the response. Please try again."
                    setMessages(prev => [...prev, { role: "assistant", content: fallbackMsg }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", fallbackMsg)
                }
            } else {
                // Not JSON — plain text response from AI (e.g., clarification question)

                // ── AI action detection ───────────────────────────────────────────
                // Check if the AI responded with a special action marker
                if (cleaned.startsWith("[ACTION:UNLOCK_DOCUMENT]")) {
                    // Defensive: only show unlock card if the document is ACTUALLY locked
                    // (sent/signed). Otherwise the AI hallucinated the marker — strip it
                    // and show the message as plain text. Prevents the "Unlock Document"
                    // card from appearing on freshly-created docs that were never sent.
                    const isActuallyLocked = session && (session.status === "finalized" || session.status === "signed")
                    const aiMessage = cleaned.replace("[ACTION:UNLOCK_DOCUMENT]", "").trim()

                    if (!isActuallyLocked) {
                        // Hallucinated marker — treat as a normal AI reply
                        const safeMsg = aiMessage || "Got it. Let me know what you'd like to do."
                        setMessages(prev => [...prev, { role: "assistant", content: safeMsg }])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", safeMsg)
                        return
                    }

                    // Document is genuinely sent/signed — show the unlock confirmation card
                    setMessages(prev => [...prev, { role: "assistant", content: "", unlockCard: true }])
                    await saveMessage("user", displayText)
                    if (aiMessage) await saveMessage("assistant", aiMessage, { card: "unlock" })
                    else await saveMessage("assistant", "Unlock document", { card: "unlock" })
                    return
                }

                // [ACTION:SHOW_LINK] — AI wants to show the document link
                if (cleaned.startsWith("[ACTION:SHOW_LINK]") && session) {
                    // Onboarding forms use a real client-fillable capability.
                    // Create or reuse it securely; email delivery is optional.
                    if (docType === "client_onboarding_form") {
                        try {
                            const onboardUrl = await ensureOnboardingFillLink(session.id)
                            setMessages(prev => [...prev, { role: "assistant", content: "", linkCard: onboardUrl }])
                            await saveMessage("user", displayText)
                            await saveMessage("assistant", "View document link", { card: "link" })
                        } catch (error) {
                            const msg = error instanceof Error ? error.message : "Couldn't create the form link. Please try again."
                            setMessages(prev => [...prev, { role: "assistant", content: msg }])
                            await saveMessage("user", displayText)
                            await saveMessage("assistant", msg)
                        }
                        return
                    }
                    const docLink = await fetchPublicDocumentLink(session.id)
                    if (!docLink) {
                        const msg = "Couldn't look up the document link. Please try again."
                        setMessages(prev => [...prev, { role: "assistant", content: msg }])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", msg)
                        return
                    }
                    setMessages(prev => [...prev, { role: "assistant", content: "", linkCard: docLink }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", "View document link", { card: "link" })
                    return
                }

                // [ACTION:SETUP_RECURRING] — AI wants to show recurring setup card
                if (cleaned.startsWith("[ACTION:SETUP_RECURRING]") && session) {
                    setMessages(prev => [...prev, { role: "assistant", content: "", recurringCard: "setup" as const }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", "Set up recurring invoice", { card: "recurring_setup" })
                    return
                }

                // [ACTION:CANCEL_RECURRING] — AI wants to cancel recurring
                if (cleaned.startsWith("[ACTION:CANCEL_RECURRING]") && session) {
                    setMessages(prev => [...prev, { role: "assistant", content: "", recurringCard: "cancel" as const }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", "Cancel recurring invoice", { card: "recurring_cancel" })
                    return
                }

                // [ACTION:DISABLE_CLIENT_RESPONSE] — AI wants to disable accept/reject buttons
                if (cleaned.startsWith("[ACTION:DISABLE_CLIENT_RESPONSE]")) {
                    onChange({ allowClientResponse: false })
                    const msg = "Done! The Accept/Decline/Changes buttons are now hidden from your client."
                    setMessages(prev => [...prev, { role: "assistant", content: msg }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", msg)
                    return
                }

                // [ACTION:ENABLE_CLIENT_RESPONSE] — AI wants to enable accept/reject buttons
                if (cleaned.startsWith("[ACTION:ENABLE_CLIENT_RESPONSE]")) {
                    onChange({ allowClientResponse: true })
                    const msg = "Done! Your client will now see Accept/Decline/Request Changes buttons on the document."
                    setMessages(prev => [...prev, { role: "assistant", content: msg }])
                    await saveMessage("user", displayText)
                    await saveMessage("assistant", msg)
                    return
                }

                // ── Send intent detection for plain-text responses ─────────────────
                // If user asked to send and document already exists, show send card ONLY
                // Replace the AI's "click Send button" instructions with a minimal message
                if (documentGenerated && session) {
                    // Check for share intent first
                    const shareIntent = detectShareIntent(userMessage)

                    // Onboarding forms are shared ONLY as a fillable /onboard/<token>
                    // link via the Send flow — never the generic share card, which
                    // finalizes the session and would expose the read-only
                    // /d/<publicId> preview. Route any share OR send intent through
                    // the same asset-link → Send screen.
                    if ((shareIntent.hasShareIntent || detectSendIntent(userMessage).hasSendIntent) && docType === "client_onboarding_form") {
                        const sIntent = detectSendIntent(userMessage)
                        const knownEmail = sIntent.email || data.toEmail || ""
                        const method = sIntent.method === "email" ? "email" : "general"
                        const introMsg = "Before you send — add a link where your client can upload their assets (logo, brand files). This is optional; you can skip it."
                        setMessages(prev => [...prev,
                            { role: "assistant", content: introMsg },
                            { role: "assistant", content: "", assetLinkCard: { method, email: knownEmail } },
                        ])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", introMsg, { card: "asset_link", method, email: knownEmail })
                        return
                    }

                    // Any share intent (general, whatsapp, link) → show multi-option share card
                    // The ChatShareCard has a proper Lock & Share confirmation flow
                    if (shareIntent.hasShareIntent) {
                        const shareMsg = shareIntent.method === "whatsapp"
                            ? `Sure! Let me help you share your ${docType} on WhatsApp.`
                            : shareIntent.method === "link"
                                ? `Sure! Let me get a shareable link for your ${docType}.`
                                : `How would you like to share your ${docType}?`
                        setMessages(prev => [...prev,
                            { role: "assistant", content: shareMsg },
                            { role: "assistant", content: "", shareCard: true },
                        ])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", shareMsg, { card: "share" })
                        return
                    }

                    const { hasSendIntent, method: sendMethod, email: detectedEmail } = detectSendIntent(userMessage)
                    const knownEmailPost = detectedEmail || data.toEmail || ""
                    if (hasSendIntent && docType === "client_onboarding_form") {
                        const introMsg = "Before you send — add a link where your client can upload their assets (logo, brand files). This is optional; you can skip it."
                        setMessages(prev => [...prev,
                            { role: "assistant", content: introMsg },
                            { role: "assistant", content: "", assetLinkCard: { method: sendMethod === "email" ? "email" : "general", email: knownEmailPost } },
                        ])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", introMsg, { card: "asset_link", method: sendMethod === "email" ? "email" : "general", email: knownEmailPost })
                        return
                    }
                    if (hasSendIntent && sendMethod === "email") {
                        // Show a minimal message + email send card (compose step always shown, email editable)
                        const minimalMsg = `Sure! Fill in the details below to send your ${docType}.`
                        setMessages(prev => [...prev, { role: "assistant", content: minimalMsg }, {
                            role: "assistant",
                            content: "",
                            sendCard: { email: knownEmailPost },
                        }])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", minimalMsg, { card: "send", email: knownEmailPost })
                        return
                    }
                    if (hasSendIntent && sendMethod === "general") {
                        // Generic "send" — always show 3-option share card
                        const shareMsg = `How would you like to send your ${docType}?`
                        setMessages(prev => [...prev,
                            { role: "assistant", content: shareMsg },
                            { role: "assistant", content: "", shareCard: true },
                        ])
                        await saveMessage("user", displayText)
                        await saveMessage("assistant", shareMsg, { card: "share" })
                        return
                    }
                }
                // ── End send intent detection ──────────────────────────────────────

                // ── Sanitize hallucinated unlock claims ─────────────────────────────
                // If the AI mentions "unlocked", "unsent", or "cancelled the send"
                // but the document isn't actually locked, those statements are
                // factually wrong and confusing. Strip the claim and replace with
                // a neutral acknowledgement.
                let finalContent = cleaned

                // ── Strip any trailing JSON block from plain-text responses ─────────
                // The AI sometimes appends a full document JSON after its conversational
                // reply (e.g. "I've updated the name.\n\n{"document":{...}}").
                // The JSON was already applied to the document via the JSON parse path
                // above (which runs FIRST and returns early). If we're here, we're on
                // the plain-text path — but `cleaned` may still contain a leftover JSON
                // tail because Pattern 3 failed to extract it cleanly. Strip it before
                // displaying or saving so users never see raw JSON in chat.
                {
                    const jsonTailMatch = finalContent.match(/^([\s\S]*?)(\n\n?\{[\s\S]*$)/)
                    if (jsonTailMatch?.[1] && jsonTailMatch[1].trim().length > 0) {
                        finalContent = jsonTailMatch[1].trim()
                    } else if (finalContent.startsWith("{") || finalContent.startsWith("[")) {
                        // Entire content is JSON (shouldn't normally reach here, but guard)
                        finalContent = "✅ Document updated! Check the preview."
                    }
                }
                // ── End JSON tail stripper ──────────────────────────────────────────
                const sessionIsLocked = session && (session.status === "finalized" || session.status === "signed")
                if (!sessionIsLocked) {
                    const hallucinatesUnlock = /\b(I[''′]?ve\s+(unlocked|unsent|un-sent|made\s+it\s+editable|cancelled\s+the\s+send|reverted\s+the\s+send)|the\s+document\s+is\s+now\s+(unlocked|editable\s+again)|I\s+(unlocked|unsent)\s+(it|the\s+document))\b/i
                    if (hallucinatesUnlock.test(finalContent)) {
                        // Strip the offending sentence(s) — split by sentence and drop matches.
                        finalContent = finalContent
                            .split(/(?<=[.!?])\s+/)
                            .filter(sentence => !hallucinatesUnlock.test(sentence))
                            .join(" ")
                            .trim()
                        // If we stripped everything, fall back to a useful response
                        if (!finalContent) {
                            finalContent = "The document has been updated. Check the preview to see the latest values."
                        }
                    }
                }
                // ── End unlock hallucination sanitizer ──────────────────────────────

                setMessages(prev => [...prev, { role: "assistant", content: finalContent }])
                await saveMessage("user", displayText)
                // Save activities from ref (synchronous, reliable)
                const chatActivities = [...currentActivitiesRef.current]
                await saveMessage("assistant", finalContent, chatActivities.length > 0 ? { activities: chatActivities } : undefined)
            }
        } catch (err: any) {
            // Ignore abort errors (component unmounted or user navigated away)
            if (err.name === "AbortError" || !isMountedRef.current) {
                return
            }
            const errorMsg = err.message || "Something went wrong"
            const assistantMsg = errorMsg.includes("429") || errorMsg.includes("rate limit")
                ? "⏳ High demand right now. Please wait a minute and try again."
                : "Something went wrong. Please try again."
            setStreamingContent(null)
            // Mark thinking message as complete on error
            setMessages(prev => [
                ...prev.map(m => m.role === "thinking" && m.isWorking ? { ...m, isWorking: false } : m),
                { role: "assistant" as const, content: assistantMsg }
            ])
            // NOTE: Do NOT save user or error messages to DB on failure —
            // this prevents errors from counting against the message limit.
            // The error message is shown in the UI only.
            await saveGeneration(messageText, {}, null, false, errorMsg)
        } finally {
            // Only update state if component is still mounted
            if (isMountedRef.current) {
                setStreamingContent(null)
                setIsLoading(false)
            }
            abortControllerRef.current = null
        }

        } finally {
            sendingRef.current = false
        }
    }, [isLoading, messages, data, docType, onChange, session, saveMessage, updateSessionContext, saveGeneration, fileContext, thinkingMode])

    // File upload handler — ALWAYS extracts via OpenAI, then routes through the
    // full stream pipeline (business profile → compliance → Kimi → DeepSeek).
    // OpenAI is ONLY used for reading the file — never for document generation.
    const handleFileUpload = useCallback(async (file: File, userText?: string) => {
        if (!session) return
        setIsUploading(true)

        const displayText = userText ? `📎 ${file.name}\n${userText}` : `📎 Attached: ${file.name}`
        setMessages(prev => [...prev, { role: "user", content: displayText }])
        await saveMessage("user", displayText)
        setMessages(prev => [...prev, { role: "assistant", content: "Reading your document..." }])

        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("mode", "extract") // ALWAYS extract — never let GPT generate
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
            const summary = result.summary || ""

            if (!summary) {
                throw new Error("Could not extract content from the file")
            }

            // Store the extracted content as file context
            setFileContext(summary)

            // Remove the "Reading your document..." placeholder
            setMessages(prev => prev.filter(m => m.content !== "Reading your document..."))

            // Determine if user wants to generate a document from this file
            const generationKeywords = /\b(create|generate|make|build|invoice|quotation|contract|proposal)\b/i
            const isGenerationRequest = userText ? generationKeywords.test(userText) : false

            if (isGenerationRequest) {
                // User wants a document — route through the full stream pipeline.
                // Inject the extracted file content into the prompt so the stream
                // endpoint (Kimi orchestration → DeepSeek) has full context.
                const enrichedPrompt = `${userText || `Create a ${docType} from this file`}\n\n[CLIENT DETAILS FROM ATTACHED FILE]\n${summary}`
                setIsUploading(false)
                // sendMessage goes through /api/ai/stream → business profile → compliance → Kimi → DeepSeek
                await sendMessage(enrichedPrompt)
            } else {
                // User just uploaded a file without a generation request — store context
                const assistantMsg = "I've read your file. You can ask me questions about it or say \"create an invoice from this\" to generate a document."
                setMessages(prev => [...prev, { role: "assistant", content: assistantMsg }])
                await saveMessage("assistant", assistantMsg)
                setIsUploading(false)
            }
        } catch (err: any) {
            setMessages(prev => {
                const filtered = prev.filter(m => m.content !== "Reading your document...")
                return [...filtered, {
                    role: "assistant",
                    content: `${err.message || "Could not process the file. Try describing your document instead."}`
                }]
            })
            await saveMessage("assistant", `Could not analyze file: ${err.message}`)
            setIsUploading(false)
        }
    }, [session, docType, data, onChange, saveMessage, updateSessionContext, saveGeneration, updateClientName, sendMessage])

    // Auto-send initial prompt ONCE
    useEffect(() => {
        if (initialPrompt && session && !sessionLoading && !initialPromptSentRef.current && welcomeLoaded) {
            initialPromptSentRef.current = true
            sendMessage(initialPrompt.trim())
        }
    }, [initialPrompt, session, sessionLoading, welcomeLoaded, sendMessage])

    // Handle "New" conversation
    const handleNewConversation = useCallback(async () => {
        // Clear parent-owned lock/status/link state before startNewSession updates
        // this component's internal session and renders the new conversation.
        onSessionTransitionStart?.()
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
    }, [startNewSession, onSessionChange, onSessionTransitionStart])

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
                <div className="shrink-0 px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center gap-2">
                    <span className="text-foreground/60 text-sm shrink-0">🔒</span>
                    <p className="text-xs text-muted-foreground leading-snug">
                        {session.status === "signed"
                            ? "This document has been signed and is permanently locked."
                            : "This document has been sent and is locked. Use the chat to unlock and edit."}
                    </p>
                </div>
            )}

            {/* Cancelled banner — shown when the document has been cancelled
                (from the top bar or chat). Its links/reminders are voided; the
                document can be edited or sent again. */}
            {session && session.status === "cancelled" && (
                <div className="shrink-0 px-4 py-2.5 bg-muted/40 border-b border-border/60 flex items-center gap-2">
                    <span className="text-foreground/60 text-sm shrink-0">🚫</span>
                    <p className="text-xs text-muted-foreground leading-snug">
                        This document has been cancelled. Its links and reminders are no longer active — you can edit it or send it again.
                    </p>
                </div>
            )}

            {/* Linked doc context banner — shows what data was pulled from the parent document */}
            {linkedDocContext && linkedDocContext.fields.length > 0 && (
                <div className="shrink-0 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800/40">
                    <div className="flex items-start gap-2">
                        <span className="text-blue-500 dark:text-blue-400 text-sm shrink-0 mt-0.5">🔗</span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 mb-1">
                                Data from {linkedDocContext.parentType}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {linkedDocContext.fields.map(f => (
                                    <span key={f.label} className="text-[10px] text-blue-600 dark:text-blue-400">
                                        <span className="font-medium">{f.label}:</span> {f.value}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setLinkedDocContext(null)}
                            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 shrink-0 text-xs leading-none mt-0.5"
                            aria-label="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 bg-background overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>
                <div className="px-4 py-5 space-y-4 pb-4 max-w-xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div key={`${session?.id}-${idx}`} className={cn(
                            "flex w-full min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-300",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}>
                            {msg.role === "thinking" ? (
                                (msg.activities && msg.activities.length > 0 || msg.isWorking) ? (
                                <div className="w-full max-w-full overflow-hidden">
                                    <AgenticThinkingBlock
                                        activities={msg.activities || []}
                                        isWorking={msg.isWorking ?? false}
                                    />
                                </div>
                                ) : null
                            ) : msg.assetLinkCard ? (
                                // Onboarding pre-send step: attach a client asset-upload link.
                                <ChatAssetLinkCard
                                    initialLink={data.assetUploadLink || ""}
                                    onDismiss={() => setMessages(prev => prev.filter((_, i) => i !== idx))}
                                    onSkip={() => {
                                        // Always land on the multi-option share card. It offers a
                                        // working Copy Link (mints the fillable /onboard link on
                                        // demand), WhatsApp, and Email — so onboarding sharing is
                                        // never forced through the email-only send flow.
                                        setMessages(prev => prev.map((m, i) => i === idx
                                            ? { role: "assistant" as const, content: "", shareCard: true }
                                            : m))
                                    }}
                                    onContinue={async (link) => {
                                        // Persist the full context + link BEFORE showing the share card
                                        // (updateSessionContext replaces the context column, so pass all of `data`).
                                        onChange({ assetUploadLink: link })
                                        await updateSessionContext({ ...data, assetUploadLink: link })
                                        setMessages(prev => prev.map((m, i) => i === idx
                                            ? { role: "assistant" as const, content: "", shareCard: true }
                                            : m))
                                    }}
                                />
                            ) : msg.sendCard ? (
                                // Inline send card — only shown when send intent detected
                                <ChatSendCard
                                    sessionId={session!.id}
                                    invoiceData={data}
                                    documentType={docType}
                                    detectedEmail={msg.sendCard.email}
                                    onBeforeSend={() => updateSessionContext(data)}
                                    onDismiss={() => setMessages(prev => prev.filter((_, i) => i !== idx))}
                                    onLockDocument={() => {
                                        // Notify parent to lock the document and immediately update
                                        // the DocumentPreview's lock state without waiting for a DB fetch
                                        onLockDocument?.(session!.id)
                                        onDocumentStatusChange?.(session!.id, "finalized")
                                        updateSessionStatus("finalized")
                                    }}
                                    onSent={(info) => {
                                        // Onboarding forms: persist the fresh fillable link as a
                                        // { card: "link" } message so it survives a refresh and can
                                        // be re-shared any time. The send card keeps its own transient
                                        // "sent" confirmation; this adds the durable record.
                                        if (docType === "client_onboarding_form" && info?.onboardUrl) {
                                            const link = info.onboardUrl
                                            setMessages(prev => [...prev, { role: "assistant" as const, content: "", linkCard: link }])
                                            saveMessage("assistant", "View form link", { card: "link" }).catch(() => {})
                                        }
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
                                    isSent={session?.status === "finalized" || session?.status === "signed"}
                                    onSelectEmail={(email) => {
                                        // Replace share card with send card
                                        setMessages(prev => prev.map((m, i) =>
                                            i === idx ? { role: "assistant" as const, content: "", sendCard: { email } } : m
                                        ))
                                    }}
                                    onDismiss={() => setMessages(prev => prev.filter((_, i) => i !== idx))}
                                    onLockDocument={() => {
                                        // Full sync: update all three state atoms so they agree
                                        onLockDocument?.(session!.id)
                                        onDocumentStatusChange?.(session!.id, "finalized")
                                        updateSessionStatus("finalized")
                                    }}
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
                            ) : msg.cancelPaymentCard ? (
                                // Cancel payment link confirmation card (from chat intent)
                                <ChatCancelPaymentCard
                                    sessionId={session!.id}
                                    razorpayPaymentLinkId={msg.cancelPaymentCard.razorpayId}
                                    amount={msg.cancelPaymentCard.amount}
                                    onCancelled={() => {
                                        // Trigger the same flow as the button cancel
                                        onChange({ paymentLink: "", paymentLinkStatus: undefined, showPaymentLinkInPdf: false })
                                        if (onPaymentLinkCancelled) onPaymentLinkCancelled()
                                        // Replace the card with a success notification
                                        setMessages(prev => prev.map((m, i) =>
                                            i === idx ? { role: "assistant" as const, content: "", cancelledCard: true } : m
                                        ))
                                    }}
                                    onDismiss={() => {
                                        // Remove the card and add a "kept active" message
                                        setMessages(prev => prev.map((m, i) =>
                                            i === idx ? { role: "assistant" as const, content: "Payment link kept active. No changes made." } : m
                                        ))
                                    }}
                                />
                            ) : msg.linkCard ? (
                                // Document link card with copy button
                                <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 px-4 py-3.5 space-y-2"
                                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                                            <span className="text-sm">🔗</span>
                                        </div>
                                        <p className="text-sm font-semibold text-foreground">Document Link</p>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/30">
                                        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{msg.linkCard}</span>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await navigator.clipboard.writeText(msg.linkCard!)
                                                    toast.success("Link copied!")
                                                } catch { toast.error("Failed to copy") }
                                            }}
                                            className="text-xs font-medium text-foreground hover:text-foreground/80 transition-colors shrink-0 px-2 py-1 rounded-md hover:bg-muted/60 border border-border/40"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            ) : msg.recurringCard ? (
                                // Recurring invoice setup/cancel card
                                <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 overflow-hidden"
                                    style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
                                >
                                    <RecurringCard
                                        mode={msg.recurringCard}
                                        sessionId={session!.id}
                                        onDone={(resultMsg) => {
                                            setMessages(prev => prev.map((m, i) =>
                                                i === idx ? { role: "assistant" as const, content: resultMsg } : m
                                            ))
                                        }}
                                    />
                                </div>
                            ) : msg.unlockCard ? (
                                // Unlock/cancel-send confirmation card
                                // FINAL GATE: only render if the document is genuinely locked.
                                (session?.status === "finalized" || session?.status === "signed" || session?.status === "paid") ? (
                                <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 overflow-hidden"
                                    style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
                                >
                                    {/* Determine lock state once */}
                                    {(() => {
                                        const isSignedPerm = session?.status === "signed"
                                        const isPaidPerm = session?.status === "paid"
                                            || data.paymentLinkStatus === "paid"
                                            || (data as any).manualPaid === true
                                        const isPermanentlyLocked = isSignedPerm || isPaidPerm

                                        if (isPermanentlyLocked) {
                                            // Permanently locked — no unlock option
                                            const permanentMsg = isSignedPerm
                                                ? "All parties have signed this document. It is permanently locked and cannot be edited or cancelled — this is required for legal validity."
                                                : "This invoice has been paid and is permanently locked. Paid invoices are financial records that must be preserved."
                                            const permanentLabel = isSignedPerm ? "Signed & locked" : "Paid & locked"
                                            return (
                                                <div className="px-5 pt-5 pb-5 space-y-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-foreground/6 dark:bg-foreground/10 border border-border/40 flex items-center justify-center shrink-0 mt-0.5">
                                                            <span className="text-base">🔒</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">{permanentLabel}</p>
                                                            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                                                                {permanentMsg}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMessages(prev => prev.map((m, i) =>
                                                                    i === idx ? { role: "assistant" as const, content: "Got it. This document is preserved." } : m
                                                                ))
                                                            }}
                                                            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border/60 bg-background hover:bg-muted/40 transition-colors active:scale-[0.97]"
                                                        >
                                                            Got it
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                // Create a new linked session of the same doc type with the same client data
                                                                try {
                                                                    if (session && onLinkedSessionCreate) {
                                                                        await handleCreateLinked(session.id, docType)
                                                                        setMessages(prev => prev.map((m, i) =>
                                                                            i === idx ? { role: "assistant" as const, content: `Starting a new ${docType} with the same client details.` } : m
                                                                        ))
                                                                    }
                                                                } catch {
                                                                    toast.error("Could not create new document.")
                                                                }
                                                            }}
                                                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.97]"
                                                            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)" }}
                                                        >
                                                            + New Document
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        // Finalized/sent only — can unlock
                                        return (
                                            <div className="px-5 pt-5 pb-5 space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-foreground/6 dark:bg-foreground/10 border border-border/40 flex items-center justify-center shrink-0 mt-0.5">
                                                        <span className="text-base">🔓</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">Unlock Document</p>
                                                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                                                            This will unlock the document so you can edit it again. The email already sent cannot be recalled, but you can make changes and resend.
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setMessages(prev => prev.map((m, i) =>
                                                                i === idx ? { role: "assistant" as const, content: "No changes made. The document stays locked." } : m
                                                            ))
                                                        }}
                                                        className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border/60 bg-background hover:bg-muted/40 transition-colors active:scale-[0.97]"
                                                    >
                                                        Keep Locked
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            try {
                                                                const res = await authFetch("/api/sessions/unlock", {
                                                                    method: "POST",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ sessionId: session!.id }),
                                                                })
                                                                if (res.ok) {
                                                                    const result = await res.json()
                                                                    setMessages(prev => prev.map((m, i) =>
                                                                        i === idx ? { role: "assistant" as const, content: "Document unlocked. You can now edit it and resend when ready." } : m
                                                                    ))
                                                                    toast.success("Document unlocked")
                                                                    updateSessionStatus("active")
                                                                    onUnlockDocument?.(session!.id)
                                                                    // If the API also cancelled a payment link, clear it from
                                                                    // the document data so the PDF strip and toolbar both update.
                                                                    if (result.paymentLinkCancelled) {
                                                                        onChange({ paymentLink: "", paymentLinkStatus: undefined, showPaymentLinkInPdf: false })
                                                                        if (onPaymentLinkCancelled) onPaymentLinkCancelled()
                                                                    }
                                                                } else {
                                                                    const err = await res.json()
                                                                    setMessages(prev => prev.map((m, i) =>
                                                                        i === idx ? { role: "assistant" as const, content: err.error || "Failed to unlock the document." } : m
                                                                    ))
                                                                }
                                                            } catch {
                                                                setMessages(prev => prev.map((m, i) =>
                                                                    i === idx ? { role: "assistant" as const, content: "Something went wrong. Please try again." } : m
                                                                ))
                                                            }
                                                        }}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.97]"
                                                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)" }}
                                                    >
                                                        🔓 Unlock &amp; Edit
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                                ) : null
                            ) : msg.role === "user" ? (
                                <div className="max-w-[78%] min-w-0 px-4 py-2.5 rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300"
                                    style={{ boxShadow: "0 2px 8px hsl(var(--primary) / 0.25)", wordBreak: "break-word", overflowWrap: "anywhere" }}
                                >
                                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                </div>
                            ) : (
                                <div className="max-w-[85%] min-w-0 px-4 py-3 rounded-2xl rounded-bl-sm bg-card border border-border/50 text-sm leading-relaxed text-foreground animate-in fade-in slide-in-from-bottom-2 duration-400 overflow-hidden"
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
            </div>

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
                                        onChange={(fields) => {
                                            selectedClientRef.current = {
                                                name: fields.toName,
                                                email: fields.toEmail || undefined,
                                                address: fields.toAddress || undefined,
                                                phone: fields.toPhone || undefined,
                                                taxId: fields.toTaxId || undefined,
                                            }
                                            setSelectedClientName(fields.toName)
                                            onChange({
                                                toName: fields.toName,
                                                toEmail: fields.toEmail,
                                                toAddress: fields.toAddress,
                                                toPhone: fields.toPhone,
                                                toTaxId: fields.toTaxId,
                                            })
                                        }}
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
                                        onChange={(fields) => {
                                            selectedClientRef.current = {
                                                name: fields.toName,
                                                email: fields.toEmail || undefined,
                                                address: fields.toAddress || undefined,
                                                phone: fields.toPhone || undefined,
                                                taxId: fields.toTaxId || undefined,
                                            }
                                            setSelectedClientName(fields.toName)
                                            onChange({
                                                toName: fields.toName,
                                                toEmail: fields.toEmail,
                                                toAddress: fields.toAddress,
                                                toPhone: fields.toPhone,
                                                toTaxId: fields.toTaxId,
                                            })
                                        }}
                                    />
                                    {/* Show selected client badge */}
                                    {selectedClientName && (
                                        <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium bg-primary/10 text-primary border border-primary/20 shrink-0 max-w-[160px] truncate">
                                            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                            <span className="truncate">{selectedClientName}</span>
                                        </span>
                                    )}
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
                                    placeholder={composerPlaceholder}
                                    disabled={sessionLoading || !session}
                                    statusText={isSaving ? "Saving..." : undefined}
                                    showAttachButton={true}
                                    stagedFile={stagedFile}
                                    onFileSelect={(file) => setStagedFile(file)}
                                    onFileRemove={() => setStagedFile(null)}
                                    thinkingMode={thinkingMode}
                                    onThinkingModeChange={setThinkingMode}
                                    showContextButton={contextEnabled}
                                    onContextClick={() => setContextOpen(true)}
                                    contextFillPercent={contextUsage.fillPercent}
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
                                placeholder={composerPlaceholder}
                                disabled={sessionLoading || !session}
                                statusText={isSaving ? "Saving..." : undefined}
                                showAttachButton={true}
                                stagedFile={stagedFile}
                                onFileSelect={(file) => setStagedFile(file)}
                                onFileRemove={() => setStagedFile(null)}
                                thinkingMode={thinkingMode}
                                onThinkingModeChange={setThinkingMode}
                                showContextButton={contextEnabled}
                                onContextClick={() => setContextOpen(true)}
                                contextFillPercent={contextUsage.fillPercent}
                            />
                        )
                    )}
                </div>
                </div>
            </div>

            {/* Reference Context manager — opened from the chat bar's context button */}
            <ContextManagerDialog
                open={contextOpen}
                onOpenChange={setContextOpen}
                documents={contextDocuments}
                usage={contextUsage}
                uploading={contextUploading}
                onUpload={uploadContext}
                onRemove={removeContext}
                disabledReason={!session ? "Start or open a document first, then add reference context." : null}
            />

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
                    onBeforeSend={() => updateSessionContext(data)}
                    onEmailSent={() => {
                        setSendDialogOpen(false)
                        toast.success("Document sent!")
                    }}
                />
            )}
        </div>
    )
}

