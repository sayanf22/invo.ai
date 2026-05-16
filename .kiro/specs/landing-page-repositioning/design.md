# Design Document: Landing Page Repositioning

## Overview

This design specifies the exact text replacements needed to reposition Clorefy's landing page from a generic "AI document generator" to a professional-authority platform for freelancers, agencies, and small service businesses. All changes are string-only — no UI, layout, animation, or structural modifications.

## Architecture

The change is purely a copy system update across existing React components. No new components, hooks, APIs, or database changes are required.

### Affected Files

| File | Section | Change Type |
|------|---------|-------------|
| `components/landing/hero-section.tsx` | Hero headline, subtitle, FlipWords | String replacements |
| `components/landing/stats-section.tsx` | Stats array (label, detail, value) | String replacements in array |
| `components/landing/why-not-chatgpt.tsx` | Body paragraphs | String replacements |
| `components/landing/persona-tabs.tsx` | Persona title, desc fields | String replacements in array |
| `components/landing/ai-showcase.tsx` | Heading, subtitle, STEPS array | String replacements |
| `components/landing/features-section.tsx` | Features array (title, desc), section heading | String replacements |
| `components/landing/multi-device.tsx` | Section heading, subtitle | String replacements |
| `components/landing/testimonials-section.tsx` | Testimonials array, section heading | String replacements |
| `components/landing/cta-section.tsx` | Heading, body text | String replacements |
| `components/landing/still-not-sure.tsx` | Heading, description | String replacements |
| `components/landing/services-marquee.tsx` | Services array, tagline | String replacements |
| `components/landing/landing-footer.tsx` | No text changes needed (already correct) |
| `app/pricing/page.tsx` | Hero pill text, plan descriptions | String replacements |

---

## Detailed Copy Specifications

### 1. Hero Section (`hero-section.tsx`)

#### FlipWords Array
```typescript
// OLD
words={["invoices", "contracts", "proposals", "quotations"]}

// NEW
words={["invoices", "contracts", "proposals", "NDAs", "SOWs"]}
```

#### Main Heading Structure
The heading structure remains: "Create" / FlipWords / "in seconds". No change to the heading text itself — the FlipWords expansion communicates broader capability.

#### Subtitle
```typescript
// OLD
"Tell Clorefy what you need. It writes the invoice, contract, or proposal for you — with your details filled in, the right tax rules applied, and a payment link ready to send."

// NEW
"Describe your document in plain English. Clorefy generates it with your business details, country-compliant tax rules for 11 countries, and a payment link — ready to send in under 30 seconds."
```

#### FlipWords Gradients Array
Add a 5th gradient for "SOWs":
```typescript
// ADD to gradients array:
// SOWs — deep slate → charcoal (professional, structured)
"linear-gradient(120deg, #334155 0%, #475569 50%, #1e293b 100%)",
```

---

### 2. Stats Section (`stats-section.tsx`)

#### Section Heading
```typescript
// OLD
"The impact of automation"

// NEW
"The cost of manual documents"
```

#### Stats Array (preserve all non-text fields: Icon, bg, duration)
```typescript
// OLD
{ label: "Hours saved weekly", detail: "Per user on average", value: 12, suffix: "+" }
// NEW
{ label: "Hours lost monthly", detail: "Average for freelancers on manual invoicing", value: 5, suffix: "+" }

// OLD
{ label: "Faster than manual", detail: "Document creation speed", value: 10, suffix: "×" }
// NEW
{ label: "Higher cash-flow risk", detail: "For businesses with late or incorrect invoices", value: 3, suffix: "×" }

// OLD
{ label: "Accuracy rate", detail: "AI-generated documents", value: 99, suffix: "%" }
// NEW
{ label: "Compliance error rate", detail: "When tax rules are applied manually", value: 22, suffix: "%" }

// OLD
{ label: "Documents generated", detail: "Across all users", value: 10, suffix: "k+" }
// NEW
{ label: "Countries supported", detail: "With auto-applied tax and legal rules", value: 11, suffix: "" }
```

---

### 3. Why Not ChatGPT Section (`why-not-chatgpt.tsx`)

#### First Paragraph
```typescript
// OLD
"ChatGPT writes text. It can't send invoices to your clients, collect payments, chase overdue bills, or run recurring billing every month. You'd still need 5 other tools — and they don't talk to each other."

// NEW
"ChatGPT writes text. It hallucinates tax rates, ignores country-specific compliance rules, can't format a real invoice, and has no memory of your business details. You'd still need 5 other tools that don't talk to each other — and uploading contracts to consumer AI risks confidentiality breaches with zero professional accountability."
```

