/**
 * Proposal Builder — Type Definitions
 *
 * Structured data model for the multi-step proposal creation flow.
 * These types define exactly what the builder collects before handing
 * off to the AI for section-by-section generation.
 */

// ─── Service Categories ───────────────────────────────────────────────────────

export const PROPOSAL_SERVICE_CATEGORIES = [
  { value: "social_media", label: "Social Media Management" },
  { value: "web_design", label: "Web Design & Development" },
  { value: "photography", label: "Photography" },
  { value: "video_production", label: "Video Production" },
  { value: "branding", label: "Branding & Identity" },
  { value: "seo", label: "SEO & Content Marketing" },
  { value: "custom", label: "Custom / Other" },
] as const

export type ServiceCategory = (typeof PROPOSAL_SERVICE_CATEGORIES)[number]["value"]

// ─── Client Industries ────────────────────────────────────────────────────────

export const CLIENT_INDUSTRIES = [
  { value: "automotive", label: "Automotive" },
  { value: "fnb", label: "Food & Beverage" },
  { value: "retail", label: "Retail" },
  { value: "real_estate", label: "Real Estate" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "hospitality", label: "Hospitality" },
  { value: "technology", label: "Technology" },
  { value: "fashion", label: "Fashion & Apparel" },
  { value: "finance", label: "Finance & Banking" },
  { value: "other", label: "Other" },
] as const

export type ClientIndustry = (typeof CLIENT_INDUSTRIES)[number]["value"]

// ─── Social Media Platforms ───────────────────────────────────────────────────

export const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter_x", label: "Twitter / X" },
  { value: "pinterest", label: "Pinterest" },
  { value: "snapchat", label: "Snapchat" },
  { value: "tiktok", label: "TikTok" },
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["value"]

// ─── Pricing Models ───────────────────────────────────────────────────────────

export type PricingModel = "single" | "tiered" | "custom"

export interface PricingLineItem {
  id: string
  description: string
  quantity: number
  rate: number
}

export interface PricingTier {
  id: string
  name: string        // e.g. "Basic", "Standard", "Premium"
  description: string
  inclusions: string[] // bullet list of what's included
  monthlyRate: number
  isRecommended?: boolean
}

export interface PricingAddOn {
  id: string
  description: string
  rate: number
}

// ─── KPI Types ────────────────────────────────────────────────────────────────

export interface ProposalKPI {
  id: string
  label: string
  target: string  // "500 new followers/month", "8% engagement rate", etc.
}

// ─── Timeline / Milestones ────────────────────────────────────────────────────

export interface ProposalMilestone {
  id: string
  phase: string
  description: string
  duration: string  // "1 week", "2 weeks", "1 month"
}

// ─── T&C Clauses ─────────────────────────────────────────────────────────────

export interface TCClause {
  id: string
  label: string
  text: string
  isCustom?: boolean
}

// ─── Platform Scope (Social Media specific) ──────────────────────────────────

export interface PlatformScope {
  platform: SocialPlatform
  postsPerMonth: number
}

// ─── Full Proposal Form State ─────────────────────────────────────────────────

export interface ProposalFormData {
  // Step 1: Basics
  title: string
  proposalNumber: string
  issueDate: string        // ISO date
  validUntilDate: string   // ISO date
  serviceCategory: ServiceCategory | ""

  // Step 2: Client Details
  clientBusinessName: string
  clientContactName: string
  clientAddress: string
  clientEmail: string
  clientPhone: string
  clientIndustry: ClientIndustry | ""
  clientDigitalPresence: "none" | "basic" | "active" | ""
  clientPrimaryGoal: "brand_awareness" | "lead_generation" | "sales" | "community_building" | ""
  // auto-fill from saved client (optional)
  savedClientId?: string

  // Step 3: Scope
  // Social media platforms
  targetPlatforms: SocialPlatform[]
  platformScopes: PlatformScope[]   // posting frequency per platform
  includesPhotographyShoot: boolean
  includesCommunityManagement: boolean
  includesMonthlyReporting: boolean
  includesPaidAdsManagement: boolean
  // General scope
  clientNeedsDescription: string    // 2–3 sentence free text
  customDeliverables: string[]      // manually listed deliverables

  // Step 4: Pricing
  pricingModel: PricingModel
  // Single price items
  lineItems: PricingLineItem[]
  // Tiered plans
  tiers: PricingTier[]
  addOns: PricingAddOn[]
  // Payment details
  advancePaymentPercent: number
  paymentMethod: string
  taxApplicable: boolean
  taxRate: number
  currency: string

