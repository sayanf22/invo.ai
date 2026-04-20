"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface ClientAIChatProps {
  onClientsUpdated: () => void
}

export function ClientAIChat({ onClientsUpdated }: ClientAIChatProps) {
  const [conversationHistory, setConversationHistory] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [inputValue, setInputValue] = useState("")

  async function handleSubmit(message: string) {
    if (!message.trim()) return

    const userMessage: Message = { role: "user", content: message }
    const updatedHistory = [...conversationHistory, userMessage]
    setConversationHistory(updatedHistory)
    setIsLoading(true)

    try {
      const response = await fetch("/api/ai/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationHistory }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? `Request failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === "chunk" && data.text) fullText += data.text
              if (data.type === "complete" || data.type === "error") break
            } catch { /* ignore parse errors */ }
          }
        }
      }

      const assistantMessage: Message = { role: "assistant", content: fullText }
      setConversationHistory([...updatedHistory, assistantMessage])
      onClientsUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">AI Client Assistant</h2>

      {conversationHistory.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {conversationHistory.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border text-foreground"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      )}

      <AIInputWithLoading
        placeholder="e.g. Add a client named Acme Corp, email acme@example.com"
        isLoading={isLoading}
        value={inputValue}
        onValueChange={setInputValue}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