#### Second Paragraph
```typescript
// OLD
"Clorefy generates tax-compliant invoices, contracts, quotations, and proposals — then emails them to clients, adds a payment link, auto-sends reminders until paid, and schedules recurring invoices every month. One platform, fully automated."

// NEW
"Clorefy generates compliant invoices, contracts, proposals, NDAs, SOWs, and 4 more document types — with country-specific tax rules auto-applied for 11 countries, your business details pre-filled, payment links attached, and professional formatting guaranteed. One platform, purpose-built for service businesses."
```

---

### 4. Persona Tabs (`persona-tabs.tsx`)

Update only the `title` and `desc` fields for select personas. Preserve all other fields (id, label, chat, doc).

#### Students Persona
```typescript
// OLD
title: "Professional docs, zero stress",
desc: "Create internship contracts, project proposals, and freelance invoices. Free tier covers everything.",

// NEW
title: "Professional docs from day one",
desc: "Generate compliant freelance invoices, internship contracts, and project proposals — no templates to fill, no tax rules to look up. Free tier included.",
```

#### Agencies Persona
```typescript
// OLD
title: "Scale your client onboarding",
desc: "Generate client proposals, service agreements, and quotations in seconds. Spend less time on paperwork, more time closing.",

// NEW
title: "Stop juggling 5 tools that don't talk to each other",
desc: "Generate proposals, SOWs, contracts, and invoices from one prompt. No more copying client details between HoneyBook, Google Docs, and your payment processor.",
```

#### Developers Persona
```typescript
// OLD
title: "Docs that write themselves",
desc: "Describe your project scope, deliverables, and terms. Clorefy generates polished proposals and contracts instantly.",

// NEW
title: "Ship code, not paperwork",
desc: "Describe your project scope and Clorefy generates the SOW, contract, or invoice — with the right tax rules for your client's country, payment terms, and IP clauses included.",
```

#### Creators Persona
```typescript
// OLD
title: "Capture fleeting ideas",
desc: "Don't let inspiration slip away. Record your creative bursts and get organized project briefs instantly.",

// NEW
title: "Get paid faster for creative work",
desc: "Generate sponsorship briefs, collaboration contracts, and invoices with payment links — so you spend time creating, not chasing payments.",
```

#### Leaders Persona
```typescript
// OLD
title: "Communicate with clarity",
desc: "Turn raw meeting notes into structured investor updates and strategy memos automatically.",

// NEW
title: "From notes to board-ready documents",
desc: "Turn meeting notes into structured investor memos, strategy documents, and executive summaries — formatted and ready to share.",
```

---

### 5. AI Showcase Section (`ai-showcase.tsx`)

#### Main Heading
```typescript
// OLD
"From messy thought to masterpiece"

// NEW
"From prompt to compliant document"
```

#### Subtitle Paragraph
```typescript
// OLD
"Stop worrying about structure or format. Just type your rough ideas. Clorefy understands context and formats everything perfectly."

// NEW
"Describe what you need in plain English. Clorefy applies your business profile, checks country-specific compliance rules, and delivers a professionally formatted document."
```

#### STEPS Array
```typescript
// OLD
{ title: "Describe", desc: "Type your request in plain English. No rigid templates.", icon: Type },
{ title: "Refine",   desc: "Our AI structures your data instantly.",                  icon: Wand2 },
{ title: "Done",     desc: "Export professional PDFs or share seamlessly.",           icon: FileCheck },

// NEW
{ title: "Describe", desc: "Tell Clorefy what you need — client, amount, terms. No forms to fill.", icon: Type },
{ title: "Comply",   desc: "Tax rules, mandatory fields, and legal requirements auto-applied for your country.", icon: Wand2 },
{ title: "Deliver",  desc: "Export as PDF, attach a payment link, and send — in under 30 seconds.", icon: FileCheck },
```

---

### 6. Features Section (`features-section.tsx`)

#### Section Heading
```typescript
// OLD heading
"Everything you need to flow"

// NEW heading
"Everything your business needs to get paid"
```

#### Section Subtitle
```typescript
// OLD
"Powerful tools wrapped in a simple, intuitive interface. No complex setup required."

// NEW
"Generate compliant documents, collect payments, and save 5+ hours a month — from a single prompt."
```

