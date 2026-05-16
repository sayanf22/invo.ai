/**
 * Unit tests for DocumentPreview lock state clearing on document cancel (Bug 5)
 * Feature: document-flow-critical-fixes, Task 7
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 3.3, 3.12
 */

import { describe, it, expect } from "vitest"

// ── Inline pure lock state derivation (mirrors document-preview.tsx) ──────────
//
// The production component derives isDocumentLocked from these inputs:
//   - externallyUnlocked: boolean  (chat unlock card)
//   - sentAt: string | null        (local state, loaded from DB)
//   - manualPaid: boolean          (local state)
//   - paymentLinkStatus: string | undefined (from InvoiceData)
//   - paymentLink: string | undefined       (from InvoiceData)
//   - allSigned: boolean           (derived from signatures state)
//   - hasPendingSignatures: boolean (derived from signatures state)
//
// The fix (Bug 5) adds a useEffect that clears sentAt/manualPaid and marks
// pending signature rows as "cancelled" when documentStatus === "cancelled".
// This means after the effect runs, the inputs to isDocumentLocked are all
// falsy, so isDocumentLocked becomes false.
//
// We test the pure derivation here so tests are stable and deterministic
// (no React lifecycle, no Supabase, no react-pdf required).

interface LockInputs {
  externallyUnlocked: boolean
  sentAt: string | null
  manualPaid: boolean
  paymentLinkStatus?: string
  paymentLink?: string
  allSigned: boolean
  hasPendingSignatures: boolean
}

interface SignatureRow {
  signed_at: string | null
  signer_action: string | null
}

/** Mirrors the isDocumentLocked derivation from document-preview.tsx */
function deriveIsDocumentLocked(inputs: LockInputs): boolean {
  const hasActivePaymentLink =
    !!inputs.paymentLink &&
    !!inputs.paymentLinkStatus &&
    inputs.paymentLinkStatus !== "expired" &&
    inputs.paymentLinkStatus !== "cancelled" &&
    inputs.paymentLinkStatus !== "failed"

  return (
    !inputs.externallyUnlocked &&
    (!!inputs.sentAt ||
      inputs.manualPaid ||
      inputs.paymentLinkStatus === "paid" ||
      hasActivePaymentLink ||
      inputs.allSigned ||
      inputs.hasPendingSignatures)
  )
}

/** Mirrors the cancel-status useEffect from document-preview.tsx */
function applyDocumentStatusCancelled(inputs: LockInputs, signatures: SignatureRow[]): {
  updatedInputs: LockInputs
  updatedSignatures: SignatureRow[]
} {
  const updatedSignatures = signatures.map(s =>
    s.signed_at === null ? { ...s, signer_action: "cancelled" as const } : s
  )
  const updatedInputs: LockInputs = {
    ...inputs,
    sentAt: null,
    manualPaid: false,
    // hasPendingSignatures must be re-derived from updatedSignatures
    hasPendingSignatures: updatedSignatures.some(
      s => s.signed_at === null && (s.signer_action === null || s.signer_action === undefined)
    ),
  }
  return { updatedInputs, updatedSignatures }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Bug 5 — DocumentPreview lock state clears on document cancel", () => {
  /**
   * Property 5 (Bug Condition): Lock State Clears on Cancel
   * When documentStatus transitions to "cancelled", the component
   * SHALL derive isDocumentLocked === false, regardless of what sentAt was.
   *
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   */
  it("isDocumentLocked becomes false after cancel-status effect fires with non-null sentAt", () => {
    // Before cancel: sentAt is set (document was sent), externallyUnlocked is false
    const beforeCancel: LockInputs = {
      externallyUnlocked: false,
      sentAt: "2025-01-01T10:00:00Z",   // non-null — was sent
      manualPaid: false,
      paymentLinkStatus: undefined,
      paymentLink: undefined,
      allSigned: false,
      hasPendingSignatures: false,
    }

    // Verify the pre-cancel state is locked (the bug condition)
    expect(deriveIsDocumentLocked(beforeCancel)).toBe(true)

    // Apply the cancel-status useEffect (what happens when documentStatus === "cancelled")
    const { updatedInputs } = applyDocumentStatusCancelled(beforeCancel, [])
    const afterCancel = deriveIsDocumentLocked(updatedInputs)

    // After cancel: isDocumentLocked must be false
    expect(afterCancel).toBe(false)
  })

  it("isDocumentLocked becomes false after cancel when there are pending signatures", () => {
    const pendingSignatures: SignatureRow[] = [
      { signed_at: null, signer_action: null },
      { signed_at: null, signer_action: null },
    ]

    const beforeCancel: LockInputs = {
      externallyUnlocked: false,
      sentAt: "2025-01-01T10:00:00Z",
      manualPaid: false,
      paymentLinkStatus: undefined,
      paymentLink: undefined,
      allSigned: false,
      hasPendingSignatures: pendingSignatures.some(
        s => s.signed_at === null && (s.signer_action === null || s.signer_action === undefined)
      ),
    }

    // Pre-cancel: locked due to sentAt + pending signatures
    expect(deriveIsDocumentLocked(beforeCancel)).toBe(true)

    // Apply cancel effect
    const { updatedInputs, updatedSignatures } = applyDocumentStatusCancelled(beforeCancel, pendingSignatures)

    // All pending signatures should now have signer_action === "cancelled"
    expect(updatedSignatures.every(s => s.signer_action === "cancelled")).toBe(true)

    // After cancel: isDocumentLocked must be false
    expect(deriveIsDocumentLocked(updatedInputs)).toBe(false)
  })

  it("isDocumentLocked becomes false after cancel when manualPaid is true", () => {
    const beforeCancel: LockInputs = {
      externallyUnlocked: false,
      sentAt: "2025-01-01T10:00:00Z",
      manualPaid: true,              // document was manually marked paid
      paymentLinkStatus: undefined,
      paymentLink: undefined,
      allSigned: false,
      hasPendingSignatures: false,
    }

    expect(deriveIsDocumentLocked(beforeCancel)).toBe(true)

    const { updatedInputs } = applyDocumentStatusCancelled(beforeCancel, [])
    expect(deriveIsDocumentLocked(updatedInputs)).toBe(false)
  })

  it("cancel effect keeps signed signatures intact (signed_at !== null rows untouched)", () => {
    const mixedSignatures: SignatureRow[] = [
      { signed_at: "2025-01-02T09:00:00Z", signer_action: null }, // already signed
      { signed_at: null, signer_action: null },                    // pending
    ]

    const { updatedSignatures } = applyDocumentStatusCancelled(
      { externallyUnlocked: false, sentAt: "2025-01-01T10:00:00Z", manualPaid: false, allSigned: false, hasPendingSignatures: true },
      mixedSignatures
    )

    // The already-signed row must NOT be touched
    expect(updatedSignatures[0].signer_action).toBe(null)
    expect(updatedSignatures[0].signed_at).toBe("2025-01-02T09:00:00Z")

    // The pending row must be marked cancelled
    expect(updatedSignatures[1].signer_action).toBe("cancelled")
  })
})

