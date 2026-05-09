# Document Types Expansion Plan

## Objective

Expand Invo.ai from an invoice/contract generator to a comprehensive "go-to" business document platform that serves any business document need. This includes both system-generated templates AND user-defined custom documents stored in RAG for contextual AI generation.

---

## Phase 1: Core Document Categories (Priority 1)

### 1.1 Financial Documents (Already Implemented)
| Document Type | Status | Countries |
|---------------|--------|-----------|
| Invoices | ✅ Live | 11 countries |
| Quotations | ✅ Live | 11 countries |
| Proposals | ✅ Live | 11 countries |
| Contracts | ✅ Live | 11 countries |

---

### 1.2 Legal & Business Contracts (NEW)

#### A. Service Agreements
| Document | Description | Priority |
|----------|-------------|----------|
| Master Service Agreement (MSA) | Framework agreement for ongoing services | HIGH |
| Service Level Agreement (SLA) | Defines service standards and metrics | HIGH |
| Statement of Work (SOW) | Project-specific work description | HIGH |
| Consulting Agreement | Consultant engagement terms | HIGH |

#### B. NDA & Confidentiality
| Document | Description | Priority |
|----------|-------------|----------|
| Non-Disclosure Agreement (NDA) | Mutual or one-way confidentiality | HIGH |
| Confidentiality Agreement | Extended privacy terms | MEDIUM |
| Non-Compete Agreement | Restrict competition during/after engagement | MEDIUM |

#### C. Sales & Procurement
| Document | Description | Priority |
|----------|-------------|----------|
| Sales Agreement | Terms for product/service sales | HIGH |
| Purchase Order | Order for goods/services | HIGH |
| Supply Agreement | Ongoing supply terms | MEDIUM |
| Distribution Agreement | Distributor terms | MEDIUM |
| Agency Agreement | Sales agent representation | MEDIUM |

#### D. Partnership & Corporate
| Document | Description | Priority |
|----------|-------------|----------|
| Partnership Agreement | Business partnership terms | HIGH |
| Joint Venture Agreement | Collaboration terms | MEDIUM |
| Shareholder Agreement | Ownership and rights | MEDIUM |
| Operating Agreement (LLC) | Internal LLC rules | MEDIUM |

#### E. Property & Lease
| Document | Description | Priority |
|----------|-------------|----------|
| Commercial Lease Agreement | Office/space rental | MEDIUM |
| Equipment Lease Agreement | Equipment rental terms | MEDIUM |
| Rental Application | Tenant screening | LOW |

---

### 1.3 Human Resources Documents (NEW)

#### A. Employment Documents
| Document | Description | Priority |
|----------|-------------|----------|
| Employment Contract | Full-time employment terms | HIGH |
| Offer Letter | Job offer details | HIGH |
| Independent Contractor Agreement | Freelancer/contractor terms | HIGH |
| Part-time Employment Agreement | Part-time worker terms | MEDIUM |
| Seasonal Employment Contract | Temporary/seasonal workers | MEDIUM |

#### B. HR Policies & Handbooks
| Document | Description | Priority |
|----------|-------------|----------|
| Employee Handbook | Company policies and procedures | HIGH |
| Code of Conduct | Behavior expectations | HIGH |
| Anti-Harassment Policy | Workplace harassment prevention | HIGH |
| Equal Opportunity Policy | EEO compliance | HIGH |
| Remote Work Policy | Work-from-home guidelines | MEDIUM |
| Bring Your Own Device (BYOD) Policy | Device usage at work | MEDIUM |
| Leave Policy | Vacation, sick leave, PTO | MEDIUM |
| Grievance Policy | Employee complaint process | MEDIUM |
| Disciplinary Policy | Disciplinary procedures | MEDIUM |

#### C. Termination & Exit
| Document | Description | Priority |
|----------|-------------|----------|
| Termination Letter | Employment termination notice | HIGH |
| Exit Interview Form | Offboarding questionnaire | MEDIUM |
| Non-Compete Release | Release from non-compete | LOW |
| Reference Letter | Employment reference | MEDIUM |

---

## Phase 2: Operational Documents (Priority 2)

### 2.1 Administrative Documents
| Document | Description | Priority |
|----------|-------------|----------|
| Business Plan | Company strategy and projections | HIGH |
| Company Profile | Overview for clients/partners | HIGH |
| Meeting Minutes | Record of meetings | MEDIUM |
| Board Resolution | Official board decisions | MEDIUM |
| Power of Attorney | Legal representation授权 | MEDIUM |
| Letter of Authorization | Delegate authority | MEDIUM |
| Certificate of Incorporation | Company formation doc | LOW |

### 2.2 Project Management
| Document | Description | Priority |
|----------|-------------|----------|
| Project Proposal | Project overview and plan | HIGH |
| Project Charter | Project authorization | MEDIUM |
| Project Timeline | Schedule and milestones | MEDIUM |
| Risk Assessment | Project risk analysis | MEDIUM |
| Change Request | Scope change documentation | MEDIUM |

### 2.3 Standard Operating Procedures (SOPs)
| Document | Description | Priority |
|----------|-------------|----------|
| General SOP Template | Standard procedure format | MEDIUM |
| Onboarding SOP | Employee onboarding process | MEDIUM |
| Customer Support SOP | Support procedures | MEDIUM |
| Billing SOP | Invoice/payment procedures | MEDIUM |

