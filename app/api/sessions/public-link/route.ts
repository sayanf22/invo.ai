import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { getPublicDocumentUrl } from "@/lib/public-capability"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error
  const rateError = await checkRateLimit(auth.user.id, "general", auth.supabase as any)
  if (rateError) return rateError

  const sessionId = request.nextUrl.searchParams.get("sessionId") || ""
  if (!UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("document_sessions")
    .select("public_id")
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)
    .maybeSingle()

  if (error) {
    console.error("[sessions/public-link] lookup failed:", error)
    return NextResponse.json({ error: "Failed to load public link" }, { status: 500 })
  }
  if (!data?.public_id) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  return NextResponse.json(
    { publicId: data.public_id, publicUrl: getPublicDocumentUrl(data.public_id, "d") },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
