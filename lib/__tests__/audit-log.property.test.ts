/**
 * Property-based tests for audit-log module
 * Feature: security-hardening, Property 16: Audit logger non-blocking behavior
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import { logAudit, type AuditAction } from "@/lib/audit-log"

// ── Property 16: Audit logger non-blocking behavior ────────────────────

describe("Feature: security-hardening, Property 16: Audit logger non-blocking behavior", () => {
    /**
     * Validates: Requirements 10.4
     *
     * For any audit log operation that fails (database insert error, network
     * timeout), the logAudit function SHALL catch the error, log it to the
     * server console, and SHALL NOT throw or reject — ensuring the original
     * request completes unaffected.
     */

    const AUDIT_ACTIONS: AuditAction[] = [
        "document.create",
        "document.update",
        "document.delete",
        "document.export",
        "document.sign",
        "signature.create",
        "signature.complete",
        "business.create",
        "business.update",
        "auth.login",
        "auth.logout",
        "auth.signup",
        "compliance.query",
        "ai.generate",
        "ai.onboarding",
        "payment.verify",
        "payment.webhook",
        "security.csrf_failure",
        "security.rate_limit",
        "security.auth_failure",
        "security.origin_failure",
        "security.payment_failure",
        "security.brute_force_block",
    ]

    beforeEach(() => {
        vi.restoreAllMocks()
    })

    /** Helper: create a mock Supabase client whose insert returns an error */
    function createFailingSupabase(error: unknown) {
        return {
            from: () => ({
                insert: () => Promise.resolve({ error }),
            }),
        } as any
    }

    /** Helper: create a mock Supabase client whose insert rejects */
    function createThrowingSupabase(error: unknown) {
        return {
            from: () => ({
                insert: () => Promise.reject(error),
            }),
        } as any
    }

    /** Helper: create a mock Supabase client whose from() throws synchronously */
    function createFromThrowingSupabase(error: unknown) {
        return {
            from: () => { throw error },
        } as any
    }

    it("never throws when database insert returns an error", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...AUDIT_ACTIONS),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 200 }),
                async (action, userId, errorMessage) => {
                    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
                    const supabase = createFailingSupabase({ message: errorMessage, code: "PGRST500" })

                    // logAudit must resolve (not reject or throw)
                    await expect(
                        logAudit(supabase, { user_id: userId, action })
                    ).resolves.toBeUndefined()

                    consoleSpy.mockRestore()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("never throws when database insert rejects with an exception", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...AUDIT_ACTIONS),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 200 }),
                async (action, userId, errorMessage) => {
                    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
                    const supabase = createThrowingSupabase(new Error(errorMessage))

                    await expect(
                        logAudit(supabase, { user_id: userId, action })
                    ).resolves.toBeUndefined()

                    consoleSpy.mockRestore()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("never throws when supabase.from() throws synchronously", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...AUDIT_ACTIONS),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 200 }),
                async (action, userId, errorMessage) => {
                    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
                    const supabase = createFromThrowingSupabase(new Error(errorMessage))

                    await expect(
                        logAudit(supabase, { user_id: userId, action })
                    ).resolves.toBeUndefined()

                    consoleSpy.mockRestore()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("logs errors to console.error when insert fails", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...AUDIT_ACTIONS),
                fc.string({ minLength: 1, maxLength: 50 }),
                async (action, userId) => {
                    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
                    const dbError = { message: "connection refused", code: "ECONNREFUSED" }
                    const supabase = createFailingSupabase(dbError)

                    await logAudit(supabase, { user_id: userId, action })

                    expect(consoleSpy).toHaveBeenCalled()
                    consoleSpy.mockRestore()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("resolves to undefined for all action types regardless of failure mode", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...AUDIT_ACTIONS),
                fc.constantFrom("insert_error", "promise_reject", "sync_throw") as fc.Arbitrary<string>,
                fc.string({ minLength: 1, maxLength: 50 }),
                async (action, failureMode, userId) => {
                    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

                    let supabase: any
                    if (failureMode === "insert_error") {
                        supabase = createFailingSupabase({ message: "fail" })
                    } else if (failureMode === "promise_reject") {
                        supabase = createThrowingSupabase(new Error("network timeout"))
                    } else {
                        supabase = createFromThrowingSupabase(new Error("crash"))
                    }

                    const result = await logAudit(supabase, { user_id: userId, action })
                    expect(result).toBeUndefined()

                    consoleSpy.mockRestore()
                }
            ),
            { numRuns: 100 }
        )
    })
})
