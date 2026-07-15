import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP, validateBodySize } from "@/lib/api-auth"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"
import { isPublicDocumentId } from "@/lib/public-capability"

/** Public, non-sensitive view tracking keyed only by the recipient capability. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return NextResponse.json({ ok: true })
    const sizeError = validateBodySize(body, 1024)
    if (sizeError) return sizeError

    const publicId = (body as Record<string, unknown>).publicId
    if (!isPublicDocumentId(publicId)) return NextResponse.json({ ok: true })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ ok: true })
    const db = createClient(url, serviceKey, { auth: { persistSession: false } })

    const rateError = await checkPublicRateLimit(db, getClientIP(request), "document_view_ip", 60, 60)
    if (rateError) return NextResponse.json({ ok: true })

    const { data: session } = await db.from("document_sessions")
      .select("id").eq("public_id", publicId).maybeSingle()
    if (!session) return NextResponse.json({ ok: true })

    const { data: payment } = await db.from("invoice_payments")
      .select("id,view_count,link_viewed_at")
      .eq("session_id", session.id)
      .in("status", ["created", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!payment) return NextResponse.json({ ok: true })
    const now = new Date()
    const lastViewed = payment.link_viewed_at ? new Date(payment.link_viewed_at) : null
    const secondsSinceLastView = lastViewed ? (now.getTime() - lastViewed.getTime()) / 1000 : Infinity

    if (secondsSinceLastView > 60) {
      await db.from("invoice_payments").update({
        view_count: (payment.view_count || 0) + 1,
        link_viewed_at: now.toISOString(),
        updated_at: now.toISOString(),
      }).eq("id", payment.id)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
