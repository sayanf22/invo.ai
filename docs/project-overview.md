# Clorefy (invo.ai) — Project Overview

> AI-powered document generation platform for businesses across 11 countries.

## Product Overview

Clorefy is a conversational AI platform that generates compliant invoices, contracts, quotations, and proposals. Users describe their document needs in natural language, and the AI produces complete, country-compliant documents ready for export and digital signing.

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

### 2. Business Onboarding via AI Chat
- First-time users go through a conversational onboarding flow
- AI asks questions to build a complete business profile
- Collected data: business name, type, address, tax IDs, payment methods, signatory, logo, signature
- Data stored permanently and reused for all future documents
- Profile editable anytime via hamburger menu → Profile page

### 3. Supported Countries (11)
All countries are equal priority with full compliance support:

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

### 4. Document Types
- **Invoices** — with country-specific tax compliance, line items, tax calculations
- **Contracts** — service agreements, employment contracts, with jurisdiction clauses
- **Quotations** — price quotes, estimates, bids with validity periods
- **Proposals** — business proposals, project proposals, pitches

### 5. Multi-Format Export
- **PDF** — via `@react-pdf/renderer`, 9 templates available
- **DOCX** — Word document export
- **Image** — PNG/JPG export

### 6. Digital Signatures
- Token-based access for external signers (no account required)
- Signature pad capture (drawn signatures)
- Tracks: signer name, email, IP address, user agent, document hash
- Signature tokens with expiration dates
- Party A / Party B signing flow

### 7. Custom Logo & Branding (Pro+)
- Upload business logo during onboarding or via profile
- Logo appears on all generated documents
- Custom signature upload

### 8. Document Linking
- **derived_from** — create a contract from a quotation, invoice from a proposal
- **related_to** — link related documents together
- Chain navigation UI for browsing linked document sessions

### 9. Session History
- Chat sessions preserved with full message history
- Chain navigator for browsing linked sessions
- Session sidebar for quick access to recent sessions
- History retention varies by plan (7 days → forever)

### 10. 9 Document Templates
Modern, Classic, Bold, Minimal, Elegant, Corporate, Creative, Warm, Geometric — each with distinct fonts, colors, and layouts.

### 11. File Analysis
- Upload PDFs, images, or documents for AI analysis
- AI reads file contents and can extract data for document generation
- Powered by OpenAI GPT-4.1 mini for vision/file understanding

---

## AI Models Used

| Model | API Name | Use Case | Input Cost | Output Cost |
|-------|----------|----------|------------|-------------|
| DeepSeek V3 | `deepseek-chat` | Onboarding, general chat, document generation | $0.27/1M tokens | $1.10/1M tokens |
| DeepSeek R1 | `deepseek-reasoner` | Complex reasoning tasks | $0.55/1M tokens | $2.19/1M tokens |
| OpenAI GPT-4.1 mini | `gpt-4.1-mini` | File analysis, PDF/image reading | $0.40/1M tokens | $1.60/1M tokens |

**Architecture:**
- Dual-mode system prompt: AI detects whether user wants conversation or document generation
- Document generation returns structured JSON; conversation returns Markdown
- Business context injected into every AI call
- Country-specific compliance rules embedded in system prompts
- 44 compliance templates (11 countries × 4 document types)

---

## Pricing Plans

### INR Pricing (India)

| Feature | Free | Starter (₹999/mo) | Pro (₹2,499/mo) | Agency (₹5,999/mo) |
|---------|------|-------------------|-----------------|-------------------|
| Documents/month | 5 | 50 | 150 | Unlimited |
| Document types | Invoice + Contract | All 4 | All 4 | All 4 |
| Messages/session | 10 | 30 | 50 | Unlimited |
| Templates | 3 | All 9 | All 9 | All 9 |
| Countries | All 11 | All 11 | All 11 | All 11 |
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
| Framework | Next.js 16.1.6 (App Router) |
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
| `/api/ai/stream` | Streaming document generation |
| `/api/ai/onboarding` | Onboarding conversation |
| `/api/ai/detect-type` | Document type detection |
| `/api/ai/analyze-file` | File analysis (PDF/image) |
| `/api/ai/profile-update` | AI-assisted profile updates |
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
