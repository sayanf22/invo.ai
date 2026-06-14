/**
 * Multi-currency pricing for the major supported markets.
 * Prices are set manually per country to look natural (e.g., ₹999, $9.99, €8.99).
 * Razorpay always charges in INR — the displayed price is for UX only.
 * The actual charge amount is the INR price.
 */

export interface CountryPricing {
    country: string
    countryCode: string
    currency: string
    currencySymbol: string
    locale: string
    starter: { monthly: number; yearly: number }
    pro: { monthly: number; yearly: number }
    agency: { monthly: number; yearly: number }
}

// ─── Prices by country ────────────────────────────────────────────────────────
// Designed to look natural in each currency.
// Razorpay charges in INR — these are display prices for UX only.

export const COUNTRY_PRICING: Record<string, CountryPricing> = {
    IN: {
        country: "India", countryCode: "IN", currency: "INR", currencySymbol: "₹", locale: "en-IN",
        starter: { monthly: 999, yearly: 799 },
        pro: { monthly: 2499, yearly: 1999 },
        agency: { monthly: 5999, yearly: 4799 },
    },
    US: {
        country: "United States", countryCode: "US", currency: "USD", currencySymbol: "$", locale: "en-US",
        starter: { monthly: 9.99, yearly: 7.99 },
        pro: { monthly: 24.99, yearly: 19.99 },
        agency: { monthly: 59.99, yearly: 47.99 },
    },
    GB: {
        country: "United Kingdom", countryCode: "GB", currency: "GBP", currencySymbol: "£", locale: "en-GB",
        starter: { monthly: 7.99, yearly: 5.99 },
        pro: { monthly: 19.99, yearly: 15.99 },
        agency: { monthly: 47.99, yearly: 37.99 },
    },
    DE: {
        country: "Germany", countryCode: "DE", currency: "EUR", currencySymbol: "€", locale: "de-DE",
        starter: { monthly: 8.99, yearly: 6.99 },
        pro: { monthly: 22.99, yearly: 17.99 },
        agency: { monthly: 54.99, yearly: 43.99 },
    },
    CA: {
        country: "Canada", countryCode: "CA", currency: "CAD", currencySymbol: "CA$", locale: "en-CA",
        starter: { monthly: 12.99, yearly: 9.99 },
        pro: { monthly: 32.99, yearly: 25.99 },
        agency: { monthly: 79.99, yearly: 63.99 },
    },
    AU: {
        country: "Australia", countryCode: "AU", currency: "AUD", currencySymbol: "A$", locale: "en-AU",
        starter: { monthly: 14.99, yearly: 11.99 },
        pro: { monthly: 37.99, yearly: 29.99 },
        agency: { monthly: 89.99, yearly: 71.99 },
    },
    SG: {
        country: "Singapore", countryCode: "SG", currency: "SGD", currencySymbol: "S$", locale: "en-SG",
        starter: { monthly: 12.99, yearly: 9.99 },
        pro: { monthly: 32.99, yearly: 25.99 },
        agency: { monthly: 79.99, yearly: 63.99 },
    },
    AE: {
        country: "UAE", countryCode: "AE", currency: "AED", currencySymbol: "AED", locale: "en-AE",
        starter: { monthly: 36.99, yearly: 28.99 },
        pro: { monthly: 89.99, yearly: 72.99 },
        agency: { monthly: 219.99, yearly: 175.99 },
    },
    PH: {
        country: "Philippines", countryCode: "PH", currency: "PHP", currencySymbol: "₱", locale: "en-PH",
        starter: { monthly: 499, yearly: 399 },
        pro: { monthly: 1299, yearly: 999 },
        agency: { monthly: 2999, yearly: 2399 },
    },
    FR: {
        country: "France", countryCode: "FR", currency: "EUR", currencySymbol: "€", locale: "fr-FR",
        starter: { monthly: 8.99, yearly: 6.99 },
        pro: { monthly: 22.99, yearly: 17.99 },
        agency: { monthly: 54.99, yearly: 43.99 },
    },
    NL: {
        country: "Netherlands", countryCode: "NL", currency: "EUR", currencySymbol: "€", locale: "nl-NL",
        starter: { monthly: 8.99, yearly: 6.99 },
        pro: { monthly: 22.99, yearly: 17.99 },
        agency: { monthly: 54.99, yearly: 43.99 },
    },
    // Additional EU countries (EUR)
    ES: {
        country: "Spain", countryCode: "ES", currency: "EUR", currencySymbol: "€", locale: "es-ES",
        starter: { monthly: 8.99, yearly: 6.99 },
        pro: { monthly: 22.99, yearly: 17.99 },
        agency: { monthly: 54.99, yearly: 43.99 },
    },
    IT: {
        country: "Italy", countryCode: "IT", currency: "EUR", currencySymbol: "€", locale: "it-IT",
        starter: { monthly: 8.99, yearly: 6.99 },
        pro: { monthly: 22.99, yearly: 17.99 },
        agency: { monthly: 54.99, yearly: 43.99 },
    },
    SE: {
        country: "Sweden", countryCode: "SE", currency: "SEK", currencySymbol: "kr", locale: "sv-SE",
        starter: { monthly: 99, yearly: 79 },
        pro: { monthly: 249, yearly: 199 },
        agency: { monthly: 599, yearly: 479 },
    },
    // MENA / South Asia
    SA: {
        country: "Saudi Arabia", countryCode: "SA", currency: "SAR", currencySymbol: "SAR", locale: "en-SA",
        starter: { monthly: 37.99, yearly: 29.99 },
        pro: { monthly: 94.99, yearly: 75.99 },
        agency: { monthly: 224.99, yearly: 179.99 },
    },
    PK: {
        country: "Pakistan", countryCode: "PK", currency: "PKR", currencySymbol: "₨", locale: "en-PK",
        starter: { monthly: 2799, yearly: 2199 },
        pro: { monthly: 6999, yearly: 5599 },
        agency: { monthly: 16999, yearly: 13599 },
    },
    BD: {
        country: "Bangladesh", countryCode: "BD", currency: "BDT", currencySymbol: "৳", locale: "en-BD",
        starter: { monthly: 1099, yearly: 879 },
        pro: { monthly: 2799, yearly: 2199 },
        agency: { monthly: 6699, yearly: 5399 },
    },
    // East Asia
    JP: {
        country: "Japan", countryCode: "JP", currency: "JPY", currencySymbol: "¥", locale: "ja-JP",
        starter: { monthly: 1499, yearly: 1199 },
        pro: { monthly: 3699, yearly: 2999 },
        agency: { monthly: 8999, yearly: 7199 },
    },
    KR: {
        country: "South Korea", countryCode: "KR", currency: "KRW", currencySymbol: "₩", locale: "ko-KR",
        starter: { monthly: 13900, yearly: 10900 },
        pro: { monthly: 34900, yearly: 27900 },
        agency: { monthly: 84900, yearly: 67900 },
    },
    // Southeast Asia
    MY: {
        country: "Malaysia", countryCode: "MY", currency: "MYR", currencySymbol: "RM", locale: "en-MY",
        starter: { monthly: 44.99, yearly: 35.99 },
        pro: { monthly: 109.99, yearly: 87.99 },
        agency: { monthly: 269.99, yearly: 215.99 },
    },
    ID: {
        country: "Indonesia", countryCode: "ID", currency: "IDR", currencySymbol: "Rp", locale: "id-ID",
        starter: { monthly: 159000, yearly: 129000 },
        pro: { monthly: 399000, yearly: 319000 },
        agency: { monthly: 949000, yearly: 759000 },
    },
    TH: {
        country: "Thailand", countryCode: "TH", currency: "THB", currencySymbol: "฿", locale: "th-TH",
        starter: { monthly: 349, yearly: 279 },
        pro: { monthly: 879, yearly: 699 },
        agency: { monthly: 2099, yearly: 1679 },
    },
    // Africa
    NG: {
        country: "Nigeria", countryCode: "NG", currency: "NGN", currencySymbol: "₦", locale: "en-NG",
        starter: { monthly: 14999, yearly: 11999 },
        pro: { monthly: 37499, yearly: 29999 },
        agency: { monthly: 89999, yearly: 71999 },
    },
    ZA: {
        country: "South Africa", countryCode: "ZA", currency: "ZAR", currencySymbol: "R", locale: "en-ZA",
        starter: { monthly: 179, yearly: 139 },
        pro: { monthly: 449, yearly: 359 },
        agency: { monthly: 1099, yearly: 879 },
    },
    // Latin America
    BR: {
        country: "Brazil", countryCode: "BR", currency: "BRL", currencySymbol: "R$", locale: "pt-BR",
        starter: { monthly: 49.99, yearly: 39.99 },
        pro: { monthly: 124.99, yearly: 99.99 },
        agency: { monthly: 299.99, yearly: 239.99 },
    },
    MX: {
        country: "Mexico", countryCode: "MX", currency: "MXN", currencySymbol: "MX$", locale: "es-MX",
        starter: { monthly: 169, yearly: 139 },
        pro: { monthly: 429, yearly: 339 },
        agency: { monthly: 999, yearly: 799 },
    },
}

