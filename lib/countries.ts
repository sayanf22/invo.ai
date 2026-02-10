// 11 Supported Countries for Invo.ai
// All countries have equal priority as per specification

export interface Country {
    code: string           // ISO 3166-1 alpha-2
    name: string
    flag: string
    currency: string
    currencySymbol: string
    taxIdName: string
    taxIdFormat: string    // Regex pattern for validation
    taxIdPlaceholder: string
    taxIdHelp: string
}

export const SUPPORTED_COUNTRIES: Country[] = [
    {
        code: "IN",
        name: "India",
        flag: "🇮🇳",
        currency: "INR",
        currencySymbol: "₹",
        taxIdName: "GSTIN",
        taxIdFormat: "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$",
        taxIdPlaceholder: "29ABCDE1234F1Z5",
        taxIdHelp: "15-character GST Identification Number"
    },
    {
        code: "US",
        name: "United States",
        flag: "🇺🇸",
        currency: "USD",
        currencySymbol: "$",
        taxIdName: "EIN",
        taxIdFormat: "^[0-9]{2}-[0-9]{7}$",
        taxIdPlaceholder: "12-3456789",
        taxIdHelp: "Employer Identification Number (XX-XXXXXXX)"
    },
    {
        code: "GB",
        name: "United Kingdom",
        flag: "🇬🇧",
        currency: "GBP",
        currencySymbol: "£",
        taxIdName: "VAT",
        taxIdFormat: "^GB[0-9]{9}$",
        taxIdPlaceholder: "GB123456789",
        taxIdHelp: "VAT Registration Number (GB + 9 digits)"
    },
    {
        code: "DE",
        name: "Germany",
        flag: "🇩🇪",
        currency: "EUR",
        currencySymbol: "€",
        taxIdName: "Steuernummer",
        taxIdFormat: "^[0-9]{10,11}$",
        taxIdPlaceholder: "12345678901",
        taxIdHelp: "German Tax Number (10-11 digits)"
    },
    {
        code: "CA",
        name: "Canada",
        flag: "🇨🇦",
        currency: "CAD",
        currencySymbol: "$",
        taxIdName: "BN",
        taxIdFormat: "^[0-9]{9}[A-Z]{2}[0-9]{4}$",
        taxIdPlaceholder: "123456789RC0001",
        taxIdHelp: "Business Number (9 digits + 2 letters + 4 digits)"
    },
    {
        code: "AU",
        name: "Australia",
        flag: "🇦🇺",
        currency: "AUD",
        currencySymbol: "$",
        taxIdName: "ABN",
        taxIdFormat: "^[0-9]{11}$",
        taxIdPlaceholder: "12345678901",
        taxIdHelp: "Australian Business Number (11 digits)"
    },
    {
        code: "SG",
        name: "Singapore",
        flag: "🇸🇬",
        currency: "SGD",
        currencySymbol: "$",
        taxIdName: "GST",
        taxIdFormat: "^[A-Z][0-9]{8}[A-Z]$",
        taxIdPlaceholder: "M12345678X",
        taxIdHelp: "GST Registration Number"
    },
    {
        code: "AE",
        name: "United Arab Emirates",
        flag: "🇦🇪",
        currency: "AED",
        currencySymbol: "د.إ",
        taxIdName: "TRN",
        taxIdFormat: "^[0-9]{15}$",
        taxIdPlaceholder: "100123456789012",
        taxIdHelp: "Tax Registration Number (15 digits)"
    },
    {
        code: "PH",
        name: "Philippines",
        flag: "🇵🇭",
        currency: "PHP",
        currencySymbol: "₱",
        taxIdName: "TIN",
        taxIdFormat: "^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{3}$",
        taxIdPlaceholder: "123-456-789-000",
        taxIdHelp: "Tax Identification Number"
    },
    {
        code: "FR",
        name: "France",
        flag: "🇫🇷",
        currency: "EUR",
        currencySymbol: "€",
        taxIdName: "SIRET",
        taxIdFormat: "^[0-9]{14}$",
        taxIdPlaceholder: "12345678901234",
        taxIdHelp: "SIRET Number (14 digits)"
    },
    {
        code: "NL",
        name: "Netherlands",
        flag: "🇳🇱",
        currency: "EUR",
        currencySymbol: "€",
        taxIdName: "BTW",
        taxIdFormat: "^NL[0-9]{9}B[0-9]{2}$",
        taxIdPlaceholder: "NL123456789B01",
        taxIdHelp: "BTW Number (NL + 9 digits + B + 2 digits)"
    }
]

