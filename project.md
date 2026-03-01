# Invo.ai

AI-powered document generation platform. Create compliant invoices, contracts, quotations, and proposals for 11 countries through natural conversation.

---

## How It Works

```
User prompt → AI generates document + asks follow-up → User refines → Export PDF/DOCX/Image
```

Every AI response returns `{ "document": {...}, "message": "..." }` — the document is generated/updated on every turn, and the message includes a friendly follow-up question to improve it.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) + React 19 |
| Language | TypeScript 5.7.3 (strict mode) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, RLS) |
| AI Model | DeepSeek V3 (`deepseek-chat` for onboarding, `deepseek-chat` for generation) |
| Embeddings | OpenAI (1536-dim vectors via pgvector for RAG) |
| Styling | Tailwind CSS + Radix UI + shadcn/ui |
| PDF | @react-pdf/renderer with 5 visual themes |
| Forms | React Hook Form + Zod validation |

---

## Supported Countries

India · USA · UK · Germany · Canada · Australia · Singapore · UAE · Philippines · France · Netherlands

Each country has compliance templates with tax requirements, mandatory fields, and legal notes — injected automatically during generation.

---

## Document Types

| Type | Examples |
|------|---------|
| Invoice | Service invoices, product invoices, recurring invoices |
| Contract | Service agreements, employment contracts, freelance contracts |
| Quotation | Price quotes, estimates, bids |
| Proposal | Business proposals, project proposals, pitches |

---

## Core Features

### Conversational AI Generation
- User describes what they need in plain language
- AI generates a complete document immediately (no empty templates)
- Every response includes a follow-up question to refine the document
- Business profile data auto-filled from onboarding (never asks for sender info)
- Template style detected from prompt ("make it bold", "classic style", etc.)

### Tax-Aware Generation
- During onboarding, user confirms tax registration status (yes/no)
- If NOT tax-registered → `taxRate` is always 0, compliance tax rules are ignored
- If tax-registered → appropriate rates applied per country (GST, VAT, etc.)
- Tax IDs stored in `businesses.tax_ids` (JSONB)

### 5 PDF Template Styles

| Template | Font | Header Color | Vibe |
|----------|------|-------------|------|
| Modern | Helvetica | `#2563eb` (blue) | Clean with accent shapes |
| Classic | Times-Roman | `#1e293b` (dark) | Traditional & elegant |
| Bold | Helvetica | `#7c3aed` (purple) | Vibrant full-color header |
| Minimal | Helvetica | none | No-color, content-focused |
| Elegant | Times-Roman | `#059669` (emerald) | Refined serif with green accents |

Users can select templates from the UI picker or by mentioning the style in their prompt. Each template renders with visually distinct headers, borders, shadows, and accent colors in both the live preview and exported PDF.

### Design Customization
- Template picker dropdown in the document view
- 8 accent color swatches
- 3 font options (Sans Serif / Serif / Mono)
- Custom `headerColor` and `tableColor` flow through to PDF export
- Design state stored in `InvoiceData.design` field

### Multi-Format Export
- PDF (multi-page with automatic page breaks)
- DOCX
- PNG / JPG image export

### Session Management
- Each new prompt creates an independent session (ChatGPT-style)
- Session history sidebar for navigating past documents
- Sessions stored in Supabase with document snapshots

---

## User Flow

### 1. Signup / Login
Email-based auth via Supabase. Password reset with PKCE flow.

### 2. Onboarding (12 fields)
Conversational AI collects business profile data:

| # | Field | Example |
|---|-------|---------|
| 1 | Business name | WhyCreatives |
| 2 | Business type | Agency, Freelancer, etc. |
| 3 | Owner name | John Doe |
| 4 | Email | hello@example.com |
| 5 | Phone | +91 9876543210 |
| 6 | Country | India |
| 7 | State/Province | Maharashtra |
| 8 | Tax registered (yes/no) | No |
| 9 | Currency | INR |
| 10 | Payment terms | Net 30 |
| 11 | Payment methods | Bank Transfer, UPI |
| 12 | Client countries | India, USA |

