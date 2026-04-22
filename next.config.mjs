import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  await initOpenNextCloudflareForDev();
}

// Environment-aware CSP: allow unsafe-eval in dev for hot reload, block in prod
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://checkout.razorpay.com https://cdn.razorpay.com https://static.cloudflareinsights.com"
  : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://checkout.razorpay.com https://cdn.razorpay.com https://static.cloudflareinsights.com";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },

  // Remove X-Powered-By header to prevent technology fingerprinting
  poweredByHeader: false,

  // Exclude heavy packages from the server bundle — they're only used client-side
  serverExternalPackages: [
    "@react-pdf/renderer",
    "react-pdf",
  ],

  // ── Security Headers ────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer info sent with requests
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Enable HSTS (force HTTPS) with preload
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Prevent XSS attacks
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Permissions policy: disable camera, mic, geo, usb; allow payment for Razorpay
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\"), usb=()" },
          // Content Security Policy (environment-aware)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://*.razorpay.com https://upload.wikimedia.org https://cashfreelogo.cashfree.com https://stripe.com https://js.stripe.com",
              "connect-src 'self' blob: data: https://*.supabase.co https://api.deepseek.com https://api.openai.com https://api.razorpay.com https://lumberjack.razorpay.com",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              "frame-ancestors 'none'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