  // Step 5: Goals & KPIs
  kpis: ProposalKPI[]

  // Step 6: Timeline
  projectStartDate: string
  milestones: ProposalMilestone[]
  durationMonths: number

  // Step 7: Agency (pulled from business profile)
  agencyName: string
  agencyAddress: string
  agencyEmail: string
  agencyPhone: string
  agencyWebsite: string
  agencyFoundingYear: string
  agencyTagline: string
  agencyServices: string
  agencyLogoUrl?: string

  // Step 8: Review/Generate (no additional input fields)

  // T&C clauses (configured in review step)
  tcClauses: TCClause[]
}

// ─── Stepper Steps ────────────────────────────────────────────────────────────

export const PROPOSAL_STEPS = [
  { id: 1, key: "basics",    title: "Basics",        description: "Proposal title, number, dates" },
  { id: 2, key: "client",    title: "Client",        description: "Who you're pitching to" },
  { id: 3, key: "scope",     title: "Scope",         description: "Services and deliverables" },
  { id: 4, key: "pricing",   title: "Pricing",       description: "Investment and payment terms" },
  { id: 5, key: "kpis",      title: "Goals & KPIs",  description: "Measurable targets" },
  { id: 6, key: "timeline",  title: "Timeline",      description: "Start date and milestones" },
  { id: 7, key: "agency",    title: "About Us",      description: "Your agency profile" },
  { id: 8, key: "review",    title: "Review",        description: "Final check before generation" },
] as const

export type StepKey = (typeof PROPOSAL_STEPS)[number]["key"]

// ─── Generated Proposal Sections ─────────────────────────────────────────────

export interface GeneratedProposalSections {
  executiveSummary: string
  aboutUs: string
  ourUnderstanding: string
  proposedSolution: string
  goalsAndKPIs: string
  nextSteps: string
}

