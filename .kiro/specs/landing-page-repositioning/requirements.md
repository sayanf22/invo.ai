# Requirements Document

## Introduction

Reposition Clorefy's landing page and section pages from a generic "AI document generator" to a professional-authority platform purpose-built for freelancers, agencies, and small service businesses. The repositioning addresses real pain points discovered through market research: competitors like HoneyBook are US/Canada-only with 89% price hikes, Bonsai's tax tools only work for US freelancers, FreshBooks caps clients at 5 and lacks contracts/proposals, and ChatGPT cannot handle compliance, payments, or business context. The new copy positions Clorefy as the single platform that writes complete, country-compliant business documents from a conversational prompt — solving the "5+ hours/month on manual invoicing" problem that causes 3× higher cash-flow risk for small businesses.

All changes are text-only. No UI components, animations, layouts, or functionality changes.

## Glossary

- **Landing_Page**: The marketing homepage at the root URL shown to non-authenticated visitors, composed of multiple section components
- **Section_Pages**: Sub-pages accessible from the landing page including /features, /use-cases/[slug], /business, and /resources
- **Copy_System**: The collection of all user-facing text strings (headings, subheadings, body text, CTAs, labels, stat values) across landing and section pages
- **Positioning_Tone**: Professional authority — serious, trust-building, emphasizing compliance, accuracy, and reliability over playfulness
- **Primary_Audience**: Freelancers, agencies, and small service businesses who create invoices, contracts, quotations, and proposals regularly
- **Competitor_Set**: Zoho Invoice, FreshBooks, HoneyBook, Bonsai, AND.co — the tools the Primary_Audience currently uses
- **Document_Types**: The 9+ business document types Clorefy supports (invoices, contracts, quotations, proposals, NDAs, SOWs, and more)
- **Compliance_Engine**: Clorefy's built-in system that auto-applies country-specific tax rules, mandatory fields, and legal requirements for 11 countries
- **Four_Docs_Reference**: Any text that limits Clorefy's positioning to only 4 document types (invoice, contract, quotation, proposal) when the platform supports 9+

## Requirements

### Requirement 1: Hero Section Repositioning

**User Story:** As a freelancer visiting Clorefy for the first time, I want to immediately understand that this platform solves my document creation and compliance pain, so that I feel confident this is built for professionals like me.

#### Acceptance Criteria

1. WHEN a visitor loads the Landing_Page, THE Copy_System SHALL display a hero headline that communicates AI-powered document generation positioned for service businesses rather than generic document creation.
2. WHEN a visitor reads the hero subtitle, THE Copy_System SHALL communicate that Clorefy handles compliance, tax rules, and payment links automatically — differentiating from manual tools and generic AI.
3. THE Copy_System SHALL use Positioning_Tone language in the hero section that conveys professional authority and reliability rather than casual or playful language.
4. THE Copy_System SHALL reference the breadth of Document_Types supported (9+ types) rather than limiting to 4 document types in the hero section.
5. WHEN a visitor views the hero section, THE Copy_System SHALL include a reference to multi-country compliance (11 countries) as a key differentiator.

### Requirement 2: Stats Section Repositioning

**User Story:** As a potential customer evaluating Clorefy, I want to see credible metrics that demonstrate the platform's value, so that I trust it can save me time and reduce errors.

#### Acceptance Criteria

1. THE Copy_System SHALL display stats that reference real pain points from the Primary_Audience (time spent on manual document creation, compliance error rates, payment delays).
2. THE Copy_System SHALL use stat labels and descriptions that align with Positioning_Tone (professional, specific, trust-building).
3. THE Copy_System SHALL avoid vague or unsubstantiated superlatives in stat descriptions.

### Requirement 3: Why Not ChatGPT Section Repositioning

**User Story:** As a freelancer who has tried using ChatGPT for business documents, I want to understand why a purpose-built tool is better, so that I see the value in switching to Clorefy.

#### Acceptance Criteria

1. WHEN a visitor reads the Why Not ChatGPT section, THE Copy_System SHALL articulate specific limitations of generic AI tools: hallucinations in legal/tax content, no compliance awareness, no payment integration, no business context memory, and no formatted output.
2. THE Copy_System SHALL position Clorefy's Compliance_Engine as the key differentiator — auto-applying country-specific tax rules that generic AI cannot reliably provide.
3. THE Copy_System SHALL reference that uploading contracts to consumer AI tools risks confidentiality breaches and lacks professional accountability.
4. THE Copy_System SHALL maintain Positioning_Tone by stating facts about ChatGPT limitations rather than mocking or dismissing it.

