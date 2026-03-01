# Project Structure

## Root Configuration Files

- `next.config.mjs` - Next.js configuration with security headers
- `tsconfig.json` - TypeScript compiler configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `components.json` - shadcn/ui component configuration
- `middleware.ts` - Next.js middleware for auth and routing
- `.env` / `.env.local` - Environment variables (Supabase, DeepSeek API keys)

## Directory Organization

### `/app` - Next.js App Router

**Pages:**
- `page.tsx` - Main dashboard/home page
- `layout.tsx` - Root layout with providers
- `globals.css` - Global styles

**Routes:**
- `/auth/*` - Authentication flows (login, signup, callback)
- `/onboarding/*` - Business profile setup wizard
- `/sign/[token]/*` - Document signing with token-based access
- `/api/*` - API routes (see API Routes section below)

### `/components` - React Components

**Core Components:**
- `app-shell.tsx` - Main application layout wrapper
- `auth-provider.tsx` - Authentication context provider
- `theme-provider.tsx` - Dark mode theme provider

**Document Components:**
- `document-preview.tsx` - Live document preview
- `editor-panel.tsx` - Document editing interface
- `pdf-download-button.tsx` - Export functionality
- `signature-pad.tsx` - Digital signature capture

**Prompt/Generation Components:**
- `prompt-screen.tsx` / `prompt-screen-new.tsx` - Document generation UI
- `builder-prompt-bar.tsx` - Prompt input for document builder
- `prompt-input.tsx` - Reusable prompt input component
- `onboarding-chat.tsx` - Conversational onboarding interface

**UI Components:**
- `/ui/*` - shadcn/ui components (50+ components: buttons, forms, dialogs, etc.)
- `template-selector.tsx` - Document type selection
- `category-pills.tsx` - Category filtering UI
- `user-profile-menu.tsx` - User menu dropdown

### `/lib` - Utility Libraries & Core Logic

**Database & Auth:**
- `supabase.ts` - Browser Supabase client (singleton pattern)
- `supabase-server.ts` - Server-side Supabase client
- `database.types.ts` - TypeScript types generated from Supabase schema
- `api-auth.ts` - API route authentication helpers

**AI & Generation:**
- `deepseek.ts` - DeepSeek API integration (streaming & non-streaming)
- `gemini.ts` - Alternative AI provider (if needed)
- `compliance.ts` - Compliance rule fetching and RAG logic

**Document Logic:**
- `document-templates.ts` - Document structure definitions
- `invoice-types.ts` - Invoice data type definitions
- `pdf-templates.tsx` - PDF generation templates using @react-pdf/renderer
- `validation.ts` - Document validation logic

**Utilities:**
- `utils.ts` - General utility functions (cn, etc.)
- `countries.ts` - Country data and ISO codes
- `rate-limiter.ts` - API rate limiting logic

### `/hooks` - Custom React Hooks

- `use-business.ts` - Business profile data fetching
- `use-document.ts` - Document state management
- `use-require-auth.ts` - Authentication guard hook
- `use-toast.ts` - Toast notification hook
- `use-mobile.tsx` - Mobile device detection

### `/docs` - Documentation

- `01-overview-and-architecture.md` - System architecture overview
- `02-database-schema.md` - Supabase database schema
- `03-onboarding-flow.md` - Onboarding process documentation
- `04-generation-and-monitoring.md` - Document generation workflow

### `/public` - Static Assets

- SVG placeholders and logos
- Publicly accessible files

### `/styles` - Additional Styles

- `globals.css` - Additional global styles (if needed)

## API Routes Structure

All API routes are in `/app/api/`:

**AI Endpoints:**
- `/api/ai/generate` - Non-streaming document generation
- `/api/ai/stream` - Streaming document generation
- `/api/ai/process` - Process user prompts
- `/api/ai/onboarding` - Onboarding conversation processing

**Document Operations:**
- `/api/validation/document` - Multi-layer document validation
- `/api/export/docx` - DOCX export
- `/api/export/image` - PNG/JPG export
- `/api/signatures` - Digital signature management

**Compliance:**
- `/api/compliance/query` - RAG-based compliance rule retrieval

## Database Schema (Supabase)

**Main Tables:**
- `profiles` - User profiles linked to auth.users
- `businesses` - Business profile data (onboarding results)
- `documents` - Generated documents with metadata
- `document_versions` - Document version history
- `compliance_rules` - Compliance rules with vector embeddings
- `compliance_alerts` - Detected legal/tax changes
- `signatures` - Digital signatures with token-based access

**Key Features:**
- Row Level Security (RLS) policies on all tables
- pgvector extension for semantic search
- Foreign key relationships between tables
- JSONB columns for flexible structured data

## Naming Conventions

- **Components:** PascalCase (e.g., `DocumentPreview.tsx`)
- **Utilities:** camelCase (e.g., `createClient()`)
- **API Routes:** kebab-case folders (e.g., `/api/ai/generate`)
- **Types:** PascalCase interfaces/types (e.g., `InvoiceData`)
- **Database tables:** snake_case (e.g., `business_profiles`)

## Import Aliases

Use `@/*` for imports from workspace root:
```typescript
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
```

## Key Patterns

- **Server Components by default** - Use `"use client"` only when needed
- **Supabase SSR** - Use appropriate client (browser vs server) based on context
- **Type safety** - All database operations use generated TypeScript types
- **Singleton pattern** - Supabase client reuses single instance
- **API route protection** - Middleware handles auth, API routes verify user
- **Streaming responses** - Use streaming for real-time AI generation feedback
