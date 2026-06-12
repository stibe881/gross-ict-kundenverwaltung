import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LOGO_BASE64 } from "./logo.ts";
import { generateContractPDF, generateInvoicePDF, generateQuotePDF } from "./pdf-generator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtCHF(amount: number): string {
  return amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string): string {
  if (!d) return "-";
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTextHtml(str: string): string {
  // Escape HTML first, then convert " - " separators and newlines to <br> line breaks
  let text = escHtml(str);
  // Convert " - " at word boundaries to line breaks with dash
  text = text.replace(/\s*-\s+/g, '<br/>- ');
  // Also convert actual newlines
  text = text.replace(/\n/g, '<br/>');
  // Clean up leading <br/> if present
  text = text.replace(/^(<br\/>)+/, '');
  return text;
}

function renderPage(contract: any, supabaseUrl: string, employee: any = null): string {
  const customerName = contract.is_internal
    ? (employee?.name || employee?.email || "Mitarbeiter")
    : (contract.customer?.company_name ||
      `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde");

  const isSigned = !!contract.signature_date;
  const signDate = contract.signature_date
    ? new Date(contract.signature_date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  // Calculate duration display
  const durationText = contract.duration_months
    ? `${contract.duration_months} ${contract.duration_months === 1 ? "Monat" : "Monate"}`
    : "";

  const signatureSection = isSigned
    ? `
      <div class="signed-box">
        <svg class="signed-check" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h2>Vertrag unterzeichnet</h2>
        <p>Unterzeichnet von <strong>${escHtml(contract.signature_name || "")}</strong></p>
        <p class="sign-date">am ${signDate}</p>
      </div>
    `
    : `
      <div class="sign-section">
        <h2>Vertrag digital unterzeichnen</h2>
        <p class="sign-info">
          Mit Ihrer Unterzeichnung bestätigen Sie, dass Sie die oben aufgeführten Vertragsbedingungen
          gelesen haben und diesen verbindlich zustimmen. Ihre digitale Signatur (Name, Ort, Datum, IP-Adresse und
          Zeitstempel) wird als rechtsgültiger Nachweis der Unterzeichnung gespeichert.
        </p>
        <div class="sign-form">
          <label for="signName">Vollständiger Name *</label>
          <input type="text" id="signName" placeholder="Vor- und Nachname" autocomplete="name" />
          <label for="signLocation">Ort *</label>
          <input type="text" id="signLocation" placeholder="z.B. Zürich" autocomplete="address-level2" />
          <label for="signDate">Datum *</label>
          <input type="text" id="signDate" value="${new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}" />
          <button id="signBtn" onclick="handleSign()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            Verbindlich unterzeichnen
          </button>
          <div id="signError" class="sign-error" style="display:none;"></div>
        </div>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vertrag – ${escHtml(contract.title || "Gross ICT")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #09090b;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .container { width: 100%; max-width: 640px; }

    /* Header with Logo */
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #1f1f23;
    }
    .header img {
      height: 48px;
      margin-bottom: 12px;
      filter: brightness(1.1);
    }
    .header .subtitle {
      font-size: 14px;
      color: #71717a;
      font-weight: 500;
    }

    /* Contract Title Card */
    .title-card {
      background: linear-gradient(135deg, #161618 0%, #1a1a1f 100%);
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 16px;
    }
    .title-card h1 {
      font-size: 24px;
      font-weight: 800;
      color: #fafafa;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    .title-card .customer-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(202,255,90,0.08);
      border: 1px solid rgba(202,255,90,0.15);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      color: #CAFF5A;
      font-weight: 600;
    }
    .title-card .customer-badge svg {
      width: 14px; height: 14px;
    }

    /* Details Card */
    .card {
      background: #161618;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 13px;
      font-weight: 700;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 16px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 480px) {
      .detail-grid { grid-template-columns: 1fr; }
    }
    .detail-item { }
    .detail-item .label {
      font-size: 12px;
      color: #71717a;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .detail-item .value {
      font-size: 15px;
      font-weight: 600;
      color: #e5e5e5;
    }
    .detail-item .value.highlight {
      color: #CAFF5A;
      font-size: 18px;
      font-weight: 800;
    }
    .full-width { grid-column: 1 / -1; }

    /* Description */
    .description-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #27272a;
    }
    .description-section .label {
      font-size: 12px;
      color: #71717a;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .description-section p {
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    /* Terms Card */
    .terms-card {
      background: #161618;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
    }
    .terms-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #1f1f23;
    }
    .terms-item:last-child { border-bottom: none; }
    .terms-icon {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      background: rgba(202,255,90,0.08);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .terms-icon svg { width: 16px; height: 16px; color: #CAFF5A; }
    .terms-text .t-label {
      font-size: 12px;
      color: #71717a;
      font-weight: 500;
    }
    .terms-text .t-value {
      font-size: 14px;
      color: #e5e5e5;
      font-weight: 600;
    }

    /* Signing Section */
    .sign-section {
      background: #161618;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 16px;
    }
    .sign-section h2 {
      font-size: 18px;
      font-weight: 700;
      color: #fafafa;
      margin-bottom: 12px;
    }
    .sign-info {
      font-size: 13px;
      color: #71717a;
      line-height: 1.7;
      margin-bottom: 24px;
    }
    .sign-form label {
      font-size: 14px;
      font-weight: 600;
      color: #a1a1aa;
      display: block;
      margin-bottom: 8px;
    }
    .sign-form input {
      width: 100%;
      padding: 14px 16px;
      background: #09090b;
      border: 1px solid #3f3f46;
      border-radius: 10px;
      color: #fafafa;
      font-size: 16px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      margin-bottom: 16px;
    }
    .sign-form input:focus {
      border-color: #CAFF5A;
      box-shadow: 0 0 0 3px rgba(202,255,90,0.1);
    }
    .sign-form input::placeholder { color: #52525b; }
    .sign-form button {
      width: 100%;
      padding: 16px;
      background: #CAFF5A;
      color: #09090b;
      font-size: 16px;
      font-weight: 700;
      font-family: inherit;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sign-form button:hover { opacity: 0.9; }
    .sign-form button:active { transform: scale(0.98); }
    .sign-form button:disabled { opacity: 0.4; cursor: not-allowed; }
    .sign-error {
      margin-top: 12px;
      padding: 12px 16px;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      border-radius: 8px;
      color: #ef4444;
      font-size: 14px;
    }

    /* Signed State */
    .signed-box {
      background: #161618;
      border: 1px solid rgba(34,197,94,0.2);
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      margin-bottom: 16px;
      animation: fadeIn 0.4s ease-out;
    }
    .signed-check {
      width: 56px;
      height: 56px;
      margin: 0 auto 16px;
      display: block;
    }
    .signed-box h2 {
      font-size: 20px;
      color: #22c55e;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .signed-box p { font-size: 15px; color: #a1a1aa; }
    .sign-date { font-size: 13px; color: #71717a; margin-top: 4px; }

    /* Footer */
    .footer {
      text-align: center;
      padding: 24px 0;
      font-size: 12px;
      color: #3f3f46;
      line-height: 1.7;
      border-top: 1px solid #1f1f23;
      margin-top: 8px;
    }
    .footer a { color: #52525b; text-decoration: none; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_BASE64}" alt="Gross ICT" />
      <div class="subtitle">Digitaler Vertrag</div>
    </div>

    <!-- Contract Title -->
    <div class="title-card">
      <h1>${escHtml(contract.title || "Vertrag")}</h1>
      ${customerName ? `
      <div class="customer-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${escHtml(customerName)}
      </div>
      ` : ""}
    </div>

    <!-- Contract Details -->
    <div class="card">
      <div class="card-title">Vertragsdetails</div>
      <div class="detail-grid">
        ${contract.contact_person ? `
        <div class="detail-item">
          <div class="label">Kontaktperson</div>
          <div class="value">${escHtml(contract.contact_person)}</div>
        </div>
        ` : ""}
        <div class="detail-item">
          <div class="label">Vertragsbeginn</div>
          <div class="value">${fmtDate(contract.start_date)}</div>
        </div>
        ${!contract.is_internal ? `
        <div class="detail-item">
          <div class="label">Vertragsende</div>
          <div class="value">${fmtDate(contract.end_date)}</div>
        </div>
        ${durationText ? `
        <div class="detail-item">
          <div class="label">Vertragslaufzeit</div>
          <div class="value">${durationText}</div>
        </div>
        ` : ""}
        ${contract.annual_amount || contract.amount ? `
        <div class="detail-item">
          <div class="label">Jahresbetrag</div>
          <div class="value highlight">CHF ${fmtCHF(Number(contract.annual_amount || contract.amount))}</div>
        </div>
        ` : ""}
        ` : ""}
      </div>

      ${contract.description || contract.scope_of_services ? `
      <div class="description-section">
        ${contract.description ? `
        <div class="label">Beschreibung</div>
        <p style="margin-bottom: 12px;">${formatTextHtml(contract.description)}</p>
        ` : ""}
        ${contract.scope_of_services ? `
        <div class="label">Leistungsumfang</div>
        <p>${formatTextHtml(contract.scope_of_services)}</p>
        ` : ""}
      </div>
      ` : ""}
    </div>

    <!-- Terms & Conditions -->
    <div class="terms-card">
      <div class="card-title">Vertragsbedingungen</div>
      ${!contract.is_internal ? `
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Kündigungsfrist</div>
          <div class="t-value">${contract.notice_period_months || 3} ${(contract.notice_period_months || 3) === 1 ? "Monat" : "Monate"} zum Vertragsende</div>
        </div>
      </div>
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Zahlungsbedingungen</div>
          <div class="t-value">${contract.payment_terms ? escHtml(contract.payment_terms) : "Jährliche Abrechnung, zahlbar innert 30 Tagen"}</div>
        </div>
      </div>
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Automatische Verlängerung</div>
          <div class="t-value">Bei Nichtkündigung verlängert sich der Vertrag automatisch um die gleiche Laufzeit</div>
        </div>
      </div>
      ` : ""}
      ${contract.special_agreements ? `
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Zusatzvereinbarungen</div>
          <div class="t-value">${formatTextHtml(contract.special_agreements)}</div>
        </div>
      </div>
      ` : ""}
    </div>

    ${signatureSection}

    <div style="text-align:center;margin-bottom:16px;">
      <button onclick="window.print()" class="pdf-btn" style="
        background:#27272a;color:#e5e5e5;border:1px solid #3f3f46;border-radius:10px;
        padding:12px 24px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;
        display:inline-flex;align-items:center;gap:8px;
      ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Vertrag als PDF herunterladen
      </button>
    </div>

    <div class="footer">
      Gross ICT · Stefan Gross<br/>
      Dieser Vertrag wurde digital über die Gross ICT Plattform bereitgestellt.
    </div>
  </div>

  <!-- Professional Print-Only Contract Document (matching invoice/quote design) -->
  <div class="print-contract">
    <div class="pc-accent-bar"></div>
    <div class="pc-page">
      <table class="pc-header-table"><tr>
        <td><img src="${LOGO_BASE64}" class="pc-logo-img" alt="Gross ICT" /></td>
        <td><div class="pc-doc-type">Vertrag</div></td>
      </tr></table>

      <div class="pc-company-bar">
        <strong>Gross ICT</strong> · Neuhushof 3 · 6144 Zell LU · Schweiz<br>
        Stefan Gross · +41 79 414 06 16 · info@gross-ict.ch
      </div>

      <table class="pc-addr-meta"><tr>
        <td style="width:55%;">
          <div class="pc-cust-label">Vertragspartner</div>
          <div class="pc-cust-addr">${customerName}</div>
        </td>
        <td style="width:45%;">
          <div class="pc-meta-box">
            <table class="pc-meta-table">
              <tr><td>Vertragstitel</td><td>${escHtml(contract.title || "")}</td></tr>
              <tr><td>Beginn</td><td>${fmtDate(contract.start_date)}</td></tr>
              ${!contract.is_internal ? `
              <tr><td>Ende</td><td>${fmtDate(contract.end_date)}</td></tr>
              ${durationText ? `<tr><td>Laufzeit</td><td>${durationText}</td></tr>` : ""}
              ${(contract.annual_amount || contract.amount) ? `<tr><td>Betrag p.a.</td><td>CHF ${fmtCHF(Number(contract.annual_amount || contract.amount))}</td></tr>` : ""}
              <tr><td>Zahlung</td><td>${contract.payment_terms ? escHtml(contract.payment_terms) : "30 Tage netto"}</td></tr>
              ` : ""}
            </table>
          </div>
        </td>
      </tr></table>

      ${contract.description ? `
      <div class="pc-section">
        <table class="pc-section-header"><tr><th>Beschreibung</th></tr></table>
        <div class="pc-section-body">${formatTextHtml(contract.description)}</div>
      </div>
      ` : ""}

      ${contract.scope_of_services ? `
      <div class="pc-section">
        <table class="pc-section-header"><tr><th>Leistungsumfang</th></tr></table>
        <div class="pc-section-body">${formatTextHtml(contract.scope_of_services)}</div>
      </div>
      ` : ""}

      <div class="pc-section">
        <table class="pc-section-header"><tr><th>Vertragsbedingungen</th></tr></table>
        <table class="pc-terms-table">
          ${!contract.is_internal ? `
          <tr><td>Kündigungsfrist</td><td>${contract.notice_period_months || 3} ${(contract.notice_period_months || 3) === 1 ? "Monat" : "Monate"} zum Vertragsende</td></tr>
          <tr><td>Zahlungsbedingungen</td><td>${contract.payment_terms ? escHtml(contract.payment_terms) : "Jährliche Abrechnung, zahlbar innert 30 Tagen"}</td></tr>
          <tr><td>Automatische Verlängerung</td><td>Bei Nichtkündigung verlängert sich der Vertrag automatisch um die gleiche Laufzeit</td></tr>
          ` : ""}
          ${contract.special_agreements ? `<tr><td>Zusatzvereinbarungen</td><td>${formatTextHtml(contract.special_agreements)}</td></tr>` : ""}
        </table>
      </div>

      ${isSigned ? `
      <div class="pc-section pc-sig-section">
        <table class="pc-section-header"><tr><th>Digitale Signatur</th></tr></table>
        <table class="pc-terms-table">
          <tr><td>Unterzeichnet von</td><td><strong>${escHtml(contract.signature_name || "")}</strong></td></tr>
          <tr><td>Datum</td><td>${signDate}</td></tr>
          ${contract.signature_ip ? `<tr><td>IP-Adresse</td><td>${escHtml(contract.signature_ip)}</td></tr>` : ""}
        </table>
        <div class="pc-sig-note">Diese digitale Signatur dient als rechtsgültiger Nachweis der Unterzeichnung.</div>
      </div>
      ` : `
      <div class="pc-section pc-sig-section">
        <table class="pc-section-header"><tr><th>Unterschrift</th></tr></table>
        <div class="pc-sig-line">
          <div class="pc-sig-field"><div class="pc-sig-dash"></div><span>Ort, Datum</span></div>
          <div class="pc-sig-field"><div class="pc-sig-dash"></div><span>Unterschrift</span></div>
        </div>
      </div>
      `}

    ${isSigned ? `
    <div class="pc-section pc-sig-section">
      <table class="pc-section-header"><tr><th>Digitale Signatur</th></tr></table>
      <table class="pc-terms-table">
        <tr><td>Unterzeichnet von</td><td><strong>${escHtml(contract.signature_name || "")}</strong></td></tr>
        <tr><td>Ort, Datum</td><td>${contract.signature_location ? escHtml(contract.signature_location) + ', ' : ''}${signDate}</td></tr>
        ${contract.signature_ip ? `<tr><td>IP-Adresse</td><td>${escHtml(contract.signature_ip)}</td></tr>` : ""}
      </table>
      <div class="pc-sig-note">Dieser Vertrag wurde digital unterzeichnet und signiert. Die digitale Signatur dient als rechtsgültiger Nachweis der Unterzeichnung.</div>
    </div>` : ''}
    </div>

    <div class="pc-footer">
      <table class="pc-footer-table"><tr>
        <td style="width:33%;"><div class="pc-ft-label">Kontakt</div><span class="pc-ft-val">Gross ICT</span><br>info@gross-ict.ch</td>
        <td style="width:33%;"><div class="pc-ft-label">Bankverbindung</div><span class="pc-ft-val">Luzerner Kantonalbank AG</span></td>
        <td style="width:34%;"><div class="pc-ft-label">IBAN</div><span class="pc-ft-val">CH32 0077 8229 1386 9200 1</span></td>
      </tr></table>
    </div>
  </div>

  <style>
    .print-contract { display: none; }

    @media print {
      .container, .pdf-btn { display: none !important; }
      body { background: #fff !important; color: #1a1a2e !important; padding: 0 !important; margin: 0 !important; min-height: auto !important; display: flex !important; flex-direction: column; }

      .print-contract {
        display: flex !important; flex-direction: column; min-height: 100vh;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 9.5pt; color: #1a1a2e; line-height: 1.5;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .pc-accent-bar { height: 6px; background: linear-gradient(90deg, #D4A432, #E8B84A); }
      .pc-page { padding: 30px 40px 60px 40px; flex: 1; }
      .pc-header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      .pc-header-table td { border: none; padding: 0; vertical-align: bottom; }
      .pc-logo-img { height: 45px; width: auto; }
      .pc-doc-type { text-align: right; font-size: 22pt; font-weight: 700; color: #D4A432; letter-spacing: 3px; text-transform: uppercase; }
      .pc-company-bar { text-align: right; font-size: 8pt; color: #64748b; padding: 4px 0 12px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px; line-height: 1.7; }
      .pc-addr-meta { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      .pc-addr-meta td { border: none; padding: 0; vertical-align: top; }
      .pc-cust-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 6px; font-weight: 600; }
      .pc-cust-addr { font-size: 11pt; font-weight: 600; line-height: 1.3; color: #1a1a2e; }
      .pc-meta-box { background: #f8fafb; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; float: right; }
      .pc-meta-table { border-collapse: collapse; font-size: 9pt; }
      .pc-meta-table td { padding: 3px 0; border: none; }
      .pc-meta-table td:first-child { color: #64748b; padding-right: 24px; }
      .pc-meta-table td:last-child { font-weight: 600; text-align: right; color: #1a1a2e; }
      .pc-section { margin-bottom: 8px; }
      .pc-section-header { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
      .pc-section-header th { background: #D4A432; color: #fff; padding: 8px 12px; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; text-align: left; border-radius: 4px 4px 0 0; }
      .pc-section-body { font-size: 9.5pt; color: #475569; line-height: 1.7; white-space: pre-wrap; padding: 10px 12px; }
      .pc-terms-table { width: 100%; border-collapse: collapse; }
      .pc-terms-table td { padding: 8px 12px; font-size: 9pt; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      .pc-terms-table td:first-child { width: 180px; color: #64748b; font-weight: 500; }
      .pc-terms-table td:last-child { color: #1a1a2e; }
      .pc-sig-section { margin-top: 20px; }
      .pc-sig-note { font-size: 8pt; color: #94a3b8; font-style: italic; margin-top: 8px; padding: 4px 12px; }
      .pc-sig-line { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 12px; }
      .pc-sig-field { width: 45%; }
      .pc-sig-dash { border-bottom: 1px solid #1a1a2e; height: 30px; margin-bottom: 4px; }
      .pc-sig-field span { font-size: 8pt; color: #94a3b8; }
      .pc-footer { background: #1a1a2e; color: #cbd5e1; padding: 14px 40px; font-size: 7.5pt; line-height: 1.7; margin-top: auto; }
      .pc-footer-table { width: 100%; border-collapse: collapse; }
      .pc-footer-table td { border: none; padding: 0; vertical-align: top; color: #cbd5e1; }
      .pc-ft-label { font-weight: 700; color: #D4A432; text-transform: uppercase; letter-spacing: 1px; font-size: 7pt; margin-bottom: 3px; }
      .pc-ft-val { font-weight: 600; color: #fff; }
      @page { size: A4; margin: 0; }
    }
  </style>

  ${!isSigned ? `
  <script>
    const SIGN_URL = "${supabaseUrl}/functions/v1/contract-page?token=${contract.token}&action=sign";

    async function handleSign() {
      const nameInput = document.getElementById("signName");
      const locationInput = document.getElementById("signLocation");
      const dateInput = document.getElementById("signDate");
      const btn = document.getElementById("signBtn");
      const errorDiv = document.getElementById("signError");
      const name = nameInput.value.trim();
      const location = locationInput.value.trim();
      const signDate = dateInput.value.trim();

      if (!name) {
        errorDiv.textContent = "Bitte geben Sie Ihren vollständigen Namen ein.";
        errorDiv.style.display = "block";
        return;
      }
      if (!location) {
        errorDiv.textContent = "Bitte geben Sie den Ort ein.";
        errorDiv.style.display = "block";
        return;
      }
      if (!signDate) {
        errorDiv.textContent = "Bitte geben Sie das Datum ein.";
        errorDiv.style.display = "block";
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<svg style="width:20px;height:20px;animation:spin 1s linear infinite" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>';
      errorDiv.style.display = "none";

      try {
        const res = await fetch(SIGN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, location, date: signDate }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fehler beim Unterzeichnen");

        document.querySelector(".sign-section").outerHTML = \`
          <div class="signed-box">
            <svg class="signed-check" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h2>Vertrag unterzeichnet</h2>
            <p>Unterzeichnet von <strong>\${name}</strong></p>
            <p class="sign-date">\${location}, \${signDate}</p>
            <p style="font-size:13px;color:#71717a;margin-top:8px;">Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet.</p>
          </div>
        \`;
      } catch (err) {
        errorDiv.textContent = err.message || "Ein Fehler ist aufgetreten.";
        errorDiv.style.display = "block";
        btn.disabled = false;
        btn.innerHTML = 'Verbindlich unterzeichnen';
      }
    }

    document.getElementById("signName").addEventListener("keydown", function(e) {
      if (e.key === "Enter") handleSign();
    });
  </script>
  <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  ` : ""}
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const contractId = url.searchParams.get("id");
  const action = url.searchParams.get("action");

  if (!token && !contractId) {
    return new Response(
      renderErrorPage("Token fehlt", "Der Link ist ungültig. Bitte verwenden Sie den Link aus der E-Mail."),
      { status: 400, headers: { ...corsHeaders, "content-type": "text/html;charset=UTF-8" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );


    console.log(`[contract-page] Lookup: token=${token}, contractId=${contractId}, action=${action}`);

    // ── Invoice/Quote PDF: eigenständig, kein Contract nötig ──
    if (action === "generate-invoice-pdf" && contractId) {
      try {
        const { data: invoice, error: invErr } = await supabase
          .from("invoices")
          .select("*, customer:customers(*), items:invoice_items(*)")
          .eq("id", contractId)
          .single();

        if (invErr || !invoice) {
          return new Response(
            JSON.stringify({ error: "Rechnung nicht gefunden" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: settings } = await supabase
          .from("invoice_settings")
          .select("*")
          .limit(1)
          .single();

        const customerName = invoice.customer?.company_name ||
          `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() || "Kunde";

        const addressParts = [
          customerName,
          invoice.customer?.address || invoice.customer?.street,
          (invoice.customer?.postal_code || invoice.customer?.city) ? `${invoice.customer?.postal_code || ""} ${invoice.customer?.city || ""}`.trim() : undefined,
          "Schweiz"
        ].filter(Boolean);

        let docType = "Rechnung";
        if (invoice.status === "draft") {
          docType = "Rechnungsentwurf";
        } else if (invoice.is_dunning_document || (invoice.dunning_level != null && invoice.dunning_level > 0)) {
          if (invoice.dunning_level === 0) docType = "Zahlungserinnerung";
          else if (invoice.dunning_level === 1) docType = "1. Mahnung";
          else if (invoice.dunning_level === 2) docType = "2. Mahnung";
          else if (invoice.dunning_level === 3) docType = "Betreibungsandrohung";
        }

        const itemsTotal = (invoice.items || []).reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0);
        const calculatedTotal = itemsTotal > 0 ? itemsTotal : Number(invoice.total || 0);

        const pdfBase64 = generateInvoicePDF({
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.status === "draft" ? "" : invoice.invoice_date,
          dueDate: invoice.status === "draft" ? "" : invoice.due_date,
          customerName,
          customerAddress: addressParts.join("\n"),
          customerNumber: invoice.customer?.customer_number,
          docType,
          greetingText: settings?.greeting_text,
          items: (invoice.items || []).map((item: any) => ({
            description: item.description || "",
            quantity: Number(item.quantity || 1),
            unit: item.unit || "Stk.",
            unitPrice: Number(item.unit_price || 0),
            discountPercentage: Number(item.discount_percentage || 0),
            vatRate: Number(item.vat_rate || 0),
            total: Number(item.total || 0),
          })),
          total: calculatedTotal,
          paidAmount: Number(invoice.paid_amount || 0),
          specialDiscount: invoice.special_discount_type === 'percentage' 
            ? ((invoice.items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity) * Number(i.unit_price)), 0)) * (Number(invoice.special_discount) / 100)
            : Number(invoice.special_discount || 0),
          notes: invoice.notes,
          settings: settings ? {
            accountHolder: settings.account_holder,
            bankName: settings.bank_name,
            iban: settings.iban,
            swiftBic: settings.swift_bic,
            accountNumber: settings.account_number,
          } : undefined,
        });

        return new Response(
          JSON.stringify({ pdf: pdfBase64 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        console.error("[contract-page] Invoice PDF error:", err);
        return new Response(
          JSON.stringify({ error: "Rechnungs-PDF Fehler: " + err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "generate-quote-pdf" && contractId) {
      try {
        const { data: quote, error: quoteErr } = await supabase
          .from("quotes")
          .select("*, customer:customers(*), items:quote_items(*)")
          .eq("id", contractId)
          .single();

        if (quoteErr || !quote) {
          return new Response(
            JSON.stringify({ error: "Angebot nicht gefunden" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const customerName = quote.customer?.company_name ||
          `${quote.customer?.first_name || ""} ${quote.customer?.last_name || ""}`.trim() || "Kunde";

        const addressParts = [
          customerName,
          quote.customer?.address || quote.customer?.street,
          (quote.customer?.postal_code || quote.customer?.city) ? `${quote.customer?.postal_code || ""} ${quote.customer?.city || ""}`.trim() : undefined,
          "Schweiz"
        ].filter(Boolean);

        const pdfBase64 = generateQuotePDF({
          quoteNumber: quote.quote_number,
          quoteDate: quote.quote_date,
          validUntil: quote.valid_until,
          customerName,
          customerAddress: addressParts.join("\n"),
          customerNumber: quote.customer?.customer_number,
          creatorName: quote.creator_name || "Stefan Gross",
          items: (quote.items || []).map((item: any) => ({
            description: item.description || "",
            quantity: Number(item.quantity || 1),
            unit: item.unit || "Stk.",
            unitPrice: Number(item.unit_price || 0),
            vatRate: Number(item.vat_rate || 0),
            total: Number(item.total || 0),
            optional: !!item.optional,
          })),
          subtotal: Number(quote.subtotal || 0),
          tax: Number(quote.tax || 0),
          total: Number(quote.total || 0),
          specialDiscount: quote.special_discount_type === 'percentage' 
            ? ((quote.items || []).filter((i: any) => !i.optional).reduce((sum: number, i: any) => sum + (Number(i.quantity) * Number(i.unit_price)), 0)) * (Number(quote.special_discount) / 100)
            : Number(quote.special_discount || 0),
          notes: quote.notes,
        });

        return new Response(
          JSON.stringify({ pdf: pdfBase64 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        console.error("[contract-page] Quote PDF error:", err);
        return new Response(
          JSON.stringify({ error: "Angebots-PDF Fehler: " + err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Contract lookup (nur für Vertrags-Aktionen) ──
    let contract: any = null;
    let fetchErr: any = null;

    if (token) {
      const result = await supabase
        .from("contracts")
        .select("*, customer:customers(*)")
        .eq("token", token)
        .single();
      contract = result.data;
      fetchErr = result.error;
      console.log(`[contract-page] Token lookup: found=${!!contract}, error=${fetchErr?.message}`);
    }

    // Fallback: lookup by ID (for generate-pdf when no token exists)
    if (!contract && contractId) {
      const result = await supabase
        .from("contracts")
        .select("*, customer:customers(*)")
        .eq("id", contractId)
        .single();
      contract = result.data;
      fetchErr = result.error;
      console.log(`[contract-page] ID lookup: found=${!!contract}, error=${fetchErr?.message}`);
    }

    let employee = null;
    if (contract?.is_internal && contract?.employee_id) {
       const { data: emp, error: empErr } = await supabase.from('users').select('name, email, address, postal_code, city').eq('id', contract.employee_id).single();
       console.log(`[contract-page] Employee lookup: id=${contract.employee_id}, name=${emp?.name}, address=${emp?.address}, postal_code=${emp?.postal_code}, city=${emp?.city}, error=${empErr?.message}`);
       employee = emp;
    }

    if (fetchErr || !contract) {
      // Return JSON for generate-pdf so the client can show a proper error
      if (action === "generate-pdf") {
        return new Response(
          JSON.stringify({ error: `Vertrag nicht gefunden (token=${token}, id=${contractId}, dbError=${fetchErr?.message || 'none'})` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        renderErrorPage("Vertrag nicht gefunden", "Der angeforderte Vertrag konnte nicht gefunden werden. Der Link ist möglicherweise abgelaufen oder ungültig."),
        { status: 404, headers: { ...corsHeaders, "content-type": "text/html;charset=UTF-8" } }
      );
    }
    // GET: Generate PDF and return as base64
    if (action === "generate-pdf") {
      try {
        const customerName = contract.is_internal
          ? (employee?.name || employee?.email || "Mitarbeiter")
          : (contract.customer?.company_name ||
            `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde");

        const addressParts = contract.is_internal
          ? [
              customerName,
              employee?.address || "Gross ICT",
              (employee?.postal_code || employee?.city) ? `${employee?.postal_code || ''} ${employee?.city || ''}`.trim() : (!employee?.address ? "Neuhushof 3" : undefined),
              (!employee?.address ? "6144 Zell LU" : undefined),
              "Schweiz"
            ].filter(Boolean)
          : [
            customerName,
            contract.customer?.address || contract.customer?.street,
            (contract.customer?.postal_code || contract.customer?.city) ? `${contract.customer?.postal_code || ""} ${contract.customer?.city || ""}`.trim() : undefined,
            "Schweiz"
          ].filter(Boolean);

        const pdfData = {
          title: contract.title,
          customerName,
          customerAddress: addressParts.join("\n"),
          startDate: contract.start_date,
          endDate: contract.end_date,
          amount: Number(contract.annual_amount || contract.amount || 0),
          noticePeriodMonths: contract.notice_period_months || 3,
          description: contract.description || "",
          scopeOfServices: contract.scope_of_services || "",
          specialAgreements: contract.special_agreements || "",
          isInternal: contract.is_internal,
          cancellationDate: contract.cancellation_date || undefined,
          signatureName: contract.signature_name || undefined,
          signatureDate: contract.signature_date ? new Date(contract.signature_date).toISOString().split("T")[0] : undefined,
          signatureIp: contract.signature_ip || undefined,
        };

        const pdfBase64 = generateContractPDF(pdfData);
        return new Response(
          JSON.stringify({ pdf: pdfBase64 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (pdfErr: any) {
        console.error("[contract-page] PDF generation error:", pdfErr);
        return new Response(
          JSON.stringify({ error: "PDF konnte nicht generiert werden: " + pdfErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // POST: Sign contract
    if (req.method === "POST" && action === "sign") {
      if (contract.signature_date) {
        return new Response(
          JSON.stringify({ error: "Dieser Vertrag wurde bereits unterzeichnet." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let body: any = {};
      try { body = await req.json(); } catch {
        return new Response(
          JSON.stringify({ error: "Ungültige Anfrage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sigName = (body.name || "").trim();
      const sigLocation = (body.location || "").trim();
      const sigDate = (body.date || "").trim();
      if (!sigName) {
        return new Response(
          JSON.stringify({ error: "Name ist erforderlich" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") || "unknown";

      const { error: updateErr } = await supabase
        .from("contracts")
        .update({
          signature_name: sigName,
          signature_date: new Date().toISOString(),
          signature_ip: clientIP,
          signature_location: sigLocation || null,
          status: "active",
        })
        .eq("id", contract.id);

      if (updateErr) {
        console.error("[contract-page] Signature update error:", updateErr);
        return new Response(
          JSON.stringify({ error: "Signatur konnte nicht gespeichert werden" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify admin
      const customerName = contract.is_internal
        ? (employee?.name || employee?.email || "Mitarbeiter")
        : (contract.customer?.company_name ||
        `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde");

      // Log activity: signed
      try {
        const locationNote = sigLocation ? ` in ${sigLocation}` : "";
        await supabase.from("contract_activities").insert({
          contract_id: contract.id,
          type: "signed",
          description: `Vertrag digital unterzeichnet von ${sigName}${locationNote}`,
          user_name: customerName,
        });
      } catch (actErr) {
        console.error("[contract-page] Activity log failed:", actErr);
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Gross ICT <info@gross-ict.ch>",
              to: ["info@gross-ict.ch"],
              subject: `✅ Vertrag "${contract.title}" unterzeichnet – ${customerName}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                  <h2 style="color:#22c55e;">Vertrag unterzeichnet! ✍️</h2>
                  <p><strong>${customerName}</strong> hat den Vertrag <strong>"${contract.title}"</strong> soeben digital unterzeichnet.</p>
                  <p style="color:#666;margin-top:8px;">Unterzeichnet von: <strong>${sigName}</strong></p>
                  <p style="color:#666;">IP: ${clientIP}</p>
                  <p style="color:#666;margin-top:16px;">Zeitpunkt: ${new Date().toLocaleString("de-CH")}</p>
                </div>
              `,
            }),
          });
        } catch (emailErr) {
          console.error("[contract-page] Notification email failed:", emailErr);
        }
      }

      // Push notification
      try {
        const { data: admins } = await supabase
          .from("users")
          .select("id, push_token")
          .not("push_token", "is", null);

        if (admins && admins.length > 0) {
          const messages: any[] = [];
          for (const a of admins) {
            if (!a.push_token) continue;
            const tokens = a.push_token.split(",").map((t: string) => t.trim()).filter(Boolean);
            for (const t of tokens) {
              if (t.startsWith("ExponentPushToken")) {
                messages.push({
                  to: t,
                  sound: "default",
                  title: "Vertrag unterzeichnet! ✍️",
                  body: `${customerName} hat den Vertrag "${contract.title}" unterzeichnet.`,
                  data: { url: "/contracts" },
                });
              }
            }
          }
          if (messages.length > 0) {
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(messages),
            });
          }
        }
      } catch (pushErr) {
        console.error("[contract-page] Push failed:", pushErr);
      }

      // Send signed contract confirmation email to customer
      try {
        const customerEmail = contract.customer?.email;
        if (customerEmail && resendApiKey) {
          const signDateDisplay = sigDate || new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
          const locationDisplay = sigLocation ? `${sigLocation}, ` : "";

          const confirmEmailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#CAFF5A 0%,#22c55e 100%);color:#111;padding:24px;border-radius:8px 8px 0 0;">
                <h1 style="margin:0;font-size:20px;">Gross ICT</h1>
                <p style="margin:4px 0 0;font-size:14px;">Vertragsbestätigung</p>
              </div>
              <div style="padding:24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">
                <p>Guten Tag ${customerName},</p>
                <p>vielen Dank für Ihre Unterzeichnung des Vertrags <strong>"${contract.title}"</strong>.</p>
                <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin:16px 0;">
                  <p style="margin:0 0 8px;font-weight:bold;color:#16a34a;">✓ Digital unterzeichnet und signiert</p>
                  <table style="border-collapse:collapse;width:100%;">
                    <tr><td style="padding:4px 0;color:#666;">Unterzeichnet von:</td><td style="padding:4px 0;font-weight:600;">${sigName}</td></tr>
                    <tr><td style="padding:4px 0;color:#666;">Ort, Datum:</td><td style="padding:4px 0;font-weight:600;">${locationDisplay}${signDateDisplay}</td></tr>
                    <tr><td style="padding:4px 0;color:#666;">Vertragsbeginn:</td><td style="padding:4px 0;font-weight:600;">${fmtDate(contract.start_date)}</td></tr>
                    <tr><td style="padding:4px 0;color:#666;">Vertragsende:</td><td style="padding:4px 0;font-weight:600;">${fmtDate(contract.end_date)}</td></tr>
                    <tr><td style="padding:4px 0;color:#666;">Jahresbetrag:</td><td style="padding:4px 0;font-weight:600;">CHF ${fmtCHF(Number(contract.annual_amount || contract.amount || 0))}</td></tr>
                  </table>
                </div>

                <div style="text-align:center;margin:24px 0;">
                  <a href="https://vertrag.gross-ict.ch/?token=${token}" style="display:inline-block;background:#CAFF5A;color:#111;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
                    📄 Unterzeichneten Vertrag ansehen
                  </a>
                </div>
                <p style="color:#666;font-size:13px;">Über den obigen Link können Sie Ihren unterzeichneten Vertrag jederzeit einsehen und als PDF speichern (Drucken → Als PDF speichern).</p>

                <p>Bitte bewahren Sie diese E-Mail als Bestätigung auf.</p>
                <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
              </div>
            </div>
          `;

          // Generate signed contract PDF
          let pdfBase64: string | null = null;
          try {
            const addressParts = contract.is_internal
              ? [
                  customerName,
                  employee?.address || "Gross ICT",
                  (employee?.postal_code || employee?.city) ? `${employee?.postal_code || ''} ${employee?.city || ''}`.trim() : (!employee?.address ? "Neuhushof 3" : undefined),
                  (!employee?.address ? "6144 Zell LU" : undefined),
                  "Schweiz"
                ].filter(Boolean)
              : [
                customerName,
                contract.customer?.address || contract.customer?.street,
                (contract.customer?.postal_code || contract.customer?.city) ? `${contract.customer?.postal_code || ""} ${contract.customer?.city || ""}`.trim() : undefined
              ].filter(Boolean);

            pdfBase64 = generateContractPDF({
              title: contract.title,
              customerName,
              customerAddress: addressParts.join("\n"),
              startDate: contract.start_date,
              endDate: contract.end_date,
              amount: Number(contract.annual_amount || contract.amount || 0),
              noticePeriodMonths: contract.notice_period_months || 3,
              description: contract.description || "",
              scopeOfServices: contract.scope_of_services || "",
              specialAgreements: contract.special_agreements || "",
              isInternal: contract.is_internal,
              signatureName: sigName,
              signatureDate: new Date().toISOString().split("T")[0],
              signatureLocation: sigLocation || undefined,
              signatureIp: clientIP !== "unknown" ? clientIP : undefined,
            });
            console.log("[contract-page] Signed contract PDF generated successfully");
          } catch (pdfErr) {
            console.error("[contract-page] PDF generation failed:", pdfErr);
          }

          const emailPayload: any = {
            from: "Gross ICT <info@gross-ict.ch>",
            to: [customerEmail],
            subject: `Ihr unterzeichneter Vertrag: ${contract.title} – Gross ICT`,
            html: confirmEmailHtml,
          };

          if (pdfBase64) {
            const safeTitle = contract.title.replace(/[^a-zA-Z0-9äöüÄÖÜ_\- ]/g, "").replace(/\s+/g, "_");
            emailPayload.attachments = [{ filename: `Vertrag_${safeTitle}.pdf`, content: pdfBase64 }];
          }

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(emailPayload),
          });
          console.log(`[contract-page] Confirmation email sent to ${customerEmail}`);
        }
      } catch (emailErr) {
        console.error("[contract-page] Confirmation email failed:", emailErr);
      }

      // Auto-create and send first recurring invoice
      if (contract.recurring_enabled) {
        try {
          console.log(`[contract-page] Recurring enabled for "${contract.title}", creating first invoice...`);

          const BILLING_CYCLES = [
            { key: "monthly", months: 1, surcharge: 2, label: "Monatlich" },
            { key: "quarterly", months: 3, surcharge: 2, label: "Quartal" },
            { key: "semi_annual", months: 6, surcharge: 2, label: "Halbjährlich" },
            { key: "yearly", months: 12, surcharge: 0, label: "Jährlich" },
          ];
          const cycle = BILLING_CYCLES.find(c => c.key === contract.billing_cycle) || BILLING_CYCLES[3];
          const annualAmount = contract.annual_amount || contract.amount || 0;
          const baseAmount = Math.round((annualAmount / 12 * cycle.months) * 100) / 100;
          const totalAmount = baseAmount + cycle.surcharge;

          // Get next invoice number
          const { data: lastInvoice } = await supabase
            .from("invoices")
            .select("invoice_number")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const year = new Date().getFullYear();
          let nextNum = 1;
          if (lastInvoice?.invoice_number) {
            const match = lastInvoice.invoice_number.match(/(\d+)$/);
            if (match) nextNum = parseInt(match[1]) + 1;
          }
          const invoiceNumber = `RE-${year}-${String(nextNum).padStart(3, "0")}`;

          const today = new Date().toISOString().split("T")[0];
          const ptMatch = (contract.payment_terms || "").match(/(\d+)/);
          const paymentDays = ptMatch ? parseInt(ptMatch[1]) : 30;
          const dueDate = new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

          const vatRate = contract.vat_rate ?? 0;
          const vatMultiplier = vatRate / 100;

          // Create invoice items
          const invoiceItems: any[] = [
            {
              description: `${contract.title} — ${cycle.label}e Abrechnung`,
              quantity: 1, unit: "Pauschale", unit_price: baseAmount, vat_rate: vatRate, total: baseAmount,
            },
          ];
          if (cycle.surcharge > 0) {
            invoiceItems.push({
              description: `Zuschlag ${cycle.label}e Abrechnung`,
              quantity: 1, unit: "Pauschale", unit_price: cycle.surcharge, vat_rate: vatRate, total: cycle.surcharge,
            });
          }

          // Create invoice in DB
          const { data: invoiceData, error: invoiceError } = await supabase
            .from("invoices")
            .insert([{
              customer_id: contract.customer_id,
              invoice_number: invoiceNumber,
              invoice_date: today,
              due_date: dueDate,
              subtotal: totalAmount,
              vat_amount: Math.round(totalAmount * vatMultiplier * 100) / 100,
              total: Math.round(totalAmount * (1 + vatMultiplier) * 100) / 100,
              status: "open",
              notes: `Automatische Rechnung aus Vertrag: ${contract.title}`,
            }])
            .select()
            .single();

          if (!invoiceError && invoiceData) {
            // Insert items
            const itemsWithId = invoiceItems.map(item => ({ ...item, invoice_id: invoiceData.id }));
            await supabase.from("invoice_items").insert(itemsWithId);

            // Update contract dates
            const nextDate = new Date(today);
            nextDate.setMonth(nextDate.getMonth() + cycle.months);
            await supabase.from("contracts").update({
              last_invoice_date: today,
              next_invoice_date: nextDate.toISOString().split("T")[0],
              updated_at: new Date().toISOString(),
            }).eq("id", contract.id);

            console.log(`[contract-page] Invoice ${invoiceNumber} created.`);

            // Send invoice email via Supabase Edge Function (which now natively generates the PDF if missing)
            try {
              const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
              const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
              const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ id: invoiceData.id }),
              });
              if (emailRes.ok) {
                console.log(`[contract-page] Invoice email sent successfully via edge function.`);
              } else {
                const errText = await emailRes.text();
                console.error("[contract-page] Invoice email failed:", errText);
              }
            } catch (sendErr) {
              console.error("[contract-page] Failed to send invoice email:", sendErr);
            }
          } else {
            console.error("[contract-page] Failed to create invoice:", invoiceError);
          }
        } catch (recurringErr) {
          console.error("[contract-page] Error creating recurring invoice:", recurringErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET: Render page + track view + push notification
    // Non-blocking: track that contract was viewed
    const customerName2 = contract.is_internal
      ? (employee?.name || employee?.email || "Mitarbeiter")
      : (contract.customer?.company_name ||
      `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde");
    try {
      const { data: admins } = await supabase
        .from("users")
        .select("id, push_token")
        .not("push_token", "is", null);

      if (admins && admins.length > 0) {
        const pushMessages: any[] = [];
        for (const a of admins) {
          if (!a.push_token) continue;
          const tokens = a.push_token.split(",").map((t: string) => t.trim()).filter(Boolean);
          for (const t of tokens) {
            if (t.startsWith("ExponentPushToken")) {
              pushMessages.push({
                to: t,
                sound: "default",
                title: "📄 Vertrag geöffnet",
                body: `${customerName2} hat den Vertrag "${contract.title}" geöffnet.`,
                data: { url: "/contracts" },
              });
            }
          }
        }
        if (pushMessages.length > 0) {
          fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(pushMessages),
          }).catch(e => console.warn("[contract-page] View push failed:", e));
        }
      }
    } catch (pushErr) {
      console.warn("[contract-page] View tracking push error:", pushErr);
    }

    const html = renderPage(contract, supabaseUrl, employee);
    return new Response(html, {
      headers: {
        ...corsHeaders,
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[contract-page] Error:", err);
    return new Response(
      renderErrorPage("Fehler", err.message || "Ein interner Fehler ist aufgetreten."),
      { status: 500, headers: { ...corsHeaders, "content-type": "text/html;charset=UTF-8" } }
    );
  }
});

function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fehler – Gross ICT</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #09090b; color: #e5e5e5; min-height: 100vh;
      display: flex; justify-content: center; align-items: center; padding: 24px;
    }
    .error-box {
      max-width: 400px; text-align: center; background: #161618;
      border: 1px solid #27272a; border-radius: 16px; padding: 40px 32px;
    }
    .error-icon {
      width: 56px; height: 56px; margin: 0 auto 16px; display: block;
    }
    h1 { font-size: 22px; color: #ef4444; margin-bottom: 12px; font-weight: 700; }
    p { font-size: 15px; color: #71717a; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="error-box">
    <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    <h1>${escHtml(title)}</h1>
    <p>${escHtml(message)}</p>
  </div>
</body>
</html>`;
}