### Requirement 4: Persona Tabs Repositioning

**User Story:** As a visitor identifying with a specific role (freelancer, agency owner, developer), I want to see how Clorefy solves my specific workflow problems, so that I feel the product was designed for people like me.

#### Acceptance Criteria

1. THE Copy_System SHALL include persona descriptions that reference specific pain points discovered in market research: HoneyBook's geographic limitations, FreshBooks' client caps, Bonsai's US-only tax tools, and the general "5 tools that don't talk to each other" problem.
2. WHEN a visitor selects a persona tab, THE Copy_System SHALL display a title and description that uses Positioning_Tone language appropriate for that role.
3. THE Copy_System SHALL ensure persona prompts and AI replies demonstrate realistic professional scenarios rather than generic examples.
4. THE Copy_System SHALL remove or update any Four_Docs_Reference in persona descriptions to reflect 9+ Document_Types.

### Requirement 5: AI Showcase Section Repositioning

**User Story:** As a potential customer, I want to understand Clorefy's generation process in terms that build trust in accuracy and compliance, so that I feel confident the output will be professional and correct.

#### Acceptance Criteria

1. THE Copy_System SHALL describe the AI generation process using language that emphasizes compliance verification, business context awareness, and professional formatting rather than generic "messy thought to masterpiece" framing.
2. WHEN a visitor views the AI Showcase steps, THE Copy_System SHALL use step descriptions that reference compliance checking, tax rule application, and professional document standards.
3. THE Copy_System SHALL replace casual language ("messy thought", "rough ideas") with Positioning_Tone language that conveys precision and reliability.

### Requirement 6: Features Section Repositioning

**User Story:** As a service business owner, I want to see features described in terms of business outcomes (faster payments, fewer compliance errors, time saved), so that I understand the ROI of using Clorefy.

#### Acceptance Criteria

1. THE Copy_System SHALL describe features using business-outcome language relevant to the Primary_Audience rather than generic productivity language.
2. THE Copy_System SHALL include feature descriptions that reference country-specific compliance, multi-format export, and payment integration as core capabilities.
3. THE Copy_System SHALL replace generic feature titles ("Text-to-Document", "AI Formatting", "Custom Templates") with titles that communicate professional document generation value.
4. THE Copy_System SHALL remove or update any Four_Docs_Reference in feature descriptions.

### Requirement 7: Multi-Device Section Repositioning

**User Story:** As a freelancer who works across devices, I want to understand that Clorefy works wherever I am, so that I know I can generate documents on the go.

#### Acceptance Criteria

1. THE Copy_System SHALL describe multi-device capability using Positioning_Tone language that emphasizes professional reliability across contexts (client meetings, travel, office).
2. THE Copy_System SHALL frame device flexibility as a business advantage (respond to clients faster, never miss a billing window) rather than a generic convenience feature.

### Requirement 8: Testimonials Section Repositioning

**User Story:** As a potential customer, I want to see social proof from people in my industry, so that I trust Clorefy works for businesses like mine.

#### Acceptance Criteria

1. THE Copy_System SHALL display testimonials that reference specific Primary_Audience roles (freelance designer, agency founder, consultant, developer).
2. THE Copy_System SHALL include testimonial content that mentions specific pain points solved (compliance headaches, hours saved on proposals, faster payments).
3. THE Copy_System SHALL use Positioning_Tone in testimonial framing text (section heading, subheading).

### Requirement 9: CTA Section Repositioning

**User Story:** As a visitor ready to try Clorefy, I want the call-to-action to reinforce the professional positioning, so that I feel I'm joining a serious business tool rather than a toy.

#### Acceptance Criteria

1. THE Copy_System SHALL use CTA headlines and body text that reinforce Positioning_Tone and reference the Primary_Audience's core need (compliant documents, faster payments, less admin).
2. THE Copy_System SHALL avoid inflated user counts or unverifiable claims in CTA supporting text.
3. THE Copy_System SHALL frame the free tier as a professional trial rather than a casual freebie.

