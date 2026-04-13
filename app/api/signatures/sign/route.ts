/**
 * Signature Submission API Route (Backend-Only)
 * 
 * POST /api/signatures/sign
 * 
 * Handles the entire signing flow server-side:
 * 1. Validates signing token and checks expiry
 * 2. Uploads signature image to Cloudflare R2 (falls back to base64 data URL)
 * 3. Updates signature record with image key/URL, timestamp, IP, user-agent
 * 4. Checks if all signatures for the document are complete
 * 5. Updates document status if fully signed
 * 
 * SECURITY: No auth required (token-based access for external signers).
 * Rate-limited by IP address. Input validated and size-limited.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getClientIP, sanitizeError } from "@/lib/api-auth"
import { putObject } from "@/lib/r2"

// Max request body size: 500KB (base64 signature image)
const MAX_BODY_SIZE = 500 * 1024

export async function POST(request: NextRequest) {
    try {
        // Parse and validate body
        let body: { token?: string; signatureDataUrl?: string }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 }
            )
        }

        // Validate body size
        const bodyStr = JSON.stringify(body)
        if (bodyStr.length > MAX_BODY_SIZE) {
            return NextResponse.json(
                { error: "Request body too large. Maximum 500KB allowed." },
                { status: 413 }
            )
        }

        const { token, signatureDataUrl } = body

        // Validate required fields
        if (!token || typeof token !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid signing token" },
                { status: 400 }
            )
        }

        if (!signatureDataUrl || typeof signatureDataUrl !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid signature data" },
                { status: 400 }
            )
        }

        // Validate token format
        if (!token.startsWith("sign_") || token.length > 100) {
            return NextResponse.json(
                { error: "Invalid token format" },
                { status: 400 }
            )
        }

        // Validate signature data URL format
        if (!signatureDataUrl.startsWith("data:image/")) {
            return NextResponse.json(
                { error: "Invalid signature image format. Must be a data:image URL." },
                { status: 400 }
            )
        }

        // Create server-side Supabase client
        const supabase = await createServerSupabaseClient()

        // 1. Look up the signature by token
        const { data: signature, error: lookupError } = await supabase
            .from("signatures")
            .select("*, documents(id, type, data, status)")
            .eq("token", token)
            .single()

        if (lookupError || !signature) {
            return NextResponse.json(
                { error: "Invalid or expired signing link" },
                { status: 404 }
            )
        }

        // 2. Check if already signed
        if (signature.signed_at) {
            return NextResponse.json(
                { error: "This document has already been signed" },
                { status: 409 }
            )
        }

        // 3. Check expiry
        if (signature.expires_at && new Date(signature.expires_at) < new Date()) {
            return NextResponse.json(
                { error: "Signing link has expired" },
                { status: 410 }
            )
        }

        // 4. Upload signature image to R2
        let signatureUrl = signatureDataUrl // fallback to data URL
        try {
            const base64Data = signatureDataUrl.split(",")[1]
            if (base64Data) {
                const binaryStr = atob(base64Data)
                const bytes = new Uint8Array(binaryStr.length)
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i)
                }

                const objectKey = `signatures/${signature.id}_${Date.now()}.png`
                await putObject(objectKey, bytes, "image/png")
                signatureUrl = objectKey
            }
        } catch (uploadErr) {
            console.error("Signature upload failed:", uploadErr)
            // Continue with data URL fallback
        }

        // 5. Capture request metadata
        const clientIP = getClientIP(request)
        const userAgent = request.headers.get("user-agent") || "unknown"

        // 6. Update the signature record
        const { error: updateError } = await supabase
            .from("signatures")
            .update({
                signature_image_url: signatureUrl,
                signed_at: new Date().toISOString(),
                ip_address: clientIP,
                user_agent: userAgent,
            })
            .eq("id", signature.id)

        if (updateError) {
            console.error("Signature update error:", updateError)
            return NextResponse.json(
                { error: "Failed to record signature" },
                { status: 500 }
            )
        }

        // 7. Check if ALL signatures for this document are now complete
        const documentId = (signature.documents as { id: string })?.id
        if (documentId) {
            const { data: allSignatures } = await supabase
                .from("signatures")
                .select("signed_at")
                .eq("document_id", documentId)

            const allSigned = allSignatures?.every(
                (s: { signed_at: string | null }) => s.signed_at !== null
            )

            if (allSigned) {
                await supabase
                    .from("documents")
                    .update({ status: "signed" })
                    .eq("id", documentId)
            }
        }

        return NextResponse.json({
            success: true,
            message: "Document signed successfully",
        })
    } catch (error) {
        console.error("Signature submission error:", error)
        return NextResponse.json(
            { error: sanitizeError(error) },
            { status: 500 }
        )
    }
}
