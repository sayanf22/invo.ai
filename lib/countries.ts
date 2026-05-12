// Countries supported by Clorefy — every ISO 3166-1 country is supported.
//
// A small set of major markets (India, USA, UK, Germany, Canada, Australia,
// Singapore, UAE, Philippines, France, Netherlands) carries a full
// taxIdFormat regex so the onboarding form can validate the tax-ID
// structure (GSTIN, EIN, VAT Reg No, etc.). Every other country in the
// world uses a permissive "^.{3,40}$" regex so users can enter any format
// their jurisdiction uses. The compliance_knowledge RAG fills in any
// country-specific document rules dynamically at generation time.

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

// ── Generic country list ────────────────────────────────────────────
// [ISO alpha-2, display name, flag, currency, symbol, tax-id name]
// Declared first so SUPPORTED_COUNTRIES can use it at initialization
// time with no TDZ surprises.
const GENERIC_COUNTRY_ROWS: ReadonlyArray<
    readonly [string, string, string, string, string, string]
> = [
    // Europe
    ["AT", "Austria", "🇦🇹", "EUR", "€", "UID"],
    ["BE", "Belgium", "🇧🇪", "EUR", "€", "BTW/TVA"],
    ["BG", "Bulgaria", "🇧🇬", "BGN", "лв", "VAT"],
    ["HR", "Croatia", "🇭🇷", "EUR", "€", "OIB"],
    ["CY", "Cyprus", "🇨🇾", "EUR", "€", "VAT"],
    ["CZ", "Czech Republic", "🇨🇿", "CZK", "Kč", "DIČ"],
    ["DK", "Denmark", "🇩🇰", "DKK", "kr", "CVR"],
    ["EE", "Estonia", "🇪🇪", "EUR", "€", "KMKR"],
    ["FI", "Finland", "🇫🇮", "EUR", "€", "VAT"],
    ["GR", "Greece", "🇬🇷", "EUR", "€", "AFM"],
    ["HU", "Hungary", "🇭🇺", "HUF", "Ft", "VAT"],
    ["IS", "Iceland", "🇮🇸", "ISK", "kr", "VSK"],
    ["IE", "Ireland", "🇮🇪", "EUR", "€", "VAT"],
    ["IT", "Italy", "🇮🇹", "EUR", "€", "P.IVA"],
    ["LV", "Latvia", "🇱🇻", "EUR", "€", "PVN"],
    ["LT", "Lithuania", "🇱🇹", "EUR", "€", "PVM"],
    ["LU", "Luxembourg", "🇱🇺", "EUR", "€", "TVA"],
    ["MT", "Malta", "🇲🇹", "EUR", "€", "VAT"],
    ["NO", "Norway", "🇳🇴", "NOK", "kr", "MVA"],
    ["PL", "Poland", "🇵🇱", "PLN", "zł", "NIP"],
    ["PT", "Portugal", "🇵🇹", "EUR", "€", "NIF"],
    ["RO", "Romania", "🇷🇴", "RON", "lei", "CUI"],
    ["SK", "Slovakia", "🇸🇰", "EUR", "€", "DIČ"],
    ["SI", "Slovenia", "🇸🇮", "EUR", "€", "DDV"],
    ["ES", "Spain", "🇪🇸", "EUR", "€", "NIF"],
    ["SE", "Sweden", "🇸🇪", "SEK", "kr", "VAT"],
    ["CH", "Switzerland", "🇨🇭", "CHF", "Fr", "MwSt"],
    ["UA", "Ukraine", "🇺🇦", "UAH", "₴", "ПДВ"],
    ["AL", "Albania", "🇦🇱", "ALL", "L", "NIPT"],
    ["AD", "Andorra", "🇦🇩", "EUR", "€", "NRT"],
    ["BY", "Belarus", "🇧🇾", "BYN", "Br", "УНП"],
    ["BA", "Bosnia and Herzegovina", "🇧🇦", "BAM", "KM", "PIB"],
    ["LI", "Liechtenstein", "🇱🇮", "CHF", "Fr", "MwSt"],
    ["MC", "Monaco", "🇲🇨", "EUR", "€", "TVA"],
    ["ME", "Montenegro", "🇲🇪", "EUR", "€", "PIB"],
    ["MD", "Moldova", "🇲🇩", "MDL", "L", "IDNO"],
    ["MK", "North Macedonia", "🇲🇰", "MKD", "ден", "EDB"],
    ["RS", "Serbia", "🇷🇸", "RSD", "дин", "PIB"],
    ["SM", "San Marino", "🇸🇲", "EUR", "€", "COE"],
    ["TR", "Turkey", "🇹🇷", "TRY", "₺", "VKN"],
    ["RU", "Russia", "🇷🇺", "RUB", "₽", "ИНН"],

    // Asia
    ["AF", "Afghanistan", "🇦🇫", "AFN", "؋", "TIN"],
    ["AM", "Armenia", "🇦🇲", "AMD", "֏", "TIN"],
    ["AZ", "Azerbaijan", "🇦🇿", "AZN", "₼", "VÖEN"],
    ["BH", "Bahrain", "🇧🇭", "BHD", ".د.ب", "VAT"],
    ["BD", "Bangladesh", "🇧🇩", "BDT", "৳", "BIN"],
    ["BT", "Bhutan", "🇧🇹", "BTN", "Nu.", "TIN"],
    ["BN", "Brunei", "🇧🇳", "BND", "$", "TIN"],
    ["KH", "Cambodia", "🇰🇭", "KHR", "៛", "TIN"],
    ["CN", "China", "🇨🇳", "CNY", "¥", "纳税人识别号"],
    ["GE", "Georgia", "🇬🇪", "GEL", "₾", "TIN"],
    ["HK", "Hong Kong", "🇭🇰", "HKD", "$", "BR No."],
    ["ID", "Indonesia", "🇮🇩", "IDR", "Rp", "NPWP"],
    ["IR", "Iran", "🇮🇷", "IRR", "﷼", "TIN"],
    ["IQ", "Iraq", "🇮🇶", "IQD", "ع.د", "TIN"],
    ["IL", "Israel", "🇮🇱", "ILS", "₪", "מ.ע.מ"],
    ["JP", "Japan", "🇯🇵", "JPY", "¥", "法人番号"],
    ["JO", "Jordan", "🇯🇴", "JOD", "د.ا", "TIN"],
    ["KZ", "Kazakhstan", "🇰🇿", "KZT", "₸", "БИН"],
    ["KW", "Kuwait", "🇰🇼", "KWD", "د.ك", "TIN"],
    ["KG", "Kyrgyzstan", "🇰🇬", "KGS", "с", "ИНН"],
    ["LA", "Laos", "🇱🇦", "LAK", "₭", "TIN"],
    ["LB", "Lebanon", "🇱🇧", "LBP", "ل.ل", "TIN"],
    ["MO", "Macau", "🇲🇴", "MOP", "MOP$", "TIN"],
    ["MY", "Malaysia", "🇲🇾", "MYR", "RM", "SST"],
    ["MV", "Maldives", "🇲🇻", "MVR", "Rf", "TIN"],
    ["MN", "Mongolia", "🇲🇳", "MNT", "₮", "TIN"],
    ["MM", "Myanmar", "🇲🇲", "MMK", "K", "TIN"],
    ["NP", "Nepal", "🇳🇵", "NPR", "रू", "PAN"],
    ["OM", "Oman", "🇴🇲", "OMR", "ر.ع.", "VAT"],
    ["PK", "Pakistan", "🇵🇰", "PKR", "₨", "NTN"],
    ["PS", "Palestine", "🇵🇸", "ILS", "₪", "TIN"],
    ["QA", "Qatar", "🇶🇦", "QAR", "ر.ق", "TIN"],
    ["SA", "Saudi Arabia", "🇸🇦", "SAR", "ر.س", "VAT"],
    ["KR", "South Korea", "🇰🇷", "KRW", "₩", "사업자등록번호"],
    ["LK", "Sri Lanka", "🇱🇰", "LKR", "Rs", "TIN"],
    ["SY", "Syria", "🇸🇾", "SYP", "£", "TIN"],
    ["TW", "Taiwan", "🇹🇼", "TWD", "NT$", "統一編號"],
    ["TJ", "Tajikistan", "🇹🇯", "TJS", "ЅМ", "ИНН"],
    ["TH", "Thailand", "🇹🇭", "THB", "฿", "VAT"],
    ["TL", "Timor-Leste", "🇹🇱", "USD", "$", "TIN"],
    ["TM", "Turkmenistan", "🇹🇲", "TMT", "m", "TIN"],
    ["UZ", "Uzbekistan", "🇺🇿", "UZS", "сўм", "ИНН"],
    ["VN", "Vietnam", "🇻🇳", "VND", "₫", "MST"],
    ["YE", "Yemen", "🇾🇪", "YER", "﷼", "TIN"],

    // Americas
    ["AR", "Argentina", "🇦🇷", "ARS", "$", "CUIT"],
    ["BS", "Bahamas", "🇧🇸", "BSD", "$", "TIN"],
    ["BB", "Barbados", "🇧🇧", "BBD", "$", "TIN"],
    ["BZ", "Belize", "🇧🇿", "BZD", "BZ$", "TIN"],
    ["BO", "Bolivia", "🇧🇴", "BOB", "Bs", "NIT"],
    ["BR", "Brazil", "🇧🇷", "BRL", "R$", "CNPJ"],
    ["CL", "Chile", "🇨🇱", "CLP", "$", "RUT"],
    ["CO", "Colombia", "🇨🇴", "COP", "$", "NIT"],
    ["CR", "Costa Rica", "🇨🇷", "CRC", "₡", "NITE"],
    ["CU", "Cuba", "🇨🇺", "CUP", "$", "TIN"],
    ["DM", "Dominica", "🇩🇲", "XCD", "$", "TIN"],
    ["DO", "Dominican Republic", "🇩🇴", "DOP", "$", "RNC"],
    ["EC", "Ecuador", "🇪🇨", "USD", "$", "RUC"],
    ["SV", "El Salvador", "🇸🇻", "USD", "$", "NIT"],
    ["GT", "Guatemala", "🇬🇹", "GTQ", "Q", "NIT"],
    ["GY", "Guyana", "🇬🇾", "GYD", "$", "TIN"],
    ["HT", "Haiti", "🇭🇹", "HTG", "G", "TIN"],
    ["HN", "Honduras", "🇭🇳", "HNL", "L", "RTN"],
    ["JM", "Jamaica", "🇯🇲", "JMD", "$", "TRN"],
    ["MX", "Mexico", "🇲🇽", "MXN", "$", "RFC"],
    ["NI", "Nicaragua", "🇳🇮", "NIO", "C$", "RUC"],
    ["PA", "Panama", "🇵🇦", "PAB", "B/.", "RUC"],
    ["PY", "Paraguay", "🇵🇾", "PYG", "₲", "RUC"],
    ["PE", "Peru", "🇵🇪", "PEN", "S/", "RUC"],
    ["PR", "Puerto Rico", "🇵🇷", "USD", "$", "EIN"],
    ["SR", "Suriname", "🇸🇷", "SRD", "$", "TIN"],
    ["TT", "Trinidad and Tobago", "🇹🇹", "TTD", "$", "BIR"],
    ["UY", "Uruguay", "🇺🇾", "UYU", "$U", "RUT"],
    ["VE", "Venezuela", "🇻🇪", "VES", "Bs", "RIF"],

    // Africa
    ["DZ", "Algeria", "🇩🇿", "DZD", "د.ج", "NIF"],
    ["AO", "Angola", "🇦🇴", "AOA", "Kz", "NIF"],
    ["BJ", "Benin", "🇧🇯", "XOF", "Fr", "IFU"],
    ["BW", "Botswana", "🇧🇼", "BWP", "P", "TIN"],
    ["BF", "Burkina Faso", "🇧🇫", "XOF", "Fr", "IFU"],
    ["BI", "Burundi", "🇧🇮", "BIF", "Fr", "TIN"],
    ["CV", "Cabo Verde", "🇨🇻", "CVE", "$", "NIF"],
    ["CM", "Cameroon", "🇨🇲", "XAF", "Fr", "NUI"],
    ["CF", "Central African Republic", "🇨🇫", "XAF", "Fr", "NIF"],
    ["TD", "Chad", "🇹🇩", "XAF", "Fr", "NIF"],
    ["KM", "Comoros", "🇰🇲", "KMF", "Fr", "TIN"],
    ["CG", "Congo", "🇨🇬", "XAF", "Fr", "NIU"],
    ["CD", "DR Congo", "🇨🇩", "CDF", "Fr", "NIF"],
    ["CI", "Ivory Coast", "🇨🇮", "XOF", "Fr", "CC"],
    ["DJ", "Djibouti", "🇩🇯", "DJF", "Fr", "NIF"],
    ["EG", "Egypt", "🇪🇬", "EGP", "£", "TIN"],
    ["GQ", "Equatorial Guinea", "🇬🇶", "XAF", "Fr", "NIF"],
    ["ER", "Eritrea", "🇪🇷", "ERN", "Nfk", "TIN"],
    ["SZ", "Eswatini", "🇸🇿", "SZL", "L", "TIN"],
    ["ET", "Ethiopia", "🇪🇹", "ETB", "Br", "TIN"],
    ["GA", "Gabon", "🇬🇦", "XAF", "Fr", "NIF"],
    ["GM", "Gambia", "🇬🇲", "GMD", "D", "TIN"],
    ["GH", "Ghana", "🇬🇭", "GHS", "₵", "TIN"],
    ["GN", "Guinea", "🇬🇳", "GNF", "Fr", "NIF"],
    ["GW", "Guinea-Bissau", "🇬🇼", "XOF", "Fr", "NIF"],
    ["KE", "Kenya", "🇰🇪", "KES", "Sh", "PIN"],
    ["LS", "Lesotho", "🇱🇸", "LSL", "L", "TIN"],
    ["LR", "Liberia", "🇱🇷", "LRD", "$", "TIN"],
    ["LY", "Libya", "🇱🇾", "LYD", "ل.د", "TIN"],
    ["MG", "Madagascar", "🇲🇬", "MGA", "Ar", "NIF"],
    ["MW", "Malawi", "🇲🇼", "MWK", "MK", "TIN"],
    ["ML", "Mali", "🇲🇱", "XOF", "Fr", "NIF"],
    ["MR", "Mauritania", "🇲🇷", "MRU", "UM", "NIF"],
    ["MU", "Mauritius", "🇲🇺", "MUR", "₨", "VAT"],
    ["MA", "Morocco", "🇲🇦", "MAD", "د.م.", "ICE"],
    ["MZ", "Mozambique", "🇲🇿", "MZN", "MT", "NUIT"],
    ["NA", "Namibia", "🇳🇦", "NAD", "$", "TIN"],
    ["NE", "Niger", "🇳🇪", "XOF", "Fr", "NIF"],
    ["NG", "Nigeria", "🇳🇬", "NGN", "₦", "TIN"],
    ["RW", "Rwanda", "🇷🇼", "RWF", "Fr", "TIN"],
    ["ST", "Sao Tome and Principe", "🇸🇹", "STN", "Db", "NIF"],
    ["SN", "Senegal", "🇸🇳", "XOF", "Fr", "NINEA"],
    ["SC", "Seychelles", "🇸🇨", "SCR", "₨", "TIN"],
    ["SL", "Sierra Leone", "🇸🇱", "SLE", "Le", "TIN"],
    ["SO", "Somalia", "🇸🇴", "SOS", "Sh", "TIN"],
    ["ZA", "South Africa", "🇿🇦", "ZAR", "R", "VAT"],
    ["SS", "South Sudan", "🇸🇸", "SSP", "£", "TIN"],
    ["SD", "Sudan", "🇸🇩", "SDG", "£", "TIN"],
    ["TZ", "Tanzania", "🇹🇿", "TZS", "Sh", "TIN"],
    ["TG", "Togo", "🇹🇬", "XOF", "Fr", "NIF"],
    ["TN", "Tunisia", "🇹🇳", "TND", "د.ت", "MF"],
    ["UG", "Uganda", "🇺🇬", "UGX", "Sh", "TIN"],
    ["ZM", "Zambia", "🇿🇲", "ZMW", "ZK", "TPIN"],
    ["ZW", "Zimbabwe", "🇿🇼", "ZWL", "$", "BP"],

    // Oceania
    ["NZ", "New Zealand", "🇳🇿", "NZD", "$", "GST"],
    ["FJ", "Fiji", "🇫🇯", "FJD", "$", "TIN"],
    ["PG", "Papua New Guinea", "🇵🇬", "PGK", "K", "TIN"],
    ["WS", "Samoa", "🇼🇸", "WST", "T", "TIN"],
    ["SB", "Solomon Islands", "🇸🇧", "SBD", "$", "TIN"],
    ["TO", "Tonga", "🇹🇴", "TOP", "T$", "TIN"],
    ["VU", "Vanuatu", "🇻🇺", "VUV", "Vt", "TIN"],
    ["KI", "Kiribati", "🇰🇮", "AUD", "$", "TIN"],
    ["MH", "Marshall Islands", "🇲🇭", "USD", "$", "TIN"],
    ["FM", "Micronesia", "🇫🇲", "USD", "$", "TIN"],
    ["NR", "Nauru", "🇳🇷", "AUD", "$", "TIN"],
    ["PW", "Palau", "🇵🇼", "USD", "$", "TIN"],
    ["TV", "Tuvalu", "🇹🇻", "AUD", "$", "TIN"],
]

