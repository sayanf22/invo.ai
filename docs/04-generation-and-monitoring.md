# INVO.AI - Document Generation & Compliance Monitoring

## Invoice Generation Flow

> **Critical Principle:** Never search web during invoice generation. Always use cached compliance rules from Supabase via RAG.

---

### Step 1: Extract Intent

**Example Prompt:** "Create invoice for $5,000 to US client for web development"

**AI Task:** Parse natural language to extract:
- Document type (invoice, contract, NDA)
- Client's country
- Amount and currency
- Service/product description

**Model:** DeepSeek V3
**Cost:** ~$0.0003 per request

---

### Step 2: Fetch Compliance Rules (RAG)

**Process:**
```
1. Generate search query embedding
   → "United States invoice compliance requirements"

2. Vector similarity search in Supabase
   → Query compliance_rules table using pgvector
   → Filter: country = 'US' AND document_type = 'invoice'
   → Order by cosine distance

3. Validate rules freshness
   → Check if last_updated within 7 days
   → Flag if stale, error if missing

4. Return compliance rules as JSON
```

**Cost:** Zero (database query only)
**Speed:** Milliseconds

---

### Step 3: Ask Clarifying Questions

**AI determines missing fields:**
- Client company name
- Client address
- Specific service description
- Country-specific required fields

**One at a time:**
```
"I need a few more details:"
1. "What's your client's company name?"
2. "What's their address in the USA?"
3. "What specific service did you provide?"
```

---

### Step 4: Generate Complete Invoice

**DeepSeek V3 with Caching Strategy:**

| Component | Cached? | Description |
|-----------|---------|-------------|
| System Instructions | ✅ Yes | Permanent instructions |
| Business Profile | ✅ Yes | User's data from Supabase |
| Compliance Rules | ✅ Yes | From RAG query |
| User's Request | ❌ No | Unique to this invoice |

**Generated Data:**
- Invoice number (auto-generated sequential)
- Invoice date & due date
- Seller information (from business profile)
- Buyer information (from user input)
- Line items with descriptions, quantities, prices
- Tax calculations
- Legal notices (from compliance rules)
- Payment instructions

**Cost:** ~$0.0009 per invoice (70% cache hit rate)

---

### Step 5: Multi-Layer Validation

> **Critical:** Never show document without passing validation.

| Validation | Description |
|------------|-------------|
| **Schema** | JSON matches expected structure, required fields present |
| **Compliance** | Compare against compliance rules, legal notices included |
| **Mathematical** | Line totals, subtotals, taxes, final total all correct |
| **AI Review** | Second AI review for errors/ambiguities |
| **Rule-Based** | Regex patterns, date formats, currency codes |

**Confidence Score Decision:**
| Score | Action |
|-------|--------|
| ≥ 0.95 | Show to user (high confidence) |
| 0.85-0.95 | Show with warning flag |
| < 0.85 | Block, escalate to human review |

---

### Step 6: Present to User (Editable Interface)

**Two-Panel Layout:**

| Left Panel | Right Panel |
|------------|-------------|
| Editable form with all fields | Live preview (updates in real-time) |
| Calendar pickers, dropdowns | Professional styling with logo |
| Add/remove line items | Click to jump to field |

**Every field is editable by user.**

**Bottom Bar:**
```
✓ Compliance Check Passed (96%)
[Save as Draft] [Export PDF] [Export DOCX] [Export PNG] [Export JPG]
```

---

### Step 7: Export Documents

**Via Supabase Edge Function:**

| Format | Process |
|--------|---------|
| **PDF** | Puppeteer renders HTML → 300 DPI → Flattened → Disclaimer added |
| **DOCX** | Convert data to Word format → Preserve formatting |
| **PNG/JPG** | Render high-resolution image → Optimize file size |

**Saved to Supabase:**
- Document data as JSONB
- AI model used
- Compliance rules version
- Validation scores
- Edit history
- Export formats

---

## Compliance Monitoring System

### Schedule
- **Frequency:** Every 7 days (Supabase Edge Function cron)
- **Timing:** Low-traffic time (e.g., 3:00 AM UTC)
- **Scope:** All 11 countries checked

---

### Double Verification Process

#### Step 1: First Search (Initial Data)

**Query (using DeepSeek V3 Reasoning):**
```
Search for official tax and invoice law changes in [country] 
in the last 7 days.

Focus on:
- Invoice requirements changes
- Tax rate modifications
- New compliance mandates
- Invoice format updates

Search ONLY official government sources.
```

