# Clorefy (Invo.ai) — Complete Project Reference

AI-powered document generation platform. Create compliant invoices, contracts, quotations, and proposals for 11 countries through natural conversation.

---

## How It Works

```
User prompt → AI auto-detects document type → Fetches business profile (server-side)
→ Injects country compliance template → Streams to DeepSeek V3
→ Returns { "document": {...}, "message": "..." } via SSE
→ Live preview updates in real-time → User edits → Export PDF/DOCX/Image
```

Every AI response is JSON with two keys:
- `document` — the full structured document data (InvoiceData)
- `message` — a friendly follow-up question to refine the document

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5.7.3 (strict mode) |
| Runtime | React 19 |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, RLS, pgvector) |
| AI Model | DeepSeek V4 Flash `deepseek-v4-flash` for onboarding/chat; DeepSeek V4 Pro `deepseek-v4-pro` (thinking) for document generation |
| File Analysis | GPT (via `/api/ai/analyze-file`) for image/PDF extraction |
| Embeddings | OpenAI (1536-dim vectors via pgvector for RAG compliance queries) |
| Styling | Tailwind CSS 3.4.17 + Radix UI + shadcn/ui (50+ components) |
| PDF | @react-pdf/renderer with 9 visual template styles |
| Forms | React Hook Form 7.54.1 + Zod 3.24.1 |
| Payments | Razorpay (INR-based, multi-currency display) |
| Package Manager | pnpm |

---

## Supported Countries (All 11 — Available to ALL Tiers)

India · USA · UK · Germany · Canada · Australia · Singapore · UAE · Philippines · France · Netherlands

Each country has 4 compliance templates (invoice, contract, quotation, proposal) = 44 templates total.
Templates include country-specific tax rates, mandatory fields, legal requirements.
Auto-injected during generation. All countries available to all tiers including free.

---

## Document Types (All 4 — Available to ALL Tiers)

| Type | Examples |
|------|---------|
| Invoice | Service invoices, product invoices, recurring invoices |
| Contract | Service agreements, employment contracts, freelance contracts |
| Quotation | Price quotes, estimates, bids |
| Proposal | Business proposals, project proposals, pitches |

All 4 document types are available to every tier. The only limit is the monthly document count.

---

## The 4 Pricing Tiers

| | Free | Starter | Pro | Agency (Coming Soon) |
|--|------|---------|-----|--------|
| Monthly price | $0 | $9 | $24 | $59 |
| Yearly price | $0 | $7/mo | $19/mo | $47/mo |
| Documents/month | 5 | 50 | 150 | Unlimited |
| Messages/session | 10 | 30 | 50 | Unlimited |
| Document types | Invoice + Contract | All 4 | All 4 | All 4 |
| PDF templates | 3 (Modern, Classic, Minimal) | All 9 | All 9 | All 9 |
| Countries | All 11 | All 11 | All 11 | All 11 |
| Export formats | PDF only | PDF + DOCX | PDF + DOCX + Image | All formats |
| Session history | 7 days | 30 days | 1 year | Forever |
| Digital signatures | — | — | ✓ | ✓ |
| Custom logo/branding | — | — | ✓ | ✓ |
| Team members | 1 | 1 | 1 | 3 |
| Priority support | — | — | — | ✓ |
| AI profile editing | — | ✓ | ✓ | ✓ |

### Billing Model
- Count per DOCUMENT (session), not per AI message
- All messages within one session are free up to the per-session message cap
- Editing an already-generated document does not consume quota
- Error responses from AI do NOT count against the message limit
- Only successful AI responses increment the message count

