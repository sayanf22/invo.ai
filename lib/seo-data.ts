/**
 * Static SEO data layer for programmatic SEO pages.
 * 11 countries × 4 document types = 44 unique landing pages.
 * All data is static TypeScript — no database queries needed.
 */

// ── Interfaces ─────────────────────────────────────────────────────────

export interface CountryData {
  slug: string
  name: string
  currency: string
  currencySymbol: string
  taxSystem: string
  taxRate: string
  complianceNotes: string
  locale: string
  flag: string
}

export interface DocumentTypeData {
  slug: string
  name: string
  singularName: string
  description: string
  features: string[]
}

export interface ProgrammaticPageData {
  country: CountryData
  documentType: DocumentTypeData
  title: string
  metaDescription: string
  heroHeading: string
  heroSubheading: string
  taxSection: string
  complianceSection: string
  faqs: { question: string; answer: string }[]
  relatedPages: { href: string; label: string }[]
  relatedBlogSlugs: string[]
}

// ── Country Data ───────────────────────────────────────────────────────

export const SUPPORTED_COUNTRIES: CountryData[] = [
  {
    slug: "india",
    name: "India",
    currency: "INR",
    currencySymbol: "₹",
    taxSystem: "GST (CGST + SGST / IGST)",
    taxRate: "18%",
    complianceNotes: "Invoices must include GSTIN, HSN/SAC codes, and separate CGST/SGST or IGST lines. E-invoicing is mandatory for businesses with turnover above ₹5 crore.",
    locale: "en-IN",
    flag: "🇮🇳",
  },
  {
    slug: "usa",
    name: "USA",
    currency: "USD",
    currencySymbol: "$",
    taxSystem: "Sales Tax (state-level)",
    taxRate: "0–10.25%",
    complianceNotes: "Sales tax varies by state and locality. Nexus rules determine when you must collect tax. No federal invoice format requirement, but EIN and state tax ID should be included.",
    locale: "en-US",
    flag: "🇺🇸",
  },
  {
    slug: "uk",
    name: "UK",
    currency: "GBP",
    currencySymbol: "£",
    taxSystem: "VAT",
    taxRate: "20%",
    complianceNotes: "VAT-registered businesses must include VAT number, VAT rate, and VAT amount on invoices. Reduced rate of 5% applies to certain goods. Making Tax Digital (MTD) requires digital record-keeping.",
    locale: "en-GB",
    flag: "🇬🇧",
  },
  {
    slug: "germany",
    name: "Germany",
    currency: "EUR",
    currencySymbol: "€",
    taxSystem: "VAT (Umsatzsteuer)",
    taxRate: "19%",
    complianceNotes: "Invoices must include Steuernummer or USt-IdNr, sequential invoice number, and itemized VAT. Reduced rate of 7% applies to certain goods. Kleinunternehmerregelung exempts small businesses under €22,000 revenue.",
    locale: "de-DE",
    flag: "🇩🇪",
  },
  {
    slug: "canada",
    name: "Canada",
    currency: "CAD",
    currencySymbol: "$",
    taxSystem: "GST/HST + Provincial Sales Tax",
    taxRate: "5–15%",
    complianceNotes: "GST (5%) applies federally. HST combines GST and provincial tax in participating provinces. Quebec charges QST separately. Business Number (BN) must appear on invoices.",
    locale: "en-CA",
    flag: "🇨🇦",
  },
  {
    slug: "australia",
    name: "Australia",
    currency: "AUD",
    currencySymbol: "$",
    taxSystem: "GST",
    taxRate: "10%",
    complianceNotes: "GST of 10% applies to most goods and services. ABN must be displayed on tax invoices. Tax invoices over $1,000 require buyer's ABN. BAS reporting is quarterly or monthly.",
    locale: "en-AU",
    flag: "🇦🇺",
  },
  {
    slug: "singapore",
    name: "Singapore",
    currency: "SGD",
    currencySymbol: "$",
    taxSystem: "GST",
    taxRate: "9%",
    complianceNotes: "GST registration is mandatory for businesses with taxable turnover exceeding S$1 million. Tax invoices must include GST registration number, total GST amount, and be issued within 30 days of supply.",
    locale: "en-SG",
    flag: "🇸🇬",
  },
  {
    slug: "uae",
    name: "UAE",
    currency: "AED",
    currencySymbol: "د.إ",
    taxSystem: "VAT",
    taxRate: "5%",
    complianceNotes: "VAT of 5% applies to most goods and services. Tax invoices must include TRN, VAT amount in AED, and be retained for 5 years. Simplified invoices allowed for supplies under AED 10,000.",
    locale: "en-AE",
    flag: "🇦🇪",
  },
  {
    slug: "philippines",
    name: "Philippines",
    currency: "PHP",
    currencySymbol: "₱",
    taxSystem: "VAT + Percentage Tax",
    taxRate: "12%",
    complianceNotes: "VAT of 12% applies to businesses with gross sales exceeding ₱3 million. TIN must appear on all invoices. BIR-registered invoices are required. Non-VAT businesses pay 3% percentage tax.",
    locale: "en-PH",
    flag: "🇵🇭",
  },
  {
    slug: "france",
    name: "France",
    currency: "EUR",
    currencySymbol: "€",
    taxSystem: "VAT (TVA)",
    taxRate: "20%",
    complianceNotes: "Invoices must include SIRET number, TVA intracommunautaire number, and mention 'TVA non applicable, article 293 B du CGI' if exempt. Reduced rates of 10% and 5.5% apply to specific categories. E-invoicing mandatory for B2B from 2026.",
    locale: "fr-FR",
    flag: "🇫🇷",
  },
  {
    slug: "netherlands",
    name: "Netherlands",
    currency: "EUR",
    currencySymbol: "€",
    taxSystem: "VAT (BTW)",
    taxRate: "21%",
    complianceNotes: "Invoices must include BTW-identificatienummer, sequential invoice number, and VAT amount. Reduced rate of 9% applies to essential goods. KOR scheme exempts small businesses under €20,000 revenue.",
    locale: "nl-NL",
    flag: "🇳🇱",
  },
]

