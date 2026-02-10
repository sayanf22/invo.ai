import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

// Placeholder API route for AI processing
export async function POST(request: NextRequest) {
    // SECURITY: Authenticate even placeholder routes
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    return NextResponse.json({ error: "Not implemented" }, { status: 501 })
}
