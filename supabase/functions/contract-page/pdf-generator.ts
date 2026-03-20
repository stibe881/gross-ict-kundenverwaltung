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