// ── Document Type Data ─────────────────────────────────────────────────

export const DOCUMENT_TYPES: DocumentTypeData[] = [
  {
    slug: "invoice-generator",
    name: "Invoice Generator",
    singularName: "Invoice",
    description: "Create professional, tax-compliant invoices with automatic calculations, multi-currency support, and country-specific formatting.",
    features: [
      "Automatic tax calculations (GST, VAT, Sales Tax)",
      "Multi-currency support with symbol formatting",
      "Line items with quantity, rate, and discount",
      "Payment terms and due date tracking",
      "Business branding with logo and colors",
      "PDF, DOCX, and image export",
    ],
  },
  {
    slug: "contract-generator",
    name: "Contract Generator",
    singularName: "Contract",
    description: "Generate legally structured contracts including service agreements, freelance contracts, and business contracts with country-specific clauses.",
    features: [
      "Service agreement and freelance contract templates",
      "Country-specific legal clauses and terms",
      "Scope of work and deliverables sections",
      "Payment milestones and penalty clauses",
      "Intellectual property and confidentiality terms",
      "Digital signature support",
    ],
  },
  {
    slug: "quotation-generator",
    name: "Quotation Generator",
    singularName: "Quotation",
    description: "Build professional quotations with itemized pricing, validity periods, and terms that convert prospects into clients.",
    features: [
      "Itemized pricing with descriptions",
      "Validity period and expiration dates",
      "Terms and conditions customization",
      "Discount and markup calculations",
      "Multi-currency pricing",
      "One-click conversion to invoice",
    ],
  },
  {
    slug: "proposal-generator",
    name: "Proposal Generator",
    singularName: "Proposal",
    description: "Create winning business proposals with executive summaries, project timelines, pricing tiers, and professional formatting.",
    features: [
      "Executive summary and problem statement",
      "Project timeline with milestones",
      "Tiered pricing options (Basic, Standard, Premium)",
      "Case studies and testimonials sections",
      "Team and credentials overview",
      "Call-to-action with next steps",
    ],
  },
]

// ── Blog slug mapping by document type and country ─────────────────────