Data saved to `businesses` table. Used automatically in every document generation.

### 3. Document Generation
User types a prompt → AI returns document JSON + message → live preview updates in real-time via SSE streaming.

### 4. Edit & Export
All fields are editable after generation. Export in PDF, DOCX, or image format.

---

## Architecture

### API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/ai/stream` | Streaming document generation (primary) |
| `POST /api/ai/generate` | Non-streaming document generation |
| `POST /api/ai/process` | Process user prompts |
| `POST /api/ai/onboarding` | Onboarding conversation |
| `POST /api/ai/detect-type` | Auto-detect document type from prompt |
| `POST /api/compliance/query` | RAG-based compliance rule retrieval |
| `POST /api/validation/document` | Multi-layer document validation |
| `POST /api/export/docx` | DOCX export |
| `POST /api/export/image` | Image export |
| `POST /api/sessions/create` | Create new session |
| `GET /api/signatures` | Signature management |
| `POST /api/signatures/sign` | Digital signing |
| `GET /api/templates/get` | Fetch document templates |

### AI Pipeline

```
User prompt
  → Sanitize input
  → Authenticate + rate limit + cost check
  → Fetch business profile (server-side)
  → Fetch country compliance template
  → Build prompt (business context + conversation history + current data + template detection)
  → Stream to DeepSeek V3
  → Parse JSON response { document, message }
  → Return via SSE
```

### Database Schema (Supabase)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to auth.users) |
| `businesses` | Business data from onboarding |
| `documents` | Generated documents with metadata |
| `document_versions` | Version history |
| `document_templates` | 44 country × type compliance templates |
| `ai_prompts` | AI system prompts per document type |
| `compliance_rules` | Compliance rules with vector embeddings |
| `compliance_alerts` | Detected legal/tax changes |
| `signatures` | Digital signatures with token-based access |
| `user_usage` | AI cost tracking per user/month |
| `audit_logs` | Security audit trail |
| `rate_limit_log` | Rate limiting records |

All tables have Row Level Security (RLS) policies.

---

## Security

8-layer defense-in-depth:

| Layer | Implementation |
|-------|---------------|
| Authentication | Supabase JWT validation via `getUser()` on every request |
| Authorization | RLS policies enforce user ownership on all tables |
| Rate Limiting | Postgres-based, category limits (AI: 10/min, Export: 20/min) |
| Cost Protection | Per-user monthly spending limits ($5 free / $50 pro) |
| Input Sanitization | XSS, SQL injection, path traversal prevention |
| CSRF Protection | HMAC-signed tokens with 1-hour expiry |
| Security Headers | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| Audit Logging | All sensitive operations logged with IP + user agent |

OWASP API Security Top 10 compliant.

---

## Key Files

```
lib/
  deepseek.ts          — AI integration (buildPrompt, streaming, generation)
  invoice-types.ts     — InvoiceData interface + helpers
  pdf-templates.tsx     — 5 PDF themes with multi-page support
  supabase.ts          — Browser client (singleton)
  supabase-server.ts   — Server-side client
  api-auth.ts          — Auth + origin validation + rate limiting
  cost-protection.ts   — AI spending limits
  sanitize.ts          — Input sanitization
  audit-log.ts         — Audit logging
  csrf.ts              — CSRF token management
  compliance.ts        — RAG compliance queries
  document-templates.ts — Document structure definitions
  validation.ts        — Document validation

components/
  app-shell.tsx        — Main layout wrapper
  prompt-screen.tsx    — Document generation UI
  invoice-chat.tsx     — Conversational AI chat
  document-preview.tsx — Live preview with 5 template styles
  template-picker.tsx  — Template/color/font selector
  pdf-download-button.tsx — Export functionality
  onboarding-chat.tsx  — Onboarding conversation
  signature-pad.tsx    — Digital signature capture
  landing/             — Landing page components
```

---

## Commands

```bash
pnpm dev        # Start dev server (localhost:3000)
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
```
