# Clorefy (invo.ai) — Project Overview

> AI-powered document generation platform for businesses worldwide.

## Product Overview

Clorefy is a conversational AI platform that generates compliant invoices, contracts, quotations, proposals, statements of work, change orders, NDAs, client onboarding forms, and payment follow-ups. Users describe their document needs in natural language, and the AI produces complete, country-compliant documents ready for export and digital signing.

**Core flow:** User describes document need → AI generates complete document → User edits if needed → Export in multiple formats

**Brand:** Clorefy (domain: invo.ai)

---

## Core Features

### 1. Conversational AI Document Generation
- Users chat with the AI to create documents — no forms, no templates to fill
- AI generates complete documents from scratch based on conversation context
- Supports iterative refinement within a session (edit, add items, change terms)
- Smart extraction: parses client names, amounts, services from natural language
- Business context auto-injected from onboarding profile (never asks for your own info)
- Dual-mode detection: AI determines if user wants conversation or document generation

### 2. Business Onboarding via AI Chat
- First-time users go through a conversational onboarding flow
- AI asks questions to build a complete business profile
- Collected data: business name, type, address, tax IDs, payment methods, signatory, logo, signature
- Data stored permanently and reused for all future documents
- Profile editable anytime via hamburger menu → Profile page

### 3. Global Country Support
Clorefy supports **every ISO 3166-1 country** (200+ countries). Users from any country can create documents with their local currency, tax ID format, and compliance rules.

**11 Core Markets** with strict tax-ID validation and full compliance templates:

| Code | Country       | Tax System          | Standard Rate |
|------|---------------|---------------------|---------------|
| IN   | India         | GST (CGST+SGST/IGST)| 18%          |
| US   | United States | State Sales Tax     | Varies by state |
| GB   | United Kingdom| VAT                 | 20%           |
| DE   | Germany       | USt (Umsatzsteuer)  | 19%           |
| CA   | Canada        | GST/HST + PST/QST  | Varies by province |
| AU   | Australia     | GST                 | 10%           |
| SG   | Singapore     | GST                 | 9%            |
| AE   | UAE           | VAT                 | 5%            |
| PH   | Philippines   | VAT                 | 12%           |
| FR   | France        | TVA                 | 20%           |
| NL   | Netherlands   | BTW                 | 21%           |

All other countries use a permissive tax-ID format and get compliance rules dynamically via the RAG knowledge base at generation time.

### 4. Document Types (9)
- **Invoices** — with country-specific tax compliance, line items, tax calculations, per-item discounts
- **Contracts** — service agreements, employment contracts, with jurisdiction clauses
- **Quotations** — price quotes, estimates, bids with validity periods
- **Proposals** — business proposals, project proposals, pitches
- **Statements of Work (SOW)** — detailed project scope, deliverables, timelines
- **Change Orders** — amendments to existing contracts/SOWs
- **NDAs** — non-disclosure/confidentiality agreements
- **Client Onboarding Forms** — structured intake forms for new clients
- **Payment Follow-ups** — payment reminder documents with invoice references

### 5. Multi-Format Export
- **PDF** — via `@react-pdf/renderer`, 9 templates available
- **DOCX** — Word document export
- **Image** — PNG/JPG export

### 6. Digital Signatures (E-Signatures)
- Token-based access for external signers (no account required)
- Signature pad capture (drawn signatures)
- Tracks: signer name, email, IP address, user agent, document hash
- Signature tokens with expiration dates
- Party A / Party B signing flow
- Sender's saved signature auto-applied as Party A
- Public verification URL for legal proof
- Supported on: Contracts, SOWs, Change Orders, NDAs (Pro/Agency plans)

### 7. Email Sending
- Send documents directly to clients via email from toolbar or chat
- AI-generated personalized email messages
- Auto follow-up reminders
- Recurring invoice scheduling (weekly/monthly/quarterly)
- Payment links embedded in invoice emails (via Razorpay)

### 8. Custom Logo & Branding (Pro+)
- Upload business logo during onboarding or via profile
- Logo appears on all generated documents
- Custom signature upload

### 9. Document Linking
- **derived_from** — create a contract from a quotation, invoice from a proposal
- **related_to** — link related documents together
- Chain navigation UI for browsing linked document sessions
- Auto-invoice on contract signing