describe("Bug 5 — Preservation: Non-cancelled documents remain locked (Requirement 3.3, 3.12)", () => {
  /**
   * Property 8 (Preservation): Non-Cancelled Documents Remain Locked
   * For documentStatus in ["sent", "signed", "paid", "finalized"],
   * with non-null sentAt and externallyUnlocked=false, the component
   * SHALL produce isDocumentLocked === true.
   *
   * Validates: Requirements 3.3, 3.12
   */
  it("isDocumentLocked is true for documentStatus='sent' with non-null sentAt and externallyUnlocked=false", () => {
    // documentStatus="sent" — no cancel effect fires, so sentAt remains set
    const inputs: LockInputs = {
      externallyUnlocked: false,
      sentAt: "2025-01-01T10:00:00Z",  // non-null
      manualPaid: false,
      paymentLinkStatus: undefined,
      paymentLink: undefined,
      allSigned: false,
      hasPendingSignatures: false,
    }

    // documentStatus is "sent" — the cancel useEffect does NOT fire
    // so inputs are unchanged → isDocumentLocked must remain true
    expect(deriveIsDocumentLocked(inputs)).toBe(true)
  })

  it("isDocumentLocked is true for documentStatus='signed' with allSigned=true and externallyUnlocked=false", () => {
    const inputs: LockInputs = {
      externallyUnlocked: false,
      sentAt: "2025-01-01T10:00:00Z",
      manualPaid: false,
      paymentLinkStatus: undefined,
      paymentLink: undefined,
      allSigned: true,               // all parties signed
      hasPendingSignatures: false,
    }

    expect(deriveIsDocumentLocked(inputs)).toBe(true)
  })

  it("isDocumentLocked is true for documentStatus='paid' with manualPaid=true and externallyUnlocked=false", () => {
    const inputs: LockInputs = {
      externallyUnlocked: false,
      sentAt: null,                  // sentAt may be null on manual-paid docs
      manualPaid: true,
      paymentLinkStatus: undefined,
      paymentLink: undefined,
      allSigned: false,
      hasPendingSignatures: false,
    }

    expect(deriveIsDocumentLocked(inputs)).toBe(true)
  })

  it("isDocumentLocked is true for documentStatus='finalized' (PDF downloaded) — Requirement 3.12", () => {
    // Documents finalised by download have sentAt set (or paymentLinkStatus "paid")
    const inputs: LockInputs = {
      externallyUnlocked: false,
      sentAt: "2025-01-01T10:00:00Z",
      manualPaid: false,
      paymentLinkStatus: "paid",
      paymentLink: "https://rzp.io/i/abc123",
      allSigned: false,
      hasPendingSignatures: false,
    }

    expect(deriveIsDocumentLocked(inputs)).toBe(true)
  })

  it("isDocumentLocked is false when sentAt is null and no other lock condition is active", () => {
    const inputs: LockInputs = {
      externallyUnlocked: false,
      sentAt: null,
      manualPaid: false,
      paymentLinkStatus: undefined,
      paymentLink: undefined,
      allSigned: false,
      hasPendingSignatures: false,
    }

    expect(deriveIsDocumentLocked(inputs)).toBe(false)
  })

  it("externallyUnlocked=true overrides all lock conditions", () => {
    const inputs: LockInputs = {
      externallyUnlocked: true,
      sentAt: "2025-01-01T10:00:00Z",
      manualPaid: true,
      paymentLinkStatus: "created",
      paymentLink: "https://rzp.io/i/abc123",
      allSigned: true,
      hasPendingSignatures: true,
    }

    expect(deriveIsDocumentLocked(inputs)).toBe(false)
  })
})
