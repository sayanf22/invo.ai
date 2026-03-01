# Product Overview

Invo.ai is an AI-powered platform that generates compliant invoices, contracts, quotations, and proposals for 11 countries through conversational prompts.

## Core User Flow

User describes document need → AI generates complete document → User edits if needed → Export in multiple formats

## Supported Countries

India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands (all equal priority)

## Key Principles

- AI writes complete documents from scratch (not templates)
- Business data collected once during onboarding, stored permanently
- Everything is editable by users after generation
- Only structured data saved (no chat conversation logs)
- Multi-layer validation before showing documents to users
- Backend powered entirely by Supabase
- User profile accessible via hamburger menu for viewing/editing business information

## AI Model Strategy

**Two-Layer Architecture with Template-Enhanced Generation:**

1. **Onboarding Flow** - DeepSeek V3 Chat: Extract structured business data from conversations
2. **Document Generation** - DeepSeek V3 Chat: Generate invoices, contracts, quotations, and proposals using business profile data + country-specific compliance templates

**Template System:**
- 44 templates covering 11 countries × 4 document types
- Automatic compliance requirement injection
- Country-specific tax rates, mandatory fields, and legal requirements
- Auto-update system for regulatory changes (7-day review cycle)

## Document Types

- Invoices (with country-specific tax compliance)
- Contracts (service agreements, employment contracts)
- Quotations (price quotes, estimates, bids)
- Proposals (business proposals, project proposals, pitches)

## User Experience Flow

1. **Signup/Login** → User creates account with email
2. **Onboarding** → Conversational AI asks questions to build business profile
3. **Business Profile** → All data saved and accessible via menu
4. **Document Generation** → AI uses profile data to generate documents
5. **Edit & Export** → User can edit and export in multiple formats
