/**
 * DOCX Export Utility
 * Generates a Word document from InvoiceData using the `docx` package.
 * Works client-side — no server required.
 */

import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, convertInchesToTwip, Header, Footer,
  PageNumber, NumberFormat,
} from "docx"
import type { InvoiceData } from "@/lib/invoice-types"

function fmt(n: number, currency = "₹"): string {
  return `${currency}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function calcTotals(data: InvoiceData) {
  const items = data.items || []
  const subtotal = items.reduce((s, item) => {
    const base = (Number(item.quantity) || 0) * (Number(item.rate) || 0)
    const disc = item.discount ? base * (Number(item.discount) / 100) : 0
    return s + base - disc
  }, 0)

  const discountValue = Number(data.discountValue) || 0
  const discountAmount = data.discountType === "flat"
    ? discountValue
    : subtotal * (discountValue / 100)

  const afterDiscount = subtotal - discountAmount
  const taxRate = Number(data.taxRate) || 0
  const taxAmount = afterDiscount * (taxRate / 100)
  const shipping = Number(data.shippingFee) || 0
  const total = afterDiscount + taxAmount + shipping

  return { subtotal, discountAmount, taxAmount, shipping, total }
}

function cell(text: string, opts: {
  bold?: boolean
  shade?: boolean
  align?: (typeof AlignmentType)[keyof typeof AlignmentType]
  width?: number
} = {}): TableCell {
  return new TableCell({
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold, size: 20, font: "Calibri" })],
    })],
    shading: opts.shade ? { type: ShadingType.SOLID, color: "F5F5F5" } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E5E5E5" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E5E5" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
  })
}

function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20, font: "Calibri", color: "555555" }),
      new TextRun({ text: value, size: 20, font: "Calibri" }),
    ],
  })
}

export async function generateDocx(data: InvoiceData): Promise<Blob> {
  const docType = (data.documentType || "Invoice")
  const currency = data.currency || "₹"
  const { subtotal, discountAmount, taxAmount, shipping, total } = calcTotals(data)

  const refNumber = data.invoiceNumber || data.referenceNumber || ""
  const title = `${docType}${refNumber ? ` — ${refNumber}` : ""}`

  // ── Header section ──────────────────────────────────────────────────────────
  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: title, bold: true, size: 36, font: "Calibri", color: "1A1A1A" })],
    }),
  ]

  // From / To info table
  const fromLines = [
    data.fromName, data.fromEmail, data.fromPhone, data.fromAddress,
  ].filter(Boolean)

  const toLines = [
    data.toName, data.toEmail, data.toPhone, data.toAddress,
  ].filter(Boolean)

  const makePartyCell = (heading: string, lines: string[]) => new TableCell({
    children: [
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: heading, bold: true, size: 22, font: "Calibri", color: "555555", allCaps: true })],
      }),
      ...lines.map(l => new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: l, size: 20, font: "Calibri" })],
      })),
    ],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })

  const partyTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [makePartyCell("From", fromLines), makePartyCell("To", toLines)] })],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
  })

  // Dates row
  const dateParagraphs: Paragraph[] = []
  if (data.issueDate) dateParagraphs.push(labelValue("Issue Date", data.issueDate))
  if (data.dueDate) dateParagraphs.push(labelValue("Due Date", data.dueDate))
  if (data.paymentTerms) dateParagraphs.push(labelValue("Payment Terms", data.paymentTerms))

  // ── Items table ─────────────────────────────────────────────────────────────
  const hasItems = Array.isArray(data.items) && data.items.length > 0

  const itemsTable = hasItems ? new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          cell("Description", { bold: true, shade: true, width: 50 }),
          cell("Qty", { bold: true, shade: true, align: AlignmentType.CENTER, width: 10 }),
          cell("Rate", { bold: true, shade: true, align: AlignmentType.RIGHT, width: 20 }),
          cell("Amount", { bold: true, shade: true, align: AlignmentType.RIGHT, width: 20 }),
        ],
      }),
      // Data rows
      ...(data.items || []).map(item => {
        const qty = Number(item.quantity) || 0
        const rate = Number(item.rate) || 0
        const disc = item.discount ? rate * qty * (Number(item.discount) / 100) : 0
        const amount = qty * rate - disc
        return new TableRow({
          children: [
            cell(item.description || "", { width: 50 }),
            cell(String(qty), { align: AlignmentType.CENTER, width: 10 }),
            cell(fmt(rate, currency), { align: AlignmentType.RIGHT, width: 20 }),
            cell(fmt(amount, currency), { align: AlignmentType.RIGHT, width: 20 }),
          ],
        })
      }),
    ],
  }) : null

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalRows: Paragraph[] = []
  const addTotal = (label: string, value: string, bold = false) =>
    totalRows.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${label}: `, bold, size: 20, font: "Calibri", color: bold ? "1A1A1A" : "555555" }),
        new TextRun({ text: value, bold, size: bold ? 24 : 20, font: "Calibri" }),
      ],
    }))

  if (hasItems) {
    addTotal("Subtotal", fmt(subtotal, currency))
    if (discountAmount > 0) addTotal("Discount", `-${fmt(discountAmount, currency)}`)
    if (taxAmount > 0) addTotal(`Tax (${data.taxRate}%)`, fmt(taxAmount, currency))
    if (shipping > 0) addTotal("Shipping", fmt(shipping, currency))
    addTotal("Total", fmt(total, currency), true)
  }

  // ── Notes / Terms ────────────────────────────────────────────────────────────
  const noteParagraphs: Paragraph[] = []
  if (data.notes) {
    noteParagraphs.push(
      new Paragraph({ spacing: { before: 240, after: 80 }, children: [new TextRun({ text: "Notes", bold: true, size: 22, font: "Calibri" })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: data.notes, size: 20, font: "Calibri", color: "555555" })] }),
    )
  }
  if (data.terms) {
    noteParagraphs.push(
      new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: "Terms & Conditions", bold: true, size: 22, font: "Calibri" })] }),
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: data.terms, size: 20, font: "Calibri", color: "555555" })] }),
    )
  }

  // ── Assemble document ────────────────────────────────────────────────────────
  const children: (Paragraph | Table)[] = [
    ...headerParagraphs,
    partyTable,
    new Paragraph({ spacing: { after: 160 } }),
    ...dateParagraphs,
    new Paragraph({ spacing: { after: 200 } }),
    ...(itemsTable ? [itemsTable, new Paragraph({ spacing: { after: 120 } })] : []),
    ...totalRows,
    ...noteParagraphs,
    new Paragraph({ spacing: { after: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Generated by Clorefy · clorefy.com", size: 16, font: "Calibri", color: "AAAAAA" })],
    }),
  ]

  const doc = new Document({
    creator: "Clorefy",
    title,
    description: `${docType} generated by Clorefy`,
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
        },
      },
      children,
    }],
  })

  const buffer = await Packer.toBlob(doc)
  return buffer
}
