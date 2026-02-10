import type { InvoiceData } from "@/lib/invoice-types"

export interface DocumentTemplate {
    id: string
    name: string
    description: string
    category: "invoice" | "contract" | "nda" | "agreement"
    icon: string
    tags: string[]
    previewImage?: string
    data: Partial<InvoiceData>
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
    // Invoice Templates
    {
        id: "invoice-basic",
        name: "Basic Invoice",
        description: "Simple, professional invoice for freelancers and small businesses",
        category: "invoice",
        icon: "FileText",
        tags: ["simple", "freelance", "professional"],
        data: {
            documentType: "Invoice",
            paymentTerms: "Net 30",
            currency: "USD",
            taxRate: 0,
            notes: "Thank you for your business!",
            terms: "Payment is due within 30 days.",
            items: [
                { id: "1", description: "Service provided", quantity: 1, rate: 0 },
            ],
            design: {
                templateId: "invoice-basic",
                font: "Helvetica",
                headerColor: "#f5f3ff", // light violet
                tableColor: "#f8fafc",
                layout: "modern",
            },
        },
    },
    {
        id: "invoice-detailed",
        name: "Detailed Invoice",
        description: "Comprehensive invoice with multiple line items and tax",
        category: "invoice",
        icon: "FileText",
        tags: ["detailed", "tax", "professional"],
        data: {
            documentType: "Invoice",
            paymentTerms: "Net 30",
            currency: "USD",
            taxRate: 10,
            taxLabel: "Tax",
            notes: "Thank you for choosing us. We appreciate your business!",
            terms: "Please pay within 30 days. Late fees may apply.",
            items: [
                { id: "1", description: "Professional Services", quantity: 1, rate: 0 },
                { id: "2", description: "Additional Services", quantity: 1, rate: 0 },
                { id: "3", description: "Materials", quantity: 1, rate: 0 },
            ],
            design: {
                templateId: "invoice-detailed",
                font: "Helvetica",
                headerColor: "#0f172a", // dark slate
                tableColor: "#f1f5f9",
                layout: "bold",
            },
        },
    },
    {
        id: "invoice-consulting",
        name: "Consulting Invoice",
        description: "Hourly billing template for consultants and advisors",
        category: "invoice",
        icon: "Clock",
        tags: ["hourly", "consulting", "advisor"],
        data: {
            documentType: "Invoice",
            paymentTerms: "Due on Receipt",
            currency: "USD",
            taxRate: 0,
            notes: "Billed at agreed hourly rate. Additional hours subject to approval.",
            terms: "Payment due upon receipt. Contact for any billing questions.",
            items: [
                { id: "1", description: "Consulting - Strategy Session", quantity: 2, rate: 150 },
                { id: "2", description: "Research & Analysis", quantity: 4, rate: 125 },
                { id: "3", description: "Report Preparation", quantity: 2, rate: 100 },
            ],
            design: {
                templateId: "invoice-consulting",
                font: "Times-Roman",
                headerColor: "#f0fdf4", // light green
                tableColor: "#f8fafc",
                layout: "classic",
            },
        },
    },

    // Contract Templates
    {
        id: "contract-simple",
        name: "Simple Service Contract",
        description: "Basic agreement for service providers and clients",
        category: "contract",
        icon: "ScrollText",
        tags: ["services", "basic", "agreement"],
        data: {
            documentType: "Contract",
            description: `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of [Date] between [Your Company] ("Service Provider") and [Client Name] ("Client").

1. SERVICES
The Service Provider agrees to perform the following services:
[Describe services to be provided]

2. COMPENSATION
The Client agrees to pay the Service Provider as follows:
[Payment terms and amounts]

3. TERM
This Agreement begins on [Start Date] and continues until [End Date] or until terminated by either party with 30 days written notice.

4. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary information shared during this engagement.

5. GOVERNING LAW
This Agreement shall be governed by the laws of [State/Country].

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.`,
            paymentTerms: "Net 30",
            design: {
                templateId: "contract-simple",
                font: "Helvetica",
                headerColor: "#ffffff",
                tableColor: "#ffffff",
                layout: "modern",
            },
        },
    },
    {
        id: "contract-freelance",
        name: "Freelance Contract",
        description: "Comprehensive contract for freelance work with deliverables",
        category: "contract",
        icon: "ScrollText",
        tags: ["freelance", "deliverables", "project"],
        data: {
            documentType: "Contract",
            description: `FREELANCE SERVICE AGREEMENT

This Agreement is made between:
Service Provider: [Your Name/Company]
Client: [Client Name]

PROJECT SCOPE
[Detailed description of work to be performed]

DELIVERABLES
1. [Deliverable 1]
2. [Deliverable 2]
3. [Deliverable 3]

TIMELINE
Start Date: [Date]
Completion Date: [Date]
Milestones: [List key milestones]

PAYMENT TERMS
Total Project Fee: $[Amount]
Payment Schedule:
- 50% upon contract signing
- 50% upon project completion

REVISIONS
[Number] rounds of revisions included. Additional revisions at $[Rate]/hour.

INTELLECTUAL PROPERTY
Upon full payment, all rights to the deliverables transfer to the Client.

TERMINATION
Either party may terminate with [X] days written notice.`,
            paymentTerms: "Custom",
            design: {
                templateId: "contract-freelance",
                font: "Courier",
                headerColor: "#1a1a1a",
                tableColor: "#f3f4f6",
                layout: "bold",
            },
        },
    },