const BLOG_SLUGS_BY_DOC_TYPE: Record<string, string[]> = {
  "invoice-generator": [
    "ai-invoice-generator-complete-guide",
    "free-invoice-generator-online",
    "invoice-template-freelancers",
    "how-to-write-payment-terms",
    "invoice-tax-compliance-guide",
    "small-business-invoicing-mistakes",
    "recurring-invoice-guide",
    "multi-currency-invoicing",
    "how-to-send-invoice-email",
    "invoice-numbering-system",
    "ai-invoice-generator-vs-templates",
    "best-invoicing-software-freelancers-2025",
    "late-payment-email-templates",
  ],
  "contract-generator": [
    "ai-contract-generator",
    "freelance-contract-template",
    "digital-signature-documents",
    "contract-vs-proposal-difference",
    "ai-document-generation-business",
    "best-ai-tools-freelancers-2025",
  ],
  "quotation-generator": [
    "how-to-create-quotation",
    "quotation-vs-invoice-difference",
    "ai-document-generation-business",
    "multi-currency-invoicing",
    "best-ai-tools-freelancers-2025",
  ],
  "proposal-generator": [
    "ai-proposal-generator",
    "how-to-write-business-proposal",
    "contract-vs-proposal-difference",
    "ai-document-generation-business",
    "best-ai-tools-freelancers-2025",
  ],
}

const BLOG_SLUGS_BY_COUNTRY: Record<string, string[]> = {
  india: [
    "gst-invoice-format-india",
    "invoice-generator-india",
    "how-to-create-invoice-without-gst",
    "invoice-tax-compliance-guide",
  ],
  usa: [
    "invoice-generator-usa-sales-tax",
    "invoice-tax-compliance-guide",
    "best-invoicing-software-freelancers-2025",
  ],
  uk: [
    "vat-invoice-requirements-europe",
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
  ],
  germany: [
    "vat-invoice-requirements-europe",
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
  ],
  canada: [
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
    "best-invoicing-software-freelancers-2025",
  ],
  australia: [
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
    "best-invoicing-software-freelancers-2025",
  ],
  singapore: [
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
    "best-ai-tools-freelancers-2025",
  ],
  uae: [
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
    "best-ai-tools-freelancers-2025",
  ],
  philippines: [
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
    "best-ai-tools-freelancers-2025",
  ],
  france: [
    "vat-invoice-requirements-europe",
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
  ],
  netherlands: [
    "vat-invoice-requirements-europe",
    "invoice-tax-compliance-guide",
    "multi-currency-invoicing",
  ],
}

// ── FAQ data per document type per country ──────────────────────────────

