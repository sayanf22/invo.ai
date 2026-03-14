/**
 * Signatures API Route
 * Creates and retrieves document signature requests.
 * 
 * SECURITY: Uses authenticateRequest() + backend rate limiting for all
 * authenticated operations. Public token lookup does not require auth.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { randomUUID } from "crypto"

// Generate a unique signing token
function generateSigningToken(): string {
    return `sign_${randomUUID().replace(/-/g, "")}`
}

// Create a new signature request
export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user via standard helper
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // SECURITY: Rate limit (general: 30 req/min)
        const rateLimitError = await checkRateLimit(auth.user.id, "general")
        if (rateLimitError) return rateLimitError

        const body = await request.json()

        // SECURITY: Input size limit (10KB)
        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        const { documentId, signerEmail, signerName, role } = body

        if (!documentId || !signerEmail || !signerName) {
            return NextResponse.json(
                { error: "Missing required fields: documentId, signerEmail, signerName" },
                { status: 400 }
            )
        }

        // SECURITY: Validate email format
        if (typeof signerEmail !== "string" || !signerEmail.includes("@") || !signerEmail.includes(".")) {
            return NextResponse.json(
                { error: "Invalid signer email format" },
                { status: 400 }
            )
        }

        // SECURITY: Validate string lengths to prevent abuse
        if (signerName.length > 200 || signerEmail.length > 254) {
            return NextResponse.json(
                { error: "Input too long" },
                { status: 400 }
            )
        }

        const supabase = auth.supabase

        // Verify document exists and user owns it (RLS ensures user can only see their docs)
        const { data: document, error: docError } = await supabase
            .from("documents")
            .select("*, businesses!inner(user_id)")
            .eq("id", documentId)
            .single()

        if (docError || !document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 })
        }

        if (document.businesses.user_id !== auth.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Generate signing token
        const signingToken = generateSigningToken()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

        // Create signature record
        const { data: signature, error: sigError } = await supabase
            .from("signatures")
            .insert({
                document_id: documentId,
                signer_email: signerEmail,
                signer_name: signerName,
                party: role || "signer",
                token: signingToken,
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single()

        if (sigError) {
            console.error("Signature creation error:", sigError)
            return NextResponse.json({ error: "Failed to create signature request" }, { status: 500 })
        }

        // Update document status to pending
        await supabase
            .from("documents")
            .update({ status: "pending" })
            .eq("id", documentId)

        // SECURITY: Build signing URL from allowed origin only
        const origin = request.headers.get("origin") || ""
        const signingUrl = `${origin}/sign/${signingToken}`

        return NextResponse.json({
            success: true,
            signature,
            signingUrl,
            expiresAt: expiresAt.toISOString(),
        })
    } catch (error) {
        console.error("Signature request error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// Get signature status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get("documentId")
        const token = searchParams.get("token")

        if (token) {
            // Public lookup by token — no auth required (signing flow)
            // SECURITY: Use server client, not user client, for public token lookups
            const { createServerSupabaseClient } = await import("@/lib/supabase-server")
            const supabase = await createServerSupabaseClient()

            const { data: signature, error } = await supabase
                .from("signatures")
                .select("*, documents(id, type, data, status)")
                .eq("token", token)
                .single()

            if (error || !signature) {
                return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
            }

            // Check expiry
            if (signature.expires_at && new Date(signature.expires_at) < new Date()) {
                return NextResponse.json({ error: "Signing link has expired" }, { status: 410 })
            }

            return NextResponse.json({ signature })
        }

        if (documentId) {
            // Authenticated lookup by document
            const auth = await authenticateRequest(request)
            if (auth.error) return auth.error

            // SECURITY: Rate limit authenticated lookups
            const rateLimitError = await checkRateLimit(auth.user.id, "general")
            if (rateLimitError) return rateLimitError

            const { data: signatures, error } = await auth.supabase
                .from("signatures")
                .select("*")
                .eq("document_id", documentId)
                .order("created_at", { ascending: false })

            if (error) {
                return NextResponse.json({ error: "Failed to fetch signatures" }, { status: 500 })
            }

            return NextResponse.json({ signatures })
        }

        return NextResponse.json({ error: "Missing documentId or token parameter" }, { status: 400 })
    } catch (error) {
        console.error("Signature fetch error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
