import { authFetch } from "@/lib/auth-fetch"

export type DeliveryAction = "email" | "link" | "whatsapp" | "send" | "none"

/**
 * Cheap client-side pre-filter. Returns true only when a message plausibly
 * relates to delivering/sharing a document, so pure edits and questions skip
 * the AI classifier entirely (no added latency).
 */
export function hasDeliveryHint(message: string): boolean {
  return /\b(send|resend|share|deliver|forward|dispatch|email|e-mail|mail|whats\s*app|whatsapp|wa|link|url|copy)\b/i.test(message)
}

/**
 * Keyword fallback used only when the AI classifier is unavailable or errors.
 * Intentionally conservative and channel-aware; mirrors the model's contract.
 */
export function keywordDeliveryAction(message: string): DeliveryAction {
  const lower = message.toLowerCase().trim()

  // Non-delivery "send" workflow mentions (e.g. "send for approval").
  if (/\bsend\s+(?:for|as|when|after|before|once|if)\b/.test(lower)) return "none"

  const wantsWhatsapp = /\bwhats\s*app\b|\bwhatsapp\b|\bwa\b/.test(lower)
  if (wantsWhatsapp) return "whatsapp"

  const mentionsLink = /\b(link|url)\b/.test(lower)
  const mentionsEmail = /\be-?mail\b|\bmail\b|[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(lower)
  const mentionsSendVerb = /\b(send|resend|re-send|share|deliver|forward|dispatch|copy|get)\b/.test(lower)

  if (mentionsLink && (mentionsSendVerb || /\bcopy\b|\bget\b|\bcreate\b|\bmake\b/.test(lower))) return "link"
  if (mentionsEmail && mentionsSendVerb) return "email"
  if (/\bsend\s+via\s+e-?mail\b|\bemail\s+(it|this|to)\b|\bmail\s+(it|this|to)\b/.test(lower)) return "email"
  if (mentionsSendVerb) return "send"
  return "none"
}

/**
 * Classify a message about an existing document by MEANING using the model,
 * with a keyword fallback so the chat never blocks on a failed/absent call.
 */
export async function classifyDeliveryAction(
  message: string,
  ctx: { documentType: string; status: string },
): Promise<DeliveryAction> {
  try {
    const res = await authFetch("/api/ai/action-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, documentType: ctx.documentType, status: ctx.status }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data?.fallback) return keywordDeliveryAction(message)
      const action = data?.action
      if (action === "email" || action === "link" || action === "whatsapp" || action === "send" || action === "none") {
        return action
      }
    }
    return keywordDeliveryAction(message)
  } catch {
    return keywordDeliveryAction(message)
  }
}
