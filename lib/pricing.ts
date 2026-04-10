/**
 * Multi-currency pricing for all 11 supported countries.
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

// Prices designed to look natural in each currency
// Razorpay charges in INR — these are display prices
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
}

// Default to India pricing
export const DEFAULT_COUNTRY = "IN"

/**
 * Detect user's country from browser timezone.
 * This is a best-effort detection — not 100% accurate but good enough for pricing display.
 */
export function detectCountryFromTimezone(): string {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const tzToCountry: Record<string, string> = {
            "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
            "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
            "America/Phoenix": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US",
            "Europe/London": "GB",
            "Europe/Berlin": "DE", "Europe/Munich": "DE",
            "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
            "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU", "Australia/Perth": "AU",
            "Asia/Singapore": "SG",
            "Asia/Dubai": "AE",
            "Asia/Manila": "PH",
            "Europe/Paris": "FR",
            "Europe/Amsterdam": "NL",
        }
        return tzToCountry[tz] || DEFAULT_COUNTRY
    } catch {
        return DEFAULT_COUNTRY
    }
}

/**
 * Format price for display with proper locale formatting.
 */
export function formatPrice(amount: number, pricing: CountryPricing): string {
    // For currencies with no decimals (INR, PHP), show whole numbers
    const noDecimals = ["INR", "PHP"].includes(pricing.currency)
    
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
    const pricing = COUNTRY_PRICING[countryCode] || COUNTRY_PRICING[DEFAULT_COUNTRY]
    const amount = pricing[plan][billingCycle]
    return {
        display: formatPrice(amount, pricing),
        amount,
        pricing,
    }
}
