import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  totalVat: number;
  total: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function generateInvoiceHTML(data: InvoiceData): string {
  const itemsHTML = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: right;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(item.unitPrice)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: right;">${item.vatRate}%</td>
      <td style="padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 600;">${formatCurrency(item.total)}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="de-CH">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10pt; color: #11181C; padding: 40px; }
    .header { margin-bottom: 40px; }
    .company-name { font-size: 18pt; font-weight: bold; color: #0a7ea4; margin-bottom: 8px; }
    .invoice-title { font-size: 24pt; font-weight: bold; margin-bottom: 20px; }
    .info-section { margin-bottom: 30px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .label { font-weight: 600; color: #687076; }
    .customer-box { background: #F5F5F5; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #0a7ea4; color: white; padding: 10px 8px; text-align: left; font-weight: 600; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
    .totals-row.final { border-top: 2px solid #11181C; border-bottom: 2px solid #11181C; font-weight: bold; font-size: 12pt; margin-top: 8px; padding-top: 12px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 9pt; color: #687076; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">Ihr Firmenname</div>
    <div>Musterstrasse 123 • 8000 Zürich • Schweiz</div>
    <div>Tel: +41 44 123 45 67 • info@firma.ch</div>
  </div>

  <div class="invoice-title">Rechnung</div>

  <div class="info-section">
    <div class="info-row">
      <div><span class="label">Rechnungsnummer:</span> ${data.invoiceNumber}</div>
      <div><span class="label">Rechnungsdatum:</span> ${formatDate(data.invoiceDate)}</div>
    </div>
    <div class="info-row">
      <div></div>
      <div><span class="label">Fälligkeitsdatum:</span> ${formatDate(data.dueDate)}</div>
    </div>
  </div>

  <div class="customer-box">
    <div class="label" style="margin-bottom: 8px;">Rechnungsadresse:</div>
    <div style="font-weight: 600;">${data.customerName}</div>
    <div>${data.customerAddress}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th style="text-align: right;">Menge</th>
        <th style="text-align: right;">Einzelpreis</th>
        <th style="text-align: right;">MwSt</th>
        <th style="text-align: right;">Betrag</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Zwischensumme:</span>
      <span>${formatCurrency(data.subtotal)}</span>
    </div>
    <div class="totals-row">
      <span>MwSt:</span>
      <span>${formatCurrency(data.totalVat)}</span>
    </div>
    <div class="totals-row final">
      <span>Gesamtbetrag:</span>
      <span>${formatCurrency(data.total)}</span>
    </div>
  </div>

  <div class="footer">
    <div>Zahlbar innerhalb von 30 Tagen nach Rechnungsdatum.</div>
    <div style="margin-top: 8px;">Bankverbindung: IBAN CH00 0000 0000 0000 0000 0 • BIC: XXXXXXXX</div>
    <div style="margin-top: 8px;">UID: CHE-123.456.789 MWST</div>
  </div>
</body>
</html>
  `;
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const html = generateInvoiceHTML(data);
  const tempHTMLPath = path.join("/tmp", `invoice-${data.invoiceNumber}-${Date.now()}.html`);
  const tempPDFPath = path.join("/tmp", `invoice-${data.invoiceNumber}-${Date.now()}.pdf`);

  try {
    // HTML-Datei schreiben
    await writeFile(tempHTMLPath, html, "utf-8");

    // PDF mit wkhtmltopdf generieren
    await execAsync(`wkhtmltopdf --page-size A4 --margin-top 10mm --margin-bottom 10mm --margin-left 10mm --margin-right 10mm "${tempHTMLPath}" "${tempPDFPath}"`);

    // PDF-Datei lesen
    const fs = require("fs");
    const pdfBuffer = fs.readFileSync(tempPDFPath);

    // Temporäre Dateien löschen
    await unlink(tempHTMLPath);
    await unlink(tempPDFPath);

    return pdfBuffer;
  } catch (error) {
    // Cleanup bei Fehler
    try {
      await unlink(tempHTMLPath);
      await unlink(tempPDFPath);
    } catch {}
    throw error;
  }
}
