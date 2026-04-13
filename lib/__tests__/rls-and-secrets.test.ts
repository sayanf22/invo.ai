/**
 * Integration tests for Database RLS and Secret Management (Task 13)
 *
 * Since we can't connect to a real database in unit tests, these tests verify:
 * 1. The SQL migration content contains correct RLS statements for all tables
 * 2. The signatures table RLS policies enforce public read by token + owner-only write
 * 3. The validateRequiredSecrets() function works correctly
 * 4. Razorpay key secret is not exposed in wrangler.json vars
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fs from "fs"
import * as path from "path"

// ============================================================================
// 13.1 & 13.2: SQL Migration RLS Verification
// ============================================================================

describe("RLS Migration SQL", () => {
    const migrationPath = path.resolve(
        __dirname,
        "../../supabase/migrations/security_hardening_rls.sql"
    )
    let migrationSQL: string

    beforeEach(() => {
        migrationSQL = fs.readFileSync(migrationPath, "utf-8")
    })

    const RLS_TABLES = [
        "profiles",
        "businesses",
        "documents",
        "document_versions",
        "signatures",
        "compliance_rules",
        "audit_logs",
        "user_usage",
        "payment_history",
        "subscriptions",
        "chat_messages",
    ]

    it("should enable RLS on all required tables", () => {
        for (const table of RLS_TABLES) {
            const pattern = new RegExp(
                `ALTER\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
                "i"
            )
            expect(migrationSQL).toMatch(pattern)
        }
    })

    it("should be idempotent (uses IF EXISTS and exception handling)", () => {
        // Check ALTER TABLE uses IF EXISTS
        for (const table of RLS_TABLES) {
            expect(migrationSQL).toContain(`ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY`)
        }
        // Check policy creation uses exception handling for idempotency
        expect(migrationSQL).toContain("WHEN duplicate_object THEN NULL")
    })

    // 13.2: Verify signatures table RLS policies
    describe("Signatures table RLS policies", () => {
        it("should allow public read access by token", () => {
            expect(migrationSQL).toContain("Public read signatures by token")
            expect(migrationSQL).toMatch(/FOR\s+SELECT/i)
            expect(migrationSQL).toMatch(/token\s+IS\s+NOT\s+NULL/i)
        })

        it("should restrict insert to document owners via auth.uid()", () => {
            expect(migrationSQL).toContain("Document owners can insert signatures")
            expect(migrationSQL).toMatch(/FOR\s+INSERT/i)
            expect(migrationSQL).toContain("auth.uid()")
        })

        it("should restrict update to document owners via auth.uid()", () => {
            expect(migrationSQL).toContain("Document owners can update signatures")
            expect(migrationSQL).toMatch(/FOR\s+UPDATE/i)
        })

        it("should restrict delete to document owners via auth.uid()", () => {
            expect(migrationSQL).toContain("Document owners can delete signatures")
            expect(migrationSQL).toMatch(/FOR\s+DELETE/i)
        })

        it("should allow service role to update signatures for signing endpoint", () => {
            expect(migrationSQL).toContain("Service role can update signatures")
        })

        it("should join documents to businesses to verify ownership", () => {
            // The policy should check document ownership through the businesses table
            expect(migrationSQL).toContain("documents d")
            expect(migrationSQL).toContain("businesses b")
            expect(migrationSQL).toContain("b.user_id = auth.uid()")
        })
    })
})

// ============================================================================
// 13.3: Secret Validation Tests
// ============================================================================

describe("validateRequiredSecrets", () => {
    const originalEnv = process.env

    beforeEach(() => {
        // Reset modules to get fresh import
        vi.resetModules()
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    it("should pass when all required secrets are present", async () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-value"
        process.env.CSRF_SECRET = "test-csrf-secret-value"

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        expect(() => validateRequiredSecrets()).not.toThrow()
    })

    it("should throw when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-value"
        process.env.CSRF_SECRET = "test-csrf-secret-value"

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        expect(() => validateRequiredSecrets()).toThrow("Missing required secrets")
        expect(() => validateRequiredSecrets()).toThrow("NEXT_PUBLIC_SUPABASE_URL")
    })

    it("should throw when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        process.env.CSRF_SECRET = "test-csrf-secret-value"

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        expect(() => validateRequiredSecrets()).toThrow("Missing required secrets")
        expect(() => validateRequiredSecrets()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    })

    it("should throw when CSRF_SECRET is missing", async () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-value"
        delete process.env.CSRF_SECRET

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        expect(() => validateRequiredSecrets()).toThrow("Missing required secrets")
        expect(() => validateRequiredSecrets()).toThrow("CSRF_SECRET")
    })

    it("should list all missing secrets in a single error", async () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        delete process.env.CSRF_SECRET

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        try {
            validateRequiredSecrets()
            expect.fail("Should have thrown")
        } catch (e: unknown) {
            const msg = (e as Error).message
            expect(msg).toContain("NEXT_PUBLIC_SUPABASE_URL")
            expect(msg).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY")
            expect(msg).toContain("CSRF_SECRET")
        }
    })

    it("should treat empty string values as missing", async () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = ""
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-value"
        process.env.CSRF_SECRET = "test-csrf-secret-value"

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        expect(() => validateRequiredSecrets()).toThrow("NEXT_PUBLIC_SUPABASE_URL")
    })

    it("should treat whitespace-only values as missing", async () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "   "
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key-value"
        process.env.CSRF_SECRET = "test-csrf-secret-value"

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        expect(() => validateRequiredSecrets()).toThrow("NEXT_PUBLIC_SUPABASE_URL")
    })

    it("should include remediation guidance in error message", async () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        delete process.env.CSRF_SECRET

        const { validateRequiredSecrets } = await import("@/lib/secrets")
        try {
            validateRequiredSecrets()
            expect.fail("Should have thrown")
        } catch (e: unknown) {
            const msg = (e as Error).message
            expect(msg).toContain("environment variables")
        }
    })
})

// ============================================================================
// 13.4: Razorpay Key Secret Not in wrangler.json
// ============================================================================

describe("Razorpay secret not in wrangler.json", () => {
    it("should not contain RAZORPAY_KEY_SECRET in wrangler.json vars", () => {
        const wranglerPath = path.resolve(__dirname, "../../wrangler.json")
        const wranglerContent = JSON.parse(fs.readFileSync(wranglerPath, "utf-8"))

        // Verify RAZORPAY_KEY_SECRET is not in vars
        expect(wranglerContent.vars).toBeDefined()
        expect(wranglerContent.vars).not.toHaveProperty("RAZORPAY_KEY_SECRET")
    })

    it("should not contain RAZORPAY_SECRET in wrangler.json vars", () => {
        const wranglerPath = path.resolve(__dirname, "../../wrangler.json")
        const wranglerContent = JSON.parse(fs.readFileSync(wranglerPath, "utf-8"))

        // Also check for common alternative names
        expect(wranglerContent.vars).not.toHaveProperty("RAZORPAY_SECRET")
        expect(wranglerContent.vars).not.toHaveProperty("RAZORPAY_KEY_SECRET")
    })

    it("should not contain any secret-like Razorpay values in wrangler.json vars", () => {
        const wranglerPath = path.resolve(__dirname, "../../wrangler.json")
        const wranglerContent = JSON.parse(fs.readFileSync(wranglerPath, "utf-8"))

        const vars = wranglerContent.vars || {}
        const razorpaySecretKeys = Object.keys(vars).filter(
            (key) => key.toUpperCase().includes("RAZORPAY") && key.toUpperCase().includes("SECRET")
        )
        expect(razorpaySecretKeys).toHaveLength(0)
    })
})
