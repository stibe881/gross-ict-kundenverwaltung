import { readFileSync } from "fs";
import path from "path";
import { jsPDF } from "jspdf";

interface InvoiceItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  vatRate: number;
  total: number;
}

interface InvoiceData {
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

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  // ─── Logo laden (falls verfügbar) ───
  let logoBase64 = "";
  try {
    const logoPath = path.resolve(__dirname, "..", "assets", "images", "splash-icon.png");
    const logoBuffer = readFileSync(logoPath);
    logoBase64 = logoBuffer.toString("base64");
  } catch (e) {
    // Logo nicht verfügbar
  }

  // ─── Header: Logo + RECHNUNG ───
  if (logoBase64) {
    try {
      doc.addImage(`data:image/png;base64,${logoBase64}`, "PNG", marginLeft, y, 18, 18);
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
  doc.text("+41 41 562 34 16", companyRightX, y, { align: "right" });
  y += 4;
  doc.text("stefan.gross@hotmail.ch", companyRightX, y, { align: "right" });

  y += 10;

  // ─── Kundenadresse (links) + Rechnungsdaten (rechts) ───
  const sectionStartY = y;

  // Kundenadresse
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  const addressLines = data.customerAddress.split("\n").map(l => l.trim()).filter(Boolean);
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
  const bankLine1 = "Zahlungsempfänger: Gross ICT  ·  Bank: Luzerner Kantonalbank AG";
  const bankLine2 = "IBAN: CH32 0077 8229 1386 9200 1";
  const bankLine3 = "UID: CHE-142.161.164";
  doc.text(bankLine1, marginLeft, footerY + 10);
  doc.text(bankLine2, marginLeft, footerY + 14);
  doc.text(bankLine3, marginLeft, footerY + 18);

  // PDF als Buffer zurückgeben
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

// ─── HTML-Vorschau (für Browser-Tests) ───

function generateInvoiceHTML(data: InvoiceData): string {
  let logoBase64 = "";
  try {
    const logoPath = path.resolve(__dirname, "..", "assets", "images", "splash-icon.png");
    const logoBuffer = readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch (e) {
    // Logo nicht verfügbar
  }

  const itemsHTML = data.items
    .map(
      (item) => `
    <tr>
      <td class="cell-left">${item.description}</td>
      <td class="cell-right">${item.quantity} ${item.unit || "Stk."}</td>
      <td class="cell-right">${fmtCHF(item.unitPrice)}</td>
      <td class="cell-right">${fmtCHF(item.discount ?? 0)}</td>
      <td class="cell-right">${fmtCHF(item.total)}</td>
    </tr>
  `
    )
    .join("");

  const customerAddressHTML = data.customerAddress
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("<br>");

  return `
<!DOCTYPE html>
<html lang="de-CH">
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${data.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 20mm 20mm 25mm 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; font-size: 9.5pt; color: #333; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .logo-area { display: flex; align-items: center; gap: 8px; }
    .logo-area img { height: 50px; width: auto; }
    .rechnung-title { font-size: 18pt; font-weight: 400; color: #333; text-decoration: underline; text-underline-offset: 4px; }
    .company-info { text-align: right; font-size: 9pt; color: #333; margin-bottom: 20px; }
    .company-info .name { font-weight: 700; }
    .company-info .separator { height: 10px; }
    .meta-section { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .customer-address { font-size: 10pt; line-height: 1.6; min-width: 200px; padding-top: 10px; }
    .invoice-meta { text-align: right; font-size: 9pt; }
    .invoice-meta table { margin-left: auto; border-collapse: collapse; }
    .invoice-meta td { padding: 2px 0; }
    .invoice-meta td:first-child { text-align: left; padding-right: 30px; color: #555; }
    .invoice-meta td:last-child { text-align: right; font-weight: 600; }
    .intro { margin: 15px 0 10px; font-style: italic; font-size: 9pt; color: #555; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
    .items-table thead th { background: #F0F0F0; border-top: 1px solid #999; border-bottom: 1px solid #999; padding: 6px 8px; font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #333; }
    .items-table thead th:first-child { text-align: left; }
    .items-table thead th:not(:first-child) { text-align: right; }
    .items-table tbody td { padding: 8px 8px; border-bottom: 1px solid #E0E0E0; font-size: 9pt; vertical-align: top; }
    .cell-left { text-align: left; }
    .cell-right { text-align: right; }
    .totals-row { display: flex; justify-content: flex-end; align-items: center; padding: 4px 8px; font-size: 9pt; }
    .totals-row .label { text-align: right; margin-right: 20px; font-weight: 600; text-transform: uppercase; font-size: 8pt; color: #555; }
    .totals-row .value { min-width: 120px; text-align: right; font-weight: 600; }
    .zu-bezahlen { background: #F5F5F0; border-top: 2px solid #999; border-bottom: 2px solid #999; padding: 10px 8px; display: flex; justify-content: flex-end; align-items: center; margin-top: 4px; }
    .zu-bezahlen .label { font-size: 14pt; font-weight: 700; margin-right: 30px; color: #333; }
    .zu-bezahlen .value { font-size: 14pt; font-weight: 700; min-width: 140px; text-align: right; color: #333; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 20mm 3mm 20mm; border-top: 1px solid #CCC; font-size: 8pt; color: #555; }
    .footer .bank-title { font-weight: 700; font-size: 8pt; margin-bottom: 6px; text-transform: uppercase; }
    .footer .bank-details { font-size: 8pt; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Gross ICT" />` : `<span style="font-size:22pt;font-weight:300;color:#555;">Gross · ICT</span>`}
    </div>
    <div class="rechnung-title">RECHNUNG</div>
  </div>
  <div class="company-info">
    <div class="name">Gross ICT</div>
    <div>Neuhushof 3</div>
    <div>6144 Zell LU</div>
    <div>Schweiz</div>
    <div class="separator"></div>
    <div class="name">Stefan Gross</div>
    <div>+41 41 562 34 16</div>
    <div>stefan.gross@hotmail.ch</div>
  </div>
  <div class="meta-section">
    <div class="customer-address">${customerAddressHTML}</div>
    <div class="invoice-meta">
      <table>
        <tr><td>Rechnungsnummer</td><td>${data.invoiceNumber}</td></tr>
        ${data.customerNumber ? `<tr><td>Kundennummer</td><td>${data.customerNumber}</td></tr>` : ""}
        <tr><td>Ausstellungsdatum</td><td>${fmtDate(data.invoiceDate)}</td></tr>
        <tr><td>Zahlungsziel</td><td>${fmtDate(data.dueDate)}</td></tr>
        ${data.serviceDate ? `<tr><td>Leistungsdatum</td><td>${fmtDate(data.serviceDate)}</td></tr>` : ""}
        <tr><td>Zahlungsform</td><td>${data.paymentMethod || "Überweisung"}</td></tr>
      </table>
    </div>
  </div>
  <div class="intro">Wir bedanken uns für Ihren Auftrag und stellen folgende Positionen in Rechnung:</div>
  <table class="items-table">
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th>Menge</th>
        <th>Preis (CHF)</th>
        <th>Rabatt %</th>
        <th>Betrag (CHF)</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div class="totals-section">
    <div class="totals-row">
      <span class="label">Gesamtbetrag</span>
      <span class="value">${fmtCHF(data.total)} CHF</span>
    </div>
    <div class="zu-bezahlen">
      <span class="label">ZU BEZAHLEN</span>
      <span class="value">${fmtCHF(data.total)} CHF</span>
    </div>
  </div>
  <div class="footer">
    <div class="bank-title">Bankverbindung:</div>
    <div class="bank-details">
      Zahlungsempfänger: <strong>Gross ICT</strong> &nbsp;·&nbsp;
      Bank: <strong>Luzerner Kantonalbank AG</strong><br>
      IBAN: <strong>CH32 0077 8229 1386 9200 1</strong><br>
      UID: <strong>CHE-142.161.164</strong>
    </div>
  </div>
</body>
</html>
  `;
}

export function generateInvoiceHTMLPreview(data: InvoiceData): string {
  return generateInvoiceHTML(data);
}