### 10. Session History
- Chat sessions preserved with full message history
- Chain navigator for browsing linked sessions
- Session sidebar for quick access to recent sessions
- History retention varies by plan (7 days → forever)

### 11. 9 Document Templates
Modern, Classic, Bold, Minimal, Elegant, Corporate, Creative, Warm, Geometric — each with distinct fonts, colors, and layouts.

### 12. File Analysis
- Upload PDFs, images, or documents for AI analysis
- AI reads file contents and can extract data for document generation
- Powered by OpenAI GPT-5.4 mini for vision/file understanding

### 13. Client Response (Quotations/Proposals)
- Accept/reject toggle for quotations and proposals
- Clients can respond to documents without an account
- Toggleable via chat commands

---

## AI Models Used

| Model | API Name | Use Case |
|-------|----------|----------|
| DeepSeek V3 | `deepseek-chat` | Fast mode: onboarding, general chat, document generation (temperature 0.3) |
| DeepSeek V4 Pro | `deepseek-v4-pro` | Thinking mode: complex reasoning with reasoning_effort "low" |
| OpenAI GPT-5.4 mini | `gpt-5.4-mini` | File analysis only: PDF/image reading and data extraction |

**Architecture:**
- Dual-mode system prompt: AI detects whether user wants conversation or document generation
- Document generation returns structured JSON; conversation returns Markdown
- Business context injected into every AI call
- Country-specific compliance rules fetched via RAG (pgvector semantic search)
- Compliance templates for major world markets (document types × countries)
- GPT is ONLY used when a file is physically attached; all text interactions use DeepSeek
- Thinking mode uses reasoning_effort "low" to avoid timeout issues on edge runtimes

---

## Pricing Plans

### INR Pricing (India)

| Feature | Free | Starter (₹999/mo) | Pro (₹2,499/mo) | Agency (₹5,999/mo) |
|---------|------|-------------------|-----------------|-------------------|
| Documents/month | 5 | 50 | 150 | Unlimited |
| Document types | Invoice + Contract | All 9 | All 9 | All 9 |
| Messages/session | 10 | 30 | 50 | Unlimited |
| Templates | 3 | All 9 | All 9 | All 9 |
| Countries | All | All | All | All |
| Export formats | PDF | PDF + DOCX | PDF + DOCX + Image | All |
| Digital signatures | ✗ | ✗ | ✓ | ✓ |
| Custom branding | ✗ | ✗ | ✓ | ✓ |
| History retention | 7 days | 30 days | 1 year | Forever |
| Team members | — | — | — | 3 |
| Priority support | ✗ | ✗ | ✗ | ✓ |

### USD Pricing (International)

| Plan | Monthly | Yearly (per month) |
|------|---------|-------------------|
| Free | $0 | $0 |
| Starter | $9 | $7 |
| Pro | $24 | $19 |
| Agency | $59 | $47 |

- Yearly billing saves ~20%
- Starter and Pro include 14-day free trial
- Agency plan is **coming soon** (waitlist available)
- No lock-in, cancel anytime, unused quota doesn't roll over

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.4 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5.7.3 |
| Styling | Tailwind CSS 3.4.17 |
| Components | shadcn/ui + Radix UI |
| Icons | Lucide React |
| Charts | Recharts |
| Forms | React Hook Form 7.54 + Zod 3.24 |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| File Storage | Cloudflare R2 |
| PDF Generation | @react-pdf/renderer |
| Deployment | Cloudflare Workers via OpenNext |
| Dark Mode | next-themes |
| Toasts | Sonner |
| Dates | date-fns |
| Animations | Lenis (smooth scroll) |

---

## Authentication

- **Supabase Auth** with email/password and Google OAuth
- Server-side JWT validation via `getUser()` (not `getSession()`)
- Middleware handles auth redirects for protected routes
- All API routes use `authenticateRequest()` helper
- Password reset flow via email confirmation

---

## Payment Integration

- **Razorpay** for payment processing
- Supports INR (India) and USD (international)
- Subscription management: create, verify, downgrade
- Webhook handling for payment events
- Payment history tracking
- Order creation → payment verification → subscription activation flow
- Payment links auto-embedded in invoice emails

---

## Admin Dashboard

- **Hidden URL:** `/clorefy-ctrl-8x2m` (not linked anywhere in the UI)
- **Triple-layer authentication:**
  1. Email allowlist check
  2. Password verification
  3. PIN verification (stored as hash in `admin_config`)
