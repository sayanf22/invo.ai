import { NextRequest } from "next/server"
import { streamGenerateDocument, type AIGenerationRequest } from "@/lib/deepseek"
import { authenticateRequest, validateBodySize, sanitizeError, validateOrigin } from "@/lib/api-auth"

import { checkCostLimit, trackUsage } from "@/lib/cost-protection"
import { logAIGeneration } from "@/lib/audit-log"
import { sanitizeText } from "@/lib/sanitize"

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Validate request origin
        const originError = validateOrigin(request)
        if (originError) return originError

        // SECURITY: Authenticate user (pass request for Authorization header fallback)
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // SECURITY: Cost protection - check monthly limit
        const costError = await checkCostLimit(auth.supabase, auth.user.id, "generation")
        if (costError) return costError

        const body: AIGenerationRequest = await request.json()

        // SECURITY: Input size limit (100KB)
        const sizeError = validateBodySize(body, 100 * 1024)
        if (sizeError) return sizeError

        if (!body.prompt) {
            return new Response(
                JSON.stringify({ success: false, error: "Prompt is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        // SECURITY: Sanitize prompt input
        body.prompt = sanitizeText(body.prompt)

        // SECURITY: Limit prompt length to prevent token abuse
        if (body.prompt.length > 10_000) {
            return new Response(
                JSON.stringify({ success: false, error: "Prompt too long. Maximum 10,000 characters." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        if (!body.documentType) {
            body.documentType = "invoice"
        }

        // SECURITY: Fetch business profile SERVER-SIDE (never trust client-sent business data)
        if (!body.businessContext) {
            try {
                const { data: business } = await auth.supabase
                    .from("businesses")
                    .select("*")
                    .eq("user_id", auth.user.id)
                    .single()

                if (business) {
                    const b: any = business
                    let addr = ""
                    if (b.address) {
                        addr = typeof b.address === "string"
                            ? b.address
                            : [b.address.street, b.address.city, b.address.state, b.address.postalCode || b.address.postal_code, b.address.country]
                                .filter(Boolean).join(", ")
                    }
                    // Check if business has any tax registration
                    const hasTaxRegistration = b.tax_ids && typeof b.tax_ids === 'object' && Object.values(b.tax_ids).some((v: any) => v && String(v).trim().length > 0)
                    
                    body.businessContext = {
                        name: b.name || "",
                        address: addr || "",
                        country: b.country || "",
                        currency: b.default_currency || "USD",
                        paymentTerms: b.default_payment_terms || "Net 30",
                        signatory: {
                            name: b.primary_signatory?.name || b.owner_name || "",
                            title: b.primary_signatory?.title || "Owner",
                            email: b.email || "",
                        },
                        taxRegistered: hasTaxRegistration,
                        taxIds: hasTaxRegistration ? b.tax_ids : undefined,
                        phone: b.phone || "",
                        businessType: b.business_type || "",
                        additionalNotes: b.additional_notes || "",
                    }
                }
            } catch (err) {
                console.error("Failed to fetch business profile:", err instanceof Error ? err.message : err)
                // Continue without business context — AI will use placeholders
            }
        }

        // Create a readable stream from our generator
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()

                try {
                    for await (const chunk of streamGenerateDocument(body)) {
                        const data = `data: ${JSON.stringify(chunk)}\n\n`
                        controller.enqueue(encoder.encode(data))

                        if (chunk.type === "complete" || chunk.type === "error") {
                            break
                        }
                    }

                    // Track usage for cost protection (after successful generation)
                    await trackUsage(auth.supabase, auth.user.id, "generation", 0)

                    // Audit log
                    await logAIGeneration(
                        auth.supabase,
                        auth.user.id,
                        body.documentType,
                        0, // tokens used (would need to get from API response)
                        0.00094, // estimated cost
                        request
                    )
                } catch (error) {
                    const errorData = `data: ${JSON.stringify({
                        type: "error",
                        data: sanitizeError(error),
                    })}\n\n`
                    controller.enqueue(encoder.encode(errorData))
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        })
    } catch (error) {
        console.error("AI streaming error:", error)
        return new Response(
            JSON.stringify({
                success: false,
                error: sanitizeError(error),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}
