import { LOGO_BASE64 } from "./logo-base64";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Paths, File as FSFile } from "expo-file-system";
import { Alert, Platform } from "react-native";

function fmtCHF(amount: number | null | undefined): string {
  if (amount == null) return "0.00";
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
// Gemeinsame Bausteine
// ──────────────────────────────────────────────────────────────

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
// ANGEBOT PDF — Professionelles modernes Design
// ──────────────────────────────────────────────────────────────

interface QuoteForPDF {
  quote_number: string;
  quote_date: string;
  valid_until?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
  creator_name?: string;
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

  // Optionale Positionen berechnen
  const optionalItems = (quote.items || []).filter(i => !!i.optional);
  const nonOptionalItems = (quote.items || []).filter(i => !i.optional);
  const optionalSubtotal = optionalItems.reduce((sum, i) => sum + (i.total || 0), 0);
  const nonOptionalSubtotal = nonOptionalItems.reduce((sum, i) => sum + (i.total || 0), 0);
  const grandTotal = nonOptionalSubtotal + optionalSubtotal;
  const hasOptional = optionalSubtotal > 0;

  console.log("[PDF] Quote items:", (quote.items || []).length, "optional:", optionalItems.length, "optionalSubtotal:", optionalSubtotal, "hasOptional:", hasOptional);

  // Spacer-Höhe vorab berechnen (in mm, da plattformunabhängig)
  // A4 = 297mm
  const PAGE_H = 297;
  const HEADER_H = 55;     // Logo + Company-Bar + Accent-Bar
  const ADDR_H = 38;       // Adresse + Meta-Box
  const INTRO_H = 14;      // Guten Tag...
  const TABLE_HEAD_H = 10; // Tabellenkopf
  const ITEM_ROW_H = 9;    // Pro Item-Zeile (Basisgrösse)
  const SUB_LINE_H = 4;    // Pro Unterbeschreibungs-Zeile
  const TOTALS_H = hasOptional ? 35 : 22; // Totals-Block
  const NOTES_H = quote.notes ? 18 : 0;
  const FOOTER_H = 20;
  const MARGINS_H = 16;    // Top/Bottom padding

  // Items-Höhe berechnen
  let itemsH = 0;
  for (const item of (quote.items || [])) {
    const lines = (item.description || "").split("\n");
    itemsH += ITEM_ROW_H + Math.max(0, lines.length - 1) * SUB_LINE_H;
  }

  const contentH = HEADER_H + ADDR_H + INTRO_H + TABLE_HEAD_H + itemsH + TOTALS_H + NOTES_H + FOOTER_H + MARGINS_H;
  const pages = Math.max(1, Math.ceil(contentH / PAGE_H));
  const spacerH = Math.max(0, pages * PAGE_H - contentH);

  const itemsHTML = (quote.items || [])
    .map((item, idx) => {
      const nameParts = (item.description || "").split("\n");
      const mainName = nameParts[0] || "";
      const subLines = nameParts.slice(1).filter(Boolean);
      const prefix = item.optional ? '<span style="color:#D4A432;font-weight:600;">OPTIONAL</span> – ' : "";
      const descHTML =
        `${prefix}${mainName}` +
        (subLines.length > 0
          ? "<br>" + subLines.map(l => `<span class="sub-desc">${l}</span>`).join("<br>")
          : "");
      const rowBg = idx % 2 === 1 ? ' style="background:#f8fafb;"' : "";

      return `
      <tr${rowBg}>
        <td class="cell-center">${idx + 1}</td>
        <td class="cell-left">${descHTML}</td>
        <td class="cell-right">${item.quantity}</td>
        <td class="cell-right">${fmtCHF(item.unit_price)}</td>
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
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      color: #1a1a2e !important;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 0;
      margin: 0;
    }

    /* ── Accent Bar ── */
    .accent-bar {
      height: 6px;
      background: linear-gradient(90deg, #D4A432, #E8B84A);
    }

    .page {
      padding: 30px 40px 30px 40px;
      position: relative;
    }

    /* ── Header ── */
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: none; padding: 0; vertical-align: bottom; }
    .logo {
      font-size: 26pt;
      font-weight: 300;
      color: #1a1a2e;
      letter-spacing: 2px;
    }
    .logo span { color: #D4A432; font-weight: 600; }
    .doc-type {
      text-align: right;
      font-size: 22pt;
      font-weight: 700;
      color: #D4A432;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    /* ── Company Info ── */
    .company-bar {
      text-align: right;
      font-size: 8pt;
      color: #64748b;
      padding: 6px 0 20px 0;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 24px;
      line-height: 1.7;
    }

    /* ── Address + Meta ── */
    .addr-meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .addr-meta-table td { border: none; padding: 0; vertical-align: top; }
    .customer-label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      margin-bottom: 6px;
      font-weight: 600;
    }
    .customer-address {
      font-size: 10pt;
      line-height: 1.3;
      color: #1a1a2e;
    }
    .meta-box {
      background: #f8fafb;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px 18px;
      float: right;
    }
    .meta-table { border-collapse: collapse; font-size: 9pt; }
    .meta-table td { padding: 3px 0; border: none; }
    .meta-table td:first-child { color: #64748b; padding-right: 24px; }
    .meta-table td:last-child { font-weight: 600; text-align: right; color: #1a1a2e; }

    /* ── Intro ── */
    .intro {
      font-size: 10pt;
      color: #475569;
      margin-bottom: 20px;
      line-height: 1.6;
    }

    /* ── Items Table ── */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .items-table thead th {
      background: #D4A432;
      color: #fff;
      padding: 10px 12px;
      font-size: 7.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .items-table thead th:first-child { border-radius: 4px 0 0 0; text-align: center; width: 40px; }
    .items-table thead th:last-child { border-radius: 0 4px 0 0; }
    .items-table thead th:not(:first-child):not(:nth-child(2)) { text-align: right; }
    .items-table thead th:nth-child(2) { text-align: left; }
    .items-table tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 9pt;
      vertical-align: top;
    }
    .cell-left { text-align: left; }
    .cell-right { text-align: right; }
    .cell-center { text-align: center; color: #94a3b8; font-weight: 600; }
    .sub-desc { font-size: 8pt; color: #94a3b8; }

    /* ── Totals ── */
    .totals-wrap { width: 100%; margin-top: 6px; }
    .totals-table { border-collapse: collapse; float: right; min-width: 280px; }
    .totals-table td { padding: 6px 12px; font-size: 9pt; border: none; }
    .totals-label { text-align: right; color: #374151 !important; font-weight: 500; }
    .totals-value { text-align: right; font-weight: 600; color: #1a1a2e !important; min-width: 100px; }
    .totals-sep td { height: 2px; padding: 0; }
    .totals-sep td div { height: 2px; background: #e2e8f0; }
    .total-row { background: #D4A432; }
    .total-row td {
      padding: 12px 14px !important;
      font-size: 13pt !important;
      font-weight: 700 !important;
      color: #fff !important;
      border-radius: 4px;
    }

    /* ── Notes ── */
    .notes {
      clear: both;
      margin-top: 30px;
      padding: 14px 16px;
      background: #f8fafb;
      border-left: 3px solid #D4A432;
      font-size: 9pt;
      color: #475569;
      line-height: 1.6;
    }
    .notes-title {
      font-weight: 700;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #D4A432;
      margin-bottom: 4px;
    }

    /* ── Footer ── */
    .footer {
      background: #1a1a2e;
      color: #cbd5e1;
      padding: 14px 40px;
      font-size: 7.5pt;
      line-height: 1.7;
    }

    /* ── Page break hints ── */
    .totals-wrap { page-break-inside: avoid; }
    .notes { page-break-inside: avoid; }
    .footer-table { width: 100%; border-collapse: collapse; }
    .footer-table td { border: none; padding: 0; vertical-align: top; color: #cbd5e1; }
    .footer-label { font-weight: 700; color: #D4A432; text-transform: uppercase; letter-spacing: 1px; font-size: 7pt; margin-bottom: 3px; }
    .footer-val { font-weight: 600; color: #fff; }
  </style>
</head>
<body>

  <!-- Accent Bar -->
  <div class="accent-bar"></div>

  <div class="page">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td><img src="${LOGO_BASE64}" style="height:45px;width:auto;" alt="Gross ICT" /></td>
        <td><div class="doc-type">Angebot</div></td>
      </tr>
    </table>

    <!-- Company Info Bar -->
    <div class="company-bar">
      <strong>Gross ICT</strong> · Neuhushof 3 · 6144 Zell LU · Schweiz<br>
      ${quote.creator_name || "Stefan Gross"} · +41 79 414 06 16 · info@gross-ict.ch
    </div>

    <!-- Customer Address + Meta -->
    <table class="addr-meta-table">
      <tr>
        <td style="width:55%;">
          <div class="customer-label">Empfänger</div>
          <div class="customer-address">${customerAddressHTML}</div>
        </td>
        <td style="width:45%;">
          <div class="meta-box">
            <table class="meta-table">
              <tr><td>Angebotsnr.</td><td>${quote.quote_number}</td></tr>
              ${quote.customer?.customer_number ? `<tr><td>Kundennr.</td><td>${quote.customer.customer_number}</td></tr>` : ""}
              <tr><td>Datum</td><td>${fmtDate(quote.quote_date)}</td></tr>
              ${quote.valid_until ? `<tr><td>Gültig bis</td><td>${fmtDate(quote.valid_until)}</td></tr>` : ""}
            </table>
          </div>
        </td>
      </tr>
    </table>

    <!-- Intro -->
    <div class="intro">
      Guten Tag<br><br>
      Gerne unterbreiten wir Ihnen folgendes Angebot:
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Beschreibung</th>
          <th>Menge</th>
          <th>Einzelpreis</th>
          <th>Betrag (CHF)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-wrap" style="margin-bottom:60px;">
      <table class="totals-table">
        <tr class="total-row">
          <td class="totals-label" style="color:#fff !important;">Total</td>
          <td class="totals-value">${fmtCHF(nonOptionalSubtotal)} CHF</td>
        </tr>
        ${hasOptional ? `
        <tr><td colspan="2" style="padding-top:12px;"></td></tr>
        <tr>
          <td class="totals-label">Zwischensumme OPTIONAL</td>
          <td class="totals-value">${fmtCHF(optionalSubtotal)}</td>
        </tr>
        <tr class="totals-sep"><td colspan="2"><div></div></td></tr>
        <tr class="total-row">
          <td class="totals-label" style="color:#fff !important;">Total inkl. OPTIONAL</td>
          <td class="totals-value">${fmtCHF(grandTotal)} CHF</td>
        </tr>
        ` : ""}
      </table>
    </div>

    ${quote.notes ? `
    <div class="notes">
      <div class="notes-title">Anmerkungen</div>
      ${quote.notes.replace(/\n/g, "<br>")}
    </div>` : ""}
  </div>

  <!-- Spacer: vorberechnet in TypeScript -->
  <div id="footer-spacer" style="height: ${spacerH}mm;"></div>

  <!-- Footer -->
  <div id="pdf-footer" class="footer">
    <table class="footer-table">
      <tr>
        <td style="width:33%;">
          <div class="footer-label">Zahlungsempfänger</div>
          <span class="footer-val">Stefan Gross</span>
        </td>
        <td style="width:33%;">
          <div class="footer-label">Bankverbindung</div>
          <span class="footer-val">Bank Cler AG</span><br>
          Konto: 2610.4165.2001
        </td>
        <td style="width:34%;">
          <div class="footer-label">IBAN / SWIFT</div>
          <span class="footer-val">CH39 0644 0261 0416 5200 1</span><br>
          SWIFT: BCLRCHBB
        </td>
      </tr>
    </table>
  </div>

</body>
</html>`;
}

export async function downloadQuotePDF(quote: QuoteForPDF): Promise<void> {
  const html = generateQuoteHTML(quote);

  // Web: Hidden-Iframe-Druck (nur HTML-Inhalt, keine App-Buttons)
  if (Platform.OS === "web") {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Warten bis Inhalte geladen sind, dann drucken
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 3000);
        }, 500);
      };

      // Fallback: Falls onload nicht feuert
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch { }
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch { }
        }, 3000);
      }, 2000);
    }
    return;
  }

  // Native: PDF erstellen und teilen
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
// RECHNUNG PDF — Gleicher professioneller Stil wie Angebot
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

  // Total aus den Items berechnen (statt aus DB-Feld)
  const itemsTotal = (invoice.items || []).reduce((sum, i) => sum + (i.total || 0), 0);
  const calculatedTotal = itemsTotal > 0 ? itemsTotal : invoice.total;

  // Spacer-Höhe vorab berechnen (in mm)
  const PAGE_H = 297;
  const HEADER_H = 55;
  const ADDR_H = 38;
  const INTRO_H = 14;
  const TABLE_HEAD_H = 10;
  const ITEM_ROW_H = 9;
  const SUB_LINE_H = 4;
  const TOTALS_H = 22;
  const NOTES_H = invoice.notes ? 18 : 0;
  const FOOTER_H = 20;
  const MARGINS_H = 16;

  let invoiceItemsH = 0;
  for (const item of (invoice.items || [])) {
    const lines = (item.description || "").split("\n");
    invoiceItemsH += ITEM_ROW_H + Math.max(0, lines.length - 1) * SUB_LINE_H;
  }

  const invContentH = HEADER_H + ADDR_H + INTRO_H + TABLE_HEAD_H + invoiceItemsH + TOTALS_H + NOTES_H + FOOTER_H + MARGINS_H;
  const invPages = Math.max(1, Math.ceil(invContentH / PAGE_H));
  const invSpacerH = Math.max(0, invPages * PAGE_H - invContentH);

  const itemsHTML = (invoice.items || [])
    .map((item, idx) => {
      const descHTML = (item.description || "").replace(/\n/g, "<br>");
      const rowBg = idx % 2 === 1 ? ' style="background:#f8fafb;"' : "";
      return `
      <tr${rowBg}>
        <td class="cell-center">${idx + 1}</td>
        <td class="cell-left">${descHTML}</td>
        <td class="cell-right">${item.quantity}</td>
        <td class="cell-right">${fmtCHF(item.unit_price)}</td>
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
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      color: #1a1a2e !important;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 0;
      margin: 0;
    }
    .accent-bar { height: 6px; background: linear-gradient(90deg, #D4A432, #E8B84A); }
    .page { padding: 30px 40px 30px 40px; position: relative; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: none; padding: 0; vertical-align: bottom; }
    .logo { font-size: 26pt; font-weight: 300; color: #1a1a2e; letter-spacing: 2px; }
    .logo span { color: #D4A432; font-weight: 600; }
    .doc-type { text-align: right; font-size: 22pt; font-weight: 700; color: #D4A432; letter-spacing: 3px; text-transform: uppercase; }
    .company-bar { text-align: right; font-size: 8pt; color: #64748b; padding: 6px 0 20px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; line-height: 1.7; }
    .addr-meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .addr-meta-table td { border: none; padding: 0; vertical-align: top; }
    .customer-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
    .customer-address { font-size: 10pt; line-height: 1.3; color: #1a1a2e; }
    .meta-box { background: #f8fafb; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; float: right; }
    .meta-table { border-collapse: collapse; font-size: 9pt; }
    .meta-table td { padding: 3px 0; border: none; }
    .meta-table td:first-child { color: #64748b; padding-right: 24px; }
    .meta-table td:last-child { font-weight: 600; text-align: right; color: #1a1a2e; }
    .intro { font-size: 10pt; color: #475569; margin-bottom: 20px; line-height: 1.6; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .items-table thead th { background: #D4A432; color: #fff; padding: 10px 12px; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .items-table thead th:first-child { border-radius: 4px 0 0 0; text-align: center; width: 40px; }
    .items-table thead th:last-child { border-radius: 0 4px 0 0; }
    .items-table thead th:not(:first-child):not(:nth-child(2)) { text-align: right; }
    .items-table thead th:nth-child(2) { text-align: left; }
    .items-table tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 9pt; vertical-align: top; }
    .cell-left { text-align: left; } .cell-right { text-align: right; } .cell-center { text-align: center; color: #94a3b8; font-weight: 600; }
    .totals-wrap { width: 100%; margin-top: 6px; }
    .totals-table { border-collapse: collapse; float: right; min-width: 280px; }
    .totals-table td { padding: 6px 12px; font-size: 9pt; border: none; }
    .totals-label { text-align: right; color: #374151 !important; font-weight: 500; }
    .totals-value { text-align: right; font-weight: 600; color: #1a1a2e !important; min-width: 100px; }
    .totals-sep td { height: 2px; padding: 0; }
    .totals-sep td div { height: 2px; background: #e2e8f0; }
    .total-row { background: #D4A432; }
    .total-row td { padding: 12px 14px !important; font-size: 13pt !important; font-weight: 700 !important; color: #fff !important; border-radius: 4px; }
    .notes { clear: both; margin-top: 30px; padding: 14px 16px; background: #f8fafb; border-left: 3px solid #D4A432; font-size: 9pt; color: #475569; line-height: 1.6; }
    .notes-title { font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #D4A432; margin-bottom: 4px; }
    .footer { background: #1a1a2e; color: #cbd5e1; padding: 14px 40px; font-size: 7.5pt; line-height: 1.7; }
    .totals-wrap { page-break-inside: avoid; }
    .notes { page-break-inside: avoid; }
    .footer-table { width: 100%; border-collapse: collapse; }
    .footer-table td { border: none; padding: 0; vertical-align: top; color: #cbd5e1; }
    .footer-label { font-weight: 700; color: #D4A432; text-transform: uppercase; letter-spacing: 1px; font-size: 7pt; margin-bottom: 3px; }
    .footer-val { font-weight: 600; color: #fff; }
  </style>
</head>
<body>
  <div class="accent-bar"></div>
  <div class="page">
    <table class="header-table">
      <tr>
        <td><img src="${LOGO_BASE64}" style="height:45px;width:auto;" alt="Gross ICT" /></td>
        <td><div class="doc-type">Rechnung</div></td>
      </tr>
    </table>

    <div class="company-bar">
      <strong>Gross ICT</strong> · Neuhushof 3 · 6144 Zell LU · Schweiz<br>
      Stefan Gross · +41 79 414 06 16 · info@gross-ict.ch
    </div>

    <table class="addr-meta-table">
      <tr>
        <td style="width:55%;">
          <div class="customer-label">Empfänger</div>
          <div class="customer-address">${customerAddressHTML}</div>
        </td>
        <td style="width:45%;">
          <div class="meta-box">
            <table class="meta-table">
              <tr><td>Rechnungsnr.</td><td>${invoice.invoice_number}</td></tr>
              ${invoice.customer?.customer_number ? `<tr><td>Kundennr.</td><td>${invoice.customer.customer_number}</td></tr>` : ""}
              <tr><td>Datum</td><td>${fmtDate(invoice.invoice_date)}</td></tr>
              <tr><td>Zahlungsziel</td><td>${fmtDate(invoice.due_date)}</td></tr>
              <tr><td>Zahlungsform</td><td>Überweisung</td></tr>
            </table>
          </div>
        </td>
      </tr>
    </table>

    <div class="intro">
      Guten Tag<br><br>
      Wir bedanken uns für Ihren Auftrag und stellen folgende Positionen in Rechnung:
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Beschreibung</th>
          <th>Menge</th>
          <th>Einzelpreis</th>
          <th>Betrag (CHF)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div class="totals-wrap" style="margin-bottom:60px;">
      <table class="totals-table">
        <tr class="total-row">
          <td class="totals-label" style="color:#fff !important;">Zu bezahlen</td>
          <td class="totals-value">${fmtCHF(calculatedTotal)} CHF</td>
        </tr>
      </table>
    </div>

    ${invoice.notes ? `
    <div class="notes">
      <div class="notes-title">Anmerkungen</div>
      ${invoice.notes.replace(/\n/g, "<br>")}
    </div>` : ""}
  </div>

  <div id="footer-spacer" style="height: ${invSpacerH}mm;"></div>

  <div id="pdf-footer" class="footer">
    <table class="footer-table">
      <tr>
        <td style="width:33%;">
          <div class="footer-label">Zahlungsempfänger</div>
          <span class="footer-val">Stefan Gross</span>
        </td>
        <td style="width:33%;">
          <div class="footer-label">Bankverbindung</div>
          <span class="footer-val">Bank Cler AG</span><br>
          Konto: 2610.4165.2001
        </td>
        <td style="width:34%;">
          <div class="footer-label">IBAN / SWIFT</div>
          <span class="footer-val">CH39 0644 0261 0416 5200 1</span><br>
          SWIFT: BCLRCHBB
        </td>
      </tr>
    </table>
  </div>

</body>
</html>`;
}

export async function downloadInvoicePDF(invoice: InvoiceForPDF): Promise<void> {
  const html = generateInvoiceHTML(invoice);

  // Web: Hidden-Iframe-Druck (nur HTML-Inhalt, keine App-Buttons)
  if (Platform.OS === "web") {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => document.body.removeChild(iframe), 3000);
        }, 500);
      };

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch { }
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch { }
        }, 3000);
      }, 2000);
    }
    return;
  }

  // Native: PDF erstellen und teilen
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

  // Fallback: HTML-Datei direkt teilen
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
