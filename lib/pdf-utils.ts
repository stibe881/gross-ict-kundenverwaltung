import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Paths, File as FSFile } from "expo-file-system";
import { Alert } from "react-native";

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

// ──────────────────────────────────────────────────────────────
// Gemeinsame CSS — kein Flexbox, nur Tables für iOS-Kompatibilität
// ──────────────────────────────────────────────────────────────
const PDF_STYLES = `
  @page { size: A4; margin: 20mm 20mm 25mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    color: #333;
    line-height: 1.5;
  }

  /* Layout-Tabelle (unsichtbar) */
  .layout-table {
    width: 100%;
    border-collapse: collapse;
    border: none;
  }
  .layout-table td {
    border: none;
    padding: 0;
    vertical-align: top;
  }

  /* Header */
  .logo-text {
    font-size: 22pt;
    font-weight: 300;
    color: #555;
  }
  .doc-title {
    font-size: 18pt;
    font-weight: 400;
    color: #333;
    text-decoration: underline;
    text-underline-offset: 4px;
    text-align: right;
  }

  /* Company Info */
  .company-info {
    text-align: right;
    font-size: 9pt;
    color: #333;
    margin-bottom: 20px;
  }
  .company-info .name { font-weight: 700; }
  .company-info .separator { height: 10px; }

  /* Customer Address */
  .customer-address {
    font-size: 10pt;
    line-height: 1.6;
    padding-top: 10px;
  }

  /* Meta Table */
  .meta-table {
    margin-left: auto;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .meta-table td {
    padding: 2px 0;
    border: none;
  }
  .meta-table td:first-child {
    text-align: left;
    padding-right: 30px;
    color: #555;
  }
  .meta-table td:last-child {
    text-align: right;
    font-weight: 600;
  }
  .meta-table .sep { height: 8px; }

  /* Intro */
  .intro {
    margin: 15px 0 10px;
    font-style: italic;
    font-size: 9pt;
    color: #555;
  }

  /* Items Table */
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
  .sub-desc {
    font-size: 8pt;
    color: #666;
  }

  /* Totals */
  .totals-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 2px;
  }
  .totals-table td {
    padding: 4px 8px;
    font-size: 9pt;
    border: none;
  }
  .totals-label {
    text-align: right;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 8pt;
    color: #555;
  }
  .totals-value {
    text-align: right;
    font-weight: 600;
    width: 140px;
  }
  .total-highlight {
    background: #F5F5F0;
    border-top: 2px solid #999;
    border-bottom: 2px solid #999;
  }
  .total-highlight td {
    padding: 10px 8px;
    font-size: 14pt;
    font-weight: 700;
    color: #333;
  }

  /* Footer */
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px 20mm 3mm 20mm;
    border-top: 1px solid #CCC;
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

  /* Notes */
  .notes {
    margin-top: 20px;
    padding: 10px;
    background: #F9F9F6;
    border: 1px solid #E0E0E0;
    font-size: 9pt;
    color: #555;
  }
  .notes-title {
    font-weight: 700;
    font-size: 8pt;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
`;

const COMPANY_BLOCK = `
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
`;

const BANK_FOOTER = `
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
`;

function buildCustomerAddressHTML(customer: any): string {
  const customerName =
    customer?.company_name ||
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() ||
    "Unbekannt";

  return [
    customerName,
    customer?.street || customer?.address,
    `${customer?.zip || customer?.postal_code || ""} ${customer?.city || ""}`.trim(),
    "Schweiz",
  ].filter(Boolean).join("<br>");
}

// ──────────────────────────────────────────────────────────────
// ANGEBOT PDF
// ──────────────────────────────────────────────────────────────

interface QuoteForPDF {
  quote_number: string;
  quote_date: string;
  valid_until?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
  customer?: any;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    total: number;
    optional?: boolean;
  }>;
}

