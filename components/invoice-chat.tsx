"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Sparkles, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { InvoiceData } from "@/lib/invoice-types"
import { useDocumentSession } from "@/hooks/use-document-session"
import { MarkdownMessage } from "@/components/markdown-message"

interface InvoiceChatProps {
    data: InvoiceData
    onChange: (updates: Partial<InvoiceData>) => void
    selectedSessionId?: string
    onSessionChange?: (sessionId: string) => void
    initialPrompt?: string
}

export function InvoiceChat({ data, onChange, selectedSessionId, onSessionChange, initialPrompt }: InvoiceChatProps) {
    const docType = data.documentType?.toLowerCase() || "invoice"

    // Hook handles session init + switching when selectedSessionId changes
    const {
        session,
        messages: savedMessages,
        isLoading: sessionLoading,
        isSaving,
        saveMessage,
        updateSessionContext,
        saveGeneration,
        startNewSession,
    } = useDocumentSession(docType, selectedSessionId)

    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
    const [welcomeLoaded, setWelcomeLoaded] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const initialPromptSentRef = useRef(false)
    const lastSyncedSessionRef = useRef<string | null>(null)

    // Sync messages from hook when session changes (new session loaded or switched)
    useEffect(() => {
        if (sessionLoading) return
        if (!session) return

        // Only sync when the session actually changed
        if (lastSyncedSessionRef.current === session.id) return
        lastSyncedSessionRef.current = session.id

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
            }
        } else if (!welcomeLoaded) {
            // New session with no messages — load welcome
            loadWelcome()
        }
    }, [session, sessionLoading, savedMessages]) // eslint-disable-line react-hooks/exhaustive-deps

    // Load welcome message
    const loadWelcome = useCallback(async () => {
        const msg = `Hi! Describe your ${docType} and I'll generate it right away. Just tell me what you need — like "invoice for 10k for web design to Acme Corp".`
        setMessages([{ role: "assistant", content: msg }])
        setWelcomeLoaded(true)
    }, [docType])

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Core send function
    const sendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !session) return

        const userMessage = messageText.trim()
        setInputValue("")
        setMessages(prev => [...prev, { role: "user" as const, content: userMessage }])
        await saveMessage("user", userMessage)
        setIsLoading(true)

        try {
            const response = await fetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: userMessage,
                    documentType: docType,
                    // Only send currentData if this is a follow-up (not the first message)
                    // This prevents the AI from treating a new prompt as an edit of old data
                    currentData: messages.length > 1 ? data : undefined,
                    conversationHistory: messages.length > 1 ? messages.slice(-5) : [],
                }),
            })

            if (!response.ok) throw new Error(`API error: ${response.status}`)

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let fullContent = ""
            if (!reader) throw new Error("No response body")

            while (true) {
                const { done, value: chunk } = await reader.read()
                if (done) break
                const text = decoder.decode(chunk, { stream: true })
                const lines = text.split("\n").filter(l => l.startsWith("data: "))

                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line.slice(6))
                        if (parsed.type === "chunk") {
                            fullContent += parsed.data
                        } else if (parsed.type === "complete") {
                            let cleaned = fullContent.trim()
                            if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
                            else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "")
                            cleaned = cleaned.trim()

                            if (cleaned.startsWith("{")) {
                                try {
                                    const result = JSON.parse(cleaned)
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
                                        }))
                                    }

                                    // Strip AI-invented payment info if user didn't ask for it
                                    const promptLower = userMessage.toLowerCase()
                                    const mentionsPayment = /\b(payment method|bank transfer|bank details|payment info|pay via|pay by|wire|paypal|stripe|credit card|upi|ach)\b/i.test(promptLower)
                                    if (!mentionsPayment) {
                                        if (docData.paymentMethod) docData.paymentMethod = ""
                                        if (docData.paymentInstructions) docData.paymentInstructions = ""
                                    }

                                    onChange(docData)
                                    await updateSessionContext(docData)
                                    await saveGeneration(userMessage, docData, null, true)

                                    const displayMsg = aiMessage || "✅ Document generated! Check the preview. Need changes? Just tell me."
                                    setMessages(prev => [...prev, { role: "assistant", content: displayMsg }])
                                    await saveMessage("assistant", displayMsg)
                                    toast.success("Document updated!")
                                } catch {
                                    setMessages(prev => [...prev, { role: "assistant", content: cleaned }])
                                    await saveMessage("assistant", cleaned)
                                }
                            } else {
                                setMessages(prev => [...prev, { role: "assistant", content: cleaned }])
                                await saveMessage("assistant", cleaned)
                            }
                        } else if (parsed.type === "error") {
                            throw new Error(parsed.data)
                        }
                    } catch { /* skip malformed SSE lines */ }
                }
            }
        } catch (err: any) {
            const errorMsg = err.message || "Something went wrong"
            const assistantMsg = errorMsg.includes("429") || errorMsg.includes("rate limit")
                ? "⏳ High demand right now. Please wait a minute and try again."
                : "Something went wrong. Please try again."
            setMessages(prev => [...prev, { role: "assistant", content: assistantMsg }])
            await saveMessage("assistant", assistantMsg)
            await saveGeneration(messageText, {}, null, false, errorMsg)
        } finally {
            setIsLoading(false)
            inputRef.current?.focus()
        }
    }, [isLoading, messages, data, docType, onChange, session, saveMessage, updateSessionContext, saveGeneration])

    // Handle manual send
    const handleSendMessage = useCallback(() => {
        if (!inputValue.trim()) return
        sendMessage(inputValue.trim())
    }, [inputValue, sendMessage])

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

        const newSession = await startNewSession()
        if (newSession && onSessionChange) {
            onSessionChange(newSession.id)
        }
        toast.success("Started new conversation")
    }, [startNewSession, onSessionChange])

    return (
        <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/15 rounded-xl">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-base">
                            {data.documentType ? `${data.documentType} Builder` : "Document Builder"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {sessionLoading ? "Loading..." : messages.length > 1 ? `${messages.length} messages` : "New conversation"}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleNewConversation} className="gap-2 btn-press">
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">New</span>
                </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-5">
                <div className="space-y-4 pb-4 max-w-2xl mx-auto">
                    {messages.map((msg, idx) => (
                        <div key={`${session?.id}-${idx}`} className={cn(
                            "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                            msg.role === "user" ? "justify-end" : "justify-start"
                        )}>
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm",
                                msg.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                    : "bg-muted text-foreground rounded-bl-md"
                            )}>
                                {msg.role === "user" ? (
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                ) : (
                                    <MarkdownMessage content={msg.content} />
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start w-full animate-in fade-in duration-200">
                            <div className="bg-muted rounded-2xl px-4 py-3 space-x-1.5 flex items-center rounded-bl-md">
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-background border-t shrink-0">
                <div className="relative flex items-center gap-2 max-w-2xl mx-auto">
                    <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                        placeholder={`Describe your ${docType}...`}
                        disabled={isLoading || sessionLoading || !session}
                        className="flex-1 rounded-xl h-12 px-5 text-[15px] transition-shadow duration-200 focus:shadow-md"
                        autoFocus
                    />
                    <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading || sessionLoading || !session}
                        className={cn(
                            "rounded-xl h-12 w-12 shrink-0 btn-press transition-all duration-200",
                            inputValue.trim() && !isLoading && "send-ready"
                        )}
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                    {isSaving ? "Saving..." : `AI builds your ${docType} and refines it as you answer questions.`}
                </p>
            </div>
        </div>
    )
}
