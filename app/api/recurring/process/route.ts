/**
 * POST /api/recurring/process
 *
 * Called by Supabase cron job daily at 9 AM UTC.
 * Finds all active recurring invoices due today and creates new linked sessions.
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { resolveEffectiveTier } from "@/lib/cost-protection"

function computeNextRunAt(frequency: string, from: Date = new Date()): Date {
  const next = new Date(from)
  switch (frequency) {
    case "weekly":   next.setDate(next.getDate() + 7); break
    case "monthly":  next.setMonth(next.getMonth() + 1); break
    case "quarterly":next.setMonth(next.getMonth() + 3); break
    default:         next.setMonth(next.getMonth() + 1)
  }
  next.setUTCHours(9, 0, 0, 0)
  return next
}

function incrementInvoiceNumber(current: string | undefined): string {
  if (!current) return `INV-${new Date().getFullYear()}-001`
  // Try to find trailing number: INV-2024-001 → INV-2024-002
  const match = current.match(/^(.*?)(\d+)$/)
  if (match) {
    const prefix = match[1]
    const num = parseInt(match[2], 10) + 1
    const padded = String(num).padStart(match[2].length, "0")
    return `${prefix}${padded}`
  }
  return `${current}-2`
}

function computeNextDueDate(frequency: string): string {
  const d = new Date()
  switch (frequency) {
    case "weekly":   d.setDate(d.getDate() + 7); break
    case "monthly":  d.setMonth(d.getMonth() + 1); break
    case "quarterly":d.setMonth(d.getMonth() + 3); break
  }
  return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  // Verify cron secret using timing-safe comparison to prevent timing attacks
  const secret = request.headers.get("x-cron-secret")
  const expectedSecret = process.env.CRON_SECRET

  if (!secret || !expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Timing-safe comparison — prevents timing-based secret enumeration
  let isValid = false
  try {
    const { timingSafeEqual } = await import("crypto")
    const secretBuf = Buffer.from(secret)
    const expectedBuf = Buffer.from(expectedSecret)
    // Must be same length before comparing (timingSafeEqual throws on length mismatch)
    isValid = secretBuf.length === expectedBuf.length && timingSafeEqual(secretBuf, expectedBuf)
  } catch {
    isValid = false
  }

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()

  // Find all active recurring invoices due now or overdue
  const { data: dueRecurring, error: fetchError } = await (supabase as any)
    .from("recurring_invoices")
    .select("*, document_sessions!source_session_id(id, user_id, context, chain_id, client_name)")
    .eq("is_active", true)
    .lte("next_run_at", now.toISOString())
    .limit(100)

  if (fetchError) {
    console.error("[recurring/process] fetch error:", fetchError)
    return NextResponse.json({ error: "Failed to fetch due recurring invoices" }, { status: 500 })
  }

  const results: Array<{ recurringId: string; newSessionId?: string; error?: string }> = []

  for (const rec of dueRecurring ?? []) {
    try {
      const sourceSession = rec.document_sessions
      if (!sourceSession) {
        results.push({ recurringId: rec.id, error: "Source session not found" })
        continue
      }

      // Check if user's subscription is still active
      const { data: userSubscription } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", sourceSession.user_id)
        .single()

      const effectiveTier = resolveEffectiveTier(userSubscription as any)
      if (effectiveTier === "free") {
        // Deactivate recurring invoice for expired user
        await (supabase as any)
          .from("recurring_invoices")
          .update({ is_active: false })
          .eq("id", rec.id)

        // Cancel all pending email schedules for expired user
        await (supabase as any)
          .from("email_schedules")
          .update({ status: "cancelled", cancelled_reason: "subscription_expired" })
          .eq("user_id", sourceSession.user_id)
          .eq("status", "pending")

        results.push({ recurringId: rec.id, error: "Subscription expired — recurring invoice deactivated" })
        continue
      }

      // ── Industry-standard recurring-billing guard (Stripe/QuickBooks) ──────
      // Rule: Never generate a new invoice if the PREVIOUS one is still unpaid.
      //       This prevents stacking overdue invoices on the same client.
      //
      // We check the MOST RECENT invoice in the chain — not just the original
      // source — because by cycle N+2, the "previous" invoice is the one from
      // cycle N+1, not the original source.
      const chainIdForLookup = sourceSession.chain_id || sourceSession.id

      const { data: latestInChain } = await (supabase as any)
        .from("document_sessions")
        .select("id, status, sent_at, context")
        .or(`id.eq.${chainIdForLookup},chain_id.eq.${chainIdForLookup}`)
        .eq("user_id", sourceSession.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const previousSessionId = latestInChain?.id ?? sourceSession.id

      const { data: parentPayment } = await (supabase as any)
        .from("invoice_payments")
        .select("status, expires_at")
        .eq("session_id", previousSessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      // Lazy-expiry check: if the webhook missed, treat an expired timestamp as expired
      const linkHasExpired =
        parentPayment?.expires_at && new Date(parentPayment.expires_at) < now
      const effectiveParentStatus: string | null = parentPayment
        ? (linkHasExpired && parentPayment.status === "created" ? "expired" : parentPayment.status)
        : null

      // Decision matrix:
      //   - paid              → proceed (generate new cycle)
      //   - partially_paid    → pause (collect remainder first)
      //   - created (unpaid)  → pause (previous still outstanding)
      //   - expired/cancelled/failed → pause
      //   - no payment record → session was never paid → treat like unpaid → pause
      //   - session status is already "active" after unlock → sender is editing → pause
      const SHOULD_PAUSE = [
        !parentPayment,
        parentPayment && effectiveParentStatus !== "paid",
        latestInChain?.status && ["active", "draft", "cancelled"].includes(latestInChain.status),
      ].some(Boolean)

      if (SHOULD_PAUSE) {
        const reason = !parentPayment
          ? "no_payment"
          : effectiveParentStatus || "unknown"

        // Pause recurring — owner must take action before new cycles generate
        await (supabase as any)
          .from("recurring_invoices")
          .update({ is_active: false })
          .eq("id", rec.id)

        // Cancel any lingering reminders for the paused invoice
        if (previousSessionId) {
          await (supabase as any)
            .from("email_schedules")
            .update({
              status: "cancelled",
              cancelled_reason: "recurring_paused_unpaid_parent",
              updated_at: now.toISOString(),
            })
            .eq("session_id", previousSessionId)
            .eq("status", "pending")
        }

        // Notify the owner with a clear explanation
        const humanReason = reason === "paid"
          ? "previous cycle editing in progress"
          : reason === "partially_paid"
            ? "previous invoice is only partially paid"
            : reason === "no_payment"
              ? "previous invoice has no payment record"
              : `previous invoice is ${reason}`

        await (supabase as any)
          .from("notifications")
          .insert({
            user_id: sourceSession.user_id,
            type: "general",
            title: "Recurring Invoice Paused",
            message: `We paused the recurring schedule because ${humanReason}. Once resolved, you can re-enable it from the document.`,
            read: false,
            metadata: {
              recurring_id: rec.id,
              source_session_id: sourceSession.id,
              previous_session_id: previousSessionId,
              pause_reason: reason,
            },
          })

        results.push({
          recurringId: rec.id,
          error: `Paused — ${humanReason}`,
        })
        continue
      }

      const parentContext = (sourceSession.context ?? {}) as Record<string, any>

      // Build new context: copy everything, increment invoice number, update dates
      const newContext: Record<string, any> = { ...parentContext }
      newContext.invoiceNumber = incrementInvoiceNumber(parentContext.invoiceNumber)
      newContext.invoiceDate = now.toISOString().slice(0, 10)
      newContext.issueDate = now.toISOString().slice(0, 10)
      newContext.dueDate = computeNextDueDate(rec.frequency)
      // Clear payment status fields
      delete newContext.status
      delete newContext.paidAt
      delete newContext.paymentLink
      delete newContext.paymentLinkStatus
      delete newContext.showPaymentLinkInPdf
      delete newContext.signatureImages

      // Determine chain_id
      const chainId = sourceSession.chain_id || sourceSession.id

      // Ensure source session has chain_id set
      if (!sourceSession.chain_id) {
        await supabase
          .from("document_sessions")
          .update({ chain_id: chainId })
          .eq("id", sourceSession.id)
      }

      // Create new linked session
      const { data: newSession, error: createError } = await supabase
        .from("document_sessions")
        .insert({
          user_id: sourceSession.user_id,
          document_type: "invoice",
          status: "active",
          context: newContext,
          chain_id: chainId,
          client_name: sourceSession.client_name,
        })
        .select("id")
        .single()

      if (createError || !newSession) {
        results.push({ recurringId: rec.id, error: createError?.message ?? "Failed to create session" })
        continue
      }

      const { data: quota, error: quotaError } = await (supabase as any).rpc("reserve_document_quota", {
        p_user_id: sourceSession.user_id,
        p_session_id: newSession.id,
        p_month: now.toISOString().slice(0, 7),
      })
      if (quotaError || !quota?.allowed) {
        await supabase.from("document_sessions").delete().eq("id", newSession.id)
        results.push({ recurringId: rec.id, error: quotaError?.message ?? "Monthly document limit reached" })
        continue
      }

      // Create document link
      await supabase
        .from("document_links")
        .insert({
          parent_session_id: sourceSession.id,
          child_session_id: newSession.id,
          relationship: "recurring",
        })

      // Industry standard: once a new cycle is issued, stop reminding for the
      // PREVIOUS cycle. Reminders should always point to the newest outstanding
      // invoice, never a stale one.
      if (previousSessionId && previousSessionId !== newSession.id) {
        await (supabase as any)
          .from("email_schedules")
          .update({
            status: "cancelled",
            cancelled_reason: "superseded_by_new_cycle",
            updated_at: now.toISOString(),
          })
          .eq("session_id", previousSessionId)
          .eq("status", "pending")
      }

      // Quota was reserved atomically for the new session above.

      // Update recurring record: next_run_at, last_run_at, run_count
      const nextRunAt = computeNextRunAt(rec.frequency, now)
      await (supabase as any)
        .from("recurring_invoices")
        .update({
          next_run_at: nextRunAt.toISOString(),
          last_run_at: now.toISOString(),
          run_count: (rec.run_count ?? 0) + 1,
        })
        .eq("id", rec.id)

      // Create in-app notification for the owner
      await (supabase as any)
        .from("notifications")
        .insert({
          user_id: sourceSession.user_id,
          type: "recurring_invoice_generated",
          title: "Recurring Invoice Generated",
          message: `Invoice ${newContext.invoiceNumber} has been automatically created.`,
          read: false,
          metadata: {
            session_id: newSession.id,
            invoice_number: newContext.invoiceNumber,
            frequency: rec.frequency,
          },
        })

      results.push({ recurringId: rec.id, newSessionId: newSession.id })
    } catch (err) {
      console.error("[recurring/process] error for rec", rec.id, err)
      results.push({ recurringId: rec.id, error: String(err) })
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
    timestamp: now.toISOString(),
  })
}
