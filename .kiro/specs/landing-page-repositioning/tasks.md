# Implementation Plan: Landing Page Repositioning

## Overview

Apply text-only copy changes across 13 landing page components and 1 internal page to reposition Clorefy from a generic "AI document generator" to a professional-authority platform for freelancers, agencies, and small service businesses. All changes are string replacements — no UI, layout, or structural modifications.

## Tasks

- [x] 1. Update Hero Section copy
  - [x] 1.1 Update FlipWords array and gradients in `components/landing/hero-section.tsx`
    - Expand `words` array from `["invoices", "contracts", "proposals", "quotations"]` to `["invoices", "contracts", "proposals", "NDAs", "SOWs"]`
    - Add 5th gradient string for "SOWs": `"linear-gradient(120deg, #334155 0%, #475569 50%, #1e293b 100%)"`
    - _Requirements: 1.4, 14.3, 16.2_

  - [x] 1.2 Update hero subtitle in `components/landing/hero-section.tsx`
    - Replace old subtitle with: "Describe your document in plain English. Clorefy generates it with your business details, country-compliant tax rules for 11 countries, and a payment link — ready to send in under 30 seconds."
    - _Requirements: 1.1, 1.2, 1.5_

- [ ] 2. Update Stats Section copy
  - [x] 2.1 Update section heading and stats array in `components/landing/stats-section.tsx`
    - Change heading from "The impact of automation" to "The cost of manual documents"
    - Replace all 4 stats objects with new label/detail/value/suffix values (preserve icon, bg, duration fields)
    - New stats: "Hours lost monthly" (5+), "Higher cash-flow risk" (3×), "Compliance error rate" (22%), "Countries supported" (11)
    - _Requirements: 2.1, 2.2, 2.3, 16.2_

- [ ] 3. Update Why Not ChatGPT Section copy
  - [x] 3.1 Replace both paragraphs in `components/landing/why-not-chatgpt.tsx`
    - First paragraph: Address hallucinations, compliance ignorance, no formatting, no business memory, confidentiality risks
    - Second paragraph: Position Clorefy's 9+ document types, 11-country compliance, pre-filled details, payment links, professional formatting
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 14.1, 15.3_

- [x] 4. Update Persona Tabs copy
  - [x] 4.1 Update persona title and desc fields in `components/landing/persona-tabs.tsx`
    - Update Students persona: "Professional docs from day one" + new desc
    - Update Agencies persona: "Stop juggling 5 tools that don't talk to each other" + new desc referencing HoneyBook
    - Update Developers persona: "Ship code, not paperwork" + new desc with SOW/tax rules
    - Update Creators persona: "Get paid faster for creative work" + new desc
    - Update Leaders persona: "From notes to board-ready documents" + new desc
    - Preserve all other fields (id, label, chat, doc, icon)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 15.1, 16.2_

- [x] 5. Update AI Showcase Section copy
  - [x] 5.1 Update heading, subtitle, and STEPS array in `components/landing/ai-showcase.tsx`
    - Change heading from "From messy thought to masterpiece" to "From prompt to compliant document"
    - Replace subtitle with compliance-focused description
    - Update STEPS: "Describe"/"Comply"/"Deliver" with new descriptions (preserve icon assignments)
    - _Requirements: 5.1, 5.2, 5.3, 16.2_

- [x] 6. Update Features Section copy
  - [x] 6.1 Update section heading, subtitle, and features array in `components/landing/features-section.tsx`
    - Change heading to "Everything your business needs to get paid"
    - Change subtitle to "Generate compliant documents, collect payments, and save 5+ hours a month — from a single prompt."
    - Replace all 6 feature titles and descriptions with business-outcome language (preserve icon, className)
    - New titles: "Prompt-to-Document", "Country-Compliant", "5+ Hours Saved Monthly", "Send & Get Paid", "9+ Document Types", "Integrated Payments"
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 14.1, 16.2_

- [x] 7. Update Multi-Device Section copy
  - [x] 7.1 Update badge, heading, and subtitle in `components/landing/multi-device.tsx`
    - Change badge from "Cross-Platform Sync" to "Work From Anywhere"
    - Change heading from "Everywhere you work" to "Generate documents wherever you are"
    - Replace subtitle with professional context (client meetings, billing windows)
    - _Requirements: 7.1, 7.2_