function generateQuoteHTML(quote: QuoteForPDF): string {
  const customerAddressHTML = buildCustomerAddressHTML(quote.customer);

  const itemsHTML = (quote.items || [])
    .map((item) => {
      const nameParts = (item.description || "").split("\n");
      const mainName = nameParts[0] || "";
      const subLines = nameParts.slice(1).filter(Boolean);
      const prefix = item.optional ? "OPTIONAL - " : "";
      const descHTML =
        `${prefix}${mainName}` +
        (subLines.length > 0
          ? "<br>" + subLines.map(l => `<span class="sub-desc">${l}</span>`).join("<br>")
          : "");

      return `
    <tr>
      <td class="cell-left">${descHTML}</td>
      <td class="cell-right">${item.quantity} Stk.</td>
      <td class="cell-right">${fmtCHF(item.unit_price)}</td>
      <td class="cell-right">${fmtCHF(0)}</td>
      <td class="cell-right">${fmtCHF(item.total)}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="de-CH">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Angebot ${quote.quote_number}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>

  <!-- Header -->
  <table class="layout-table">
    <tr>
      <td><span class="logo-text">Gross · ICT</span></td>
      <td class="doc-title">ANGEBOT</td>
    </tr>
  </table>

  <!-- Company Info -->
  ${COMPANY_BLOCK}

  <!-- Customer + Meta -->
  <table class="layout-table" style="margin-bottom:20px;">
    <tr>
      <td class="customer-address" style="width:50%;">
        ${customerAddressHTML}
      </td>
      <td style="width:50%;">
        <table class="meta-table">
          <tr>
            <td>Angebotsnr.</td>
            <td>${quote.quote_number}</td>
          </tr>
          ${quote.customer?.customer_number ? `<tr><td>Kundennummer:</td><td>${quote.customer.customer_number}</td></tr>` : ""}
          <tr>
            <td>Ausstellungsdatum</td>
            <td>${fmtDate(quote.quote_date)}</td>
          </tr>
          ${quote.valid_until ? `<tr><td>Gültig bis</td><td>${fmtDate(quote.valid_until)}</td></tr>` : ""}
        </table>
      </td>
    </tr>
  </table>

  <!-- Intro -->
  <div class="intro">
    Wir erlauben uns Ihnen dieses Angebot zu unterbreiten:
  </div>

  <!-- Items -->
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
  <table class="totals-table">
    <tr class="total-highlight">
      <td class="totals-label" style="font-size:14pt;">ANGEBOTSBETRAG</td>
      <td class="totals-value" style="font-size:14pt;">${fmtCHF(quote.total)} CHF</td>
    </tr>
  </table>

  ${quote.notes ? `
  <div class="notes">
    <div class="notes-title">Anmerkungen:</div>
    ${quote.notes.replace(/\n/g, "<br>")}
  </div>` : ""}

  ${BANK_FOOTER}

</body>
</html>`;
}

export async function downloadQuotePDF(quote: QuoteForPDF): Promise<void> {
  const html = generateQuoteHTML(quote);

  // Schritt 1: HTML als PDF generieren
  try {
    const { uri } = await Print.printToFileAsync({
      html,
      width: 595,   // A4
      height: 842,  // A4
    });

    // Schritt 2: PDF-Datei teilen
    await Sharing.shareAsync(uri, {
      UTI: "com.adobe.pdf",
      mimeType: "application/pdf",
    });
    return;
  } catch (e1: any) {
    console.warn("[PDF] printToFileAsync fehlgeschlagen:", e1.message);
  }

  // Fallback: HTML-Datei direkt teilen
  try {
    const file = new FSFile(Paths.cache, `angebot-${quote.quote_number}.html`);
    file.write(html);
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/html",
    });
  } catch (e2: any) {
    Alert.alert("Fehler", "PDF konnte nicht erstellt werden: " + e2.message);
  }
}

// ──────────────────────────────────────────────────────────────
// RECHNUNG PDF
// ──────────────────────────────────────────────────────────────

interface InvoiceForPDF {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  notes?: string | null;
  customer?: any;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    total: number;
  }>;
}

function generateInvoiceHTML(invoice: InvoiceForPDF): string {
  const customerAddressHTML = buildCustomerAddressHTML(invoice.customer);

  const itemsHTML = (invoice.items || [])
    .map((item) => {
      const descHTML = (item.description || "").replace(/\n/g, "<br>");
      return `
    <tr>
      <td class="cell-left">${descHTML}</td>
      <td class="cell-right">${item.quantity} Stk.</td>
      <td class="cell-right">${fmtCHF(item.unit_price)}</td>
      <td class="cell-right">${fmtCHF(0)}</td>
      <td class="cell-right">${fmtCHF(item.total)}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="de-CH">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoice.invoice_number}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>

  <!-- Header -->
  <table class="layout-table">
    <tr>
      <td><span class="logo-text">Gross · ICT</span></td>
      <td class="doc-title">RECHNUNG</td>
    </tr>
  </table>

  <!-- Company Info -->
  ${COMPANY_BLOCK}

  <!-- Customer + Meta -->
  <table class="layout-table" style="margin-bottom:20px;">
    <tr>
      <td class="customer-address" style="width:50%;">
        ${customerAddressHTML}
      </td>
      <td style="width:50%;">
        <table class="meta-table">
          <tr>
            <td>Rechnungsnummer</td>
            <td>${invoice.invoice_number}</td>
          </tr>
          ${invoice.customer?.customer_number ? `<tr><td>Kundennummer:</td><td>${invoice.customer.customer_number}</td></tr>` : ""}
          <tr>
            <td>Ausstellungsdatum</td>
            <td>${fmtDate(invoice.invoice_date)}</td>
          </tr>
          <tr>
            <td>Zahlungsziel</td>
            <td>${fmtDate(invoice.due_date)}</td>
          </tr>
          <tr><td colspan="2" class="sep"></td></tr>
          <tr>
            <td>Zahlungsform</td>
            <td>Überweisung</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Intro -->
  <div class="intro">
    Wir bedanken uns für Ihren Auftrag und stellen folgende Positionen in Rechnung:
  </div>

  <!-- Items -->
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
  <table class="totals-table">
    <tr>
      <td class="totals-label">Gesamtbetrag</td>
      <td class="totals-value">${fmtCHF(invoice.total)} CHF</td>
    </tr>
    <tr class="total-highlight">
      <td class="totals-label" style="font-size:14pt;">ZU BEZAHLEN</td>
      <td class="totals-value" style="font-size:14pt;">${fmtCHF(invoice.total)} CHF</td>
    </tr>
  </table>

  ${BANK_FOOTER}

</body>
</html>`;
}

export async function downloadInvoicePDF(invoice: InvoiceForPDF): Promise<void> {
  const html = generateInvoiceHTML(invoice);

  try {
    const { uri } = await Print.printToFileAsync({
      html,
      width: 595,
      height: 842,
    });

    await Sharing.shareAsync(uri, {
      UTI: "com.adobe.pdf",
      mimeType: "application/pdf",
    });
    return;
  } catch (e1: any) {
    console.warn("[PDF] printToFileAsync fehlgeschlagen:", e1.message);
  }

  try {
    const file = new FSFile(Paths.cache, `rechnung-${invoice.invoice_number}.html`);
    file.write(html);
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/html",
    });
  } catch (e2: any) {
    Alert.alert("Fehler", "PDF konnte nicht erstellt werden: " + e2.message);
  }
}
