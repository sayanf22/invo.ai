import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function hashRateLimitIdentifier(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value || "unknown")
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function checkPublicRateLimit(
    db: SupabaseClient,
    identifier: string,
    category: string,
    maxRequests: number,
    windowSeconds: number,
): Promise<NextResponse | null> {
    const { data, error } = await (db.rpc as any)("check_public_rate_limit", {
        p_identifier_hash: await hashRateLimitIdentifier(identifier),
        p_category: category,
        p_max_requests: maxRequests,
        p_window_seconds: windowSeconds,
    })
    if (error) {
        console.error("Public rate limit failed:", error)
        return NextResponse.json({ error: "Request verification temporarily unavailable" }, { status: 503 })
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row.allowed !== "boolean") {
        return NextResponse.json({ error: "Request verification temporarily unavailable" }, { status: 503 })
    }
    if (!row.allowed) {
        return NextResponse.json({ error: "Too many requests. Please try again later." }, {
            status: 429,
            headers: { "Retry-After": String(row.retry_after ?? windowSeconds) },
        })
    }
    return null
}