export interface ProposalGenerationResult {
  sections: GeneratedProposalSections
  proposalNumber: string
  // The assembled InvoiceData-compatible object for the existing PDF renderer
  invoiceData: import("@/lib/invoice-types").InvoiceData
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

export function getDefaultTCClauses(form: ProposalFormData): TCClause[] {
  const advance = form.advancePaymentPercent || 50
  const paymentMethod = form.paymentMethod || "Bank Transfer"
  const startDate = form.projectStartDate || "the confirmed start date"

  return [
    {
      id: "payment_terms",
      label: "Payment Terms",
      text: `An advance payment of ${advance}% is due upon acceptance of this proposal via ${paymentMethod}. The remaining balance is due upon project completion or as per the agreed milestone schedule.`,
    },
    {
      id: "project_timeline",
      label: "Project Timeline",
      text: `Work commences upon receipt of the advance payment. The first deliverable will be provided within the timeframe outlined in the Project Timeline section, starting from ${startDate}.`,
    },
    {
      id: "revisions",
      label: "Revisions",
      text: `This proposal includes two rounds of revisions per deliverable. A revision is defined as minor adjustments to existing work. Structural changes, new concepts, or scope additions are billed separately.`,
    },
    {
      id: "intellectual_property",
      label: "Intellectual Property",
      text: `Upon receipt of full payment, the client receives ownership of all final deliverables. Raw files, source files, and working files remain the property of the agency unless explicitly purchased as an add-on.`,
    },
    {
      id: "termination",
      label: "Termination",
      text: `Either party may terminate this engagement with 30 days written notice. Work completed up to the termination date will be billed at the agreed rate. The advance payment is non-refundable.`,
    },
    {
      id: "governing_law",
      label: "Governing Law",
      text: `This proposal, if accepted, constitutes a binding agreement governed by the laws of the jurisdiction in which the agency is registered. Any disputes will be resolved through mutual negotiation before seeking legal remedies.`,
    },
  ]
}

export function getSuggestedKPIs(category: ServiceCategory | "", goal: string): ProposalKPI[] {
  const base: ProposalKPI[] = []

  if (category === "social_media") {
    base.push(
      { id: "followers", label: "Follower Growth", target: "500 new followers/month" },
      { id: "engagement", label: "Engagement Rate", target: "5% average engagement rate" },
      { id: "reach", label: "Monthly Reach", target: "20,000 accounts reached/month" },
      { id: "content", label: "Content Output", target: "20 posts/month across platforms" },
    )
    if (goal === "lead_generation" || goal === "sales") {
      base.push({ id: "leads", label: "Lead Generation", target: "30 qualified leads/month" })
    }
  } else if (category === "web_design") {
    base.push(
      { id: "pages", label: "Pages Delivered", target: "10 fully designed pages" },
      { id: "revisions", label: "Revision Rounds", target: "2 revision rounds included" },
      { id: "golive", label: "Go-Live Target", target: "Live within 6 weeks of project start" },
    )
  } else if (category === "photography") {
    base.push(
      { id: "images", label: "Images Delivered", target: "100 edited images per shoot" },
      { id: "turnaround", label: "Turnaround Time", target: "5 business days from shoot date" },
    )
  } else if (category === "video_production") {
    base.push(
      { id: "videos", label: "Videos Delivered", target: "4 edited videos per month" },
      { id: "turnaround", label: "Turnaround Time", target: "7 business days per video" },
    )
  } else if (category === "seo") {
    base.push(
      { id: "keywords", label: "Keyword Rankings", target: "10 target keywords in top 20" },
      { id: "organic", label: "Organic Traffic Growth", target: "25% increase in 3 months" },
      { id: "content", label: "Content Pieces", target: "8 blog articles/month" },
    )
  } else {
    base.push(
      { id: "deliverable1", label: "Primary Deliverable", target: "Completed within agreed timeline" },
      { id: "quality", label: "Quality Standard", target: "2 revision rounds to client approval" },
    )
  }

  return base
}

export function getSuggestedMilestones(category: ServiceCategory | ""): ProposalMilestone[] {
  if (category === "social_media") {
    return [
      { id: "m1", phase: "Strategy & Planning", description: "Audit, strategy document, content calendar setup", duration: "1 week" },
      { id: "m2", phase: "First Content Batch", description: "Initial content creation and platform setup", duration: "2 weeks" },
      { id: "m3", phase: "Monthly Reporting", description: "Performance report and strategy review", duration: "Monthly (ongoing)" },
    ]
  } else if (category === "web_design") {
    return [
      { id: "m1", phase: "Discovery", description: "Requirements gathering, sitemap, wireframes", duration: "1 week" },
      { id: "m2", phase: "Design", description: "UI/UX design, style guide, client approval", duration: "2 weeks" },
      { id: "m3", phase: "Development", description: "Frontend and backend development", duration: "3 weeks" },
      { id: "m4", phase: "QA & Testing", description: "Browser testing, bug fixes, client review", duration: "1 week" },
      { id: "m5", phase: "Launch", description: "Deployment and go-live", duration: "2 days" },
    ]
  } else if (category === "photography") {
    return [
      { id: "m1", phase: "Pre-Production", description: "Shot list, location scouting, scheduling", duration: "3 days" },
      { id: "m2", phase: "Shoot Day", description: "Photography session", duration: "1 day" },
      { id: "m3", phase: "Editing & Delivery", description: "Selection, editing, and file delivery", duration: "5 business days" },
    ]
  } else {
    return [
      { id: "m1", phase: "Project Kickoff", description: "Briefing, planning, and resource allocation", duration: "1 week" },
      { id: "m2", phase: "Delivery", description: "Primary deliverable completion", duration: "As per scope" },
      { id: "m3", phase: "Review & Handoff", description: "Client review, revisions, and final delivery", duration: "1 week" },
    ]
  }
}

export function getInitialProposalFormData(): ProposalFormData {
  const today = new Date()
  const validUntil = new Date(today)
  validUntil.setDate(validUntil.getDate() + 30)
  const issueDate = today.toISOString().split("T")[0]
  const validUntilDate = validUntil.toISOString().split("T")[0]
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")
  const proposalNumber = `PROP-${today.getFullYear()}-${month}-${seq}`

  return {
    title: "",
    proposalNumber,
    issueDate,
    validUntilDate,
    serviceCategory: "",
    clientBusinessName: "",
    clientContactName: "",
    clientAddress: "",
    clientEmail: "",
    clientPhone: "",
    clientIndustry: "",
    clientDigitalPresence: "",
    clientPrimaryGoal: "",
    targetPlatforms: [],
    platformScopes: [],
    includesPhotographyShoot: false,
    includesCommunityManagement: true,
    includesMonthlyReporting: true,
    includesPaidAdsManagement: false,
    clientNeedsDescription: "",
    customDeliverables: [],
    pricingModel: "tiered",
    lineItems: [{ id: "1", description: "", quantity: 1, rate: 0 }],
    tiers: [
      { id: "t1", name: "Basic", description: "", inclusions: [""], monthlyRate: 0 },
      { id: "t2", name: "Standard", description: "", inclusions: [""], monthlyRate: 0, isRecommended: true },
      { id: "t3", name: "Premium", description: "", inclusions: [""], monthlyRate: 0 },
    ],
    addOns: [],
    advancePaymentPercent: 50,
    paymentMethod: "Bank Transfer",
    taxApplicable: false,
    taxRate: 18,
    currency: "INR",
    kpis: [],
    projectStartDate: "",
    milestones: [],
    durationMonths: 3,
    agencyName: "",
    agencyAddress: "",
    agencyEmail: "",
    agencyPhone: "",
    agencyWebsite: "",
    agencyFoundingYear: "",
    agencyTagline: "",
    agencyServices: "",
    tcClauses: [],
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface StepValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateStep(step: number, form: ProposalFormData): StepValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  switch (step) {
    case 1: // Basics
      if (!form.title.trim()) errors.push("Proposal title is required")
      if (!form.proposalNumber.trim()) errors.push("Proposal number is required")
      if (!form.serviceCategory) errors.push("Service category is required")
      if (!form.issueDate) errors.push("Issue date is required")
      if (!form.validUntilDate) errors.push("Valid until date is required")
      if (form.validUntilDate && form.validUntilDate <= new Date().toISOString().split("T")[0]) {
        errors.push("Valid until date must be in the future")
      }
      break

    case 2: // Client
      if (!form.clientBusinessName.trim()) errors.push("Client business name is required")
      if (!form.clientEmail.trim()) errors.push("Client email is required")
      if (form.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) {
        errors.push("Client email is not valid")
      }
      if (!form.clientIndustry) errors.push("Client industry is required")
      if (!form.clientPrimaryGoal) errors.push("Client's primary goal is required")
      break

    case 3: // Scope
      if (!form.clientNeedsDescription.trim()) {
        warnings.push("A brief description of client needs will improve the AI-generated content")
      }
      if (form.serviceCategory === "social_media" && form.targetPlatforms.length === 0) {
        errors.push("Select at least one social media platform")
      }
      break

    case 4: // Pricing
      if (form.pricingModel === "single" || form.pricingModel === "custom") {
        const hasItem = form.lineItems.some(i => i.description.trim() && i.rate > 0)
        if (!hasItem) errors.push("Add at least one line item with a non-zero rate")
      }
      if (form.pricingModel === "tiered") {
        const validTiers = form.tiers.filter(t => t.name.trim() && t.monthlyRate > 0)
        if (validTiers.length < 2) errors.push("Add at least 2 pricing tiers with rates")
        // Check for duplicate rates
        const rates = validTiers.map(t => t.monthlyRate)
        const uniqueRates = new Set(rates)
        if (uniqueRates.size !== rates.length) errors.push("Each pricing tier must have a unique rate")
      }
      if (!form.paymentMethod.trim()) errors.push("Payment method is required")
      break

    case 5: // KPIs
      if (form.kpis.length === 0) errors.push("Add at least one measurable KPI")
      const emptyKPI = form.kpis.find(k => !k.label.trim() || !k.target.trim())
      if (emptyKPI) errors.push("All KPIs must have both a label and a target")
      break

    case 6: // Timeline
      if (!form.projectStartDate) errors.push("Project start date is required")
      if (form.milestones.length === 0) warnings.push("Add project milestones for a more detailed proposal")
      break

    case 7: // Agency
      if (!form.agencyName.trim()) errors.push("Agency name is required — complete your business profile first")
      if (!form.agencyEmail.trim()) errors.push("Agency email is required")
      break

    case 8: // Review
      // Run all previous validations
      for (let s = 1; s <= 7; s++) {
        const result = validateStep(s, form)
        errors.push(...result.errors)
      }
      // Placeholder text check
      const placeholderPattern = /\[.*?\]|\{\{.*?\}\}/g
      const fieldsToCheck = [form.clientNeedsDescription, form.title]
      fieldsToCheck.forEach(f => {
        if (placeholderPattern.test(f)) errors.push("Remove placeholder text from all fields before generating")
      })
      break
  }

  return { isValid: errors.length === 0, errors, warnings }
}

// ─── Proposal to InvoiceData Converter ───────────────────────────────────────

/**
 * Converts a ProposalFormData + generated sections into an InvoiceData object
 * that the existing PDF renderer can use.
 *
 * This is the bridge between the proposal builder and the existing PDF pipeline.
 */
export function proposalToInvoiceData(
  form: ProposalFormData,
  sections: GeneratedProposalSections,
  logoUrl?: string,
): import("@/lib/invoice-types").InvoiceData {
  // Build description from all generated sections
  const fullDescription = [
    sections.executiveSummary ? `## Executive Summary\n\n${sections.executiveSummary}` : "",
    sections.aboutUs ? `## About Us\n\n${sections.aboutUs}` : "",
    sections.ourUnderstanding ? `## Our Understanding\n\n${sections.ourUnderstanding}` : "",
    sections.proposedSolution ? `## Proposed Solution\n\n${sections.proposedSolution}` : "",
    sections.goalsAndKPIs ? `## Goals & KPIs\n\n${sections.goalsAndKPIs}` : "",
  ].filter(Boolean).join("\n\n")

  // Build items from pricing
  let items: import("@/lib/invoice-types").LineItem[] = []

  if (form.pricingModel === "tiered") {
    // Each tier becomes a line item with rate = monthly rate
    items = form.tiers
      .filter(t => t.name.trim() && t.monthlyRate > 0)
      .map((tier, i) => ({
        id: tier.id,
        description: `**${tier.name} Plan** — ₹${tier.monthlyRate.toLocaleString()}/month\n${tier.inclusions.filter(Boolean).map(inc => `• ${inc}`).join("\n")}`,
        quantity: 1,
        rate: tier.monthlyRate,
      }))
    // Add add-ons
    form.addOns.forEach(addon => {
      if (addon.description.trim() && addon.rate > 0) {
        items.push({
          id: addon.id,
          description: `Add-on: ${addon.description}`,
          quantity: 1,
          rate: addon.rate,
        })
      }
    })
  } else {
    items = form.lineItems
      .filter(i => i.description.trim() || i.rate > 0)
      .map(i => ({ ...i }))
  }

  // Build timeline as notes
  const milestoneText = form.milestones.length > 0
    ? "\n\n**Project Timeline**\n" + form.milestones.map(m =>
        `• ${m.phase} — ${m.duration}: ${m.description}`
      ).join("\n")
    : ""

  // Build next steps from generated content
  const notesText = [
    sections.nextSteps,
    milestoneText,
    form.tcClauses.length > 0
      ? "\n\n**Terms & Conditions**\n" + form.tcClauses.map(c => `**${c.label}:** ${c.text}`).join("\n\n")
      : "",
  ].filter(Boolean).join("\n\n")

  const currencySymbol = form.currency === "INR" ? "INR" : form.currency

  return {
    documentType: "Proposal",
    status: "draft",
    invoiceNumber: form.proposalNumber,
    referenceNumber: form.proposalNumber,
    invoiceDate: form.issueDate,
    dueDate: form.validUntilDate,
    paymentTerms: `${form.advancePaymentPercent}% advance, balance on completion`,
    currency: form.currency,

    // Agency / From
    fromName: form.agencyName,
    fromEmail: form.agencyEmail,
    fromAddress: form.agencyAddress,
    fromPhone: form.agencyPhone,
    fromTaxId: "",
    fromWebsite: form.agencyWebsite,
    fromLogo: form.agencyLogoUrl || "",
    showLogo: true,
    logoShape: "rounded",
    logoSize: 44,

    // Client / To
    toName: form.clientBusinessName,
    toEmail: form.clientEmail,
    toAddress: form.clientAddress,
    toPhone: form.clientPhone,
    toTaxId: "",

    // Line items
    items,

    // Financials — for tiered, we hide totals (client picks one plan)
    taxRate: form.taxApplicable ? form.taxRate : 0,
    taxLabel: form.currency === "INR" ? "GST" : "Tax",
    discountType: "percent",
    discountValue: 0,
    shippingFee: 0,
    hideTotals: form.pricingModel === "tiered",

    // Payment
    paymentInstructions: sections.nextSteps || "",
    paymentMethod: form.paymentMethod,

    // Client response — proposals support accept/decline
    allowClientResponse: true,

    // Content sections
    description: fullDescription,
    notes: notesText,
    terms: form.tcClauses.map(c => `${c.label}: ${c.text}`).join("\n\n"),

    // Signature
    signatureName: form.agencyName,
    signatureTitle: "Agency Representative",
    showSenderSignature: true,
    showSignatureFields: true,

    // Design — use corporate template for proposals by default
    design: {
      templateId: "corporate",
      font: "Inter",
      headerColor: "#1e3a5f",
      tableColor: "#f0f4f8",
      layout: "corporate",
    },
  }
}