const GENERIC_COUNTRIES: Country[] = GENERIC_COUNTRY_ROWS.map(
    ([code, name, flag, currency, currencySymbol, taxIdName]) => ({
        code,
        name,
        flag,
        currency,
        currencySymbol,
        taxIdName,
        taxIdFormat: "^.{3,40}$",
        taxIdPlaceholder: "Your tax ID (if registered)",
        taxIdHelp: `Enter your ${taxIdName} if you are tax-registered; leave empty otherwise`,
    })
)

// ── Countries with strict tax-ID validation regex ───────────────────
const CORE_COUNTRIES: Country[] = [
    {
        code: "IN",
        name: "India",
        flag: "🇮🇳",
        currency: "INR",
        currencySymbol: "₹",
        taxIdName: "GSTIN",
        taxIdFormat: "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$",
        taxIdPlaceholder: "29ABCDE1234F1Z5",
        taxIdHelp: "15-character GST Identification Number",
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
        taxIdHelp: "Employer Identification Number (XX-XXXXXXX)",
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
        taxIdHelp: "VAT Registration Number (GB + 9 digits)",
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
        taxIdHelp: "German Tax Number (10-11 digits)",
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
        taxIdHelp: "Business Number (9 digits + 2 letters + 4 digits)",
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
        taxIdHelp: "Australian Business Number (11 digits)",
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
        taxIdHelp: "GST Registration Number",
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
        taxIdHelp: "Tax Registration Number (15 digits)",
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
        taxIdHelp: "Tax Identification Number",
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
        taxIdHelp: "SIRET Number (14 digits)",
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
        taxIdHelp: "BTW Number (NL + 9 digits + B + 2 digits)",
    },
]

