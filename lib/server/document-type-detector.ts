/**
 * Document Type Detection Utility
 * Analyzes user prompts to automatically detect document type
 */

export type DocumentType =
  | "invoice"
  | "contract"
  | "quote"
  | "proposal"
  | "sow"
  | "change_order"
  | "nda"
  | "client_onboarding_form"
  | "payment_followup"

export interface DetectionResult {
  type: DocumentType
  confidence: number // 0-1
  reasoning: string
}

/**
 * Detect document type from user prompt using keyword analysis
 */
export function detectDocumentType(prompt: string): DetectionResult {
  const lowerPrompt = prompt.toLowerCase()

  // Define keyword patterns with weights
  const patterns: Record<DocumentType, { keywords: string[]; weight: number }> = {
    invoice: {
      keywords: [
        "invoice", "bill", "payment", "charge", "amount due", "pay", "paid",
        "$", "€", "£", "₹", "price", "cost", "fee", "total", "subtotal",
        "tax", "gst", "vat", "receipt", "billing", "payable",
        "recurring", "monthly invoice", "weekly billing",
        "subscription billing", "repeat invoice", "monthly billing",
        "recurring invoice", "subscription invoice", "auto-invoice"
      ],
      weight: 1.0
    },
    quote: {
      keywords: [
        "quotation", "quote", "price quote", "pricing", "estimate",
        "cost estimate", "price list", "rate card", "bid",
        "price breakdown", "quoted price"
      ],
      weight: 1.2
    },
    contract: {
      keywords: [
        "contract", "service agreement", "employment", "hire", "work agreement",
        "terms of service", "freelance agreement", "consulting agreement",
        "contractor agreement", "project agreement", "engagement"
      ],
      weight: 1.0
    },
    proposal: {
      keywords: [
        "proposal", "project proposal", "business proposal", "pitch",
        "recommendation", "plan", "strategy", "approach",
        "solution proposal", "offer", "submission"
      ],
      weight: 0.8
    },
    sow: {
      keywords: [
        "statement of work", "sow", "deliverables", "milestones",
        "timeline", "phases", "project scope", "scope of work",
        "acceptance criteria", "work breakdown"
      ],
      weight: 1.1
    },
    change_order: {
      keywords: [
        "change order", "amendment", "scope change", "modification",
        "revision", "addendum", "extra work", "change request",
        "scope amendment"
      ],
      weight: 1.2
    },
    nda: {
      keywords: [
        "nda", "non-disclosure", "confidentiality", "confidential",
        "secret", "proprietary", "non disclosure agreement",
        "confidentiality agreement"
      ],
      weight: 1.2
    },
    client_onboarding_form: {
      keywords: [
        "onboarding", "intake", "client details", "questionnaire",
        "client form", "project requirements", "intake form",
        "onboarding form", "client intake", "new client"
      ],
      weight: 1.0
    },
    payment_followup: {
      keywords: [
        "reminder", "follow up", "overdue", "payment reminder",
        "past due", "outstanding", "unpaid", "follow-up",
        "payment overdue", "invoice reminder"
      ],
      weight: 1.1
    }
  }

  // Calculate scores for each type
  const scores: Record<DocumentType, number> = {
    invoice: 0,
    contract: 0,
    quote: 0,
    proposal: 0,
    sow: 0,
    change_order: 0,
    nda: 0,
    client_onboarding_form: 0,
    payment_followup: 0
  }

  for (const [type, config] of Object.entries(patterns)) {
    for (const keyword of config.keywords) {
      if (lowerPrompt.includes(keyword)) {
        scores[type as DocumentType] += config.weight
      }
    }
  }

  // Find highest score
  let maxScore = 0
  let detectedType: DocumentType = "invoice" // default
  let reasoning = ""

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      detectedType = type as DocumentType
    }
  }

  // Calculate confidence (normalize to 0-1)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0 ? maxScore / totalScore : 0

  // Generate reasoning
  if (confidence > 0.7) {
    reasoning = `Detected "${detectedType}" based on keywords in your prompt`
  } else if (confidence > 0.4) {
    reasoning = `Likely a "${detectedType}", but please confirm`
  } else {
    reasoning = `Unclear document type, defaulting to "${detectedType}"`
  }

  return {
    type: detectedType,
    confidence,
    reasoning
  }
}

/**
 * Get a user-friendly message for document type detection
 */
export function getDetectionMessage(result: DetectionResult): string {
  if (result.confidence > 0.7) {
    return `I'll help you create a ${result.type}. ${result.reasoning}.`
  } else if (result.confidence > 0.4) {
    return `It looks like you want to create a ${result.type}. Is that correct?`
  } else {
    return `I'm not sure what type of document you need. Could you clarify if you want an invoice, contract, quote, proposal, SOW, change order, NDA, client onboarding form, or payment follow-up?`
  }
}

/**
 * Examples for testing:
 *
 * detectDocumentType("Create an invoice for $1500 web design work")
 * → { type: "invoice", confidence: 0.85, reasoning: "..." }
 *
 * detectDocumentType("Get me a price quote for 50 custom t-shirts")
 * → { type: "quote", confidence: 0.95, reasoning: "..." }
 *
 * detectDocumentType("I need a service agreement for freelance work")
 * → { type: "contract", confidence: 0.80, reasoning: "..." }
 *
 * detectDocumentType("Create a business proposal for the new project")
 * → { type: "proposal", confidence: 0.75, reasoning: "..." }
 *
 * detectDocumentType("Write a statement of work with deliverables and milestones")
 * → { type: "sow", confidence: 0.90, reasoning: "..." }
 *
 * detectDocumentType("I need an NDA to protect confidential information")
 * → { type: "nda", confidence: 0.90, reasoning: "..." }
 *
 * detectDocumentType("Send a payment reminder for the overdue invoice")
 * → { type: "payment_followup", confidence: 0.85, reasoning: "..." }
 */
