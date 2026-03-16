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
  signatureName: string;
  signatureDate: string;
  signatureLocation?: string;
  signatureIp?: string;
}

function fmtCHF(amount: number): string {
  return amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateString: string): string {
  if (!dateString) return "-";
  // Handle both ISO (YYYY-MM-DD) and Swiss (DD.MM.YYYY) formats
  if (dateString.includes("-")) {
    const parts = dateString.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : dateString;
  }
  return dateString;
}

export function generateContractPDF(data: ContractData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Colors
  const cGreen = [202, 255, 90] as [number, number, number]; // #CAFF5A
  const cDarkGreen = [22, 163, 74] as [number, number, number]; // #16a34a
  const cDarkBg = [26, 26, 46] as [number, number, number]; // #1a1a2e
  const cTextDark = [26, 26, 46] as [number, number, number];
  const cTextMuted = [100, 116, 139] as [number, number, number];
  const cBoxBg = [248, 250, 251] as [number, number, number];
  const cBorder = [226, 232, 240] as [number, number, number];

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 25;
  let y = 0;

  // 1. Top accent bar
  doc.setFillColor(...cGreen);
  doc.rect(0, 0, pageWidth, 5, "F");

  y = 25;

  // 2. Logo + Title
  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, "PNG", marginX, y, 40, 15);
    } catch {
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...cDarkBg);
      doc.text("Gross · ICT", marginX, y + 10);
    }
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cDarkBg);
    doc.text("Gross · ICT", marginX, y + 10);
  }

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cDarkGreen);
  doc.text("VERTRAG", pageWidth - marginX, y + 12, { align: "right" });

  y += 20;

  // 3. Company info
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cTextMuted);
  doc.text("Gross ICT  ·  Neuhushof 3  ·  6144 Zell LU  ·  Schweiz", pageWidth - marginX, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Stefan Gross  ·  +41 79 414 06 16  ·  info@gross-ict.ch", pageWidth - marginX, y + 5, { align: "right" });

  y += 10;
  doc.setDrawColor(...cBorder);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - marginX - 100, y, pageWidth - marginX, y);

  y += 15;

  // 4. Customer address (left) + Meta box (right)
  const metaBoxW = 75;
  const metaBoxX = pageWidth - marginX - metaBoxW;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text("VERTRAGSPARTNER", marginX, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cTextDark);

  const addressLines = data.customerAddress.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let addrY = y + 5;
  for (const line of addressLines) {
    doc.text(line, marginX, addrY);
    addrY += 5;
  }

  // Meta box
  doc.setFillColor(...cBoxBg);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(metaBoxX, y - 4, metaBoxW, 30, 2, 2, "FD");

  doc.setFontSize(9);
  let metaY = y + 2;
  const mLabelX = metaBoxX + 5;
  const mValueX = metaBoxX + metaBoxW - 5;
  const ls = 6;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Vertrag:", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  const titleLines = doc.splitTextToSize(data.title, metaBoxW - 40);
  doc.text(titleLines[0] || data.title, mValueX, metaY, { align: "right" });
  metaY += ls;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Laufzeit:", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(`${fmtDate(data.startDate)} – ${fmtDate(data.endDate)}`, mValueX, metaY, { align: "right" });
  metaY += ls;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Jahresbetrag:", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cDarkGreen);
  doc.text(`CHF ${fmtCHF(data.amount)}`, mValueX, metaY, { align: "right" });
  metaY += ls;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Kündigungsfrist:", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(`${data.noticePeriodMonths} Monate`, mValueX, metaY, { align: "right" });

  y = Math.max(addrY, y + 35) + 8;

  // 5. Contract description
  if (data.description) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(148, 163, 184);
    doc.text("VERTRAGSBESCHREIBUNG", marginX, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const safeDesc = data.description.replace(/<[^>]*>?/gm, '\n');
    const descLines = doc.splitTextToSize(safeDesc, pageWidth - marginX * 2);
    for (const line of descLines) {
      doc.text(line, marginX, y);
      y += 4.5;
    }
    y += 8;
  }

  // 6. Signature section (green box)
  const sigBoxH = 50;
  doc.setFillColor(240, 253, 244); // #f0fdf4
  doc.setDrawColor(134, 239, 174); // #86efac
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, sigBoxH, 3, 3, "FD");

  // Green left accent
  doc.setFillColor(...cDarkGreen);
  doc.rect(marginX, y, 2, sigBoxH, "F");

  y += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cDarkGreen);
  doc.text("✓ Digital unterzeichnet und signiert", marginX + 8, y);

  y += 10;

  doc.setFontSize(9);
  const sigLabelX = marginX + 8;
  const sigValueX = marginX + 55;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Unterzeichnet von:", sigLabelX, y);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(data.signatureName, sigValueX, y);
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
  doc.text(fmtDate(data.signatureDate), sigValueX, y);
  y += 6;

  if (data.signatureIp) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text("IP-Adresse:", sigLabelX, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text(data.signatureIp, sigValueX, y);
  }

  // 7. Footer (fixed at bottom)
  const fh = 25;
  const fy = pageHeight - fh;

  doc.setFillColor(...cDarkBg);
  doc.rect(0, fy, pageWidth, fh, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cGreen);

  const col1X = marginX;
  const col2X = marginX + 55;
  const col3X = marginX + 110;

  doc.text("ANBIETER", col1X, fy + 8);
  doc.text("KONTAKT", col2X, fy + 8);
  doc.text("DATUM", col3X, fy + 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);

  doc.text("Gross ICT – Stefan Gross", col1X, fy + 13);
  doc.text("Neuhushof 3, 6144 Zell LU", col1X, fy + 18);

  doc.text("info@gross-ict.ch", col2X, fy + 13);
  doc.text("+41 79 414 06 16", col2X, fy + 18);

  doc.text(`Erstellt: ${fmtDate(data.startDate)}`, col3X, fy + 13);
  doc.text(`Signiert: ${fmtDate(data.signatureDate)}`, col3X, fy + 18);

  // Return as base64
  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}