// Default to India pricing (primary market)
export const DEFAULT_COUNTRY = "IN"

// ─── Country detection ────────────────────────────────────────────────────────

/**
 * Detect user's country from browser timezone.
 * Best-effort — not 100% accurate but instant (no network call).
 */
export function detectCountryFromTimezone(): string {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const tzToCountry: Record<string, string> = {
            // India
            "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
            // USA
            "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
            "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
            "Pacific/Honolulu": "US",
            // UK
            "Europe/London": "GB",
            // Germany
            "Europe/Berlin": "DE", "Europe/Munich": "DE",
            // Canada
            "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
            "America/Winnipeg": "CA", "America/Halifax": "CA",
            // Australia
            "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
            "Australia/Perth": "AU", "Australia/Adelaide": "AU",
            // Singapore
            "Asia/Singapore": "SG",
            // UAE
            "Asia/Dubai": "AE",
            // Philippines
            "Asia/Manila": "PH",
            // France
            "Europe/Paris": "FR",
            // Netherlands
            "Europe/Amsterdam": "NL",
            // Spain
            "Europe/Madrid": "ES",
            // Italy
            "Europe/Rome": "IT",
            // Sweden
            "Europe/Stockholm": "SE",
            // Saudi Arabia
            "Asia/Riyadh": "SA",
            // Pakistan
            "Asia/Karachi": "PK",
            // Bangladesh
            "Asia/Dhaka": "BD",
            // Japan
            "Asia/Tokyo": "JP",
            // South Korea
            "Asia/Seoul": "KR",
            // Malaysia
            "Asia/Kuala_Lumpur": "MY",
            // Indonesia
            "Asia/Jakarta": "ID", "Asia/Makassar": "ID", "Asia/Jayapura": "ID",
            // Thailand
            "Asia/Bangkok": "TH",
            // Nigeria
            "Africa/Lagos": "NG",
            // South Africa
            "Africa/Johannesburg": "ZA",
            // Brazil
            "America/Sao_Paulo": "BR", "America/Recife": "BR", "America/Fortaleza": "BR",
            "America/Manaus": "BR", "America/Belem": "BR",
            // Mexico
            "America/Mexico_City": "MX", "America/Monterrey": "MX", "America/Merida": "MX",
        }
        return tzToCountry[tz] || DEFAULT_COUNTRY
    } catch {
        return DEFAULT_COUNTRY
    }
}