function generateFaqs(
  country: CountryData,
  docType: DocumentTypeData
): { question: string; answer: string }[] {
  const faqs: Record<string, { question: string; answer: string }[]> = {
    "invoice-generator": [
      {
        question: `What tax information is required on invoices in ${country.name}?`,
        answer: `In ${country.name}, invoices must comply with the ${country.taxSystem} system at a standard rate of ${country.taxRate}. ${country.complianceNotes}`,
      },
      {
        question: `Can I generate invoices in ${country.currency} with Clorefy?`,
        answer: `Yes, Clorefy fully supports ${country.currency} (${country.currencySymbol}) invoicing for ${country.name}. All tax calculations, currency formatting, and compliance rules are applied automatically based on ${country.name}'s requirements.`,
      },
      {
        question: `Is Clorefy's Invoice Generator free to use in ${country.name}?`,
        answer: `Clorefy offers a free tier that lets you generate up to 3 invoices per month with full ${country.name} tax compliance. Paid plans start at ${country.currencySymbol}9/month for higher volumes.`,
      },
    ],
    "contract-generator": [
      {
        question: `What legal clauses should contracts include in ${country.name}?`,
        answer: `Contracts in ${country.name} should include scope of work, payment terms in ${country.currency} (${country.currencySymbol}), intellectual property rights, confidentiality clauses, termination conditions, and dispute resolution mechanisms compliant with ${country.name}'s legal framework.`,
      },
      {
        question: `Are AI-generated contracts legally valid in ${country.name}?`,
        answer: `AI-generated contracts serve as professionally structured starting points. In ${country.name}, contracts are legally binding when both parties agree to the terms. We recommend having important contracts reviewed by a local legal professional.`,
      },
      {
        question: `Can I add digital signatures to contracts for ${country.name}?`,
        answer: `Yes, Clorefy supports digital signatures that are recognized in ${country.name}. You can send contracts for signing directly from the platform, with a secure token-based signing flow.`,
      },
    ],
    "quotation-generator": [
      {
        question: `Should quotations include tax in ${country.name}?`,
        answer: `In ${country.name}, it's best practice to show both the net amount and the ${country.taxSystem} amount (${country.taxRate}) on quotations. Clorefy automatically calculates and displays tax breakdowns for ${country.name}.`,
      },
      {
        question: `How long should a quotation be valid in ${country.name}?`,
        answer: `Standard quotation validity in ${country.name} is 30 days, though this varies by industry. Clorefy lets you set custom validity periods and automatically marks expired quotations.`,
      },
      {
        question: `Can I convert a quotation to an invoice in ${country.name}?`,
        answer: `Yes, Clorefy allows one-click conversion from quotation to invoice. All line items, ${country.currency} pricing, and ${country.name}-specific tax calculations carry over automatically.`,
      },
    ],
    "proposal-generator": [
      {
        question: `What should a business proposal include for clients in ${country.name}?`,
        answer: `A strong proposal for ${country.name} clients should include an executive summary, understanding of the problem, proposed solution, timeline, pricing in ${country.currency} (${country.currencySymbol}), team credentials, and clear next steps.`,
      },
      {
        question: `How do I price proposals for the ${country.name} market?`,
        answer: `When pricing for ${country.name}, consider local market rates, present amounts in ${country.currency} (${country.currencySymbol}), and factor in ${country.taxSystem} at ${country.taxRate}. Clorefy supports tiered pricing to help you offer Basic, Standard, and Premium options.`,
      },
      {
        question: `Can I create proposals in the ${country.name} locale with Clorefy?`,
        answer: `Yes, Clorefy generates proposals formatted for the ${country.name} market with ${country.currency} currency formatting, appropriate date formats (${country.locale}), and professional styling suited to ${country.name} business standards.`,
      },
    ],
  }

  return faqs[docType.slug] || []
}

// ── Meta description generators ────────────────────────────────────────

function generateMetaDescription(
  country: CountryData,
  docType: DocumentTypeData
): string {
  const descriptions: Record<string, (c: CountryData) => string> = {
    "invoice-generator": (c) =>
      `Create ${c.taxSystem}-compliant invoices for ${c.name} in ${c.currency}. Automatic tax calculations, professional formatting, and PDF export. Free to start.`,
    "contract-generator": (c) =>
      `Generate professional contracts for ${c.name} with AI. Legally structured agreements with ${c.name}-specific clauses, digital signatures, and PDF export.`,
    "quotation-generator": (c) =>
      `Build professional quotations for ${c.name} clients in ${c.currency}. Itemized pricing, ${c.taxSystem} tax calculations, and one-click invoice conversion.`,
    "proposal-generator": (c) =>
      `Create winning business proposals for ${c.name} with AI. Executive summaries, ${c.currency} pricing tiers, timelines, and professional formatting.`,
  }

  const generator = descriptions[docType.slug]
  return generator ? generator(country) : `${docType.name} for ${country.name} — create professional documents with Clorefy. AI-powered, tax-compliant, and free to start.`
}

// ── Tax section content generators ─────────────────────────────────────

function generateTaxSection(
  country: CountryData,
  docType: DocumentTypeData
): string {
  return `<h3>${country.taxSystem} Compliance for ${docType.singularName}s in ${country.name}</h3>
<p>${country.name} uses the ${country.taxSystem} system with a standard rate of ${country.taxRate}. ${country.complianceNotes}</p>
<p>Clorefy's ${docType.name} automatically applies the correct ${country.taxSystem} rate and includes all mandatory fields required by ${country.name}'s tax authorities, so your ${docType.singularName.toLowerCase()}s are always compliant.</p>`
}

// ── Compliance section content generators ──────────────────────────────

