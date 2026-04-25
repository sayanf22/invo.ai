/**
 * POST /api/recurring/process
 *
 * Called by Supabase cron job daily at 9 AM UTC.
 * Finds all active recurring invoices due today and creates new linked sessions.
 * Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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
  // Verify cron secret
  const secret = request.headers.get("x-cron-secret")
  if (secret !== process.env.CRON_SECRET) {
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

      const parentContext = (sourceSession.context ?? {}) as Record<string, any>

      // Build new context: copy everything, increment invoice number, update dates
      const newContext: Record<string, any> = { ...parentContext }
      newContext.invoiceNumber = incrementInvoiceNumber(parentContext.invoiceNumber)
      newContext.issueDate = now.toISOString().slice(0, 10)
      newContext.dueDate = computeNextDueDate(rec.frequency)
      // Clear payment status fields
      delete newContext.status
      delete newContext.paidAt
      delete newContext.paymentLink

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

      // Create document link
      await supabase
        .from("document_links")
        .insert({
          parent_session_id: sourceSession.id,
          child_session_id: newSession.id,
          relationship: "recurring",
        })

      // Increment document count
      await (supabase as any).rpc("increment_document_count", {
        p_user_id: sourceSession.user_id,
        p_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      })

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