    // NDA Templates
    {
        id: "nda-standard",
        name: "Standard NDA",
        description: "Mutual non-disclosure agreement for business discussions",
        category: "nda",
        icon: "ShieldCheck",
        tags: ["mutual", "confidential", "business"],
        data: {
            documentType: "NDA",
            description: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into by and between:

Party A: [Your Company Name]
Party B: [Other Party Name]

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means any information disclosed by either party that:
- Is marked as "Confidential" or "Proprietary"
- Is of a nature that a reasonable person would understand it to be confidential
- Includes technical, business, or financial information

2. NON-DISCLOSURE OBLIGATIONS
Each party agrees to:
- Use Confidential Information only for the purposes of [Business Purpose]
- Protect the confidentiality using the same degree of care as their own confidential information
- Not disclose to third parties without prior written consent

3. EXCLUSIONS
This Agreement does not apply to information that:
- Is or becomes publicly available without breach
- Was already known to the receiving party
- Is independently developed
- Is disclosed with prior written approval

4. TERM
This Agreement remains in effect for [2 years] from the date of signature.

5. RETURN OF INFORMATION
Upon request, each party will return or destroy all Confidential Information.

6. GOVERNING LAW
This Agreement is governed by the laws of [Jurisdiction].`,
            design: {
                templateId: "nda-standard",
                font: "Times-Roman",
                headerColor: "#ffffff",
                tableColor: "#ffffff",
                layout: "classic",
            },
        },
    },
    {
        id: "nda-unilateral",
        name: "One-Way NDA",
        description: "Protects your confidential information when sharing with others",
        category: "nda",
        icon: "ShieldCheck",
        tags: ["one-way", "protection", "disclosure"],
        data: {
            documentType: "NDA",
            description: `UNILATERAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into by:

Disclosing Party: [Your Company Name]
Receiving Party: [Recipient Name]

RECITALS
The Disclosing Party possesses certain confidential and proprietary information relating to [Subject Matter] and wishes to disclose such information to the Receiving Party for the purpose of [Purpose].

AGREEMENT

1. The Receiving Party agrees to hold all Confidential Information in strict confidence.

2. The Receiving Party shall not:
   - Disclose Confidential Information to any third party
   - Use Confidential Information for any purpose other than the stated purpose
   - Copy or reproduce Confidential Information without written consent

3. This obligation continues for a period of [3 years] after disclosure.

4. The Receiving Party acknowledges that breach of this Agreement may cause irreparable harm.`,
            design: {
                templateId: "nda-unilateral",
                font: "Helvetica",
                headerColor: "#ffffff",
                tableColor: "#ffffff",
                layout: "minimal",
            },
        },
    },

    // Agreement Templates
    {
        id: "agreement-partnership",
        name: "Partnership Agreement",
        description: "Basic terms for business partnerships and collaborations",
        category: "agreement",
        icon: "Handshake",
        tags: ["partnership", "collaboration", "joint venture"],
        data: {
            documentType: "Agreement",
            description: `PARTNERSHIP AGREEMENT

This Partnership Agreement is entered into by:
Partner 1: [Name]
Partner 2: [Name]

1. PURPOSE
The Partners agree to form a partnership for the purpose of [Business Purpose].

2. CONTRIBUTIONS
Partner 1 shall contribute: [Contribution]
Partner 2 shall contribute: [Contribution]

3. PROFIT SHARING
Profits and losses shall be shared as follows:
- Partner 1: [Percentage]%
- Partner 2: [Percentage]%

4. MANAGEMENT
Day-to-day management responsibilities:
[Describe management structure]

5. DECISION MAKING
Major decisions require unanimous consent of all Partners.

6. TERM
This partnership begins on [Date] and continues until dissolved by mutual agreement.

7. DISSOLUTION
Upon dissolution, assets shall be distributed after paying liabilities.`,
            paymentTerms: "Custom",
            design: {
                templateId: "agreement-partnership",
                font: "Helvetica",
                headerColor: "#eff6ff", // light blue
                tableColor: "#ffffff",
                layout: "modern",
            },
        },
    },
    {
        id: "agreement-retainer",
        name: "Retainer Agreement",
        description: "Monthly retainer terms for ongoing services",
        category: "agreement",
        icon: "Handshake",
        tags: ["retainer", "monthly", "ongoing"],
        data: {
            documentType: "Agreement",
            description: `RETAINER AGREEMENT

Between:
Service Provider: [Your Name/Company]
Client: [Client Name]

SERVICES
The Service Provider agrees to provide the following services on a retainer basis:
[List services included]

MONTHLY HOURS: [Number] hours per month

RETAINER FEE: $[Amount] per month, billed on the [1st/15th] of each month

ADDITIONAL HOURS: Available at $[Rate]/hour, subject to availability

ROLLOVER: Unused hours [do/do not] roll over to the following month

COMMUNICATION
- Response time: Within [24] business hours
- Monthly status calls: [Weekly/Bi-weekly]
- Reporting: Monthly summary provided

TERM
Initial term: [3/6/12] months
Renewal: Month-to-month after initial term

TERMINATION
Either party may terminate with [30] days written notice.`,
            paymentTerms: "Due on Receipt",
            design: {
                templateId: "agreement-retainer",
                font: "Times-Roman",
                headerColor: "#ffffff",
                tableColor: "#ffffff",
                layout: "classic",
            },
        },
    },
]

export function getTemplatesByCategory(category: DocumentTemplate["category"]): DocumentTemplate[] {
    return DOCUMENT_TEMPLATES.filter((t) => t.category === category)
}

export function getTemplateById(id: string): DocumentTemplate | undefined {
    return DOCUMENT_TEMPLATES.find((t) => t.id === id)
}

export function searchTemplates(query: string): DocumentTemplate[] {
    const lower = query.toLowerCase()
    return DOCUMENT_TEMPLATES.filter(
        (t) =>
            t.name.toLowerCase().includes(lower) ||
            t.description.toLowerCase().includes(lower) ||
            t.tags.some((tag) => tag.toLowerCase().includes(lower))
    )
}
