/**
 * Certificate Page — react-pdf component
 *
 * Generates a PDF certificate page for completed signing sessions.
 * Used by lib/certificate-generator.ts to produce the certificate PDF
 * stored in R2 at certificates/[documentId]_certificate.pdf.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  Link,
} from "@react-pdf/renderer"

// ── Font Registration ─────────────────────────────────────────────────────────
// Register Inter separately here since this file is used standalone
// (certificate-generator.ts imports it directly, not via pdf-templates.tsx).

Font.registerHyphenationCallback((word) => [word])

Font.register({
  family: "Inter",
  fonts: [
    { src: "/fonts/inter-400.woff", fontWeight: 400 },
    { src: "/fonts/inter-700.woff", fontWeight: 700 },
  ],
})

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Mask the last octet of an IPv4 address.
 * e.g. "192.168.1.42" → "192.168.1.xxx"
 * For IPv6 or unexpected formats, replaces the last segment after the last colon/dot.
 */
export function maskIp(ip: string): string {
  if (!ip) return "xxx.xxx.xxx.xxx"
  // IPv4: replace last octet
  const ipv4Match = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}$/)
  if (ipv4Match) {
    return `${ipv4Match[1]}xxx`
  }
  // IPv6 or other: replace last segment after last colon
  const lastColon = ip.lastIndexOf(":")
  if (lastColon !== -1) {
    return `${ip.slice(0, lastColon + 1)}xxx`
  }
  // Fallback: replace last dot-segment
  const lastDot = ip.lastIndexOf(".")
  if (lastDot !== -1) {
    return `${ip.slice(0, lastDot + 1)}xxx`
  }
  return "xxx"
}

/**
 * Format an ISO 8601 timestamp as "DD MMM YYYY HH:mm UTC".
 * e.g. "2024-03-15T14:30:00Z" → "15 Mar 2024 14:30 UTC"
 */
export function formatSignedAt(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return iso
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const dd = String(date.getUTCDate()).padStart(2, "0")
  const mmm = months[date.getUTCMonth()]
  const yyyy = date.getUTCFullYear()
  const hh = String(date.getUTCHours()).padStart(2, "0")
  const mm = String(date.getUTCMinutes()).padStart(2, "0")
  return `${dd} ${mmm} ${yyyy} ${hh}:${mm} UTC`
}

/**
 * Format an ISO 8601 timestamp as "DD MMM YYYY".
 * e.g. "2024-03-15T14:30:00Z" → "15 Mar 2024"
 */
export function formatRequestedAt(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return iso
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const dd = String(date.getUTCDate()).padStart(2, "0")
  const mmm = months[date.getUTCMonth()]
  const yyyy = date.getUTCFullYear()
  return `${dd} ${mmm} ${yyyy}`
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignerInfo {
  name: string
  email: string
  party: string
  signedAt: string       // ISO 8601 timestamp
  ipAddress: string      // will be masked: last octet replaced with "xxx"
  signatureImageUrl?: string  // R2 key or data URL
}

export interface CertificatePDFProps {
  signers: SignerInfo[]
  documentTitle: string
  documentType: string
  referenceNumber: string
  requestedAt: string    // ISO 8601 timestamp
  documentHash: string   // 64-char SHA-256 hex
  verificationUrl: string
}

// ── Legal Statement ───────────────────────────────────────────────────────────

export const LEGAL_STATEMENT =
  "This document was electronically signed via Invo.ai. The signatures and audit trail are legally binding under applicable electronic signature laws."

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    color: "#1a1a1a",
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    backgroundColor: "#ffffff",
  },
  // Header
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1e3a8a",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 9,
    color: "#6b7280",
  },
  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#374151",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Document info
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  infoLabel: {
    width: 120,
    color: "#6b7280",
    fontWeight: 400,
  },
  infoValue: {
    flex: 1,
    color: "#111827",
    fontWeight: 400,
  },
  // Table
  table: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontWeight: 700,
    color: "#374151",
    fontSize: 8,
  },
  tableCell: {
    color: "#111827",
    fontSize: 8,
  },
  colName: { width: "22%" },
  colEmail: { width: "25%" },
  colParty: { width: "13%" },
  colSignedAt: { width: "25%" },
  colIp: { width: "15%" },
  // Signature images
  signaturesSection: {
    marginBottom: 16,
  },
  signatureItem: {
    marginBottom: 10,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 3,
  },
  signatureImage: {
    width: 160,
    height: 60,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 2,
    backgroundColor: "#fafafa",
  },
  // Fingerprint
  fingerprintBlock: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 2,
    padding: 8,
    marginBottom: 16,
  },
  fingerprintLine: {
    fontFamily: "Inter",
    fontSize: 8,
    color: "#374151",
    letterSpacing: 0.3,
  },
  // Verification URL
  verificationBlock: {
    marginBottom: 16,
  },
  verificationLink: {
    fontSize: 9,
    color: "#2563eb",
    textDecoration: "underline",
  },
  // Legal statement
  legalBlock: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 2,
    padding: 8,
    marginBottom: 16,
  },
  legalText: {
    fontSize: 8,
    color: "#1e40af",
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    marginTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
})

