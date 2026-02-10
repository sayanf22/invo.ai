# INVO.AI - Database Schema

## Overview

Four main tables in Supabase PostgreSQL with pgvector extension enabled.

---

## Table 1: business_profiles

Stores permanent business information collected during onboarding.

### Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Reference to auth.users |
| `business_type` | TEXT | freelancer, agency, SaaS, ecommerce, professional |
| `business_name` | TEXT | Company or individual name |
| `owner_name` | TEXT | Full name of owner |
| `email` | TEXT | Business email |
| `phone` | TEXT | Phone with country code |
| `country` | TEXT(2) | 2-letter ISO code (IN, US, UK) |
| `state_province` | TEXT | State or province |
| `address` | JSONB | Structured address object |
| `tax_ids` | JSONB | Country-specific tax IDs |
| `default_currency` | TEXT(3) | ISO currency code (INR, USD) |
| `payment_terms` | TEXT | net_30, net_15, immediate |
| `payment_methods` | JSONB | Bank, UPI, international details |
| `logo_url` | TEXT | Supabase Storage URL |
| `signature_url` | TEXT | Supabase Storage URL |
| `client_countries` | TEXT[] | Array of ISO country codes |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Address JSONB Structure
```json
{
  "line1": "123 Main Street",
  "line2": "Suite 100",
  "city": "Mumbai",
  "state": "Maharashtra",
  "postal_code": "400001"
}
```

### Tax IDs JSONB Structure (by country)
```json
{
  "gstin": "29ABCDE1234F1Z5",     // India
  "ein": "12-3456789",            // USA
  "vat": "GB123456789",           // UK
  "abn": "12345678901",           // Australia
  "trn": "100123456789012"        // UAE
}
```

### Payment Methods JSONB Structure
```json
{
  "bank_transfer": {
    "bank_name": "HDFC Bank",
    "account_holder": "John Doe",
    "account_number": "1234567890",
    "ifsc_code": "HDFC0001234"
  },
  "upi": "business@upi",
  "international": {
    "iban": "GB82WEST12345698765432",
    "swift": "HDFCINBB"
  },
  "paypal": "business@email.com"
}
```

### Indexes
- `idx_business_profiles_user_id` on `user_id`

---

## Table 2: compliance_rules

Stores legal/tax requirements with vector embeddings for RAG.

### Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `country` | TEXT(2) | 2-letter ISO code |
| `document_type` | TEXT | invoice, contract, NDA |
| `rules` | JSONB | Complete compliance rules |
| `source_urls` | TEXT[] | Government website sources |
| `confidence_score` | DECIMAL | 0-1 from AI extraction |
| `last_updated` | TIMESTAMPTZ | Last update timestamp |
| `validated_by` | TEXT | AI or human email |
| `needs_human_review` | BOOLEAN | Flag for manual review |
| `embedding` | VECTOR(1536) | Vector for RAG search |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### Rules JSONB Structure
```json
{
  "required_fields": [
    {"name": "invoice_number", "format": "alphanumeric"},
    {"name": "gstin", "format": "15-char", "validation": "regex"}
  ],
  "tax_rules": {
    "domestic": {"gst_rate": 18, "applicable_on": "services"},
    "export": {"gst_rate": 0, "requires": "lut_bond"}
  },
  "legal_notices": [
    "This is a computer generated invoice",
    "Subject to jurisdiction of Mumbai courts"
  ],
  "format_requirements": {
    "invoice_number": "sequential",
    "date_format": "DD/MM/YYYY"
  }
}
```

### Indexes
- `idx_compliance_country_doctype` on `(country, document_type)`
- `idx_compliance_last_updated` on `last_updated`
- `idx_compliance_embedding` using ivfflat on `embedding`

---

## Table 3: generated_documents

Stores every document created by users for history and auditing.

### Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Reference to auth.users |
| `document_type` | TEXT | invoice, contract, NDA |
| `document_data` | JSONB | Complete document data |
| `ai_model_used` | TEXT | Model that generated it |
| `compliance_version` | TEXT | Compliance rules version used |
| `confidence_score` | DECIMAL | Validation confidence 0-1 |
| `validation_results` | JSONB | Which checks passed |
| `needs_human_review` | BOOLEAN | Flag for low confidence |
| `user_edited` | BOOLEAN | If user modified document |
| `edit_history` | JSONB[] | Array of edit records |
| `export_formats` | TEXT[] | PDF, DOCX, PNG, JPG |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### Document Data JSONB (Invoice Example)
```json
{
  "invoice_number": "INV-2025-001",
  "invoice_date": "2025-02-09",
  "due_date": "2025-03-11",
  "seller": { "...business profile data..." },
  "buyer": {
    "name": "Acme Corp",
    "address": "...",
    "tax_id": "..."
  },
  "line_items": [
    {
      "description": "Web Development Services",
      "quantity": 1,
      "unit_price": 5000,
      "total": 5000
    }
  ],
  "subtotal": 5000,
  "tax_amount": 900,
  "total": 5900,
  "currency": "USD",
  "legal_notices": ["..."],
  "payment_instructions": "..."
}
```

### Indexes
- `idx_generated_docs_user_id` on `user_id`
- `idx_generated_docs_created_at` on `created_at`

---

## Table 4: compliance_alerts

Stores detected changes in laws/regulations for admin review.

### Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `country` | TEXT(2) | Country where change detected |
| `summary` | TEXT | What changed |
| `severity` | TEXT | low, medium, high |
| `source_urls` | TEXT[] | Source URLs |
| `effective_date` | DATE | When change takes effect |
| `status` | TEXT | pending_review, approved, rejected |
| `reviewed_by` | TEXT | Admin who reviewed |
| `reviewed_at` | TIMESTAMPTZ | Review timestamp |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### Indexes
- `idx_alerts_status` on `status`
- `idx_alerts_created_at` on `created_at`

---

## Row Level Security (RLS) Policies

### business_profiles
```sql
-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
  ON business_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON business_profiles FOR UPDATE
  USING (auth.uid() = user_id);
```

### generated_documents
```sql
-- Users can only see their own documents
CREATE POLICY "Users can view own documents"
  ON generated_documents FOR SELECT
  USING (auth.uid() = user_id);
```

### compliance_rules
```sql
-- Everyone can read compliance rules
CREATE POLICY "Public read access"
  ON compliance_rules FOR SELECT
  TO authenticated
  USING (true);
```

---

## Vector Search Query Example

```sql
-- Find compliance rules for India invoice
SELECT *
FROM compliance_rules
WHERE country = 'IN'
  AND document_type = 'invoice'
ORDER BY embedding <-> $query_embedding
LIMIT 1;
```
