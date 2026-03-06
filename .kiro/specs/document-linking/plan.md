# Document Linking & Conversion — Implementation Plan

## Overview

Enable users to create linked documents from existing ones (e.g., Proposal → Invoice, Quotation → Contract). Documents in the same chain share context, and users can navigate between them easily.

## Core Concept: Document Chains

A "chain" is a group of related documents for the same client/project. Example flow:
```
Proposal (Acme Corp redesign) → Quotation (pricing breakdown) → Invoice (billing) → Contract (terms)
```

Each document in a chain knows its parent and siblings. The AI uses the parent document's data as context when generating the child.

---

## Phase 1: Database Schema

### New table: `document_links`

```sql
CREATE TABLE document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_session_id UUID NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  child_session_id UUID NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'derived_from',
  -- CHECK: relationship IN ('derived_from', 'related_to')
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_session_id, child_session_id)
);
```

### Add to `document_sessions`:
```sql
ALTER TABLE document_sessions ADD COLUMN client_name TEXT;
ALTER TABLE document_sessions ADD COLUMN chain_id UUID;
-- chain_id groups all related sessions together (first session's ID becomes the chain_id)
```

### RLS Policies:
- Users can only see links where they own both sessions
- INSERT/SELECT filtered by user_id through document_sessions join

---

## Phase 2: Backend — API Changes

### 2a. New API: `/api/sessions/create-linked`

POST body:
```json
{
  "parentSessionId": "uuid",
  "targetDocumentType": "invoice",
  "contextOverrides": {}  // optional overrides
}
```

Logic:
1. Load parent session + its context (document data)
2. Extract client name, items, amounts, currency, etc. from parent context
3. Create new session with `document_type = targetDocumentType`
4. Set `chain_id` = parent's `chain_id` (or parent's ID if no chain exists)
5. Insert into `document_links` (parent → child)
6. Pre-populate new session's `context` with mapped data from parent
7. Return new session ID

### 2b. New API: `/api/sessions/linked`

GET `?sessionId=uuid`

Returns all sessions in the same chain:
```json
{
  "chain": [
    { "id": "...", "document_type": "proposal", "title": "...", "client_name": "Acme Corp", "created_at": "...", "status": "completed" },
    { "id": "...", "document_type": "invoice", "title": "...", "client_name": "Acme Corp", "created_at": "...", "status": "active" }
  ],
  "currentSessionId": "..."
}
```

---

## Phase 3: Frontend — UI Components

### 3a. "Next Steps" Bar (bottom of chat, after generation)

Shows after AI generates a document successfully. Appears below the AI response message.

```
┌─────────────────────────────────────────────────┐
│  📄 What's next for Acme Corp?                  │
│                                                  │
│  [📋 Create Invoice]  [📝 Create Contract]      │
│  [💰 Create Quotation]                          │
│                                                  │
│  Based on this proposal's details               │
└─────────────────────────────────────────────────┘
```

