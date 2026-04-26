import React from "react"
import type { Metadata, Viewport } from "next"
import { DM_Sans, DM_Mono, Playfair_Display, Inter, Lora, Roboto_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"

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
    default: "Clorefy — Free AI Invoice Generator | Create Invoices, Contracts & Proposals in Seconds",
    template: "%s | Clorefy",
  },
  description:
    "Create professional invoices, contracts, quotations, and proposals in under 60 seconds with AI. Auto GST, VAT & sales tax for India, USA, UK + 8 more countries. Export PDF, DOCX. Free plan available — no credit card needed.",
  keywords: [
    "AI document generator", "AI invoice generator", "AI contract generator",
    "invoice maker", "contract maker", "quotation generator", "proposal generator",
    "AI invoicing", "automated invoicing", "business document automation",
    "GST invoice generator", "VAT invoice generator", "tax compliant invoices",
    "freelancer invoice tool", "small business invoicing", "professional proposals",
    "document generation AI", "AI business documents", "create invoice online",
    "free invoice generator", "invoice generator India", "invoice generator USA",
    "contract template AI", "quotation maker online", "proposal writer AI",
    "PDF invoice generator", "DOCX export", "e-signature documents",
    "multi-country invoicing", "Clorefy", "clorefy.com",
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
  // Add your Google Search Console verification code here after setup
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  manifest: "/manifest.json",
  openGraph: {
    title: "Clorefy — Free AI Invoice & Contract Generator",
    description:
      "Create invoices, contracts, quotations, and proposals with AI in under 60 seconds. GST, VAT & sales tax compliant for 11 countries. Export PDF, DOCX. Free to start.",
    url: "https://clorefy.com",
    siteName: "Clorefy",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Clorefy — AI Document Generator for Invoices, Contracts, and Proposals",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clorefy — Free AI Invoice & Contract Generator",
    description:
      "Create invoices, contracts & proposals with AI in 60 seconds. GST, VAT compliant for 11 countries. Free plan available.",
    images: ["/og-image.png"],
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
          @media (min-width: 768px) {
            html { background-color: #e8ddd0 !important; }
            body { background-color: #e8ddd0 !important; }
          }
        ` }} />
        {/* JSON-LD — WebSite schema (enables sitelinks search box in Google) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Clorefy",
              "url": "https://clorefy.com",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://clorefy.com/blog?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        {/* JSON-LD — Organization schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Clorefy",
              "url": "https://clorefy.com",
              "logo": "https://clorefy.com/favicon.png",
              "description": "AI-powered document generation platform that creates professional invoices, contracts, quotations, and proposals using artificial intelligence. Compliant across 11 countries.",
              "foundingDate": "2025",
              "sameAs": [
                "https://twitter.com/clorefy",
                "https://linkedin.com/company/clorefy",
                "https://github.com/clorefy",
              ],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer support",
                "url": "https://clorefy.com/contact",
              },
            }),
          }}
        />
        {/* JSON-LD — SoftwareApplication schema (for rich results) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Clorefy",
              "url": "https://clorefy.com",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "AI-powered document generation platform that creates professional invoices, contracts, quotations, and proposals using artificial intelligence. Compliant across 11 countries.",
              "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "0",
                "highPrice": "59.99",
                "priceCurrency": "USD",
                "offerCount": "4",
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "150",
                "bestRating": "5",
              },
              "creator": {
                "@type": "Organization",
                "name": "Clorefy",
                "url": "https://clorefy.com",
                "logo": "https://clorefy.com/favicon.png",
                "sameAs": [
                  "https://twitter.com/clorefy",
                  "https://linkedin.com/company/clorefy",
                  "https://github.com/clorefy",
                ],
              },
            }),
          }}
        />
        {/* JSON-LD — FAQ for rich snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": [
                {
                  "@type": "Question",
                  "name": "What is Clorefy?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy is an AI-powered document generation platform that creates professional invoices, contracts, quotations, and proposals from natural language descriptions. It supports 11 countries with automatic tax compliance.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "How does AI document generation work?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Simply describe what you need in plain language. Clorefy's AI generates a complete, professionally formatted document with correct tax calculations, legal terms, and your business branding in seconds.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Which countries does Clorefy support?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy supports India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, and Netherlands with country-specific tax compliance (GST, VAT, sales tax).",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Is Clorefy free to use?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, Clorefy offers a free plan with 5 documents per month. Paid plans start at $9.99/month for 50 documents with all features.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "What document types can Clorefy generate?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy generates invoices, contracts, quotations, and proposals. Each document type supports country-specific compliance, custom branding, and export to PDF, DOCX, or image formats.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Does Clorefy support GST invoices for India?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, Clorefy automatically generates GST-compliant invoices with CGST, SGST, or IGST calculations based on the place of supply. It includes GSTIN, HSN/SAC codes, and all mandatory fields required under Indian GST law.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "Can I export documents as PDF?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Yes, all documents can be exported as PDF, DOCX, PNG, or JPG. PDFs are professionally formatted with your business branding, logo, and correct tax calculations.",
                  },
                },
                {
                  "@type": "Question",
                  "name": "How is Clorefy different from FreshBooks or QuickBooks?",
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Clorefy uses AI to generate documents from natural language descriptions — you describe what you need and get a complete document in seconds. Traditional tools like FreshBooks and QuickBooks require manual form filling. Clorefy is faster for document creation but focused on generation, not full accounting.",
                  },
                },
              ],
            }),
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
            {children}
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
