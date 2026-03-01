# Tech Stack

## Framework & Runtime

- **Next.js 16.1.6** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5.7.3** - Type safety
- **Node.js** - Runtime environment

## Backend & Database

- **Supabase** - Complete backend solution providing:
  - PostgreSQL database with pgvector extension
  - Authentication and user management
  - File storage (logos, signatures)
  - Edge Functions for serverless logic
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Vector embeddings for RAG

## AI & ML

- **DeepSeek V3** - Primary AI model for document generation
  - `deepseek-chat` for onboarding conversations
  - `deepseek-reasoner` for document generation and compliance monitoring
- **OpenAI Embeddings** - Vector embeddings for RAG (1536 dimensions)
- **RAG (Retrieval Augmented Generation)** - Semantic search for compliance rules using pgvector

## UI & Styling

- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Pre-built component library
- **Lucide React** - Icon library
- **next-themes** - Dark mode support

## Forms & Validation

- **React Hook Form 7.54.1** - Form state management
- **Zod 3.24.1** - Schema validation
- **@hookform/resolvers** - Form validation integration

## Document Generation & Export

- **@react-pdf/renderer** - PDF generation
- Custom DOCX export functionality
- Image export (PNG, JPG)

## Common Commands

```bash
# Development
pnpm dev              # Start dev server on localhost:3000

# Build & Deploy
pnpm build            # Production build
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint
```

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

## Key Libraries

- **@supabase/ssr** - Server-side rendering support for Supabase
- **class-variance-authority** - Component variant management
- **clsx** & **tailwind-merge** - Conditional className utilities
- **date-fns** - Date manipulation
- **sonner** - Toast notifications
- **recharts** - Data visualization

## TypeScript Configuration

- Target: ES6
- Module: ESNext with bundler resolution
- Strict mode enabled
- Path aliases: `@/*` maps to workspace root
- JSX: react-jsx (React 19 transform)