**Returns:**
- Change detected? (boolean)
- Summary of changes
- New compliance rules (JSON)
- Source URLs (government links)
- Effective date

---

#### Step 2: Second Search (Verification)

**Query:**
```
Verify the following compliance information for [country]:
[First search results]

Confirm:
1. Are these changes actually implemented?
2. Are the tax rates correct?
3. Are source URLs legitimate government sources?
4. Is the effective date accurate?
```

**Returns:**
- Verified? (boolean)
- Confidence score (0-1)
- Discrepancies found
- Additional sources

---

#### Step 3: Compare with Existing Data

```
Fetch current rules from Supabase
→ Compare every field
→ EXACT MATCH = No changes
→ ANY DIFFERENCE = Changes detected
```

---

#### Step 4: Smart Database Update

**IF NO CHANGES:**
```
- Do NOT update database
- Do NOT change last_updated timestamp
- Log: "No changes for [country] - data remains current"
- Move to next country
```

**IF CHANGES DETECTED AND VERIFIED:**
```sql
-- 1. DELETE old entry
DELETE FROM compliance_rules 
WHERE country = 'IN' AND document_type = 'invoice';

-- 2. INSERT new entry
INSERT INTO compliance_rules (
  country, document_type, rules, embedding, 
  last_updated, validated_by, confidence_score
) VALUES (...);

-- 3. Create alert
INSERT INTO compliance_alerts (
  country, summary, severity, source_urls, 
  effective_date, status
) VALUES (...);
```

---

#### Step 5: Generate New Vector Embedding

```
1. Convert rules JSON to text
2. Send to OpenAI Embeddings API
3. Get 1536-dimension vector
4. Store in embedding column
5. pgvector index auto-updated
```

---

### Example: India GST Rate Change

**Day 0: Existing Rule**
```json
{
  "country": "IN",
  "tax_rules": {"gst_rate": 18},
  "last_updated": "2025-02-01"
}
```

**Day 7: Cron Job Runs**
```
First Search: "India GST rate changed to 20% effective March 1"
Second Search: "Confirmed: GST 18% → 20% effective March 1, 2025"
                Source: gst.gov.in

Comparison:
  OLD: gst_rate = 18
  NEW: gst_rate = 20
  RESULT: Change detected ✓

Action: DELETE old → INSERT new
```

**Result:** All future invoices use 20% GST automatically.

---

### Monitoring Cost

| Item | Cost |
|------|------|
| 11 countries × 2 searches | ~$0.75 |
| Input tokens | ~$0.15 |
| Output tokens | ~$0.15 |
| Vector embeddings | ~$0.10 |
| **Per check** | **~$1.15** |
| **Monthly (4 checks)** | **~$4.60** |

---

## Technical Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 15 | App Router |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| React Hook Form + Zod | Form validation |
| TipTap | Rich text editing |
| react-pdf | Client-side PDF preview |

### Backend (Supabase Only)
| Service | Purpose |
|---------|---------|
| PostgreSQL | Data storage |
| pgvector | RAG vector search |
| Auth | User authentication |
| Storage | Logos, signatures, exports |
| Edge Functions | Serverless logic, cron jobs |
| Real-time | Live updates |

### AI Integration
| Model | Purpose |
|-------|---------|
| DeepSeek V3 | Document generation |
| DeepSeek V3 Reasoning | Onboarding, monitoring |
| OpenAI Embeddings | Vector generation |

### Deployment
| Service | Purpose |
|---------|---------|
| Vercel | Next.js hosting |
| Supabase Cloud | All backend |
| Cloudflare | CDN (optional) |

---

## Critical Implementation Notes

| # | Rule |
|---|------|
| 1 | **Country Equality** - All 11 countries same priority |
| 2 | **No Web Search in Onboarding** - Just save selections |
| 3 | **RAG Only for Generation** - Never search web |
| 4 | **Double Verification** - Two searches before saving |
| 5 | **Smart Update** - Only change if actual changes |
| 6 | **Complete Replacement** - DELETE old, INSERT new |
| 7 | **Backend = Supabase** - No separate server |
| 8 | **70%+ Cache Rate** - Optimize prompt structure |
| 9 | **RLS Enforced** - Users see only their data |
| 10 | **Edit History** - Track all user changes |
| 11 | **Validation Mandatory** - Never skip validation |
| 12 | **Disclaimers Required** - On every exported document |

### Required Disclaimer
```
This document was generated using AI technology. While validated 
for compliance, we recommend review by qualified professionals 
before use.
```