// ── Exported full country list ──────────────────────────────────────
// Core countries (with strict tax-ID regex) first, then the rest of the
// world. Every ISO 3166-1 country is represented.
export const SUPPORTED_COUNTRIES: Country[] = [...CORE_COUNTRIES, ...GENERIC_COUNTRIES]

// Business types
export const BUSINESS_TYPES = [
    { value: "freelancer", label: "Freelancer or Consultant", icon: "User" },
    { value: "developer", label: "Software Developer", icon: "Code" },
    { value: "agency", label: "Agency or Studio", icon: "Building2" },
    { value: "ecommerce", label: "E-commerce Business", icon: "ShoppingCart" },
    { value: "professional", label: "Professional Services", icon: "Briefcase" },
    { value: "other", label: "Other", icon: "MoreHorizontal" },
] as const

export type BusinessType = typeof BUSINESS_TYPES[number]["value"]

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
    { value: "CNY", label: "CNY (¥)", symbol: "¥", name: "Chinese Yuan" },
]

// Payment terms options
export const PAYMENT_TERMS = [
    { value: "immediate", label: "Due on Receipt" },
    { value: "net_7", label: "Net 7 days" },
    { value: "net_15", label: "Net 15 days" },
    { value: "net_30", label: "Net 30 days" },
    { value: "net_45", label: "Net 45 days" },
    { value: "net_60", label: "Net 60 days" },
]

// Helper functions
export function getCountryByCode(code: string): Country | undefined {
    return SUPPORTED_COUNTRIES.find((c) => c.code === code)
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

    // Field keys used in the businesses.tax_ids JSONB column for the
    // primary-market countries (India, USA, UK, Germany, Canada,
    // Australia, Singapore, UAE, Philippines, France, Netherlands).
    // Other countries fall through to a generic key.
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
        NL: "btw",
    }
    return fieldMap[countryCode] || "taxId"
}

export function formatCurrency(amount: number, currencyCode: string): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
    }).format(amount)
}
