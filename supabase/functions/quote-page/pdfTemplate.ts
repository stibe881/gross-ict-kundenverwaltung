export function fmtCHFPdf(amount: number | null | undefined): string {
  if (amount == null) return "0.00";
  return amount.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

const LOGO_BASE64 = "https://bvluvvyvftygnxtmboxw.supabase.co/storage/v1/object/public/quote-pages/logo.png";
const isWeb = true; // Hardcoded for this edge function

export function generateQuotePDFHTML(quote: any): string {
  const customerAddressHTML = buildCustomerAddressHTML(quote.customer);

  const optionalItems = (quote.items || []).filter((i: any) => !!i.optional);
  const nonOptionalItems = (quote.items || []).filter((i: any) => !i.optional);
  const optionalSubtotal = optionalItems.reduce((sum: number, i: any) => sum + (i.total || 0), 0);
  const nonOptionalSubtotal = nonOptionalItems.reduce((sum: number, i: any) => sum + (i.total || 0), 0);
  const grandTotal = nonOptionalSubtotal + optionalSubtotal;
  const hasOptional = optionalSubtotal > 0;

  const itemsHTML = (quote.items || [])
    .map((item: any, idx: number) => {
      const nameParts = (item.description || "").split("\n");
      const mainName = nameParts[0] || "";
      const subLines = nameParts.slice(1).filter(Boolean);
      const prefix = item.optional ? '<span style="color:#D4A432;font-weight:600;">OPTIONAL</span> – ' : "";
      const descHTML =
        `${prefix}${mainName}` +
        (subLines.length > 0
          ? "<br>" + subLines.map((l: string) => `<span class="sub-desc">${l}</span>`).join("<br>")
          : "");
      const rowBg = idx % 2 === 1 ? ' style="background:#f8fafb;"' : "";

      return `
      <tr${rowBg}>
        <td class="cell-center">${idx + 1}</td>
        <td class="cell-left">${descHTML}</td>
        <td class="cell-right">${item.quantity} ${item.unit || 'Stk.'}</td>
        <td class="cell-right">${fmtCHFPdf(item.unit_price)}</td>
        <td class="cell-right">${fmtCHFPdf(item.total)}</td>
      </tr>`;
    })
    .join("");

  const quoteNumberHTML = quote.quote_number ? `<tr><td>Angebotsnr.</td><td>${quote.quote_number}</td></tr>` : "";
  const customerNumberHTML = quote.customer?.customer_number ? `<tr><td>Kundennr.</td><td>${quote.customer.customer_number}</td></tr>` : "";
  const validUntilHTML = quote.valid_until ? `<tr><td>Gültig bis</td><td>${new Date(quote.valid_until).toLocaleDateString("de-CH")}</td></tr>` : "";
  const dateHTML = `<tr><td>Datum</td><td>${new Date(quote.quote_date).toLocaleDateString("de-CH")}</td></tr>`;

  const optionalSubtotalsHTML = hasOptional ? `
        <tr><td colspan="2" style="padding-top:12px;"></td></tr>
        <tr>
          <td class="totals-label">Zwischensumme OPTIONAL</td>
          <td class="totals-value">${fmtCHFPdf(optionalSubtotal)}</td>
        </tr>
        <tr class="totals-sep"><td colspan="2"><div></div></td></tr>
        <tr class="total-row">
          <td class="totals-label" style="color:#fff !important;">Total inkl. OPTIONAL</td>
          <td class="totals-value">${fmtCHFPdf(grandTotal)} CHF</td>
        </tr>
  ` : "";

  const notesHTML = quote.notes ? `
    <div class="notes">
      <div class="notes-title">Anmerkungen</div>
      ${quote.notes.replace(/\n/g, "<br>")}
    </div>` : "";

  const creatorName = quote.creator_name || "Stefan Gross";

  // Re-use logic exactly from lib/pdf-utils
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
    .accent-bar { height: 6px; background: linear-gradient(90deg, #D4A432, #E8B84A); }
    .page { padding: 30px 40px 80px 40px; position: relative; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .header-table td { border: none; padding: 0; vertical-align: bottom; }
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
    .sub-desc { font-size: 8pt; color: #94a3b8; }
    .totals-wrap { width: 100%; margin-top: 6px; page-break-inside: avoid; }
    .totals-table { border-collapse: collapse; float: right; min-width: 280px; }
    .totals-table td { padding: 6px 12px; font-size: 9pt; border: none; }
    .totals-label { text-align: right; color: #374151 !important; font-weight: 500; }
    .totals-value { text-align: right; font-weight: 600; color: #1a1a2e !important; min-width: 100px; }
    .totals-sep td { height: 2px; padding: 0; }
    .totals-sep td div { height: 2px; background: #e2e8f0; }
    .total-row { background: #D4A432; }
    .total-row td { padding: 12px 14px !important; font-size: 13pt !important; font-weight: 700 !important; color: #fff !important; border-radius: 4px; }
    .notes { clear: both; margin-top: 30px; padding: 14px 16px; background: #f8fafb; border-left: 3px solid #D4A432; font-size: 9pt; color: #475569; line-height: 1.6; page-break-inside: avoid; }
    .notes-title { font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #D4A432; margin-bottom: 4px; }
    .footer { background: #1a1a2e; color: #cbd5e1; padding: 14px 40px; font-size: 7.5pt; line-height: 1.7; position: fixed; bottom: 0; left: 0; right: 0; page-break-inside: avoid; }
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
        <td><div class="doc-type">Angebot</div></td>
      </tr>
    </table>
    <div class="company-bar">
      <strong>Gross ICT</strong> · Neuhushof 3 · 6144 Zell LU · Schweiz<br>
      ${creatorName} · +41 79 414 06 16 · info@gross-ict.ch
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
              ${quoteNumberHTML}
              ${customerNumberHTML}
              ${dateHTML}
              ${validUntilHTML}
            </table>
          </div>
        </td>
      </tr>
    </table>
    <div class="intro">
      Guten Tag<br><br>
      Gerne unterbreiten wir Ihnen folgendes Angebot:
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
          <td class="totals-label" style="color:#fff !important;">Total</td>
          <td class="totals-value">${fmtCHFPdf(nonOptionalSubtotal)} CHF</td>
        </tr>
        ${optionalSubtotalsHTML}
      </table>
    </div>
    ${notesHTML}
  </div>
  <div id="footer-spacer" style="height: 0mm;"></div>
  <div id="pdf-footer" class="footer">
    <table class="footer-table">
      <tr>
        <td style="width:33%;">
          <div class="footer-label">Zahlungsempfänger</div>
          <span class="footer-val">Gross ICT</span>
        </td>
        <td style="width:33%;">
          <div class="footer-label">Bankverbindung</div>
          <span class="footer-val">Luzerner Kantonalbank AG</span>
        </td>
        <td style="width:34%;">
          <div class="footer-label">IBAN</div>
          <span class="footer-val">CH32 0077 8229 1386 9200 1</span>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}