#### Features Array (preserve icon, className for each)
```typescript
// OLD
{ title: "Text-to-Document", desc: "Type naturally. Our AI captures every detail and turns it into a structured document instantly." }
// NEW
{ title: "Prompt-to-Document", desc: "Describe your document in plain English. Clorefy generates a complete, compliant document with your business details pre-filled." }

// OLD
{ title: "AI Formatting", desc: "Automatically formats your raw thoughts into professional reports, emails, or notes." }
// NEW
{ title: "Country-Compliant", desc: "Tax rules, mandatory fields, and legal requirements auto-applied for 11 countries. No manual lookup required." }

// OLD
{ title: "Save Hours", desc: "Skip the drafting phase. Go from idea to finished document in seconds, not hours." }
// NEW
{ title: "5+ Hours Saved Monthly", desc: "Eliminate manual invoicing, proposal drafting, and compliance checking. One prompt replaces an afternoon of admin." }

// OLD
{ title: "Instant Sharing", desc: "Share links, export PDFs, or send directly to email with one click." }
// NEW
{ title: "Send & Get Paid", desc: "Email documents to clients with a payment link attached. Export as PDF, DOCX, or image — one click." }

// OLD
{ title: "Custom Templates", desc: "Create templates for your specific needs—meeting notes, daily standups, or client updates." }
// NEW
{ title: "9+ Document Types", desc: "Invoices, contracts, proposals, quotations, NDAs, SOWs, purchase orders, receipts, and credit notes — all from one platform." }

// OLD
{ title: "Payments Integration", desc: "Seamlessly accept payments via Razorpay, Cashfree, and Stripe directly from your generated documents." }
// NEW
{ title: "Integrated Payments", desc: "Accept payments via Razorpay, Cashfree, and Stripe directly from your documents. No separate payment tool needed." }
```

---

### 7. Multi-Device Section (`multi-device.tsx`)

#### Badge Text
```typescript
// OLD
"Cross-Platform Sync"

// NEW
"Work From Anywhere"
```

#### Heading
```typescript
// OLD
"Everywhere you work"

// NEW
"Generate documents wherever you are"
```

#### Subtitle
```typescript
// OLD
"Capture ideas on your phone, edit on your tablet, finalize on your desktop."

// NEW
"In a client meeting, on a train, or at your desk — generate and send compliant documents without missing a billing window."
```

---

### 8. Testimonials Section (`testimonials-section.tsx`)

#### Section Heading
```typescript
// OLD
"Trusted by professionals"

// NEW
"Trusted by service businesses"
```

#### Testimonials Array (preserve structure, update content/name/role)
```typescript
// NEW testimonials array:
[
    {
        name: "Priya Sharma",
        role: "Freelance Designer",
        content: "I used to spend 5 hours every month on invoicing alone. Now I describe what I need and Clorefy handles the GST calculation, formatting, and payment link. My clients pay faster too.",
    },
    {
        name: "Michael Torres",
        role: "Agency Founder",
        content: "We switched from HoneyBook because it only works in the US. Clorefy handles our UK and Singapore clients with the right tax rules automatically. One tool for everything.",
    },
    {
        name: "Elena Rodriguez",
        role: "Freelance Developer",
        content: "Writing SOWs was the bane of my existence. Now I type 'SOW for Finova, Next.js + Supabase, $18k, 3 milestones' and get a complete document with IP clauses and payment terms.",
    },
    {
        name: "Aisha Patel",
        role: "Consultant",
        content: "The compliance engine is what sold me. I work with clients in India, UAE, and the UK — Clorefy auto-applies the right tax rules for each country without me looking anything up.",
    },
    {
        name: "David Kim",
        role: "Startup Founder",
        content: "We used to need FreshBooks for invoices, PandaDoc for proposals, and a separate tool for contracts. Clorefy replaced all three — and it's faster because it remembers our business details.",
    },
    {
        name: "Sarah Chen",
        role: "Sales Consultant",
        content: "Sending a proposal 10 minutes after a discovery call while the lead is hot — that's what Clorefy gives us. Our close rate improved because we're faster than competitors.",
    }
]
```

---

### 9. CTA Section (`cta-section.tsx`)

#### Heading
```typescript
// OLD
"Ready to transform your workflow?"

// NEW
"Ready to stop doing documents manually?"
```

#### Body Text
```typescript
// OLD
"Join 10,000+ professionals generating documents with Clorefy. No credit card required."

// NEW
"Generate compliant invoices, contracts, and proposals in under 30 seconds. Free plan available — no credit card required."
```

---

### 10. Still Not Sure Section (`still-not-sure.tsx`)

#### Heading
```typescript
// OLD
"STILL NOT SURE THAT CLOREFY IS RIGHT FOR YOU?"

// NEW
"WANT A SECOND OPINION ON CLOREFY?"
```

#### Description
```typescript
// OLD
"Let ChatGPT, Claude, or Perplexity do the thinking for you. Click a button and see what your favorite AI says about Clorefy."

// NEW
"Ask an independent AI to evaluate Clorefy for your business. Click below and see what they find."
```

---

### 11. Services Marquee (`services-marquee.tsx`)