// Business types
export const BUSINESS_TYPES = [
    { value: "freelancer", label: "Freelancer or Consultant", icon: "User" },
    { value: "developer", label: "Software Developer", icon: "Code" },
    { value: "agency", label: "Agency or Studio", icon: "Building2" },
    { value: "ecommerce", label: "E-commerce Business", icon: "ShoppingCart" },
    { value: "professional", label: "Professional Services", icon: "Briefcase" },
    { value: "other", label: "Other", icon: "MoreHorizontal" }
] as const

export type BusinessType = typeof BUSINESS_TYPES[number]['value']

// Popular currencies (shown first in dropdown)
export const POPULAR_CURRENCIES = [
    { value: "INR", label: "INR (₹)", symbol: "₹", name: "Indian Rupee" },
    { value: "USD", label: "USD ($)", symbol: "$", name: "US Dollar" },
    { value: "GBP", label: "GBP (£)", symbol: "£", name: "British Pound" },
    { value: "EUR", label: "EUR (€)", symbol: "€", name: "Euro" },
    { value: "AUD", label: "AUD ($)", symbol: "$", name: "Australian Dollar" },
    { value: "CAD", label: "CAD ($)", symbol: "$", name: "Canadian Dollar" },
    { value: "SGD", label: "SGD ($)", symbol: "$", name: "Singapore Dollar" },
    { value: "AED", label: "AED (د.إ)", symbol: "د.إ", name: "UAE Dirham" },
    { value: "PHP", label: "PHP (₱)", symbol: "₱", name: "Philippine Peso" },
    { value: "JPY", label: "JPY (¥)", symbol: "¥", name: "Japanese Yen" },
    { value: "CHF", label: "CHF (Fr)", symbol: "Fr", name: "Swiss Franc" },
    { value: "CNY", label: "CNY (¥)", symbol: "¥", name: "Chinese Yuan" }
]

// Payment terms options
export const PAYMENT_TERMS = [
    { value: "immediate", label: "Due on Receipt" },
    { value: "net_7", label: "Net 7 days" },
    { value: "net_15", label: "Net 15 days" },
    { value: "net_30", label: "Net 30 days" },
    { value: "net_45", label: "Net 45 days" },
    { value: "net_60", label: "Net 60 days" }
]

// Helper functions
export function getCountryByCode(code: string): Country | undefined {
    return SUPPORTED_COUNTRIES.find(c => c.code === code)
}

export function validateTaxId(countryCode: string, taxId: string): boolean {
    const country = getCountryByCode(countryCode)
    if (!country) return false

    const regex = new RegExp(country.taxIdFormat)
    return regex.test(taxId)
}

export function getTaxIdFieldName(countryCode: string): string {
    const country = getCountryByCode(countryCode)
    if (!country) return "taxId"

    // Return the JSON field key for the tax_ids object
    const fieldMap: Record<string, string> = {
        IN: "gstin",
        US: "ein",
        GB: "vat",
        DE: "steuernummer",
        CA: "bn",
        AU: "abn",
        SG: "gst",
        AE: "trn",
        PH: "tin",
        FR: "siret",
        NL: "btw"
    }

    return fieldMap[countryCode] || "taxId"
}

export function formatCurrency(amount: number, currencyCode: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode
    }).format(amount)
}
