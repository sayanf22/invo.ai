# INVO.AI - Overview & Architecture

## Product Overview

Invo.ai is a global AI-first platform that generates compliant invoices, contracts, and NDAs through conversational prompts.

**User Flow:**
```
User describes what they need → AI generates complete document → User edits if needed → Export in multiple formats
```

### Supported Countries (Equal Priority)
🇮🇳 India | 🇺🇸 USA | 🇬🇧 UK | 🇩🇪 Germany | 🇨🇦 Canada | 🇦🇺 Australia | 🇸🇬 Singapore | 🇦🇪 UAE | 🇵🇭 Philippines | 🇫🇷 France | 🇳🇱 Netherlands

---

## Core Principles

1. **AI writes complete documents** from scratch (not templates)
2. **Compliance rules** stored in Supabase using RAG (vector search)
3. **Everything is editable** by users after generation
4. **Business data** asked once during onboarding, stored permanently
5. **Only structured data** saved (no chat conversation logs)
6. **Multi-layer validation** before showing document to user
7. **Automated compliance monitoring** every 7 days via cron job
8. **All 11 countries** treated equally with same priority
9. **Backend powered entirely by Supabase**

---

## AI Model Strategy (Cost-Optimized)

### Three-Layer Architecture

| Layer | Model | Purpose | Frequency | Cost |
|-------|-------|---------|-----------|------|
| **Onboarding** | DeepSeek V3 Chat | Extract structured business data | One-time per user | ~$0.005/user |
| **Generation** | DeepSeek V3 | Generate invoices, contracts, NDAs | Every document | ~$0.00094/invoice |
| **Monitoring** | DeepSeek V3 Reasoning | Monitor legal/tax changes | Every 7 days | ~$1/month |

### Layer 1: Onboarding
- **Model:** DeepSeek V3 Chat (deepseek-chat) — fast responses for interactive conversation
- **Purpose:** Extract structured business data from user conversations
- **No web search during onboarding** - User simply selects client countries from list
- Compliance rules loaded later by automated cron job

### Layer 2: Document Generation
- **Model:** DeepSeek V3 Reasoning (deepseek-reasoner)
- **Pricing:**
  - Cache hit: $0.028 / 1M tokens
  - Cache miss: $0.28 / 1M tokens
  - Output: $0.42 / 1M tokens
- **Cache Optimization Strategy:**
  - System instructions → cached
  - Business profile per user → cached
  - Compliance rules per country → cached
  - Only user's unique prompt → not cached
- Uses RAG to fetch compliance rules from Supabase vector store

### Layer 3: Compliance Monitoring
- **Model:** DeepSeek V3 Reasoning (deepseek-reasoner)
- **Double Verification Process:**
  1. First search: Get initial compliance data
  2. Second search: Verify the data
  3. Only then save to database
- **Smart Update Logic:**
  - Changes detected → DELETE old, INSERT new
  - No changes → Keep existing data unchanged

---

## Backend Architecture (Supabase Only)

All backend services provided by Supabase:

| Service | Purpose |
|---------|---------|
| PostgreSQL + pgvector | Database with vector search |
| Authentication | User management |
| Storage | Logos, signatures, exports |
| Edge Functions | Serverless logic |
| Real-time | Live subscriptions |
| Row Level Security | Data protection |

> **No separate backend server needed** - Supabase handles everything

---

## RAG Implementation

### How RAG Works for Compliance Rules

**Step 1: Store Rules with Embeddings**
```
1. Store complete rules as JSON in compliance_rules table
2. Generate vector embedding using OpenAI embeddings
3. Store 1536-dimension vector in embedding column
4. Supabase pgvector enables similarity search
```

**Step 2: Query Rules Using RAG**
```
1. User's prompt: "Create invoice for Indian client"
2. AI extracts intent: Need India invoice compliance rules
3. Generate embedding for search query
4. Supabase performs vector similarity search
5. Returns most relevant compliance rules instantly
6. AI uses these rules to generate compliant invoice
```

### Benefits
- ✅ Semantic search (understands meaning, not keywords)
- ✅ Fast retrieval (milliseconds)
- ✅ Always uses most up-to-date rules
- ✅ Handles natural language queries

---

## Monthly Cost Projection

**Example: 500 users, 10,000 invoices**

| Service | Cost |
|---------|------|
| Onboarding (DeepSeek V3 Reasoning) | $5.00 |
| Invoice Generation (DeepSeek V3 + RAG) | $9.40 |
| Compliance Monitoring | $4.60 |
| Vector Embeddings (OpenAI) | $0.50 |
| Supabase Pro Plan | $25.00 |
| Vercel Hosting | $0-20 |
| **Total** | **$54.50 - $74.50** |
