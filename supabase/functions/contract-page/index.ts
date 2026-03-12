import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { LOGO_BASE64 } from "./logo.ts";

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

function renderPage(contract: any, supabaseUrl: string): string {
  const customerName = contract.customer?.company_name ||
    `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde";

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
          gelesen haben und diesen verbindlich zustimmen. Ihre digitale Signatur (Name, IP-Adresse und
          Zeitstempel) wird als rechtsgültiger Nachweis der Unterzeichnung gespeichert.
        </p>
        <div class="sign-form">
          <label for="signName">Vollständiger Name *</label>
          <input type="text" id="signName" placeholder="Vor- und Nachname" autocomplete="name" />
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
      </div>

      ${contract.description || contract.scope_of_services ? `
      <div class="description-section">
        ${contract.description ? `
        <div class="label">Beschreibung</div>
        <p style="margin-bottom: 12px;">${escHtml(contract.description)}</p>
        ` : ""}
        ${contract.scope_of_services ? `
        <div class="label">Leistungsumfang</div>
        <p>${escHtml(contract.scope_of_services)}</p>
        ` : ""}
      </div>
      ` : ""}
    </div>

    <!-- Terms & Conditions -->
    <div class="terms-card">
      <div class="card-title">Vertragsbedingungen</div>
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
      ${contract.special_agreements ? `
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Zusatzvereinbarungen</div>
          <div class="t-value" style="white-space: pre-wrap;">${escHtml(contract.special_agreements)}</div>
        </div>
      </div>
      ` : ""}
    </div>

    ${signatureSection}

    <div class="footer">
      Gross ICT · Stefan Gross<br/>
      Dieser Vertrag wurde digital über die Gross ICT Plattform bereitgestellt.
    </div>
  </div>

  ${!isSigned ? `
  <script>
    const SIGN_URL = "${supabaseUrl}/functions/v1/contract-page?token=${contract.token}&action=sign";

    async function handleSign() {
      const nameInput = document.getElementById("signName");
      const btn = document.getElementById("signBtn");
      const errorDiv = document.getElementById("signError");
      const name = nameInput.value.trim();

      if (!name) {
        errorDiv.textContent = "Bitte geben Sie Ihren vollständigen Namen ein.";
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
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Fehler beim Unterzeichnen");

        const now = new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
        document.querySelector(".sign-section").outerHTML = \`
          <div class="signed-box">
            <svg class="signed-check" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h2>Vertrag unterzeichnet</h2>
            <p>Unterzeichnet von <strong>\${name}</strong></p>
            <p class="sign-date">am \${now}</p>
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
  const action = url.searchParams.get("action");

  if (!token) {
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

    const { data: contract, error: fetchErr } = await supabase
      .from("contracts")
      .select("*, customer:customers(company_name, first_name, last_name, email)")
      .eq("token", token)
      .single();

    if (fetchErr || !contract) {
      return new Response(
        renderErrorPage("Vertrag nicht gefunden", "Der angeforderte Vertrag konnte nicht gefunden werden. Der Link ist möglicherweise abgelaufen oder ungültig."),
        { status: 404, headers: { ...corsHeaders, "content-type": "text/html;charset=UTF-8" } }
      );
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
      const customerName = contract.customer?.company_name ||
        `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde";

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

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET: Render page
    const html = renderPage(contract, supabaseUrl);
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