### Requirement 10: Still Not Sure Section Repositioning

**User Story:** As a hesitant visitor, I want a low-pressure way to validate Clorefy's claims, so that I can make an informed decision.

#### Acceptance Criteria

1. THE Copy_System SHALL maintain the "ask AI about us" concept but frame it using Positioning_Tone language that conveys confidence rather than desperation.
2. THE Copy_System SHALL use professional language in the section heading and description.

### Requirement 11: Footer and Services Marquee Repositioning

**User Story:** As a visitor scrolling through the page, I want consistent professional messaging in all sections, so that the brand feels cohesive and trustworthy.

#### Acceptance Criteria

1. THE Copy_System SHALL ensure the services marquee displays Document_Types that reflect the full 9+ types supported rather than only 4.
2. THE Copy_System SHALL use Positioning_Tone language in footer taglines and descriptions.
3. THE Copy_System SHALL remove or update any Four_Docs_Reference in footer content.

### Requirement 12: Section Pages Repositioning

**User Story:** As a visitor exploring Clorefy's sub-pages (/features, /use-cases, /business, /resources), I want consistent professional positioning, so that the messaging reinforces trust regardless of which page I'm on.

#### Acceptance Criteria

1. WHEN a visitor navigates to any Section_Page, THE Copy_System SHALL display text that uses Positioning_Tone consistently with the Landing_Page.
2. THE Copy_System SHALL remove or update any Four_Docs_Reference on Section_Pages.
3. THE Copy_System SHALL reference the Primary_Audience's pain points and Clorefy's differentiators on Section_Pages.

### Requirement 13: Internal Pages Text Updates

**User Story:** As a user on the choose-plan or pricing page, I want the messaging to be consistent with the new professional positioning, so that the experience feels cohesive from landing page through signup.

#### Acceptance Criteria

1. WHEN a user views the choose-plan page, THE Copy_System SHALL use Positioning_Tone language that frames plan selection as a professional business decision.
2. WHEN a user views the pricing layout, THE Copy_System SHALL describe tier benefits using business-outcome language relevant to the Primary_Audience.
3. THE Copy_System SHALL remove or update any Four_Docs_Reference on internal pages.

### Requirement 14: Remove "4 Docs" Limitation References

**User Story:** As a potential customer, I want to understand the full breadth of Clorefy's capabilities, so that I don't underestimate the platform's value.

#### Acceptance Criteria

1. THE Copy_System SHALL replace all instances of "4 document types" or equivalent Four_Docs_Reference across all pages with references to 9+ Document_Types.
2. THE Copy_System SHALL update any lists that enumerate only "invoices, contracts, quotations, and proposals" to include additional document types (NDAs, SOWs, purchase orders, receipts, credit notes, and more).
3. IF a component displays a fixed list of document types for UI purposes (e.g., FlipWords animation), THEN THE Copy_System SHALL expand or reframe the list to communicate broader capability.

### Requirement 15: Competitive Differentiation Messaging

**User Story:** As a freelancer currently using FreshBooks or HoneyBook, I want to understand why Clorefy is better for my needs, so that I'm motivated to switch.

#### Acceptance Criteria

1. THE Copy_System SHALL include at least one section that implicitly addresses Competitor_Set limitations without naming competitors directly: geographic restrictions, client caps, forced upgrades, lack of AI generation, and missing compliance automation.
2. THE Copy_System SHALL position Clorefy's 11-country compliance, AI-from-prompt generation, and integrated payment links as direct solutions to Competitor_Set pain points.
3. THE Copy_System SHALL reference that existing tools require "5 other tools that don't talk to each other" as a pain point Clorefy eliminates.

### Requirement 16: Preserve UI and Animation Integrity

**User Story:** As a developer implementing these changes, I want clear boundaries on what to change, so that I don't accidentally break the existing UI.

#### Acceptance Criteria

1. THE Copy_System SHALL change only text content (strings, labels, headings, descriptions) without modifying component structure, CSS classes, animations, or layout logic.
2. IF a text change requires modifying an array of objects (e.g., features array, personas array), THEN THE Copy_System SHALL preserve the array structure, object shape, icon assignments, and className values while updating only text fields (title, desc, label, prompt, reply).
3. THE Copy_System SHALL preserve all existing Link href values, animation variants, and conditional rendering logic unchanged.