/**
 * Detect country via the /api/geo/country endpoint (uses Cloudflare cf-ipcountry header).
 * More accurate than timezone detection. Returns null on failure.
 * Only call this client-side (requires fetch).
 */
export async function detectCountryFromIP(): Promise<string | null> {
    try {
        const res = await fetch("/api/geo/country", {
            signal: AbortSignal.timeout(2000),
            cache: "no-store",
        })
        if (!res.ok) return null
        const { country } = await res.json()
        return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null
    } catch {
        return null
    }
}

/**
 * Get pricing for the user's country.
 * 1. Tries IP detection (accurate, needs network)
 * 2. Falls back to timezone detection (instant, less accurate)
 * 3. Falls back to default country (India)
 */
export async function detectUserPricing(): Promise<CountryPricing> {
    const ipCountry = await detectCountryFromIP()
    const country = ipCountry ?? detectCountryFromTimezone()
    return COUNTRY_PRICING[country] ?? COUNTRY_PRICING[DEFAULT_COUNTRY]
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format price for display with proper locale formatting.
 */
export function formatPrice(amount: number, pricing: CountryPricing): string {
    // Currencies that don't use decimals
    const noDecimals = ["INR", "PHP", "JPY", "KRW", "PKR", "BDT", "IDR", "NGN", "SEK"].includes(pricing.currency)

    try {
        return new Intl.NumberFormat(pricing.locale, {
            style: "currency",
            currency: pricing.currency,
            minimumFractionDigits: noDecimals ? 0 : 2,
            maximumFractionDigits: noDecimals ? 0 : 2,
        }).format(amount)
    } catch {
        return `${pricing.currencySymbol}${noDecimals ? Math.round(amount) : amount.toFixed(2)}`
    }
}

/**
 * Get pricing for a specific plan and country.
 */
export function getPlanPrice(
    plan: "starter" | "pro" | "agency",
    billingCycle: "monthly" | "yearly",
    countryCode: string
): { display: string; amount: number; pricing: CountryPricing } {
    const pricing = COUNTRY_PRICING[countryCode] ?? COUNTRY_PRICING[DEFAULT_COUNTRY]
    const amount = pricing[plan][billingCycle]
    return {
        display: formatPrice(amount, pricing),
        amount,
        pricing,
    }
}

/**
 * Returns a human-readable per-document cost hint for a given plan/country.
 * e.g. "~₹16 per document"
 */
export function getValueHint(
    plan: "starter" | "pro" | "agency",
    pricing: CountryPricing
): string {
    const limits: Record<string, number> = { starter: 50, pro: 150, agency: 500 }
    const monthlyPrice = pricing[plan].monthly
    const perDoc = monthlyPrice / limits[plan]
    const formatted = formatPrice(perDoc, pricing)
    return `~${formatted} per document`
}
