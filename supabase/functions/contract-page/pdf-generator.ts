import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { LOGO_BASE64 } from "./logo.ts";

export interface ContractData {
  title: string;
  customerName: string;
  customerAddress: string;
  startDate: string;
  endDate: string;
  amount: number;
  noticePeriodMonths: number;
  description?: string;
  scopeOfServices?: string;
  specialAgreements?: string;
  isInternal?: boolean;
  signatureName?: string;
  signatureDate?: string;
  signatureLocation?: string;
  signatureIp?: string;
  cancellationDate?: string;
}

function fmtCHF(amount: number): string {
  return amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateString: string): string {
  if (!dateString) return "-";
  if (dateString.includes("-")) {
    const parts = dateString.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateString;
  }
  return dateString;
}

// Colors
const cGold = [212, 164, 50] as [number, number, number]; // #D4A432
const cDarkBg = [26, 26, 46] as [number, number, number]; // #1a1a2e
const cTextDark = [26, 26, 46] as [number, number, number];
const cTextMuted = [100, 116, 139] as [number, number, number];
const cBoxBg = [248, 250, 251] as [number, number, number];
const cBorder = [226, 232, 240] as [number, number, number];
const cGreen = [22, 163, 74] as [number, number, number];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 25;
const FOOTER_H = 25;
const FOOTER_Y = PAGE_HEIGHT - FOOTER_H;
const CONTENT_BOTTOM = FOOTER_Y - 10; // Leave 10mm gap above footer

function drawFooter(doc: any, startDate: string, signatureDate?: string) {
  doc.setFillColor(...cDarkBg);
  doc.rect(0, FOOTER_Y, PAGE_WIDTH, FOOTER_H, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);

  const col1X = MARGIN_X;
  const col2X = MARGIN_X + 55;
  const col3X = MARGIN_X + 110;

  doc.text("VERTRAGSPARTNER", col1X, FOOTER_Y + 8);
  doc.text("KONTAKT", col2X, FOOTER_Y + 8);
  doc.text("ADRESSE", col3X, FOOTER_Y + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);

  doc.text("Stefan Gross", col1X, FOOTER_Y + 13);
  doc.setFont("helvetica", "normal");
  doc.text("Gross ICT", col1X, FOOTER_Y + 18);

  doc.setFont("helvetica", "normal");
  doc.text("info@gross-ict.ch", col2X, FOOTER_Y + 13);
  doc.text("+41 79 414 06 16", col2X, FOOTER_Y + 18);

  doc.setFont("helvetica", "bold");
  doc.text("Neuhushof 3", col3X, FOOTER_Y + 13);
  doc.setFont("helvetica", "normal");
  doc.text("6144 Zell LU, Schweiz", col3X, FOOTER_Y + 18);
}

function drawAccentBar(doc: any) {
  doc.setFillColor(...cGold);
  doc.rect(0, 0, PAGE_WIDTH, 5, "F");
}

/** Check if we need a new page, and if so, draw footer + new page + accent bar */
function checkPageBreak(doc: any, y: number, needed: number, startDate: string, signatureDate?: string): number {
  if (y + needed > CONTENT_BOTTOM) {
    drawFooter(doc, startDate, signatureDate);
    doc.addPage();
    drawAccentBar(doc);
    return 20; // Start Y on new page
  }
  return y;
}