---

## Phase 3: Compliance & Legal (Priority 3)

### 3.1 Website & Digital
| Document | Description | Priority |
|----------|-------------|----------|
| Terms of Service | Website/platform terms | HIGH |
| Privacy Policy | Data protection policy | HIGH |
| Cookie Policy | Cookie usage disclosure | MEDIUM |
| Terms & Conditions (E-commerce) | Online sales terms | HIGH |
| Return & Refund Policy | Return procedures | HIGH |
| Shipping Policy | Delivery terms | MEDIUM |

### 3.2 Regulatory & Tax
| Document | Description | Priority |
|----------|-------------|----------|
| Tax Registration Application | GST/VAT registration | HIGH |
| Business License Application | Operating license | MEDIUM |
| Compliance Certification | Industry compliance proof | MEDIUM |
| Import/Export Declaration | Trade documentation | LOW |

### 3.3 Industry-Specific
| Document | Description | Priority |
|----------|-------------|----------|
| Healthcare (HIPAA BAA) | Health data sharing | MEDIUM |
| Financial (NDA) | Financial data confidentiality | MEDIUM |
| Construction Contract | Project-based construction | MEDIUM |
| Real Estate Agreement | Property transactions | MEDIUM |

---

## Phase 4: User Custom Documents (RAG Integration)

### 4.1 Custom Document Upload
Users can upload their own documents to use as context for AI generation:

| Feature | Description |
|---------|-------------|
| Document Upload | PDF, DOCX, TXT upload to RAG |
| Vector Storage | Store embeddings in pgvector |
| Context Retrieval | Fetch relevant docs during generation |
| Template Extraction | AI extracts structure from uploaded docs |

### 4.2 RAG Document Storage Schema

```sql
-- User's custom documents for RAG
CREATE TABLE user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL, -- Full text content
  embedding vector(1536), -- OpenAI embeddings
  document_type TEXT, -- Category (contract, policy, template)
  is_template BOOLEAN DEFAULT false,
  metadata JSONB, -- Original filename, upload date, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RAG context links (which documents to use for generation)
CREATE TABLE document_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES document_sessions(id),
  user_document_id UUID REFERENCES user_documents(id),
  relevance_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Custom Document Categories (User-Defined)
- **Templates**: User's own document templates
- **Contracts**: Existing contracts to reference
- **Policies**: Company policies
- **Past Documents**: Previous successful documents
- **Industry Docs**: Industry-specific references
- **Notes**: Internal notes and preferences

---

## Phase 5: Country-Specific Templates

Each document type requires country-specific compliance:

### Supported Countries (11)
India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands

### Country-Specific Elements
| Element | Examples |
|---------|----------|
| Legal Requirements | Mandatory clauses per jurisdiction |
| Tax Rates | VAT, GST, Sales Tax percentages |
| Currency | Local currency formatting |
| Date Formats | DD/MM/YYYY vs MM/DD/YYYY |
| Language | Required language clauses |
| Signatures | Electronic signature laws |
| Data Protection | GDPR, CCPA, LGPD compliance |

---

## Implementation Roadmap

### Step 1: Database Schema Updates
```sql
-- Add new document type categories
ALTER TYPE document_type ADD VALUE 'service_agreement';
ALTER TYPE document_type ADD VALUE 'nda';
ALTER TYPE document_type ADD VALUE 'employment';
ALTER TYPE document_type ADD VALUE 'policy';
-- ... etc
```

### Step 2: RAG Integration
- Create user_documents table
- Implement vector embedding storage
- Build retrieval pipeline
- Add document upload UI

### Step 3: Template Creation
- 44 templates × 11 countries = 484 base templates
- Add new document categories:
  - Legal (30+ types)
  - HR (20+ types)
  - Operations (15+ types)
  - Compliance (10+ types)
  - **New total target: 100+ document types**

### Step 4: AI Model Updates
- Fine-tune prompts for new document types
- Add country-specific compliance checking
- Implement custom document context retrieval

---

## Summary Statistics

| Category | Current | Target |
|----------|---------|--------|
| Document Types | 4 | 100+ |
| Templates | 44 | 500+ |
| Countries | 11 | 11 |
| Custom RAG Docs | ❌ | ✅ |

---

## Priority Order for Implementation

1. **Immediate (Phase 1)**
   - Service Agreements (MSA, SOW, SLA)
   - Employment Contracts
   - NDAs
   - Employee Handbook template

2. **Short-term (Phase 2)**
   - Sales Agreements
   - Contractor Agreements
   - Policies (Privacy, Terms, Remote Work)
   - Business Plan template

3. **Medium-term (Phase 3)**
   - All HR documents
   - Operational SOPs
   - Compliance documents

4. **Long-term (Phase 4)**
   - Custom RAG document upload
   - Industry-specific documents
   - Advanced templates

---

## Notes

- No code changes required for this plan
- Each document type needs AI prompt engineering
- Country-specific compliance rules must be researched per type
- User custom documents stored in RAG provide contextual memory for AI
- All new documents should be editable after generation