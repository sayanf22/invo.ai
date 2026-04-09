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
    default: "Invo.ai - Intelligent Business Documents",
    template: "%s | Invo.ai",
  },
  description:
    "Create invoices, contracts, quotations, and proposals with AI-powered precision. Compliant across 11 countries.",
  icons: {
    icon: "/fabicon.png",
    apple: "/fabicon.png",
  },
  metadataBase: new URL("https://invoai.proj-invo.workers.dev"),
  openGraph: {
    title: "Invo.ai - Intelligent Business Documents",
    description:
      "AI-powered invoices, contracts, quotations, and proposals. Compliant across 11 countries. Export as PDF, DOCX, or image.",
    url: "https://invoai.proj-invo.workers.dev",
    siteName: "Invo.ai",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Invo.ai - Intelligent Business Documents",
    description:
      "AI-powered invoices, contracts, quotations, and proposals. Compliant across 11 countries.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
