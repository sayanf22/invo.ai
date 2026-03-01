/**
 * Input Sanitization Module
 * 
 * Sanitizes user inputs to prevent XSS, injection attacks, and other malicious content.
 * Uses DOMPurify for HTML sanitization and custom validators for other input types.
 */

import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitize HTML content - removes all scripts and dangerous tags
 */
export function sanitizeHTML(input: string): string {
    if (!input || typeof input !== "string") return ""
    
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS: [], // Strip all HTML tags
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true, // Keep text content
    })
}

/**
 * Sanitize plain text - removes control characters and normalizes whitespace
 */
export function sanitizeText(input: string): string {
    if (!input || typeof input !== "string") return ""
    
    return input
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim()
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
    if (!input || typeof input !== "string") return ""
    
    const sanitized = input.toLowerCase().trim()
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitized)) {
        throw new Error("Invalid email format")
    }
    
    // Check for suspicious patterns
    if (sanitized.includes("..") || sanitized.includes("@.")) {
        throw new Error("Invalid email format")
    }
    
    return sanitized
}

/**
 * Sanitize phone number - removes non-numeric characters except + and -
 */
export function sanitizePhone(input: string): string {
    if (!input || typeof input !== "string") return ""
    
    return input.replace(/[^\d+\-\s()]/g, "").trim()
}

/**
 * Sanitize URL - validates and normalizes URLs
 */
export function sanitizeURL(input: string): string {
    if (!input || typeof input !== "string") return ""
    
    try {
        const url = new URL(input)
        
        // Only allow http and https protocols
        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Invalid URL protocol")
        }
        
        return url.toString()
    } catch {
        throw new Error("Invalid URL format")
    }
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: unknown): number {
    const num = Number(input)
    
    if (isNaN(num) || !isFinite(num)) {
        throw new Error("Invalid number")
    }
    
    return num
}

/**
 * Sanitize currency amount - ensures valid decimal with max 2 decimal places
 */
export function sanitizeCurrency(input: unknown): number {
    const num = sanitizeNumber(input)
    
    if (num < 0) {
        throw new Error("Currency amount cannot be negative")
    }
    
    // Round to 2 decimal places
    return Math.round(num * 100) / 100
}

/**
 * Sanitize object recursively - applies sanitization to all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
    obj: T,
    options: {
        allowHTML?: boolean
        maxDepth?: number
    } = {}
): T {
    const { allowHTML = false, maxDepth = 10 } = options
    
    function sanitizeValue(value: unknown, depth: number): unknown {
        if (depth > maxDepth) {
            throw new Error("Object nesting too deep")
        }
        
        if (typeof value === "string") {
            return allowHTML ? value : sanitizeText(value)
        }
        
        if (Array.isArray(value)) {
            return value.map(item => sanitizeValue(item, depth + 1))
        }
        
        if (value && typeof value === "object") {
            const sanitized: Record<string, unknown> = {}
            for (const [key, val] of Object.entries(value)) {
                sanitized[key] = sanitizeValue(val, depth + 1)
            }
            return sanitized
        }
        
        return value
    }
    
    return sanitizeValue(obj, 0) as T
}

/**
 * Validate and sanitize country code (ISO 3166-1 alpha-2)
 */
export function sanitizeCountryCode(input: string): string {
    if (!input || typeof input !== "string") {
        throw new Error("Country code required")
    }
    
    const code = input.toUpperCase().trim()
    
    if (!/^[A-Z]{2}$/.test(code)) {
        throw new Error("Invalid country code format")
    }
    
    return code
}

/**
 * Validate and sanitize currency code (ISO 4217)
 */
export function sanitizeCurrencyCode(input: string): string {
    if (!input || typeof input !== "string") {
        throw new Error("Currency code required")
    }
    
    const code = input.toUpperCase().trim()
    
    if (!/^[A-Z]{3}$/.test(code)) {
        throw new Error("Invalid currency code format")
    }
    
    return code
}

/**
 * Sanitize file name - removes path traversal and dangerous characters
 */
export function sanitizeFileName(input: string): string {
    if (!input || typeof input !== "string") {
        throw new Error("File name required")
    }
    
    // Remove path traversal attempts
    let sanitized = input.replace(/\.\./g, "")
    
    // Remove path separators
    sanitized = sanitized.replace(/[/\\]/g, "")
    
    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, "")
    
    // Limit length
    if (sanitized.length > 255) {
        sanitized = sanitized.substring(0, 255)
    }
    
    if (!sanitized) {
        throw new Error("Invalid file name")
    }
    
    return sanitized
}

/**
 * Sanitize SQL-like input (for search queries, etc.)
 * Removes SQL injection patterns
 */
export function sanitizeSQLInput(input: string): string {
    if (!input || typeof input !== "string") return ""
    
    // Remove SQL keywords and dangerous patterns
    const dangerous = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
        /(--|;|\/\*|\*\/|xp_|sp_)/gi,
        /('|"|`)/g,
    ]
    
    let sanitized = input
    for (const pattern of dangerous) {
        sanitized = sanitized.replace(pattern, "")
    }
    
    return sanitized.trim()
}
