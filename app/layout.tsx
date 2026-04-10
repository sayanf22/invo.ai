import React from "react"
import type { Metadata } from "next"
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

export const metadata: Metadata = {
  title: {
    default: "Clorefy — AI Document Generator | Invoices, Contracts, Proposals",
    template: "%s | Clorefy",
  },
  description:
    "Generate professional invoices, contracts, quotations, and proposals with AI in seconds. Compliant across 11 countries including India, USA, UK, Germany. Export as PDF, DOCX, or image. Free to start.",
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
  // verification: {
  //   google: "YOUR_GOOGLE_VERIFICATION_CODE",
  // },
  manifest: "/manifest.json",
  openGraph: {
    title: "Clorefy — AI-Powered Document Generation",
    description:
      "Create invoices, contracts, quotations, and proposals with AI. Compliant across 11 countries. Export as PDF, DOCX, or image. Start free.",
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
    title: "Clorefy — AI Document Generator",
    description:
      "Generate professional invoices, contracts, quotations, and proposals with AI. Compliant across 11 countries. Free to start.",
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
        {/* JSON-LD Structured Data — Organization */}
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
              "description": "AI-powered document generation platform for invoices, contracts, quotations, and proposals. Compliant across 11 countries.",
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
                "sameAs": [],
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
                    "text": "Yes, Clorefy offers a free plan with 3 documents per month. Paid plans start at $9.99/month for 50 documents with all features.",
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
