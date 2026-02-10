/**
 * DeepSeek API Helper Types for Invo.ai
 *
 * The actual API call logic lives in app/api/ai/onboarding/route.ts.
 * This file exports shared types used across the application.
 * 
 * Model: DeepSeek V3 Reasoning (deepseek-reasoner)
 * API: OpenAI-compatible chat completions
 */

export interface OnboardingMessage {
    role: "user" | "assistant"
    content: string
}

export interface OnboardingExtractionResult {
    extractedData: Partial<{
        businessType: string
        country: string
        state: string
        businessName: string
        ownerName: string
        email: string
        phone: string
        address: {
            street: string
            city: string
            state: string
            postalCode: string
        }
        taxId: string
        clientCountries: string[]
        defaultCurrency: string
        paymentTerms: string
    }>
    nextQuestion: string | null
    stepComplete: boolean
    confidence: number
    needsClarification: boolean
    clarificationReason?: string
}