export function generateContractPDF(data: ContractData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const isSigned = !!data.signatureDate;

  let y = 0;

  // 1. Top accent bar
  drawAccentBar(doc);

  y = 25;

  // 2. Logo + Title
  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, "PNG", MARGIN_X, y, 40, 15);
    } catch {
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cDarkBg);
      doc.text("Gross · ICT", MARGIN_X, y + 10);
    }
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cDarkBg);
    doc.text("Gross · ICT", MARGIN_X, y + 10);
  }

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  doc.text("VERTRAG", PAGE_WIDTH - MARGIN_X, y + 12, { align: "right" });

  y += 20;

  // 3. Company info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextMuted);
  doc.text("Gross ICT  ·  Neuhushof 3  ·  6144 Zell LU  ·  Schweiz", PAGE_WIDTH - MARGIN_X, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Stefan Gross  ·  +41 79 414 06 16  ·  info@gross-ict.ch", PAGE_WIDTH - MARGIN_X, y + 5, { align: "right" });

  y += 10;
  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(PAGE_WIDTH - MARGIN_X - 100, y, PAGE_WIDTH - MARGIN_X, y);

  y += 15;

  // 4. Customer address (left) + Meta box (right)
  const metaBoxW = 75;
  const metaBoxX = PAGE_WIDTH - MARGIN_X - metaBoxW;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text("VERTRAGSPARTNER", MARGIN_X, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);

  const addressLines = data.customerAddress.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let addrY = y + 5;
  for (const line of addressLines) {
    doc.text(line, MARGIN_X, addrY);
    addrY += 5;
  }

  // Meta box — height depends on content
  const metaRows: [string, string][] = [["Vertrag:", data.title]];
  if (!data.isInternal) {
    metaRows.push(["Laufzeit:", `${fmtDate(data.startDate)} – ${data.endDate ? fmtDate(data.endDate) : 'Unbefristet'}`]);
    metaRows.push(["Jahresbetrag:", `CHF ${fmtCHF(data.amount || 0)}`]);
    metaRows.push(["Kündigungsfrist:", `${data.noticePeriodMonths || 3} Monate`]);
  } else {
    metaRows.push(["Startdatum:", fmtDate(data.startDate)]);
  }

  const metaBoxH = 8 + metaRows.length * 6 + 4;
  doc.setFillColor(...cBoxBg);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(metaBoxX, y - 4, metaBoxW, metaBoxH, 2, 2, "FD");

  doc.setFontSize(9);
  let metaY = y + 2;
  const mLabelX = metaBoxX + 5;
  const mValueX = metaBoxX + metaBoxW - 5;
  const ls = 6;

  for (const [label, value] of metaRows) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text(label, mLabelX, metaY);
    doc.setFont("helvetica", "bold");
    if (label === "Jahresbetrag:") {
      doc.setTextColor(...cGold);
    } else {
      doc.setTextColor(...cTextDark);
    }
    const valLines = doc.splitTextToSize(value, metaBoxW - 40);
    doc.text(valLines[0] || value, mValueX, metaY, { align: "right" });
    metaY += ls;
  }

  y = Math.max(addrY, y + metaBoxH + 4) + 8;

  // 5. Contract text sections (description, scope, agreements)
  const fields = [
    { title: "VERTRAGSGEGENSTAND", val: data.description },
    { title: "LEISTUNGSUMFANG", val: data.scopeOfServices },
    { title: "ZUSATZVEREINBARUNGEN", val: data.specialAgreements }
  ];

  for (const field of fields) {
    if (field.val) {
      y = checkPageBreak(doc, y, 20, data.startDate, data.signatureDate);

      // Section title with gold underline
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cGold);
      doc.text(field.title, MARGIN_X, y);
      y += 1;
      doc.setDrawColor(...cGold);
      doc.setLineWidth(0.6);
      doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const safeText = field.val.replace(/<[^>]*>?/gm, '\n');
      const lines = doc.splitTextToSize(safeText, PAGE_WIDTH - MARGIN_X * 2);
      for (const line of lines) {
        y = checkPageBreak(doc, y, 5, data.startDate, data.signatureDate);
        doc.text(line, MARGIN_X, y);
        y += 4.5;
      }
      y += 8;
    }
  }

  // 6. Vertragsdetails section
  y = checkPageBreak(doc, y, 40, data.startDate, data.signatureDate);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  doc.text("VERTRAGSDETAILS", MARGIN_X, y);
  y += 1;
  doc.setDrawColor(...cGold);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 6;

  // Details table
  const detailsRows: [string, string, [number, number, number]?][] = [
    ["Vertragsbeginn", fmtDate(data.startDate)],
  ];
  if (!data.isInternal) {
    detailsRows.push(["Vertragsende", fmtDate(data.endDate)]);
    detailsRows.push(["Kündigungsfrist", `${data.noticePeriodMonths || 3} ${(data.noticePeriodMonths || 3) === 1 ? "Monat" : "Monate"}`]);
  }
  if (data.cancellationDate) {
    detailsRows.push(["Gekündigt per", fmtDate(data.cancellationDate), [239, 68, 68]]);
  }

  const tableW = PAGE_WIDTH - MARGIN_X * 2;
  for (let i = 0; i < detailsRows.length; i++) {
    y = checkPageBreak(doc, y, 10, data.startDate, data.signatureDate);
    const [label, value, valueColor] = detailsRows[i];
    if (i % 2 === 0) {
      doc.setFillColor(...cBoxBg);
      doc.rect(MARGIN_X, y - 4, tableW, 10, "F");
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text(label, MARGIN_X + 5, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(valueColor || cTextDark));
    doc.text(value, MARGIN_X + tableW - 5, y, { align: "right" });
    y += 10;
  }

  // 7. Jahresbetrag box (only for non-internal contracts)
  if (!data.isInternal) {
    y += 4;
    y = checkPageBreak(doc, y, 20, data.startDate, data.signatureDate);

    doc.setFillColor(...cGold);
    doc.roundedRect(MARGIN_X, y, tableW, 16, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    doc.text("Jahresbetrag", MARGIN_X + 8, y + 10);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`${fmtCHF(data.amount)} CHF`, MARGIN_X + tableW - 8, y + 10.5, { align: "right" });
    y += 24;
  }

  // 8. Signature section
  y += 4;

  if (isSigned) {
    // Signed: green box
    const sigBoxH = data.signatureIp ? 50 : 44;
    y = checkPageBreak(doc, y, sigBoxH + 15, data.startDate, data.signatureDate);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text("DIGITALE UNTERSCHRIFT", MARGIN_X, y);
    y += 1;
    doc.setDrawColor(...cGold);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
    y += 8;

    doc.setFillColor(240, 253, 244); // #f0fdf4
    doc.setDrawColor(134, 239, 174); // #86efac
    doc.roundedRect(MARGIN_X, y, tableW, sigBoxH, 3, 3, "FD");

    // Green left accent
    doc.setFillColor(...cGreen);
    doc.rect(MARGIN_X, y, 2, sigBoxH, "F");

    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGreen);
    doc.text("✓ Digital unterzeichnet und signiert", MARGIN_X + 8, y);

    y += 10;

    doc.setFontSize(9);
    const sigLabelX = MARGIN_X + 8;
    const sigValueX = MARGIN_X + 55;

    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text("Unterzeichnet von:", sigLabelX, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(data.signatureName || "", sigValueX, y);
    y += 6;

    if (data.signatureLocation) {
      doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
      doc.text("Ort:", sigLabelX, y);
      doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
      doc.text(data.signatureLocation, sigValueX, y);
      y += 6;
    }

    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text("Datum:", sigLabelX, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(fmtDate(data.signatureDate!), sigValueX, y);
    y += 6;

    if (data.signatureIp) {
      doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
      doc.text("IP-Adresse:", sigLabelX, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
      doc.text(data.signatureIp, sigValueX, y);
    }
  } else {
    // Unsigned: placeholder with lines
    const sigBoxH = 45;
    y = checkPageBreak(doc, y, sigBoxH + 15, data.startDate, data.signatureDate);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text("UNTERSCHRIFT", MARGIN_X, y);
    y += 1;
    doc.setDrawColor(...cGold);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
    y += 8;

    doc.setFillColor(...cBoxBg);
    doc.setDrawColor(...cBorder);
    doc.roundedRect(MARGIN_X, y, tableW, sigBoxH, 3, 3, "FD");

    // Left column: Datum, Ort
    const leftX = MARGIN_X + 12;
    const rightX = MARGIN_X + tableW / 2 + 12;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(148, 163, 184);
    doc.text("DATUM, ORT", leftX, y + 10);
    doc.text("UNTERSCHRIFT AUFTRAGGEBER", rightX, y + 10);

    // Signature lines
    doc.setDrawColor(...cTextDark);
    doc.setLineWidth(0.3);
    doc.line(leftX, y + sigBoxH - 10, leftX + 55, y + sigBoxH - 10);
    doc.line(rightX, y + sigBoxH - 10, rightX + 55, y + sigBoxH - 10);
  }

  // 9. Footer on last page
  drawFooter(doc, data.startDate, data.signatureDate);

  // Return as base64
  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}

// ──────────────────────────────────────────────────────────────
// RECHNUNG PDF
// ──────────────────────────────────────────────────────────────

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerAddress: string;
  customerNumber?: string;
  docType: string; // "Rechnung", "1. Mahnung", etc.
  greetingText?: string;
  closingText?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    discountPercentage?: number;
    vatRate: number;
    total: number;
  }>;
  total: number;
  paidAmount?: number;
  notes?: string;
  settings?: {
    accountHolder?: string;
    bankName?: string;
    iban?: string;
    swiftBic?: string;
    accountNumber?: string;
  };
}