- [x] 8. Checkpoint - Verify first batch of changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update Testimonials Section copy
  - [x] 9.1 Update section heading and testimonials array in `components/landing/testimonials-section.tsx`
    - Change heading from "Trusted by professionals" to "Trusted by service businesses"
    - Replace entire testimonials array content (6 testimonials) with new names, roles, and content referencing specific pain points
    - Preserve array structure and object shape
    - _Requirements: 8.1, 8.2, 8.3, 16.2_

- [x] 10. Update CTA Section copy
  - [x] 10.1 Update heading and body text in `components/landing/cta-section.tsx`
    - Change heading from "Ready to transform your workflow?" to "Ready to stop doing documents manually?"
    - Replace body text with: "Generate compliant invoices, contracts, and proposals in under 30 seconds. Free plan available — no credit card required."
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 11. Update Still Not Sure Section copy
  - [x] 11.1 Update heading and description in `components/landing/still-not-sure.tsx`
    - Change heading from "STILL NOT SURE THAT CLOREFY IS RIGHT FOR YOU?" to "WANT A SECOND OPINION ON CLOREFY?"
    - Replace description with: "Ask an independent AI to evaluate Clorefy for your business. Click below and see what they find."
    - _Requirements: 10.1, 10.2_

- [x] 12. Update Services Marquee copy
  - [x] 12.1 Update tagline and services array in `components/landing/services-marquee.tsx`
    - Change tagline from "Every document your business needs" to "9+ document types, 11 countries, one platform"
    - Replace services array with: ["Invoices", "Contracts", "Proposals", "Quotations", "NDAs", "SOWs", "Purchase Orders", "Receipts", "Credit Notes", "Change Orders", "Payment Reminders", "Onboarding Forms"]
    - _Requirements: 11.1, 11.2, 11.3, 14.3_

- [x] 13. Update Pricing Page copy
  - [x] 13.1 Update hero pill text in `app/pricing/page.tsx`
    - Change from "2,400+ professionals save hours every week" to "2,400+ service businesses generate documents with Clorefy"
    - _Requirements: 13.1, 13.2_

- [x] 14. Final checkpoint - Verify all changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 15. Property-based tests for copy integrity
  - [ ]* 15.1 Write property test: No Four-Docs Limitation References
    - **Property 1: No Four-Docs Limitation References**
    - Verify no text field contains "4 document types" or enumerates only "invoices, contracts, quotations, and proposals" as the complete set
    - **Validates: Requirements 4.4, 6.4, 11.3, 12.2, 13.3, 14.1, 14.2**

  - [ ]* 15.2 Write property test: No Casual Language in AI Showcase
    - **Property 2: No Casual Language in AI Showcase**
    - Verify AI Showcase text fields don't contain "messy thought", "rough ideas", "masterpiece", or "raw thoughts"
    - **Validates: Requirements 5.1, 5.3**

  - [ ]* 15.3 Write property test: No Inflated User Counts in CTA
    - **Property 3: No Inflated Unverifiable User Counts in CTA**
    - Verify CTA section doesn't contain "10,000+" or any five-digit-or-higher user count
    - **Validates: Requirements 9.2**

  - [ ]* 15.4 Write property test: Generic Feature Titles Removed
    - **Property 5: Generic Feature Titles Removed**
    - Verify features array titles don't contain "Text-to-Document", "AI Formatting", or "Custom Templates"
    - **Validates: Requirements 6.3**

  - [ ]* 15.5 Write property test: Services Marquee Reflects 9+ Types
    - **Property 6: Services Marquee Reflects 9+ Document Types**
    - Verify services array contains at least 9 items including at least one of: "NDAs", "SOWs", "Purchase Orders", "Credit Notes"
    - **Validates: Requirements 11.1, 14.3**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are text-only — no UI, layout, animation, or structural modifications
- Preserve all non-text fields in arrays (icon, className, bg, duration, href)
- The only "structural" addition is a 5th item in the FlipWords words/gradients arrays (task 1.1)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after batches of changes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "6.1", "7.1", "9.1", "10.1"] },
    { "id": 2, "tasks": ["11.1", "12.1", "13.1"] },
    { "id": 3, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5"] }
  ]
}
```
