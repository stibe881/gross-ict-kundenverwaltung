import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

interface InvoiceItem {
  description: string;
  quantity: number;
  unit?: string; // z.B. "Std.", "Stk.", "Benutzer"
  unitPrice: number;
  discount?: number; // Rabatt in %
  vatRate: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  customerNumber?: string;
  invoiceDate: string;
  dueDate: string;
  serviceDate?: string;
  paymentMethod?: string; // z.B. "Überweisung"
  customerName: string;
  customerAddress: string; // Mehrzeilige Adresse (mit \n)
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
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function generateInvoiceHTML(data: InvoiceData): string {
  // Logo als base64 laden
  let logoBase64 = "";
  try {
    const logoPath = path.resolve(__dirname, "..", "assets", "images", "splash-icon.png");
    const logoBuffer = readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch (e) {
    console.warn("[PDF] Logo konnte nicht geladen werden", e);
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

  // Kundenadresse: Zeilenumbrüche in HTML umwandeln
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
    body {
      font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
      font-size: 9.5pt;
      color: #333;
      line-height: 1.5;
    }

    /* ─── Header ─── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-area img {
      height: 50px;
      width: auto;
    }
    .rechnung-title {
      font-size: 18pt;
      font-weight: 400;
      color: #333;
      text-decoration: underline;
      text-underline-offset: 4px;
    }

    /* ─── Company Info (right) ─── */
    .company-info {
      text-align: right;
      font-size: 9pt;
      color: #333;
      margin-bottom: 20px;
    }
    .company-info .name {
      font-weight: 700;
    }
    .company-info .separator {
      height: 10px;
    }

    /* ─── Customer + Invoice Meta ─── */
    .meta-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .customer-address {
      font-size: 10pt;
      line-height: 1.6;
      min-width: 200px;
      padding-top: 10px;
    }
    .invoice-meta {
      text-align: right;
      font-size: 9pt;
    }
    .invoice-meta table {
      margin-left: auto;
      border-collapse: collapse;
    }
    .invoice-meta td {
      padding: 2px 0;
    }
    .invoice-meta td:first-child {
      text-align: left;
      padding-right: 30px;
      color: #555;
    }
    .invoice-meta td:last-child {
      text-align: right;
      font-weight: 600;
    }
    .invoice-meta .separator {
      height: 8px;
    }

    /* ─── Intro Text ─── */
    .intro {
      margin: 15px 0 10px;
      font-style: italic;
      font-size: 9pt;
      color: #555;
    }

    /* ─── Items Table ─── */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 5px;
    }
    .items-table thead th {
      background: #F0F0F0;
      border-top: 1px solid #999;
      border-bottom: 1px solid #999;
      padding: 6px 8px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #333;
    }
    .items-table thead th:first-child { text-align: left; }
    .items-table thead th:not(:first-child) { text-align: right; }
    .items-table tbody td {
      padding: 8px 8px;
      border-bottom: 1px solid #E0E0E0;
      font-size: 9pt;
      vertical-align: top;
    }
    .cell-left { text-align: left; }
    .cell-right { text-align: right; }

    /* ─── Totals ─── */
    .totals-section {
      margin-top: 0;
    }
    .totals-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 4px 8px;
      font-size: 9pt;
    }
    .totals-row .label {
      text-align: right;
      margin-right: 20px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 8pt;
      color: #555;
    }
    .totals-row .value {
      min-width: 120px;
      text-align: right;
      font-weight: 600;
    }
    .zu-bezahlen {
      background: #F5F5F0;
      border-top: 2px solid #999;
      border-bottom: 2px solid #999;
      padding: 10px 8px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-top: 4px;
    }
    .zu-bezahlen .label {
      font-size: 14pt;
      font-weight: 700;
      margin-right: 30px;
      color: #333;
    }
    .zu-bezahlen .value {
      font-size: 14pt;
      font-weight: 700;
      min-width: 140px;
      text-align: right;
      color: #333;
    }

    /* ─── Footer / Bankverbindung ─── */
    .footer {
      position: fixed;
      bottom: 0;
      left: 20mm;
      right: 20mm;
      border-top: 1px solid #CCC;
      padding-top: 10px;
      font-size: 8pt;
      color: #555;
    }
    .footer .bank-title {
      font-weight: 700;
      font-size: 8pt;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .footer .bank-details {
      font-size: 8pt;
      line-height: 1.6;
    }
  </style>
</head>
<body>

  <!-- Header: Logo + RECHNUNG -->
  <div class="header">
    <div class="logo-area">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Gross ICT" />` : `<span style="font-size:22pt;font-weight:300;color:#555;">Gross · ICT</span>`}
    </div>
    <div class="rechnung-title">RECHNUNG</div>
  </div>

  <!-- Company Info (right-aligned) -->
  <div class="company-info">
    <div class="name">Gross ICT</div>
    <div>Neuhushof 3</div>
    <div>6144 Zell LU</div>
    <div>Schweiz</div>
    <div class="separator"></div>
    <div class="name">Stefan Gross</div>
    <div>+41794140616</div>
    <div>stefan.gross@hotmail.ch</div>
  </div>

  <!-- Customer Address + Invoice Meta -->
  <div class="meta-section">
    <div class="customer-address">
      ${customerAddressHTML}
    </div>
    <div class="invoice-meta">
      <table>
        <tr>
          <td>Rechnungsnummer</td>
          <td>${data.invoiceNumber}</td>
        </tr>
        ${data.customerNumber ? `<tr><td>Kundennummer</td><td>${data.customerNumber}</td></tr>` : ""}
        <tr>
          <td>Ausstellungsdatum</td>
          <td>${fmtDate(data.invoiceDate)}</td>
        </tr>
        <tr>
          <td>Zahlungsziel</td>
          <td>${fmtDate(data.dueDate)}</td>
        </tr>
        <tr><td colspan="2" class="separator"></td></tr>
        ${data.serviceDate ? `<tr><td>Leistungsdatum</td><td>${fmtDate(data.serviceDate)}</td></tr>` : ""}
        <tr>
          <td>Zahlungsform</td>
          <td>${data.paymentMethod || "Überweisung"}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Intro -->
  <div class="intro">
    Wir bedanken uns für Ihren Auftrag und stellen folgende Positionen in Rechnung:
  </div>

  <!-- Items Table -->
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
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <!-- Totals -->
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

  <!-- Bank Footer -->
  <div class="footer">
    <div class="bank-title">Bankverbindung:</div>
    <div class="bank-details">
      Zahlungsempfänger: <strong>Stefan Gross</strong> &nbsp;·&nbsp;
      Bankname: <strong>Bank Cler AG</strong> &nbsp;·&nbsp;
      Kontonr.: <strong>2610.4165.2001</strong><br>
      IBAN: <strong>CH3906440261041652001</strong> &nbsp;&nbsp;
      SWIFT/BIC: <strong>BCLRCHBB</strong>
    </div>
  </div>

</body>
</html>
  `;
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const html = generateInvoiceHTML(data);
  const tmpDir = os.tmpdir();
  const tempHTMLPath = path.join(tmpDir, `invoice-${data.invoiceNumber}-${Date.now()}.html`);
  const tempPDFPath = path.join(tmpDir, `invoice-${data.invoiceNumber}-${Date.now()}.pdf`);

  try {
    await writeFile(tempHTMLPath, html, "utf-8");

    // PDF mit wkhtmltopdf generieren
    await execAsync(
      `wkhtmltopdf --page-size A4 --margin-top 20mm --margin-bottom 25mm --margin-left 20mm --margin-right 20mm --enable-local-file-access "${tempHTMLPath}" "${tempPDFPath}"`
    );

    const fs = require("fs");
    const pdfBuffer = fs.readFileSync(tempPDFPath);

    await unlink(tempHTMLPath);
    await unlink(tempPDFPath);

    return pdfBuffer;
  } catch (error) {
    try {
      await unlink(tempHTMLPath);
      await unlink(tempPDFPath);
    } catch { }
    throw error;
  }
}

/**
 * Gibt das generierte HTML zurück (zum Testen im Browser).
 */
export function generateInvoiceHTMLPreview(data: InvoiceData): string {
  return generateInvoiceHTML(data);
}
