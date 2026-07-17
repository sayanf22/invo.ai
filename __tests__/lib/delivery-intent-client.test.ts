import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth-fetch", () => ({ authFetch: vi.fn() }))

import { authFetch } from "@/lib/auth-fetch"
import {
  classifyDeliveryAction,
  hasDeliveryHint,
  keywordDeliveryAction,
} from "@/lib/delivery-intent-client"

describe("hasDeliveryHint", () => {
  it.each([
    "send it to the client",
    "create a link to send",
    "send via link",
    "share on whatsapp",
    "email this to john@acme.com",
    "resend the doc",
  ])("detects a delivery hint in %j", (msg) => {
    expect(hasDeliveryHint(msg)).toBe(true)
  })

  it.each([
    "change the rate to 500",
    "what is GST?",
    "add a line item for design work",
    "make the title bigger",
  ])("returns false for the non-delivery message %j", (msg) => {
    expect(hasDeliveryHint(msg)).toBe(false)
  })
})

describe("keywordDeliveryAction fallback", () => {
  it.each([
    ["send via link", "link"],
    ["create a link to send", "link"],
    ["get me the shareable link", "link"],
    ["send via email", "email"],
    ["email it to the client", "email"],
    ["share on whatsapp", "whatsapp"],
    ["send it", "send"],
    ["deliver it to the client", "send"],
    ["send for approval", "none"],
    ["what is GST", "none"],
  ] as const)("maps %j → %j", (msg, expected) => {
    expect(keywordDeliveryAction(msg)).toBe(expected)
  })
})

describe("classifyDeliveryAction", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  const ctx = { documentType: "invoice", status: "active" }

  it("uses the model's action when returned", async () => {
    vi.mocked(authFetch).mockResolvedValue({ ok: true, json: async () => ({ action: "link" }) } as Response)
    await expect(classifyDeliveryAction("please generate a link", ctx)).resolves.toBe("link")
  })

  it("falls back to keywords when the route signals fallback", async () => {
    vi.mocked(authFetch).mockResolvedValue({ ok: true, json: async () => ({ action: "none", fallback: true }) } as Response)
    await expect(classifyDeliveryAction("send via email", ctx)).resolves.toBe("email")
  })

  it("falls back to keywords on a network error", async () => {
    vi.mocked(authFetch).mockRejectedValue(new Error("offline"))
    await expect(classifyDeliveryAction("send via link", ctx)).resolves.toBe("link")
  })

  it("falls back to keywords on a non-ok response", async () => {
    vi.mocked(authFetch).mockResolvedValue({ ok: false, json: async () => ({}) } as Response)
    await expect(classifyDeliveryAction("share on whatsapp", ctx)).resolves.toBe("whatsapp")
  })
})
