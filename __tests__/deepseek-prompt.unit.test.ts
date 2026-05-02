/**
 * Unit Tests for System Prompt Changes — lib/deepseek.ts
 *
 * Task 9.3: Write unit tests for system prompt changes
 * Validates: Requirements 6.1, 6.3, 6.5
 */

import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

// Read the deepseek.ts source file to inspect the DUAL_MODE_SYSTEM_PROMPT content
// and getTaxApplyRule function, since DUAL_MODE_SYSTEM_PROMPT is not exported.
const deepseekSource = fs.readFileSync(
  path.resolve(__dirname, "../lib/deepseek.ts"),
  "utf-8"
)

// Extract the DUAL_MODE_SYSTEM_PROMPT template literal content.
// The prompt starts with the backtick after `const DUAL_MODE_SYSTEM_PROMPT = \`` and ends
// at the matching closing backtick before the next top-level declaration.
function extractSystemPrompt(source: string): string {
  const marker = "const DUAL_MODE_SYSTEM_PROMPT = `"
  const startIdx = source.indexOf(marker)
  if (startIdx === -1) throw new Error("DUAL_MODE_SYSTEM_PROMPT not found in source")

  const contentStart = startIdx + marker.length
  // Find the closing backtick — it's the first unescaped backtick after the opening
  let i = contentStart
  while (i < source.length) {
    if (source[i] === "\\" && i + 1 < source.length) {
      i += 2 // skip escaped character
      continue
    }
    if (source[i] === "`") break
    i++
  }
  return source.slice(contentStart, i)
}

const systemPrompt = extractSystemPrompt(deepseekSource)

// ── Test 1: System prompt no longer contains country blocks (Req 6.1) ──

describe("System prompt no longer contains hardcoded country blocks", () => {
  /**
   * **Validates: Requirement 6.1**
   *
   * THE System_Prompt SHALL have the Country_Blocks (lines 242–549 covering
   * all 11 countries) removed from the DUAL_MODE_SYSTEM_PROMPT constant.
   */

  it("does NOT contain country flag + name headers for any of the 11 countries", () => {
    const countryHeaders = [
      "🇮🇳 INDIA",
      "🇺🇸 USA",
      "🇬🇧 UK",
      "🇩🇪 GERMANY",
      "🇨🇦 CANADA",
      "🇦🇺 AUSTRALIA",
      "🇸🇬 SINGAPORE",
      "🇦🇪 UAE",
      "🇵🇭 PHILIPPINES",
      "🇫🇷 FRANCE",
      "🇳🇱 NETHERLANDS",
    ]

    for (const header of countryHeaders) {
      expect(systemPrompt).not.toContain(header)
    }
  })

  it("does NOT contain hardcoded country-specific tax rates", () => {
    // These are specific tax rate strings that were in the old country blocks
    const hardcodedTaxRates = [
      "GST rates in India: 0%",
      "VAT standard rate: 19%",
      "VAT standard rate: 20%",
      "Sales tax varies by state",
      "GST rate: 9%",
      "VAT rate: 5%",
      "VAT rate: 12%",
      "BTW standard rate: 21%",
      "TVA standard rate: 20%",
    ]

    for (const rate of hardcodedTaxRates) {
      expect(systemPrompt).not.toContain(rate)
    }
  })

  it("DOES contain the RAG dynamic placeholder", () => {
    expect(systemPrompt).toContain(
      "Country-specific compliance rules are provided dynamically"
    )
  })

  it("DOES reference COMPLIANCE CONTEXT section for dynamic rules", () => {
    expect(systemPrompt).toContain("COMPLIANCE CONTEXT")
  })
})

// ── Test 2: System prompt retains getTaxApplyRule reference (Req 6.3) ──

describe("System prompt retains getTaxApplyRule and TAX_REGISTRATION_STATUS", () => {
  /**
   * **Validates: Requirement 6.3**
   *
   * THE System_Prompt SHALL retain the getTaxApplyRule function and all
   * TAX_REGISTRATION_STATUS handling logic unchanged.
   */

  it("source file contains getTaxApplyRule function definition", () => {
    expect(deepseekSource).toContain("function getTaxApplyRule")
  })

  it("system prompt contains TAX_REGISTRATION_STATUS reference", () => {
    expect(systemPrompt).toContain("TAX_REGISTRATION_STATUS")
  })

  it("source file exports or uses getTaxApplyRule in buildPrompt", () => {
    // getTaxApplyRule is called inside buildPrompt to generate the tax status block
    expect(deepseekSource).toContain("getTaxApplyRule(")
  })
})

// ── Test 3: System prompt retains all non-compliance sections (Req 6.5) ──

describe("System prompt retains all non-compliance sections", () => {
  /**
   * **Validates: Requirement 6.5**
   *
   * THE System_Prompt SHALL retain all non-compliance sections: math rules,
   * content rules, core rules, business understanding, smart extraction,
   * template detection, payment terms, output schemas, legal disclaimer,
   * and prompt injection defense.
   */

  const requiredSections = [
    { name: "Math rules", marker: "MATH" },
    { name: "Content rules", marker: "CONTENT RULES" },
    { name: "Core rules", marker: "CORE RULES" },
    { name: "Business understanding", marker: "UNDERSTANDING THE USER" },
    { name: "Smart extraction", marker: "SMART EXTRACTION" },
    { name: "Template detection", marker: "TEMPLATE" },
    { name: "Payment terms", marker: "PAYMENT TERMS" },
    { name: "Output schema", marker: "OUTPUT SCHEMA" },
    { name: "Legal disclaimer", marker: "LEGAL DISCLAIMER" },
    { name: "Prompt injection defense", marker: "PROMPT INJECTION DEFENSE" },
  ]

  for (const section of requiredSections) {
    it(`retains "${section.name}" section`, () => {
      expect(systemPrompt.toUpperCase()).toContain(section.marker.toUpperCase())
    })
  }
})