Rules:
- Only shows for completed generations (not during loading)
- Extracts client name from the generated document data
- Filters out the current document type (don't show "Create Proposal" on a proposal)
- Clicking creates a linked session and navigates to it
- Subtle, non-intrusive design — card with muted background

### 3b. Document Chain Navigator (top bar)

A horizontal pill/tab bar in the chat header showing all linked documents:

```
┌──────────────────────────────────────────────────┐
│  ← │ [Proposal ✓] → [Invoice •] → [Contract]   │
│     │  Acme Corp                                  │
└──────────────────────────────────────────────────┘
```

- Shows only when current session has linked documents (chain_id exists)
- Each pill shows: document type icon + status indicator (✓ completed, • active)
- Clicking a pill switches to that session (loads its chat + document preview)
- Current session is highlighted
- Compact — doesn't take much vertical space

### 3c. Session History Sidebar Enhancement

In the existing history sidebar, group linked sessions together:

```
Acme Corp (3 documents)
  ├─ Proposal — Mar 4
  ├─ Invoice — Mar 4  
  └─ Contract — Mar 5

Other Client (1 document)
  └─ Invoice — Mar 3
```

---

## Phase 4: AI Context Passing

When creating a linked document, the AI prompt includes parent context:

```
CONTEXT FROM PREVIOUS DOCUMENT:
The user previously created a [proposal] for [Acme Corp] with the following details:
- Client: Acme Corp
- Items: Web Design Work ($1,500)
- Currency: USD
- Payment Terms: Net 30

Now generate a [invoice] based on this information. Use the same client details, items, and amounts unless the user specifies changes.
```

This is injected into the system prompt or conversation history when the linked session starts.

---

## Phase 5: Data Mapping (Document Type Conversions)

### Proposal/Quotation → Invoice
- Copy: client name, client email, client address, items, amounts, currency, tax
- Map: proposal title → invoice description
- Keep: payment terms, notes

### Proposal → Contract
- Copy: client name, client details, project scope from items
- Map: proposal items → contract scope/deliverables section
- Keep: payment terms, timeline

### Quotation → Invoice
- Direct 1:1 mapping (most fields are identical)
- Copy everything, change document type

### Invoice → Contract
- Copy: client details, amounts
- Map: invoice items → contract deliverables

### Any → Any (fallback)
- Always copy: client name, client email, client address, currency
- Always copy: items/line items if they exist
- Let AI fill in document-type-specific fields

---

## Implementation Order

1. **Database migration** — Add `document_links` table, `chain_id` and `client_name` to `document_sessions`
2. **API: `/api/sessions/create-linked`** — Create linked sessions with context
3. **API: `/api/sessions/linked`** — Fetch chain for a session
4. **Frontend: "Next Steps" bar** — Show conversion options after generation
5. **Frontend: Chain navigator** — Top bar for switching between linked docs
6. **Frontend: History grouping** — Group linked sessions in sidebar
7. **AI context injection** — Pass parent data to AI when generating linked docs

---

## UI Design Principles

- **Non-intrusive**: Next Steps bar only appears after successful generation, not during chat
- **Context-aware**: Shows client name extracted from the document, not generic labels
- **Minimal clicks**: One click to create a linked document, auto-navigates to it
- **Visual hierarchy**: Chain navigator is compact, doesn't compete with chat content
- **Consistent with app theme**: Uses existing cream/dark color scheme, rounded cards, subtle borders
- **No confusion**: Clear labels, document type icons, status indicators

---

## Files to Create/Modify

### New Files:
- `components/next-steps-bar.tsx` — Post-generation conversion options
- `components/chain-navigator.tsx` — Top bar for linked document navigation
- `app/api/sessions/create-linked/route.ts` — API for creating linked sessions
- `app/api/sessions/linked/route.ts` — API for fetching document chain

### Modified Files:
- `hooks/use-document-session.ts` — Add chain awareness, linked session creation
- `components/invoice-chat.tsx` — Integrate Next Steps bar after AI responses
- `components/app-shell.tsx` — Integrate Chain Navigator in header
- `components/session-history-sidebar.tsx` — Group linked sessions
- `lib/deepseek.ts` — Add parent context to AI prompts for linked docs
- `lib/invoice-types.ts` — Add chain-related type definitions
- `lib/database.types.ts` — Regenerate after migration

---

## Technical Notes

- `chain_id` is set to the first session's ID in a chain (self-referencing for the root)
- When extracting client name, check `context.clientName` or `context.billTo?.name` or `context.recipientName`
- The "Next Steps" bar reads from the current session's context JSONB
- Chain navigator uses a single query: `SELECT * FROM document_sessions WHERE chain_id = ? ORDER BY created_at`
- No Framer Motion for the Next Steps bar — use CSS transitions for simplicity
- All new components follow existing patterns: `"use client"`, Tailwind, shadcn/ui primitives

---

## References

- [InvoiceCrowd: Best Practices for Combining Invoicing and Proposal Systems](https://invoicecrowd.com/seamless-integration-best-practices-for-combining-invoicing-and-proposal-systems/) — Enter details once, use across proposals and invoices
- [InvoiceMaster: Convert Quotes to Invoices](https://invoicemaster.org/blog/post/quote-to-invoice-one-click) — One-click quote-to-invoice conversion pattern
- [DealHub: Quote-to-Invoice](https://dealhub.io/glossary/quote-to-invoice/) — Standard quote-to-invoice workflow stages
- [Alguna: Best Quoting and Invoicing Software 2026](https://blog.alguna.com/quoting-and-invoicing-software/) — Automated quote-to-invoice conversion as key feature