### Per-Session Message Caps
Prevents chatbot abuse. Once the cap is hit, user must start a new session (counts as a new document). Users can create the same document type again (e.g., next month's invoice for the same client).

### Multi-Currency Pricing
Prices displayed in local currency per country (defined in `lib/pricing.ts`). Razorpay always charges in INR — displayed prices are for UX only. Server-side amount validation prevents client-side price manipulation.

### Margin Analysis
| Tier | Revenue | Max AI Cost | Gross Margin |
|------|---------|-------------|-------------|
| Free | $0 | ~$0.003 (3 docs) | — (acquisition) |
| Starter $9 | $9 | ~$0.05 (50 docs) | ~99.4% |
| Pro $24 | $24 | ~$0.15 (150 docs) | ~99.4% |
| Agency $59 | $59 | ~$0.50 (est. 500 docs) | ~99.2% |

---

## 9 PDF Template Styles

| Template | Font | Header Color | Vibe |
|----------|------|-------------|------|
| Modern | Helvetica | `#2563eb` (blue) | Clean with accent shapes |
| Classic | Times-Roman | `#1e293b` (dark) | Traditional & elegant |
| Bold | Helvetica | `#7c3aed` (purple) | Vibrant full-color header |
| Minimal | Inter | none | No-color, content-focused |
| Elegant | Playfair Display | `#059669` (emerald) | Refined serif with green accents |
| Corporate | Helvetica | `#1e3a5f` (navy) | Executive professional |
| Creative | Lora | `#e11d48` (rose) | Playful & warm |
| Warm | Lora | `#c2410c` (terracotta) | Earthy tones |
| Geometric | Roboto Mono | `#0d9488` (teal) | Angular shapes, tech feel |

Design customization: template picker with SVG mini-previews, 12 accent color swatches + custom color picker, 7 font options. Design state stored in `InvoiceData.design` field.

---

## Core Features

### Conversational AI Generation
- User describes what they need in plain language
- AI generates a complete document immediately (no empty templates)
- Every response includes a follow-up question to refine the document
- Business profile data auto-filled from onboarding (never asks for sender info)
- Template style detected from prompt ("make it bold", "classic style", etc.)

### Document Chains
- After generating a document, users can create related documents for the same client
- NextStepsBar shows all 4 document types including the current type (for recurring docs like monthly invoices)
- Linked sessions carry over client info, items, and financial data
- Chain navigation via ChainNavigator component

### Tier Enforcement
- Free-tier users blocked from AI profile editing (403) — manual editing still works
- Document limit enforced at session creation (429 when exceeded)
- Message limit enforced per session at the AI stream endpoint (429 when exceeded)
- Upgrade modal shown when limits are hit
- Error responses do NOT count against message limits (only successful AI responses count)

### Smart Prompt Extraction
- Matches plan names against business pricing info
- Distinguishes client names from product/service names
- Handles shorthand numbers: "10k" = 10000, "5k" = 5000
- Only uses placeholders for truly unknown info

### Tax-Aware Generation
- During onboarding, user confirms tax registration status (yes/no)
- If NOT tax-registered → `taxRate` is always 0
- If tax-registered → appropriate rates applied per country (GST, VAT, etc.)

### Payment Info Rules (3-layer protection)
1. `GENERATION_SYSTEM_PROMPT` in `deepseek.ts` — instructs AI to never include payment info unless explicitly asked
2. `invoice-chat.tsx` — client-side guard strips `paymentMethod`/`paymentInstructions` if user's prompt doesn't mention payment
3. `getInitialInvoiceData()` — defaults `paymentMethod` to `""` (empty string)

### Multi-Format Export
- PDF (multi-page with automatic page breaks, 9 template styles)
- DOCX
- PNG / JPG image export

---

## User Flow

### 1. Landing Page → Auth
- Non-authenticated users see the marketing landing page
- Email-based auth via Supabase (signup, login, password reset with PKCE flow)
- Auth callback and confirm routes handle email verification

### 2. Plan Selection (choose-plan)
- After signup, user selects a plan (Free, Starter, Pro, or Agency waitlist)
- Free plan: no credit card, instant activation
- Paid plans: Razorpay payment flow with 14-day free trial
- Multi-currency display based on detected country

### 3. Onboarding (12+ fields)
Conversational AI collects business profile data via `POST /api/ai/onboarding`:

| # | Field | Example |
|---|-------|---------|
| 1 | Business type | Freelancer, Developer, Agency, Ecommerce, Professional |
| 2 | Country | India (IN), USA (US), UK (GB), etc. |
| 3 | Business name | AddMenu |
| 4 | Owner name | Sayan Banik |
| 5 | Email | hello@example.com |
| 6 | Phone | +91 9876543210 |
| 7 | Address | City is enough (partial OK) |
| 8 | Tax registered (yes/no) | No → taxRate=0, skip taxId |
| 9 | Tax ID | Only if tax-registered |
| 10 | Client countries | "all" = all 11 countries |
| 11 | Currency | INR, USD, EUR, etc. |
| 12 | Payment terms | Immediate, Net 15, Net 30, Net 60 |
| 13 | Bank details (optional) | Bank name, account number, IFSC/SWIFT |
| 14 | Additional notes (optional) | Pricing, services, business description |

Data saved to `businesses` table. Profile completion flag in `profiles.onboarding_complete`.

### 4. Home Screen (AppShell)
- Centered prompt input with category pills (Invoice, Contract, Quotation, Proposal)
- Auto-detects document type from prompt via `POST /api/ai/detect-type`
- Example prompts that generate documents on click
- Hamburger menu for profile, business info, settings access

### 5. Document Generation (PromptScreen)
Three-panel layout:
- Left: Session history sidebar (toggleable)
- Center: AI chat (InvoiceChat) or manual editor (EditorPanel), toggleable
- Right: Live document preview (DocumentPreview) with template picker

### 6. Edit & Export
- All fields editable after generation via EditorPanel
- Template/color/font changeable via Design picker
- Export as PDF, DOCX, or image

---

## Architecture

### API Routes (13 total)

| Route | Purpose | Security |
|-------|---------|----------|
| `POST /api/ai/stream` | Streaming document generation | Auth + cost + message limit + sanitize + audit |
| `POST /api/ai/onboarding` | Onboarding conversation | Auth + cost + sanitize |
| `POST /api/ai/profile-update` | AI profile editing (paid only) | Auth + tier check + cost + sanitize |
| `POST /api/ai/detect-type` | Auto-detect document type | Auth |
| `POST /api/ai/analyze-file` | File analysis (GPT) | Auth |
| `POST /api/sessions/create` | Create document session | Auth + type check + doc limit |
| `POST /api/sessions/create-linked` | Create linked session | Auth + doc count increment |
| `GET /api/sessions/linked` | Fetch linked sessions | Auth |
| `POST /api/razorpay/create-order` | Create payment order | Auth + server-side amount |
| `POST /api/razorpay/verify` | Verify payment | Auth + signature verification |
| `GET /api/razorpay/subscription` | Get subscription status | Auth + expiry check |
| `POST /api/razorpay/downgrade` | Schedule downgrade | Auth |
| `GET/POST /api/signatures` | Signature management | Auth |
| `POST /api/signatures/sign` | Digital signing | Token-based |
| `GET /api/usage` | Usage stats | Auth |

### AI Pipeline (Stream Route)

```
User prompt
  → validateOrigin()
  → authenticateRequest() — JWT validation via getUser()
  → checkCostLimit() — monthly document limit
  → Fetch user tier from subscriptions table
  → checkMessageLimit() — per-session message cap
  → validateBodySize() — 100KB limit
  → sanitizeText() — XSS/injection prevention
  → Fetch business profile from Supabase (server-side)
  → buildPrompt() — business context + conversation history + current data
  → GENERATION_SYSTEM_PROMPT — core rules, extraction, template detection
  → streamGenerateDocument() — SSE stream to DeepSeek V3
  → trackUsage() + logAIGeneration() — cost tracking + audit
  → Client parses SSE chunks → JSON parse → update InvoiceData
```

### Message Counting Logic
- Messages saved to DB only after successful AI response
- Error responses (API errors, stream errors, rate limits) do NOT persist the user message
- `checkMessageLimit()` counts `role: "user"` messages in `chat_messages` table
- This ensures only successful round-trips count against the limit

---

## Database Schema (Supabase)

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to auth.users, includes `onboarding_complete`, `plan_selected` |
| `businesses` | Business data from onboarding (name, address, country, currency, tax_ids, additional_notes) |
| `subscriptions` | User subscription plan and status (plan, status, period dates) |
| `documents` | Generated documents with metadata |
| `document_versions` | Document version history |
| `document_sessions` | Chat sessions with document context snapshots, chain_id, client_name |
| `document_links` | Parent-child relationships between linked sessions |
| `chat_messages` | Individual messages within sessions (role, content) |
| `generation_history` | AI generation attempts with success/failure tracking |

### Compliance & Templates

| Table | Purpose |
|-------|---------|
| `document_templates` | 44 country × type compliance templates |
| `compliance_rules` | Compliance rules with vector embeddings (pgvector) |
| `compliance_knowledge` | RAG knowledge base for compliance queries |

### Security & Monitoring

| Table | Purpose |
|-------|---------|
| `user_usage` | Monthly usage tracking (documents_count, ai_requests, tokens, cost) |
| `audit_logs` | Security audit trail (action, IP, user agent) |
| `rate_limit_log` | Rate limiting records |
| `rate_limits` | Rate limit configuration |

All tables have Row Level Security (RLS) policies.

---

## Security — 8-Layer Defense-in-Depth

| Layer | Implementation |
|-------|---------------|
| Authentication | Supabase JWT validation via `getUser()` (not `getSession()`) on every request |
| Authorization | RLS policies enforce user ownership on all tables |
| Origin Validation | `validateOrigin()` checks request origin/referer headers |
| IP Rate Limiting | In-memory sliding window in middleware (30/min auth, 120/min API, 300/min global) |
| User Rate Limiting | Postgres-based per-user limits (AI: 10/min, Export: 20/min, General: 30/min) |
| Cost Protection | Tier-based document limits + per-session message caps via `cost-protection.ts` |
| Input Sanitization | XSS, SQL injection, path traversal prevention via `sanitize.ts` |
| Security Headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options in `next.config.mjs` |
| Audit Logging | All sensitive operations logged with IP + user agent via `audit-log.ts` |

---

## Key Files

```
lib/
  cost-protection.ts       — Tier limits, checkDocumentLimit, checkMessageLimit, checkDocumentTypeAllowed
  api-auth.ts              — authenticateRequest, validateBodySize, sanitizeError, validateOrigin
  deepseek.ts              — AI integration (GENERATION_SYSTEM_PROMPT, buildPrompt, streaming)
  invoice-types.ts         — InvoiceData interface, CURRENCIES, formatCurrency
  pdf-templates.tsx        — 9 PDF themes, font registration, all 4 PDF components
  pricing.ts               — Multi-currency pricing per country, detectCountryFromTimezone
  supabase.ts              — Browser Supabase client (singleton)
  supabase-server.ts       — Server-side Supabase client
  database.types.ts        — Auto-generated TypeScript types from Supabase schema
  sanitize.ts              — sanitizeText, sanitizeEmail, sanitizePhone, sanitizeObject
  audit-log.ts             — logAudit, logAIGeneration
  rate-limiter.ts          — Postgres-based rate limiting
  auth-fetch.ts            — Authenticated fetch wrapper for client components

components/
  app-shell.tsx            — Main home screen (prompt input, categories, feature cards)
  prompt-screen.tsx        — Three-panel document builder (history + chat/editor + preview)
  invoice-chat.tsx         — Conversational AI chat with SSE streaming, upgrade modal
  document-preview.tsx     — Live preview with 9 template styles
  editor-panel.tsx         — Manual field editor for all document fields
  template-picker.tsx      — Design picker (9 templates, 12 colors, 7 fonts)
  pdf-download-button.tsx  — PDF export with dynamic template selection
  onboarding-chat.tsx      — Onboarding conversation UI
  session-history-sidebar.tsx — Session history navigation
  next-steps-bar.tsx       — Document chain creation (all 4 types including current)
  message-limit-banner.tsx — Message limit reached UI with new document options
  upgrade-modal.tsx        — Tier upgrade prompt dialog
  chain-navigator.tsx      — Navigate between linked document sessions
  hamburger-menu.tsx       — Profile/business info/settings menu
  auth-provider.tsx        — Authentication context provider

hooks/
  use-document-session.ts  — Session CRUD, message saving, context updates
  use-razorpay.ts          — Razorpay payment integration
  use-require-auth.ts      — Authentication guard hook
  use-mobile.tsx           — Mobile device detection
  use-auto-resize-textarea.ts — Textarea auto-sizing
```

---

## Commands

```bash
pnpm dev        # Start dev server (localhost:3000, Turbopack)
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # Run ESLint
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
DEEPSEEK_API_KEY=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

Optional:
```
CSRF_SECRET=...                    # Defaults to Supabase anon key
NEXT_PUBLIC_APP_URL=...            # Auto-detected in production
```

---

## Supabase Project

- Project ID: `tdeqauhtobtahncglqwq`
- All database changes should use Supabase MCP tools
- Migration scripts in `supabase-migrations.sql`
- Seed scripts in `scripts/` folder

---

## Document Lifecycle

1. User creates session → `POST /api/sessions/create` (tier check + doc count increment)
2. User sends prompt → message shown in UI immediately (NOT saved to DB yet)
3. AI generates response → on success, BOTH user message and assistant message saved to DB
4. On AI error → error shown in UI only, nothing saved to DB, message count unchanged
5. User can edit/refine with AI messages (within per-session message cap)
6. NextStepsBar shows all 4 doc types (including current) for creating related documents
7. When message limit reached → MessageLimitBanner shows all 4 doc types to start new session
8. Download/export → document finalized

### Document Chains
- Creating a linked document carries over client info, items, and financial data
- Same document type can be created again (e.g., next month's invoice)
- Chain tracked via `chain_id` on `document_sessions` and `document_links` table
- ChainNavigator component allows switching between linked sessions