- **Pure black theme** with dark/light toggle
- **Features:**
  - User management (view, suspend, reset usage, change tier)
  - Subscription overview and management
  - Revenue analytics with charts
  - AI usage monitoring
  - Security audit logs
  - System announcements (broadcast banners)
  - IP blocklist management
  - User data export
  - Tier override with reason tracking

---

## Security

| Layer | Implementation |
|-------|---------------|
| CSRF Protection | HMAC-signed tokens, 1-hour expiration, double-submit pattern |
| Rate Limiting | Postgres-based, category limits (AI: 10/min, Export: 20/min, General: 30/min) |
| Input Sanitization | XSS prevention, SQL injection pattern removal, path traversal prevention |
| Security Headers | X-Frame-Options, HSTS, CSP, X-Content-Type-Options, X-XSS-Protection |
| Database Security | RLS on all tables, type-safe operations via generated types |
| Audit Logging | All sensitive operations logged with IP, user agent, metadata |
| Cost Protection | Per-tier document limits, per-session message limits |
| Error Handling | Sanitized error messages, never expose internals |

---

## SEO

- Structured data (JSON-LD) for product and pricing pages
- Dynamic sitemap generation
- robots.txt configuration
- Meta tags and Open Graph tags on all public pages
- Breadcrumb navigation with structured data
- Semantic HTML throughout

---

## Deployment

- **Runtime:** Cloudflare Workers via OpenNext adapter
- **File Storage:** Cloudflare R2 (logos, signatures, exported documents)
- **Build:** `pnpm build` → OpenNext → Cloudflare Workers
- **Config:** `wrangler.json` for Cloudflare configuration
- **Environment:** `.env` for Supabase keys, DeepSeek API key, Razorpay keys

---

## Key Pages & Routes

### Public Pages
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/pricing` | Pricing plans with billing toggle |
| `/features` | Feature showcase |
| `/about` | About the company |
| `/contact` | Contact form |
| `/blog` | Blog listing |
| `/blog/[slug]` | Individual blog post |
| `/developers` | Developer/API info |

### Auth Pages
| Route | Description |
|-------|-------------|
| `/auth/login` | Email/password + Google login |
| `/auth/signup` | Account registration |
| `/auth/reset-password` | Password reset request |
| `/auth/update-password` | Set new password |
| `/auth/callback` | OAuth callback handler |
| `/auth/confirm` | Email confirmation handler |

### App Pages (Authenticated)
| Route | Description |
|-------|-------------|
| `/` (dashboard) | Main app — document generation prompt |
| `/onboarding` | Business profile setup wizard |
| `/business` | Business profile management |
| `/documents` | Document listing |
| `/history` | Session history |
| `/billing` | Subscription & payment management |
| `/settings` | App settings |
| `/profile` | User profile & business info |
| `/notifications` | Notification center |
| `/sign/[token]` | Document signing (token-based, no auth required) |

### Admin
| Route | Description |
|-------|-------------|
| `/clorefy-ctrl-8x2m` | Admin dashboard (hidden) |

### API Routes
| Route | Description |
|-------|-------------|
| `/api/ai/stream` | Streaming document generation (DeepSeek) |
| `/api/ai/onboarding` | Onboarding conversation (DeepSeek) |
| `/api/ai/detect-type` | Document type detection |
| `/api/ai/analyze-file` | File analysis (GPT-5.4 mini) |
| `/api/ai/profile-update` | AI-assisted profile updates (DeepSeek) |
| `/api/sessions/create` | Create new document session |
| `/api/sessions/create-linked` | Create linked session |
| `/api/sessions/linked` | Get linked sessions |
| `/api/signatures` | Signature management |
| `/api/signatures/sign` | Submit signature |
| `/api/storage/upload` | File upload to R2 |
| `/api/storage/url` | Get signed URL |
| `/api/storage/image` | Image serving |
| `/api/razorpay/create-order` | Create payment order |
| `/api/razorpay/verify` | Verify payment |
| `/api/razorpay/subscription` | Manage subscription |
| `/api/razorpay/downgrade` | Downgrade plan |
| `/api/razorpay/webhook` | Razorpay webhook handler |
| `/api/usage` | Get usage stats |
| `/api/csrf` | CSRF token endpoint |
| `/api/admin/*` | Admin API routes (auth, users, subscriptions, revenue, security, settings) |
