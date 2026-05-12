import React, { Suspense } from "react"
import type { Metadata, Viewport } from "next"
import { DM_Sans, DM_Mono, Playfair_Display, Inter, Lora, Roboto_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { GoogleAnalytics } from "@/components/google-analytics"

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" })
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display" })
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" })
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono" })

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF7F0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a18" },
  ],
}

export const metadata: Metadata = {
  title: {
    default: "Clorefy — AI Invoice Generator, Contract Maker & Auto Payment Reminders | Every Country",
    template: "%s | Clorefy",
  },
  description:
    "Generate invoices, contracts, quotations, and proposals with AI in seconds. Clorefy auto-emails clients, attaches payment links, chases overdue bills for 37 days, and runs recurring billing every month. GST, VAT & sales tax compliant for India, USA, UK, Germany, Canada + 6 more. Free plan, no credit card.",
  keywords: [
    // Core intent keywords — match what people actually search
    "invoice generator", "free invoice generator", "online invoice generator",
    "AI invoice generator", "invoice maker", "invoice creator", "create invoice online",
    "contract generator", "AI contract generator", "contract maker", "contract creator",
    "proposal generator", "AI proposal generator", "proposal maker", "proposal writer",
    "quotation generator", "AI quotation generator", "quotation maker", "quote generator",
    // Country-specific (high search volume)
    "GST invoice generator", "GST invoice India", "VAT invoice generator", "VAT invoice UK",
    "invoice generator India", "invoice generator USA", "invoice generator UK",
    "tax invoice generator", "tax compliant invoices",
    // Feature-specific keywords
    "recurring invoice software", "automated invoicing", "invoice automation",
    "payment reminder software", "invoice payment reminders", "overdue invoice reminders",
    "invoice with payment link", "invoice Stripe integration", "invoice Razorpay",
    "e-signature invoice", "digital signature contracts",
    // Comparison keywords — capture "vs" search traffic
    "FreshBooks alternative", "QuickBooks alternative", "Zoho Invoice alternative",
    "Invoice Ninja alternative", "Bill.com alternative",
    "ChatGPT invoice", "ChatGPT contract generator",
    // Use-case keywords
    "freelancer invoice tool", "small business invoicing", "SMB invoice software",
    "agency invoice software", "consultant invoice template",
    "business document automation", "document generation AI",
    // Long-tail high-intent
    "how to create an invoice", "how to send invoice to client",
    "best invoice software 2025", "best invoice software 2026",
    // Brand
    "Clorefy", "clorefy.com", "Clorefy AI",
  ],
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/favicon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.png",
  },
  metadataBase: new URL("https://clorefy.com"),
  alternates: {
    canonical: "/",
  },
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
      : {}),
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Clorefy — AI Invoice Generator with Auto Payment Reminders & Recurring Billing",
    description:
      "Generate invoices, contracts & proposals with AI. Auto-email clients, attach payment links, chase overdue bills, run recurring billing. GST, VAT, sales tax compliant for every country worldwide. Free plan available.",
    url: "https://clorefy.com",
    siteName: "Clorefy",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/favicon.png",
        width: 512,
        height: 512,
        alt: "Clorefy — AI Invoice Generator with Automated Payment Collection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clorefy — AI Invoice Generator with Auto Reminders",
    description:
      "Generate invoices & contracts with AI. Auto-email clients, attach payment links, chase overdue bills. Every country worldwide. Free plan.",
    images: ["/favicon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Critical: Set brand background color BEFORE CSS loads to prevent flash */}
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { background-color: #FBF7F0 !important; }
        ` }} />
        {/* JSON-LD — WebSite schema (enables sitelinks search box in Google) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Clorefy",
              "alternateName": ["Clorefy AI", "Clorify", "Clorefy.com"],
              "url": "https://clorefy.com",
              "description": "AI-powered document generation platform for invoices, contracts, quotations, and proposals. Compliant for every country worldwide.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://clorefy.com/blog?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {/* JSON-LD — Organization schema (powers Google Knowledge Panel) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": "https://clorefy.com/#organization",
              "name": "Clorefy",
              "alternateName": ["Clorefy AI", "Clorify"],
              "url": "https://clorefy.com",
              "logo": {
                "@type": "ImageObject",
                "url": "https://clorefy.com/favicon.png",
                "width": 512,
                "height": 512,
              },
              "image": "https://clorefy.com/favicon.png",
              "description": "AI-powered document generation platform that creates professional invoices, contracts, quotations, and proposals. Compliant for every country worldwide — including India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands and beyond.",
              "foundingDate": "2025",
              "numberOfEmployees": { "@type": "QuantitativeValue", "value": 1 },
              "sameAs": [
                "https://twitter.com/clorefy",
                "https://linkedin.com/company/clorefy",
                "https://github.com/clorefy",
                "https://www.youtube.com/@Clorefy",
              ],
              "contactPoint": [
                {
                  "@type": "ContactPoint",
                  "contactType": "customer support",
                  "email": "support@clorefy.com",
                  "url": "https://clorefy.com/contact",
                  "availableLanguage": "English",
                },
              ],
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "IN",
              },
            }),
          }}
        />
        {/* JSON-LD — SoftwareApplication schema (for rich results in Google) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "@id": "https://clorefy.com/#software",
              "name": "Clorefy",
              "alternateName": ["Clorefy AI", "Clorify"],
              "url": "https://clorefy.com",
              "applicationCategory": "BusinessApplication",
              "applicationSubCategory": "InvoicingApplication",
              "operatingSystem": "Web, iOS, Android",
              "description": "AI-powered document generation platform that creates professional invoices, contracts, quotations, and proposals using artificial intelligence. Compliant for every country worldwide.",
              "featureList": [
                "AI invoice generation",
                "AI contract generation",
                "AI quotation generation",
                "AI proposal generation",
                "GST compliance for India",
                "VAT compliance for UK and EU",
                "Sales tax compliance for USA",
                "PDF export",
                "DOCX export",
                "Digital e-signatures",
                "Multi-currency support",
                "Worldwide country support",
              ],
              "screenshot": "https://clorefy.com/favicon.png",
              "offers": [
                {
                  "@type": "Offer",
                  "name": "Free Plan",
                  "price": "0",
                  "priceCurrency": "USD",
                  "description": "5 documents per month, all features included",
                },
                {
                  "@type": "Offer",
                  "name": "Starter Plan",
                  "price": "9.99",
                  "priceCurrency": "USD",
                  "description": "50 documents per month",
                },
                {
                  "@type": "Offer",
                  "name": "Pro Plan",
                  "price": "24.99",
                  "priceCurrency": "USD",
                  "description": "150 documents per month",
                },
                {
                  "@type": "Offer",
                  "name": "Agency Plan",
                  "price": "59.99",
                  "priceCurrency": "USD",
                  "description": "Unlimited documents",
                },
              ],
              "creator": {
                "@id": "https://clorefy.com/#organization",
              },
            }),
          }}
        />
        {/* Google Analytics */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-RC703VVHDW"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-RC703VVHDW');
            `,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable} ${inter.variable} ${lora.variable} ${robotoMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <Suspense fallback={null}>
              <GoogleAnalytics />
            </Suspense>
            {children}
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
        {/* Auto-reload on ChunkLoadError (stale deployment cache) */}
        <script dangerouslySetInnerHTML={{ __html: `
          function handleChunkError(msg) {
            var isChunk = msg && (msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1);
            if (isChunk) {
              var key = 'clorefy_chunk_reload';
              var last = sessionStorage.getItem(key);
              var now = Date.now();
              if (!last || now - Number(last) > 30000) {
                sessionStorage.setItem(key, String(now));
                window.location.reload();
              }
            }
          }
          window.addEventListener('error', function(e) {
            var msg = e.message || (e.error && e.error.message) || '';
            handleChunkError(msg);
          });
          window.addEventListener('unhandledrejection', function(e) {
            var msg = (e.reason && (e.reason.message || String(e.reason))) || '';
            handleChunkError(msg);
          });
        ` }} />
      </body>
    </html>
  )
}