function generateComplianceSection(
  country: CountryData,
  docType: DocumentTypeData
): string {
  return `<h3>${docType.singularName} Compliance Requirements in ${country.name}</h3>
<p>When creating ${docType.singularName.toLowerCase()}s for ${country.name}, you must ensure compliance with local regulations. ${country.complianceNotes}</p>
<p>Clorefy handles these requirements automatically — every ${docType.singularName.toLowerCase()} generated for ${country.name} includes the correct tax identifiers, ${country.currency} (${country.currencySymbol}) formatting, and mandatory disclosure fields.</p>`
}

// ── Lookup Functions ───────────────────────────────────────────────────

export function getCountryBySlug(slug: string): CountryData | undefined {
  return SUPPORTED_COUNTRIES.find((c) => c.slug === slug)
}

export function getDocumentTypeBySlug(slug: string): DocumentTypeData | undefined {
  return DOCUMENT_TYPES.find((d) => d.slug === slug)
}

export function getProgrammaticPageData(
  documentTypeSlug: string,
  countrySlug: string
): ProgrammaticPageData | undefined {
  const country = getCountryBySlug(countrySlug)
  const documentType = getDocumentTypeBySlug(documentTypeSlug)

  if (!country || !documentType) return undefined

  const title = `${documentType.name} for ${country.name} | Clorefy`
  const metaDescription = generateMetaDescription(country, documentType)
  const heroHeading = `${country.flag} ${documentType.name} for ${country.name}`
  const heroSubheading = `Create professional, ${country.taxSystem}-compliant ${documentType.singularName.toLowerCase()}s for ${country.name} in ${country.currency} (${country.currencySymbol}). Powered by AI — generate in seconds, not hours.`
  const taxSection = generateTaxSection(country, documentType)
  const complianceSection = generateComplianceSection(country, documentType)
  const faqs = generateFaqs(country, documentType)
  const relatedPages = getRelatedProgrammaticPages(documentTypeSlug, countrySlug)
  const relatedBlogSlugs = getRelatedBlogSlugs(documentTypeSlug, countrySlug)

  return {
    country,
    documentType,
    title,
    metaDescription,
    heroHeading,
    heroSubheading,
    taxSection,
    complianceSection,
    faqs,
    relatedPages,
    relatedBlogSlugs,
  }
}

export function getAllProgrammaticPages(): {
  documentType: string
  country: string
}[] {
  const pages: { documentType: string; country: string }[] = []
  for (const docType of DOCUMENT_TYPES) {
    for (const country of SUPPORTED_COUNTRIES) {
      pages.push({ documentType: docType.slug, country: country.slug })
    }
  }
  return pages
}

export function getRelatedProgrammaticPages(
  documentTypeSlug: string,
  countrySlug: string
): { href: string; label: string }[] {
  const related: { href: string; label: string }[] = []

  // Same country, different document types
  for (const docType of DOCUMENT_TYPES) {
    if (docType.slug === documentTypeSlug) continue
    const country = getCountryBySlug(countrySlug)
    if (country) {
      related.push({
        href: `/tools/${docType.slug}/${countrySlug}`,
        label: `${docType.name} for ${country.name}`,
      })
    }
  }

  // Same document type, different countries (pick up to 3)
  const docType = getDocumentTypeBySlug(documentTypeSlug)
  let count = 0
  for (const country of SUPPORTED_COUNTRIES) {
    if (country.slug === countrySlug) continue
    if (count >= 3) break
    if (docType) {
      related.push({
        href: `/tools/${documentTypeSlug}/${country.slug}`,
        label: `${docType.name} for ${country.name}`,
      })
    }
    count++
  }

  return related
}

export function getRelatedBlogSlugs(
  documentTypeSlug: string,
  countrySlug: string
): string[] {
  const docTypeSlugs = BLOG_SLUGS_BY_DOC_TYPE[documentTypeSlug] || []
  const countrySlugs = BLOG_SLUGS_BY_COUNTRY[countrySlug] || []

  // Merge and deduplicate, prioritizing country-specific slugs
  const seen = new Set<string>()
  const result: string[] = []

  for (const slug of countrySlugs) {
    if (!seen.has(slug)) {
      seen.add(slug)
      result.push(slug)
    }
  }
  for (const slug of docTypeSlugs) {
    if (!seen.has(slug)) {
      seen.add(slug)
      result.push(slug)
    }
  }

  // Return at least 2 (guaranteed by our data mappings)
  return result.slice(0, 5)
}