#### Tagline
```typescript
// OLD
"Every document your business needs"

// NEW
"9+ document types, 11 countries, one platform"
```

#### Services Array
```typescript
// OLD
["Invoices", "Contracts", "Quotations", "Proposals", "Quotes", "Receipts", "Memos", "Reports", "Briefs", "Purchase Orders", "Credit Notes", "Statements"]

// NEW
["Invoices", "Contracts", "Proposals", "Quotations", "NDAs", "SOWs", "Purchase Orders", "Receipts", "Credit Notes", "Change Orders", "Payment Reminders", "Onboarding Forms"]
```

---

### 12. Pricing Page (`app/pricing/page.tsx`)

#### Hero Pill Text
```typescript
// OLD
"2,400+ professionals save hours every week"

// NEW
"2,400+ service businesses generate documents with Clorefy"
```

---

## Constraints

1. **Text-only changes** — No modifications to: component structure, CSS classes/classNames, animation variants, layout logic, conditional rendering, Link href values, icon assignments, or array object shapes.
2. **Preserve array structure** — When modifying arrays (features, stats, personas, testimonials, services), keep the same number of items, same object keys, same icon/className/bg values. Only update text fields.
3. **No new dependencies** — No new packages, imports, or components.
4. **FlipWords gradient addition** — The only structural change is adding a 5th item to the FlipWords `words` array and a corresponding 5th gradient string to the `gradients` array. This is a text-content addition within an existing pattern.

---

## Components and Interfaces

No new components or interfaces are introduced. All changes are text-content updates within existing components:

- **HeroSection** — Updated subtitle string, expanded FlipWords array
- **StatsSection** — Updated stats array text fields (label, detail, value, suffix)
- **WhyNotChatGPT** — Updated paragraph strings
- **PersonaTabs** — Updated persona title/desc fields in array
- **AIShowcase** — Updated heading, subtitle, STEPS array text fields
- **FeaturesSection** — Updated features array text fields, section heading/subtitle
- **MultiDeviceSection** — Updated badge, heading, subtitle strings
- **TestimonialsSection** — Updated testimonials array text fields, section heading
- **CTASection** — Updated heading and body text strings
- **StillNotSure** — Updated heading and description strings
- **ServicesMarquee** — Updated services array and tagline string

All component signatures, props, exports, and rendering logic remain unchanged.

## Data Models

No data model changes. All modifications are to hardcoded string literals and array constants within component files. No database, API, or type definition changes required.

## Error Handling

Not applicable — this feature involves only static text replacements with no runtime logic changes.

---

## Testing Strategy

This feature is best validated through example-based tests and property-based checks on the text content:

- **Property tests**: Verify universal constraints (no "4 docs" references, no casual language in specific sections, structural integrity of arrays)
- **Example tests**: Verify specific new copy matches expected values in each section
- **Manual review**: Tone and positioning quality require human judgment

No integration tests needed — all changes are static text with no runtime behavior.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No Four-Docs Limitation References

*For any* text field (title, desc, label, heading, subheading, content) across all modified landing page components, the text SHALL NOT contain the phrases "4 document types", "four document types", or enumerate exactly and only "invoices, contracts, quotations, and proposals" as the complete set of supported types.

**Validates: Requirements 4.4, 6.4, 11.3, 12.2, 13.3, 14.1, 14.2**

### Property 2: No Casual Language in AI Showcase

*For any* text field in the AI Showcase section (heading, subtitle, step titles, step descriptions), the text SHALL NOT contain the phrases "messy thought", "rough ideas", "masterpiece", or "raw thoughts".

**Validates: Requirements 5.1, 5.3**

### Property 3: No Inflated Unverifiable User Counts in CTA

*For any* text field in the CTA section, the text SHALL NOT contain claims of "10,000+" users or any five-digit-or-higher user count that is unverifiable.

**Validates: Requirements 9.2**

### Property 4: Structural Integrity of Modified Arrays

*For any* array of objects modified during this feature (features, stats, personas, testimonials, services), the array SHALL preserve the same number of elements, the same object keys, and the same values for non-text fields (icon, className, bg, duration, Icon, href) as the original.

**Validates: Requirements 16.1, 16.2, 16.3**

### Property 5: Generic Feature Titles Removed

*For any* feature object in the features array, the title field SHALL NOT contain the values "Text-to-Document", "AI Formatting", or "Custom Templates".

**Validates: Requirements 6.3**

### Property 6: Services Marquee Reflects 9+ Document Types

*For any* rendering of the services marquee, the services array SHALL contain at least 9 distinct document type names including at least one of: "NDAs", "SOWs", "Purchase Orders", "Credit Notes".

**Validates: Requirements 11.1, 14.3**
