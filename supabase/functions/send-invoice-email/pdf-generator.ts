import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { LOGO_BASE64 } from "../contract-page/logo.ts";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  vatRate: number;
  total: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  customerNumber?: string;
  invoiceDate: string;
  dueDate: string;
  serviceDate?: string;
  paymentMethod?: string;
  customerName: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  totalVat: number;
  total: number;
}

function fmtCHF(amount: number): string {
  return amount.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function generateInvoicePDF(data: InvoiceData): string {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  // ─── Header: Logo + RECHNUNG ───
  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, "PNG", marginLeft, y, 18, 18);
    } catch {
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text("Gross · ICT", marginLeft, y + 10);
    }
  } else {
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(85, 85, 85);
    doc.text("Gross · ICT", marginLeft, y + 10);
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  doc.text("RECHNUNG", pageWidth - marginRight, y + 10, { align: "right" });
  // Underline
  const titleWidth = doc.getTextWidth("RECHNUNG");
  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - marginRight - titleWidth, y + 12, pageWidth - marginRight, y + 12);

  y += 22;

  // ─── Firmeninfo (rechtsbündig) ───
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  const companyRightX = pageWidth - marginRight;

  doc.setFont("helvetica", "bold");
  doc.text("Gross ICT", companyRightX, y, { align: "right" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text("Neuhushof 3", companyRightX, y, { align: "right" });
  y += 4;
  doc.text("6144 Zell LU", companyRightX, y, { align: "right" });
  y += 4;
  doc.text("Schweiz", companyRightX, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Stefan Gross", companyRightX, y, { align: "right" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text("+41794140616", companyRightX, y, { align: "right" });
  y += 4;
  doc.text("stefan.gross@hotmail.ch", companyRightX, y, { align: "right" });

  y += 10;

  // ─── Kundenadresse (links) + Rechnungsdaten (rechts) ───
  const sectionStartY = y;

  function stripHtml(html: string) {
    return html.replace(/<[^>]*>?/gm, '\n');
  }

  // Kundenadresse
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  // Address is HTML-formatted sometimes in edge functions, strip it if necessary or split by \n
  const rawAddress = data.customerAddress || "";
  const addressLines = rawAddress.split(/\r?\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
  let addrY = sectionStartY;
  for (const line of addressLines) {
    doc.text(line, marginLeft, addrY);
    addrY += 5;
  }

  // Rechnungsdaten (rechts als Tabelle)
  doc.setFontSize(9);
  const metaLabelX = pageWidth - marginRight - 75;
  const metaValueX = pageWidth - marginRight;
  let metaY = sectionStartY;

  const metaRows: [string, string][] = [
    ["Rechnungsnummer", data.invoiceNumber],
  ];
  if (data.customerNumber) metaRows.push(["Kundennummer", data.customerNumber]);
  metaRows.push(["Ausstellungsdatum", fmtDate(data.invoiceDate)]);
  metaRows.push(["Zahlungsziel", fmtDate(data.dueDate)]);
  if (data.serviceDate) metaRows.push(["Leistungsdatum", fmtDate(data.serviceDate)]);
  metaRows.push(["Zahlungsform", data.paymentMethod || "Überweisung"]);

  for (const [label, value] of metaRows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(85, 85, 85);
    doc.text(label, metaLabelX, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 51, 51);
    doc.text(value, metaValueX, metaY, { align: "right" });
    metaY += 5;
  }

  y = Math.max(addrY, metaY) + 8;

  // ─── Intro ───
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(85, 85, 85);
  doc.text("Wir bedanken uns für Ihren Auftrag und stellen folgende Positionen in Rechnung:", marginLeft, y);
  y += 8;

  // ─── Tabelle: Header ───
  const colX = {
    desc: marginLeft,
    qty: marginLeft + contentWidth * 0.48,
    price: marginLeft + contentWidth * 0.62,
    discount: marginLeft + contentWidth * 0.78,
    total: marginLeft + contentWidth - 1,
  };

  doc.setFillColor(240, 240, 240);
  doc.rect(marginLeft, y - 4, contentWidth, 8, "F");
  doc.setDrawColor(153, 153, 153);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y - 4, marginLeft + contentWidth, y - 4);
  doc.line(marginLeft, y + 4, marginLeft + contentWidth, y + 4);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 51, 51);
  doc.text("BESCHREIBUNG", colX.desc + 2, y);
  doc.text("MENGE", colX.qty, y, { align: "right" });
  doc.text("PREIS (CHF)", colX.price, y, { align: "right" });
  doc.text("RABATT %", colX.discount, y, { align: "right" });
  doc.text("BETRAG (CHF)", colX.total, y, { align: "right" });

  y += 8;

  // ─── Tabelle: Zeilen ───
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);

  for (const item of data.items) {
    // Beschreibung (ggf. mehrzeilig)
    const descLines = doc.splitTextToSize(item.description, contentWidth * 0.45);
    for (let i = 0; i < descLines.length; i++) {
      doc.text(descLines[i], colX.desc + 2, y + i * 4);
    }

    doc.text(`${item.quantity} ${item.unit || "Stk."}`, colX.qty, y, { align: "right" });
    doc.text(fmtCHF(item.unitPrice), colX.price, y, { align: "right" });
    doc.text(fmtCHF(item.discount ?? 0), colX.discount, y, { align: "right" });
    doc.text(fmtCHF(item.total), colX.total, y, { align: "right" });

    const rowHeight = Math.max(descLines.length * 4, 4) + 4;
    y += rowHeight;

    // Trennlinie
    doc.setDrawColor(224, 224, 224);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, y - 2, marginLeft + contentWidth, y - 2);
  }

  y += 4;

  // ─── Totals ───
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(85, 85, 85);
  doc.text("GESAMTBETRAG", colX.discount - 10, y, { align: "right" });
  doc.setTextColor(51, 51, 51);
  doc.text(`${fmtCHF(data.total)} CHF`, colX.total, y, { align: "right" });

  y += 8;

  // Zu bezahlen Box
  doc.setFillColor(245, 245, 240);
  doc.rect(marginLeft, y - 5, contentWidth, 14, "F");
  doc.setDrawColor(153, 153, 153);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y - 5, marginLeft + contentWidth, y - 5);
  doc.line(marginLeft, y + 9, marginLeft + contentWidth, y + 9);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 51, 51);
  doc.text("ZU BEZAHLEN", colX.discount - 10, y + 4, { align: "right" });
  doc.text(`${fmtCHF(data.total)} CHF`, colX.total, y + 4, { align: "right" });

  // ─── Footer: Bankverbindung ───
  const footerY = 272;
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, footerY, pageWidth - marginRight, footerY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(85, 85, 85);
  doc.text("BANKVERBINDUNG:", marginLeft, footerY + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const bankLine1 = "Zahlungsempfänger: Stefan Gross  ·  Bankname: Bank Cler AG  ·  Kontonr.: 2610.4165.2001";
  const bankLine2 = "IBAN: CH3906440261041652001    SWIFT/BIC: BCLRCHBB";
  doc.text(bankLine1, marginLeft, footerY + 10);
  doc.text(bankLine2, marginLeft, footerY + 14);

  // Return base64 string
  const dataUri = doc.output("datauristring");
  return dataUri.split("base64,")[1];
}
