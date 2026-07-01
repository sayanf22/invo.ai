/**
 * Static SEO data layer for programmatic SEO pages.
 * A curated set of primary-market countries × document types is used for
 * static landing-page generation. The underlying app generates documents
 * for every country worldwide — this list is a marketing / SEO subset.
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

// ── Per-country tax profile ─────────────────────────────────────────────
// Materially distinct, fact-dense data per country (authority names, real
// rate tables, registration thresholds, filing cadences, mandatory invoice
// fields, worked numeric examples, penalties). This is what makes each
// programmatic /tools/* page genuinely unique instead of a shared sentence
// with a swapped noun. Drives Property 2 (content uniqueness) below the
// pairwise-similarity threshold defined in the exploration test.

interface CountryTaxProfile {
  authority: string
  taxIdName: string
  ratesDetail: string
  invoiceRequirements: string
  registration: string
  filing: string
  workedExample: string
  digitalNote: string
  penalties: string
}

const COUNTRY_TAX_PROFILE: Record<string, CountryTaxProfile> = {
  india: {
    authority: "the GST Network (GSTN) and the CBIC",
    taxIdName: "GSTIN",
    ratesDetail:
      "India runs a dual Goods and Services Tax: intra-state sales carry CGST plus SGST, while inter-state sales carry a single IGST. Rates fall into 5%, 12%, 18% and 28% slabs, and most consulting, software and professional services sit at 18%.",
    invoiceRequirements:
      "A tax invoice must show the supplier and recipient GSTIN, a consecutive serial number, the HSN code for goods or SAC code for services, the place of supply, and separate CGST/SGST or IGST columns.",
    registration:
      "GST registration is compulsory once turnover crosses ₹40 lakh for goods or ₹20 lakh for services (₹10 lakh in special-category states), and stays voluntary below that.",
    filing:
      "Registered businesses file GSTR-1 for outward supplies and GSTR-3B for summary tax each month, or quarterly under the QRMP scheme, then reconcile annually with GSTR-9.",
    workedExample:
      "A ₹1,00,000 software consulting invoice raised from Bengaluru to a client in Mumbai attracts 18% IGST of ₹18,000, giving a ₹1,18,000 total.",
    digitalNote:
      "E-invoicing with a government IRN and QR code becomes mandatory once turnover exceeds ₹5 crore, and Clorefy populates the GSTIN and HSN/SAC fields for you.",
    penalties:
      "Late GST returns attract a fee of ₹50 per day (₹20 for nil returns) plus 18% annual interest on any unpaid tax.",
  },
  usa: {
    authority: "each state Department of Revenue",
    taxIdName: "EIN and a state sales-tax permit",
    ratesDetail:
      "The United States has no federal VAT or GST; instead each state and locality sets its own sales tax, so combined rates run from 0% in Delaware, Montana, New Hampshire and Oregon up to about 10.25% in parts of California and Illinois. Many states exempt professional and freelance services entirely.",
    invoiceRequirements:
      "A US invoice should carry your business name, EIN, the state sales-tax permit number for any state where you have nexus, itemized amounts, and sales tax broken out only on taxable tangible goods.",
    registration:
      "Economic nexus rules from the South Dakota v. Wayfair decision require registration once sales into a state pass roughly $100,000 or 200 separate transactions.",
    filing:
      "States assign monthly, quarterly or annual sales-tax filing frequencies based on collected volume, each remitted through its own Department of Revenue portal.",
    workedExample:
      "A $2,000 taxable design invoice billed in Chicago adds Illinois and Cook County sales tax of 10.25% ($205) for a $2,205 total, while the same service billed in Oregon adds nothing.",
    digitalNote:
      "There is no national e-invoicing mandate, and Clorefy handles USD formatting plus per-state tax lines automatically.",
    penalties:
      "Failure-to-file and failure-to-pay penalties are set state by state and typically stack with interest on any overdue balance.",
  },
  uk: {
    authority: "HM Revenue & Customs (HMRC)",
    taxIdName: "VAT registration number",
    ratesDetail:
      "The UK charges VAT at a standard 20%, a reduced 5% on items such as domestic energy and children's car seats, and 0% zero-rating on most food, books and children's clothing.",
    invoiceRequirements:
      "A full VAT invoice must show your GB VAT registration number, a unique sequential number, the tax point date, a per-line description with its VAT rate, and the total VAT payable.",
    registration:
      "VAT registration becomes compulsory once taxable turnover exceeds £90,000 across a rolling 12 months, with voluntary registration permitted below the threshold.",
    filing:
      "Under Making Tax Digital, VAT-registered businesses keep digital records and submit VAT returns quarterly through compatible software to HMRC.",
    workedExample:
      "A £1,500 consultancy invoice issued in London adds 20% VAT of £300, for an £1,800 total.",
    digitalNote:
      "MTD requires digital record-keeping, and Clorefy stores VAT numbers and per-line rates ready for quarterly submission.",
    penalties:
      "HMRC applies a points-based late-submission penalty and charges late-payment interest set above the Bank of England base rate.",
  },
  germany: {
    authority: "the local Finanzamt and the Bundeszentralamt für Steuern",
    taxIdName: "Steuernummer and USt-IdNr",
    ratesDetail:
      "Germany levies Umsatzsteuer at a standard 19% and a reduced 7% on items like food, books and public transport, all administered through the local Finanzamt.",
    invoiceRequirements:
      "A German invoice needs a sequential Rechnungsnummer, your Steuernummer or USt-IdNr, the supply date (Leistungsdatum), the net amount, and the VAT rate and sum shown separately.",
    registration:
      "The Kleinunternehmerregelung exempts businesses under €22,000 revenue in the prior year and €50,000 expected in the current year from charging VAT.",
    filing:
      "Businesses submit a monthly or quarterly Umsatzsteuervoranmeldung and an annual Umsatzsteuererklärung through the ELSTER portal.",
    workedExample:
      "A €2,500 engineering invoice in Munich adds 19% USt of €475, giving a €2,975 total.",
    digitalNote:
      "Cross-border EU trade requires a USt-IdNr, and Clorefy places it alongside strictly sequential invoice numbering.",
    penalties:
      "Late filings trigger a Verspätungszuschlag surcharge plus interest of 0.5% per month on overdue Umsatzsteuer.",
  },
  canada: {
    authority: "the Canada Revenue Agency (CRA) and Revenu Québec",
    taxIdName: "Business Number (BN)",
    ratesDetail:
      "Canada combines a 5% federal GST with provincial tax: HST of 13–15% applies in Ontario and the Atlantic provinces, while British Columbia, Manitoba, Saskatchewan and Quebec add separate PST or QST (Quebec's QST is 9.975%).",
    invoiceRequirements:
      "Invoices must show your Business Number with an RT account, the GST/HST rate and amount, and — in Quebec — the QST registration number and amount.",
    registration:
      "Registration is required once worldwide taxable supplies reach CA$30,000 across four consecutive quarters; smaller suppliers may register voluntarily to claim input tax credits.",
    filing:
      "The CRA assigns monthly, quarterly or annual GST/HST reporting periods by revenue, while Revenu Québec handles QST returns separately.",
    workedExample:
      "A CA$3,000 invoice in Toronto adds 13% Ontario HST of CA$390 for a CA$3,390 total, whereas the same invoice in Calgary adds only 5% GST of CA$150.",
    digitalNote:
      "Clorefy applies the correct provincial GST/HST or PST/QST split and prints your Business Number on every document.",
    penalties:
      "The CRA charges a percentage penalty for late returns plus daily compounded interest on outstanding GST/HST.",
  },
  australia: {
    authority: "the Australian Taxation Office (ATO)",
    taxIdName: "ABN",
    ratesDetail:
      "Australia applies a flat 10% GST to most goods and services, while basic food, most health, and education supplies are GST-free.",
    invoiceRequirements:
      "A valid tax invoice shows your 11-digit ABN, the words 'Tax invoice', the GST-inclusive price, and the GST amount; invoices over $1,000 must also carry the buyer's identity or ABN.",
    registration:
      "GST registration is required once annual turnover reaches $75,000 ($150,000 for non-profits) and remains optional below that.",
    filing:
      "Businesses report GST on a Business Activity Statement (BAS) lodged quarterly or monthly with the ATO.",
    workedExample:
      "A A$4,000 invoice in Sydney adds 10% GST of A$400, giving a A$4,400 total.",
    digitalNote:
      "Clorefy displays your ABN, marks documents as tax invoices, and calculates the 10% GST line automatically.",
    penalties:
      "The ATO imposes Failure To Lodge penalty units for late BAS and applies a General Interest Charge on unpaid amounts.",
  },
  singapore: {
    authority: "the Inland Revenue Authority of Singapore (IRAS)",
    taxIdName: "GST registration number",
    ratesDetail:
      "Singapore's GST rose to 9% in January 2024 and applies to most local supplies, with exports and international services zero-rated and financial services largely exempt.",
    invoiceRequirements:
      "A tax invoice must show your GST registration number, an invoice number and date, the GST rate, and the GST amount in Singapore dollars.",
    registration:
      "GST registration is compulsory once taxable turnover exceeds S$1 million over 12 months, and tax invoices must be issued within 30 days of supply.",
    filing:
      "GST-registered businesses file the GST F5 return quarterly through the IRAS myTax Portal.",
    workedExample:
      "A S$5,000 invoice in the Marina Bay CBD adds 9% GST of S$450, giving a S$5,450 total.",
    digitalNote:
      "Clorefy applies the 9% rate, shows the GST registration number, and supports zero-rated export invoicing.",
    penalties:
      "IRAS levies a 5% late-payment penalty on overdue GST, rising by a further 2% per month up to 50%.",
  },
  uae: {
    authority: "the Federal Tax Authority (FTA)",
    taxIdName: "TRN",
    ratesDetail:
      "The UAE introduced 5% VAT in 2018; exports and qualifying designated free-zone supplies are zero-rated, while a few sectors such as local passenger transport are exempt.",
    invoiceRequirements:
      "A tax invoice must display the supplier's 15-digit TRN, a sequential number, the VAT amount in AED, and the words 'Tax Invoice'; supplies under AED 10,000 may use a simplified invoice.",
    registration:
      "VAT registration is mandatory above AED 375,000 in taxable supplies and voluntary above AED 187,500.",
    filing:
      "VAT returns are filed quarterly through the Federal Tax Authority's EmaraTax portal, and records must be retained for five years.",
    workedExample:
      "An AED 20,000 invoice in Dubai adds 5% VAT of AED 1,000, giving an AED 21,000 total.",
    digitalNote:
      "Clorefy prints the TRN, formats amounts in AED, and supports both full and simplified tax invoices.",
    penalties:
      "The FTA imposes fixed administrative fines for late registration or filing plus percentage penalties on unpaid VAT.",
  },
  philippines: {
    authority: "the Bureau of Internal Revenue (BIR)",
    taxIdName: "TIN",
    ratesDetail:
      "The Philippines charges 12% VAT on businesses with over ₱3 million in annual gross sales, while smaller non-VAT taxpayers instead pay a 3% percentage tax.",
    invoiceRequirements:
      "Sales invoices and official receipts must be BIR-registered and show your TIN, registered business name, the ATP or CAS details, and the VAT broken out separately.",
    registration:
      "Businesses register with the Bureau of Internal Revenue, obtain an Authority to Print, and cross the ₱3 million threshold to become VAT-liable.",
    filing:
      "VAT is filed monthly on BIR Form 2550M and quarterly on 2550Q, with e-invoicing being rolled out for large taxpayers.",
    workedExample:
      "A ₱50,000 invoice in Makati, Manila adds 12% VAT of ₱6,000, giving a ₱56,000 total.",
    digitalNote:
      "Clorefy structures BIR-compliant invoice fields and prints your TIN alongside the VAT breakdown.",
    penalties:
      "The BIR charges a 25% surcharge, 12% annual interest, and compromise penalties on late VAT filings.",
  },
  france: {
    authority: "the Direction générale des Finances publiques (DGFiP)",
    taxIdName: "SIRET and TVA number",
    ratesDetail:
      "France applies TVA at a standard 20%, an intermediate 10% for restaurants and transport, a reduced 5.5% on food and books, and a super-reduced 2.1% on medicines and press.",
    invoiceRequirements:
      "An invoice must show your 14-digit SIRET, the TVA intracommunautaire number, a sequential number, and — if exempt — the mention 'TVA non applicable, article 293 B du CGI'.",
    registration:
      "Micro-entrepreneurs below €36,800 for services or €91,900 for goods use the franchise en base and issue invoices without charging TVA.",
    filing:
      "TVA is declared monthly or quarterly on the CA3 return through the impots.gouv.fr professional account.",
    workedExample:
      "A €2,000 invoice in Paris adds 20% TVA of €400, giving a €2,400 total.",
    digitalNote:
      "Mandatory B2B e-invoicing via Factur-X and Chorus Pro is phasing in from 2026, and Clorefy already structures the SIRET and TVA fields.",
    penalties:
      "The DGFiP applies a 10% surcharge for late payment plus 0.20% monthly interest on overdue TVA.",
  },
  netherlands: {
    authority: "the Belastingdienst",
    taxIdName: "btw-id and KVK number",
    ratesDetail:
      "The Netherlands charges BTW at a standard 21% and a reduced 9% on food, medicine, books and public transport.",
    invoiceRequirements:
      "A Dutch invoice must show your btw-id, KVK number, a sequential invoice number, the invoice and supply dates, and the BTW amount per rate.",
    registration:
      "The kleineondernemersregeling (KOR) lets businesses under €20,000 turnover opt out of charging BTW.",
    filing:
      "BTW returns are filed quarterly with the Belastingdienst, with an additional ICP declaration for intra-EU B2B supplies.",
    workedExample:
      "A €3,500 invoice in Amsterdam adds 21% BTW of €735, giving a €4,235 total.",
    digitalNote:
      "Clorefy prints the btw-id and KVK number and handles the 21% or 9% rate split per line.",
    penalties:
      "The Belastingdienst issues a verzuimboete for late filing and charges belastingrente interest on overdue BTW.",
  },
}

function getCountryTaxProfile(country: CountryData): CountryTaxProfile {
  return (
    COUNTRY_TAX_PROFILE[country.slug] ?? {
      authority: `${country.name}'s tax authority`,
      taxIdName: "tax registration number",
      ratesDetail: `${country.name} uses the ${country.taxSystem} system at a standard rate of ${country.taxRate}. ${country.complianceNotes}`,
      invoiceRequirements: country.complianceNotes,
      registration: `Registration thresholds and rules follow ${country.name}'s ${country.taxSystem} regulations.`,
      filing: `Returns are filed on the cadence set by ${country.name}'s tax authority.`,
      workedExample: `Tax is added at ${country.taxRate} on the net amount and shown in ${country.currency} (${country.currencySymbol}).`,
      digitalNote: `Clorefy formats amounts in ${country.currency} (${country.currencySymbol}) and applies ${country.name} tax rules automatically.`,
      penalties: `Late filing and payment penalties follow ${country.name}'s tax rules.`,
    }
  )
}

// ── FAQ data per document type per country ──────────────────────────────
// Answers are dominated by country-specific facts (authority, tax-ID name,
// real rates, thresholds, filing forms, worked examples) so that same-doc-type
// sibling pages across different countries are materially distinct.

function generateFaqs(
  country: CountryData,
  docType: DocumentTypeData
): { question: string; answer: string }[] {
  const p = getCountryTaxProfile(country)
  const s = docType.singularName
  const sLower = s.toLowerCase()

  // Country-fact FAQs shared in intent across doc types but distinct per
  // country because the answers carry unique data points.
  const countryFacts: { question: string; answer: string }[] = [
    {
      question: `How is ${country.taxSystem} calculated on a ${sLower} in ${country.name}?`,
      answer: `${p.ratesDetail} ${p.workedExample}`,
    },
    {
      question: `Which identifiers must a ${country.name} ${sLower} carry?`,
      answer: `${p.invoiceRequirements} These fields are what ${p.authority} expect to see, and Clorefy places the ${p.taxIdName} for you.`,
    },
    {
      question: `When must a business register for ${country.taxSystem} in ${country.name}?`,
      answer: `${p.registration} ${p.filing}`,
    },
    {
      question: `What happens if ${country.taxSystem} is filed late in ${country.name}?`,
      answer: `${p.penalties} ${p.digitalNote}`,
    },
  ]

  // A document-type-specific opener framed around the country's data.
  const opener: Record<string, { question: string; answer: string }> = {
    "invoice-generator": {
      question: `Are Clorefy invoices for ${country.name} compliant out of the box?`,
      answer: `Yes. Each invoice carries ${p.taxIdName} placement, ${country.taxSystem} line items, and the mandatory fields expected by ${p.authority}. ${p.digitalNote}`,
    },
    "contract-generator": {
      question: `What should a service contract cover for clients in ${country.name}?`,
      answer: `A ${country.name} contract should set the scope, milestones, and payment terms in ${country.currency} (${country.currencySymbol}), and state how ${country.taxSystem} applies to the fee — ${p.ratesDetail}`,
    },
    "quotation-generator": {
      question: `Should a ${country.name} quotation display ${country.taxSystem}?`,
      answer: `Best practice in ${country.name} is to quote the net amount and the ${country.taxSystem} separately so the client sees the full cost. ${p.workedExample}`,
    },
    "proposal-generator": {
      question: `How should I price a proposal for the ${country.name} market?`,
      answer: `Present tiered pricing in ${country.currency} (${country.currencySymbol}) and account for ${country.taxSystem} on the final figure. ${p.ratesDetail}`,
    },
  }

  const first = opener[docType.slug]
  return first ? [first, ...countryFacts] : countryFacts
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
  const p = getCountryTaxProfile(country)
  return `<h3>How ${country.taxSystem} shapes ${docType.singularName.toLowerCase()}s in ${country.name}</h3>
<p>${p.ratesDetail}</p>
<p>${p.invoiceRequirements}</p>
<p><strong>Worked example.</strong> ${p.workedExample} Clorefy computes this line for you and shows it in ${country.currency} (${country.currencySymbol}).</p>`
}

// ── Compliance section content generators ──────────────────────────────

function generateComplianceSection(
  country: CountryData,
  docType: DocumentTypeData
): string {
  const p = getCountryTaxProfile(country)
  return `<h3>Registering, filing and staying compliant when you send ${docType.singularName.toLowerCase()}s in ${country.name}</h3>
<p>${p.registration}</p>
<p>${p.filing} Returns are administered by ${p.authority}.</p>
<p>${p.digitalNote} ${p.penalties}</p>`
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
  const profile = getCountryTaxProfile(country)
  const heroSubheading = `Generate ${country.taxSystem}-ready ${documentType.singularName.toLowerCase()}s for ${country.name} in ${country.currency} (${country.currencySymbol}). Clorefy applies the ${profile.taxIdName} and the rules enforced by ${profile.authority}, so every document is client-ready in seconds. ${profile.workedExample}`
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

  // Same document type, different countries (pick up to 6 to spread link
  // equity across the /tools/* cluster and help the thinner sibling pages)
  const docType = getDocumentTypeBySlug(documentTypeSlug)
  let count = 0
  for (const country of SUPPORTED_COUNTRIES) {
    if (country.slug === countrySlug) continue
    if (count >= 6) break
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