function drawInvoiceFooter(doc: any, settings?: InvoiceData["settings"]) {
  doc.setFillColor(...cDarkBg);
  doc.rect(0, FOOTER_Y, PAGE_WIDTH, FOOTER_H, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);

  const col1X = MARGIN_X;
  const col2X = MARGIN_X + 55;
  const col3X = MARGIN_X + 110;

  doc.text("ZAHLUNGSEMPFÄNGER", col1X, FOOTER_Y + 8);
  doc.text("BANKVERBINDUNG", col2X, FOOTER_Y + 8);
  doc.text("IBAN / SWIFT", col3X, FOOTER_Y + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(settings?.accountHolder || "Stefan Gross", col1X, FOOTER_Y + 13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("Gross ICT", col1X, FOOTER_Y + 18);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(settings?.bankName || "Bank Cler AG", col2X, FOOTER_Y + 13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`Konto: ${settings?.accountNumber || "2610.4169.200"}`, col2X, FOOTER_Y + 18);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(settings?.iban || "CH39 0844 0261 0416 9200 1", col3X, FOOTER_Y + 13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(`SWIFT: ${settings?.swiftBic || "BCLRCHBB"}`, col3X, FOOTER_Y + 18);
}

function checkInvoicePageBreak(doc: any, y: number, needed: number, settings?: InvoiceData["settings"]): number {
  if (y + needed > CONTENT_BOTTOM) {
    drawInvoiceFooter(doc, settings);
    doc.addPage();
    drawAccentBar(doc);
    return 20;
  }
  return y;
}

export function generateInvoicePDF(data: InvoiceData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 0;

  drawAccentBar(doc);
  y = 25;

  // Logo
  if (LOGO_BASE64) {
    try { doc.addImage(LOGO_BASE64, "PNG", MARGIN_X, y, 40, 15); } catch { /* fallback */ }
  }

  // Doc type title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  doc.text(data.docType.toUpperCase(), PAGE_WIDTH - MARGIN_X, y + 12, { align: "right" });
  y += 20;

  // Company info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextMuted);
  doc.text("Gross ICT  ·  Neuhushof 3  ·  6144 Zell LU  ·  Schweiz", PAGE_WIDTH - MARGIN_X, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Stefan Gross  ·  +41 79 414 06 16  ·  info@gross-ict.ch", PAGE_WIDTH - MARGIN_X, y + 5, { align: "right" });
  y += 10;
  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 15;

  // Customer address (left) + meta box (right)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text("EMPFÄNGER", MARGIN_X, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);
  const addressLines = data.customerAddress.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let addrY = y + 5;
  for (const line of addressLines) {
    doc.text(line, MARGIN_X, addrY);
    addrY += 5;
  }

  // Meta box
  const metaBoxW = 75;
  const metaBoxX = PAGE_WIDTH - MARGIN_X - metaBoxW;
  const metaRows: [string, string][] = [
    ["Rechnungsnr.", data.invoiceNumber],
  ];
  if (data.customerNumber) metaRows.push(["Kundennr.", data.customerNumber]);
  metaRows.push(["Datum", fmtDate(data.invoiceDate)]);
  metaRows.push(["Zahlungsziel", fmtDate(data.dueDate)]);
  metaRows.push(["Zahlungsform", "Überweisung"]);

  const metaBoxH = 8 + metaRows.length * 6 + 4;
  doc.setFillColor(...cBoxBg);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(metaBoxX, y - 4, metaBoxW, metaBoxH, 2, 2, "FD");

  doc.setFontSize(9);
  let metaY = y + 2;
  for (const [label, value] of metaRows) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text(label, metaBoxX + 5, metaY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(value, metaBoxX + metaBoxW - 5, metaY, { align: "right" });
    metaY += 6;
  }

  y = Math.max(addrY, y + metaBoxH + 4) + 8;

  // Intro
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Guten Tag", MARGIN_X, y);
  y += 8;
  const greeting = data.greetingText || "Wir bedanken uns für Ihren Auftrag und stellen folgende Positionen in Rechnung:";
  const greetLines = doc.splitTextToSize(greeting, PAGE_WIDTH - MARGIN_X * 2);
  for (const line of greetLines) {
    doc.text(line, MARGIN_X, y);
    y += 5;
  }
  y += 5;

  // Items table
  const tableX = MARGIN_X;
  const tableW = PAGE_WIDTH - MARGIN_X * 2;
  const colWidths = [12, tableW - 92, 20, 25, 35]; // Pos, Desc, Qty, Price, Total

  // Table header
  y = checkInvoicePageBreak(doc, y, 12, data.settings);
  doc.setFillColor(...cGold);
  doc.rect(tableX, y - 4, tableW, 10, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  let hx = tableX + 4;
  const headers = ["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Betrag (CHF)"];
  const hAligns = ["left", "left", "right", "right", "right"];
  for (let i = 0; i < headers.length; i++) {
    if (hAligns[i] === "right") {
      doc.text(headers[i], hx + colWidths[i] - 2, y, { align: "right" });
    } else {
      doc.text(headers[i], hx + 2, y);
    }
    hx += colWidths[i];
  }
  y += 9;

  // Table rows
  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    const descLines = doc.splitTextToSize(item.description || "", colWidths[1] - 4);
    const rowH = Math.max(8, descLines.length * 4 + 4);
    y = checkInvoicePageBreak(doc, y, rowH, data.settings);

    if (idx % 2 === 1) {
      doc.setFillColor(...cBoxBg);
      doc.rect(tableX, y - 4, tableW, rowH, "F");
    }

    doc.setFontSize(9);
    let rx = tableX + 4;

    // Pos
    doc.setFont("helvetica", "bold"); doc.setTextColor(148, 163, 184);
    doc.text(`${idx + 1}`, rx + colWidths[0] / 2, y, { align: "center" });
    rx += colWidths[0];

    // Description
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextDark);
    let descY = y;
    for (const line of descLines) {
      doc.text(line, rx + 2, descY);
      descY += 4;
    }
    rx += colWidths[1];

    // Quantity
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextDark);
    doc.text(`${item.quantity} ${item.unit || "Stk."}`, rx + colWidths[2] - 2, y, { align: "right" });
    rx += colWidths[2];

    // Unit price
    doc.text(fmtCHF(item.unitPrice), rx + colWidths[3] - 2, y, { align: "right" });
    rx += colWidths[3];

    // Total
    doc.setFont("helvetica", "bold");
    doc.text(fmtCHF(item.total), rx + colWidths[4] - 2, y, { align: "right" });

    // Border bottom
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(tableX, y + rowH - 4, tableX + tableW, y + rowH - 4);
    y += rowH;
  }

  y += 6;

  // Totals
  y = checkInvoicePageBreak(doc, y, 30, data.settings);
  const totalsX = PAGE_WIDTH - MARGIN_X - 100;

  if (data.paidAmount && data.paidAmount > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal"); doc.setTextColor(55, 65, 81);
    doc.text("Totalbetrag", totalsX, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(`${fmtCHF(data.total)} CHF`, PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal"); doc.setTextColor(16, 185, 129); // green
    doc.text("Bereits bezahlt", totalsX, y);
    doc.setFont("helvetica", "bold");
    doc.text(`-${fmtCHF(data.paidAmount)} CHF`, PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 10;
  }

  // Total box
  const remaining = data.total - (data.paidAmount || 0);
  doc.setFillColor(...cGold);
  doc.roundedRect(totalsX - 5, y - 5, PAGE_WIDTH - MARGIN_X - totalsX + 5, 16, 2, 2, "F");
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Zu bezahlen", totalsX, y + 5);
  doc.text(`${fmtCHF(remaining > 0 ? remaining : 0)} CHF`, PAGE_WIDTH - MARGIN_X, y + 5, { align: "right" });
  y += 24;

  // Notes
  if (data.notes) {
    y = checkInvoicePageBreak(doc, y, 20, data.settings);
    doc.setFillColor(...cBoxBg);
    doc.rect(MARGIN_X, y - 2, tableW, 3, "F"); // Left border accent
    doc.setFillColor(...cGold);
    doc.rect(MARGIN_X, y - 2, 1.5, 20, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text("ANMERKUNGEN", MARGIN_X + 6, y + 4);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(data.notes, tableW - 12);
    let noteY = y + 10;
    for (const line of noteLines) {
      doc.text(line, MARGIN_X + 6, noteY);
      noteY += 4;
    }
  }

  drawInvoiceFooter(doc, data.settings);

  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}

// ──────────────────────────────────────────────────────────────
// ANGEBOT PDF
// ──────────────────────────────────────────────────────────────

export interface QuoteData {
  quoteNumber: string;
  quoteDate: string;
  validUntil?: string;
  customerName: string;
  customerAddress: string;
  customerNumber?: string;
  creatorName?: string;
  items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    vatRate: number;
    total: number;
    optional?: boolean;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
}

function drawQuoteFooter(doc: any) {
  doc.setFillColor(...cDarkBg);
  doc.rect(0, FOOTER_Y, PAGE_WIDTH, FOOTER_H, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);

  const col1X = MARGIN_X;
  const col2X = MARGIN_X + 55;
  const col3X = MARGIN_X + 110;

  doc.text("ZAHLUNGSEMPFÄNGER", col1X, FOOTER_Y + 8);
  doc.text("BANKVERBINDUNG", col2X, FOOTER_Y + 8);
  doc.text("IBAN / SWIFT", col3X, FOOTER_Y + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Stefan Gross", col1X, FOOTER_Y + 13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("Gross ICT", col1X, FOOTER_Y + 18);

  doc.text("Bank Cler AG", col2X, FOOTER_Y + 13);
  doc.text("Konto: 2610.4169.200", col2X, FOOTER_Y + 18);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CH39 0844 0261 0416 9200 1", col3X, FOOTER_Y + 13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("SWIFT: BCLRCHBB", col3X, FOOTER_Y + 18);
}

function checkQuotePageBreak(doc: any, y: number, needed: number): number {
  if (y + needed > CONTENT_BOTTOM) {
    drawQuoteFooter(doc);
    doc.addPage();
    drawAccentBar(doc);
    return 20;
  }
  return y;
}

export function generateQuotePDF(data: QuoteData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 0;

  drawAccentBar(doc);
  y = 25;

  // Logo
  if (LOGO_BASE64) {
    try { doc.addImage(LOGO_BASE64, "PNG", MARGIN_X, y, 40, 15); } catch { /* fallback */ }
  }

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGold);
  doc.text("ANGEBOT", PAGE_WIDTH - MARGIN_X, y + 12, { align: "right" });
  y += 20;

  // Company info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextMuted);
  doc.text("Gross ICT  ·  Neuhushof 3  ·  6144 Zell LU  ·  Schweiz", PAGE_WIDTH - MARGIN_X, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`${data.creatorName || "Stefan Gross"}  ·  +41 79 414 06 16  ·  info@gross-ict.ch`, PAGE_WIDTH - MARGIN_X, y + 5, { align: "right" });
  y += 10;
  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y += 15;

  // Customer address (left) + meta box (right)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text("EMPFÄNGER", MARGIN_X, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);
  const addressLines = data.customerAddress.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let addrY = y + 5;
  for (const line of addressLines) {
    doc.text(line, MARGIN_X, addrY);
    addrY += 5;
  }

  // Meta box
  const metaBoxW = 75;
  const metaBoxX = PAGE_WIDTH - MARGIN_X - metaBoxW;
  const metaRows: [string, string][] = [
    ["Angebotsnr.", data.quoteNumber],
  ];
  if (data.customerNumber) metaRows.push(["Kundennr.", data.customerNumber]);
  metaRows.push(["Datum", fmtDate(data.quoteDate)]);
  if (data.validUntil) metaRows.push(["Gültig bis", fmtDate(data.validUntil)]);

  const metaBoxH = 8 + metaRows.length * 6 + 4;
  doc.setFillColor(...cBoxBg);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(metaBoxX, y - 4, metaBoxW, metaBoxH, 2, 2, "FD");

  doc.setFontSize(9);
  let metaY = y + 2;
  for (const [label, value] of metaRows) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text(label, metaBoxX + 5, metaY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(value, metaBoxX + metaBoxW - 5, metaY, { align: "right" });
    metaY += 6;
  }

  y = Math.max(addrY, y + metaBoxH + 4) + 8;

  // Intro
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Guten Tag", MARGIN_X, y);
  y += 8;
  doc.text("Gerne unterbreiten wir Ihnen folgendes Angebot:", MARGIN_X, y);
  y += 10;

  // Items table
  const tableX = MARGIN_X;
  const tableW = PAGE_WIDTH - MARGIN_X * 2;
  const colWidths = [12, tableW - 92, 20, 25, 35];

  // Table header
  y = checkQuotePageBreak(doc, y, 12);
  doc.setFillColor(...cGold);
  doc.rect(tableX, y - 4, tableW, 10, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  let hx = tableX + 4;
  const headers = ["Pos.", "Beschreibung", "Menge", "Einzelpreis", "Betrag (CHF)"];
  const hAligns = ["left", "left", "right", "right", "right"];
  for (let i = 0; i < headers.length; i++) {
    if (hAligns[i] === "right") {
      doc.text(headers[i], hx + colWidths[i] - 2, y, { align: "right" });
    } else {
      doc.text(headers[i], hx + 2, y);
    }
    hx += colWidths[i];
  }
  y += 9;

  // Separate optional vs non-optional
  const optionalItems = data.items.filter(i => !!i.optional);
  const nonOptionalSubtotal = data.items.filter(i => !i.optional).reduce((s, i) => s + i.total, 0);
  const optionalSubtotal = optionalItems.reduce((s, i) => s + i.total, 0);

  // Table rows
  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx];
    const prefix = item.optional ? "OPTIONAL – " : "";
    const fullDesc = prefix + (item.description || "");
    const descLines = doc.splitTextToSize(fullDesc, colWidths[1] - 4);
    const rowH = Math.max(8, descLines.length * 4 + 4);
    y = checkQuotePageBreak(doc, y, rowH);

    if (idx % 2 === 1) {
      doc.setFillColor(...cBoxBg);
      doc.rect(tableX, y - 4, tableW, rowH, "F");
    }

    doc.setFontSize(9);
    let rx = tableX + 4;

    // Pos
    doc.setFont("helvetica", "bold"); doc.setTextColor(148, 163, 184);
    doc.text(`${idx + 1}`, rx + colWidths[0] / 2, y, { align: "center" });
    rx += colWidths[0];

    // Description
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextDark);
    let descY = y;
    for (let li = 0; li < descLines.length; li++) {
      if (li === 0 && item.optional) {
        // Highlight OPTIONAL prefix in gold
        doc.setTextColor(...cGold);
        doc.setFont("helvetica", "bold");
        doc.text("OPTIONAL", rx + 2, descY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...cTextDark);
        doc.text(descLines[li].replace(/^OPTIONAL\s*–\s*/, " – "), rx + 2 + doc.getTextWidth("OPTIONAL"), descY);
      } else {
        doc.text(descLines[li], rx + 2, descY);
      }
      descY += 4;
    }
    rx += colWidths[1];

    // Quantity
    doc.text(`${item.quantity} ${item.unit || "Stk."}`, rx + colWidths[2] - 2, y, { align: "right" });
    rx += colWidths[2];

    // Unit price
    doc.text(fmtCHF(item.unitPrice), rx + colWidths[3] - 2, y, { align: "right" });
    rx += colWidths[3];

    // Total
    doc.setFont("helvetica", "bold");
    doc.text(fmtCHF(item.total), rx + colWidths[4] - 2, y, { align: "right" });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(tableX, y + rowH - 4, tableX + tableW, y + rowH - 4);
    y += rowH;
  }

  y += 6;

  // Totals
  y = checkQuotePageBreak(doc, y, 30);
  const totalsX = PAGE_WIDTH - MARGIN_X - 100;

  // Total box
  doc.setFillColor(...cGold);
  doc.roundedRect(totalsX - 5, y - 5, PAGE_WIDTH - MARGIN_X - totalsX + 5, 16, 2, 2, "F");
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Total", totalsX, y + 5);
  doc.text(`${fmtCHF(nonOptionalSubtotal)} CHF`, PAGE_WIDTH - MARGIN_X, y + 5, { align: "right" });
  y += 24;

  // Optional totals
  if (optionalSubtotal > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal"); doc.setTextColor(55, 65, 81);
    doc.text("Zwischensumme OPTIONAL", totalsX, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(fmtCHF(optionalSubtotal), PAGE_WIDTH - MARGIN_X, y, { align: "right" });
    y += 7;

    doc.setDrawColor(...cBorder);
    doc.line(totalsX, y, PAGE_WIDTH - MARGIN_X, y);
    y += 5;

    doc.setFillColor(...cGold);
    doc.roundedRect(totalsX - 5, y - 5, PAGE_WIDTH - MARGIN_X - totalsX + 5, 16, 2, 2, "F");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Total inkl. OPTIONAL", totalsX, y + 5);
    doc.text(`${fmtCHF(nonOptionalSubtotal + optionalSubtotal)} CHF`, PAGE_WIDTH - MARGIN_X, y + 5, { align: "right" });
    y += 24;
  }

  // Notes
  if (data.notes) {
    y = checkQuotePageBreak(doc, y, 20);
    doc.setFillColor(...cBoxBg);
    const noteLines = doc.splitTextToSize(data.notes, tableW - 12);
    const noteBoxH = 12 + noteLines.length * 4;
    doc.rect(MARGIN_X, y - 2, tableW, noteBoxH, "F");
    doc.setFillColor(...cGold);
    doc.rect(MARGIN_X, y - 2, 1.5, noteBoxH, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cGold);
    doc.text("ANMERKUNGEN", MARGIN_X + 6, y + 4);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    let noteY = y + 10;
    for (const line of noteLines) {
      doc.text(line, MARGIN_X + 6, noteY);
      noteY += 4;
    }
  }

  drawQuoteFooter(doc);

  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}