// ── Component ─────────────────────────────────────────────────────────────────

export function CertificatePDF({
  signers,
  documentTitle,
  documentType,
  referenceNumber,
  requestedAt,
  documentHash,
  verificationUrl,
}: CertificatePDFProps) {
  // Split 64-char hash into two lines of 32 chars each for readability
  const hashLine1 = documentHash.slice(0, 32)
  const hashLine2 = documentHash.slice(32, 64)

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* 1. Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Signature Certificate</Text>
          <Text style={styles.headerSubtitle}>Generated by Clorefy</Text>
        </View>

        {/* 2. Document Info Block */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Title / Reference</Text>
            <Text style={styles.infoValue}>{documentTitle || referenceNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reference Number</Text>
            <Text style={styles.infoValue}>{referenceNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Document Type</Text>
            <Text style={styles.infoValue}>{documentType}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Signing Requested</Text>
            <Text style={styles.infoValue}>{formatRequestedAt(requestedAt)}</Text>
          </View>
        </View>

        {/* 3. Signer Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signers</Text>
          <View style={styles.table}>
            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colName]}>Name</Text>
              <Text style={[styles.tableHeaderCell, styles.colEmail]}>Email</Text>
              <Text style={[styles.tableHeaderCell, styles.colParty]}>Party / Role</Text>
              <Text style={[styles.tableHeaderCell, styles.colSignedAt]}>Signed At</Text>
              <Text style={[styles.tableHeaderCell, styles.colIp]}>IP Address</Text>
            </View>
            {/* Table rows */}
            {signers.map((signer, index) => {
              const isLast = index === signers.length - 1
              return (
                <View key={index} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colName]}>{signer.name}</Text>
                  <Text style={[styles.tableCell, styles.colEmail]}>{signer.email}</Text>
                  <Text style={[styles.tableCell, styles.colParty]}>{signer.party}</Text>
                  <Text style={[styles.tableCell, styles.colSignedAt]}>{formatSignedAt(signer.signedAt)}</Text>
                  <Text style={[styles.tableCell, styles.colIp]}>{maskIp(signer.ipAddress)}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 4. Signature Images */}
        {signers.some((s) => s.signatureImageUrl) && (
          <View style={styles.signaturesSection}>
            <Text style={styles.sectionTitle}>Signature Images</Text>
            {signers
              .filter((s) => s.signatureImageUrl)
              .map((signer, index) => (
                <View key={index} style={styles.signatureItem}>
                  <Text style={styles.signatureLabel}>{signer.name} ({signer.party})</Text>
                  <Image src={signer.signatureImageUrl!} style={styles.signatureImage} />
                </View>
              ))}
          </View>
        )}

        {/* 5. Fingerprint Block */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Fingerprint (SHA-256)</Text>
          <View style={styles.fingerprintBlock}>
            <Text style={styles.fingerprintLine}>{hashLine1}</Text>
            <Text style={styles.fingerprintLine}>{hashLine2}</Text>
          </View>
        </View>

        {/* 6. Verification URL */}
        <View style={styles.verificationBlock}>
          <Text style={styles.sectionTitle}>Verification URL</Text>
          <Link src={verificationUrl} style={styles.verificationLink}>
            {verificationUrl}
          </Link>
        </View>

        {/* 7. Legal Statement */}
        <View style={styles.legalBlock}>
          <Text style={styles.legalText}>{LEGAL_STATEMENT}</Text>
        </View>

        {/* 8. Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by Clorefy</Text>
        </View>

      </Page>
    </Document>
  )
}

export default CertificatePDF
