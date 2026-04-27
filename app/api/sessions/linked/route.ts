/**
 * Linked Sessions API
 * Returns all sessions in the same document chain.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // Rate limit: general category (120 req/min)
        const rateLimitError = await checkRateLimit(auth.user.id, "general")
        if (rateLimitError) return rateLimitError

        const sessionId = request.nextUrl.searchParams.get("sessionId")
        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: "sessionId query parameter is required" },
                { status: 400 }
            )
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(sessionId)) {
            return NextResponse.json(
                { success: false, error: "Invalid sessionId" },
                { status: 400 }
            )
        }

        // First get the session to find its chain_id
        const { data: session, error: sessionError } = await auth.supabase
            .from("document_sessions")
            .select("id, chain_id")
            .eq("id", sessionId)
            .eq("user_id", auth.user.id)
            .single()

        if (sessionError || !session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        const chainId = session.chain_id
        if (!chainId) {
            // No chain — return just this session
            return NextResponse.json({
                success: true,
                chain: [],
                currentSessionId: sessionId,
            })
        }

        // Fetch all sessions in this chain
        const { data: chainSessions, error: chainError } = await auth.supabase
            .from("document_sessions")
            .select("id, document_type, title, client_name, status, created_at")
            .eq("chain_id", chainId)
            .eq("user_id", auth.user.id)
            .order("created_at", { ascending: true })

        if (chainError) {
            console.error("Error fetching chain:", chainError)
            return NextResponse.json(
                { success: false, error: "Failed to fetch document chain" },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            chain: chainSessions || [],
            currentSessionId: sessionId,
            chainId,
        })
    } catch (error) {
        console.error("Error in linked sessions:", error)
        return NextResponse.json(
            { success: false, error: sanitizeError(error) },
            { status: 500 }
        )
    }
}
