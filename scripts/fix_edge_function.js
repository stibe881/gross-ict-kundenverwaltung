const fs = require('fs');

const indexTsPath = 'c:/Users/stefa/Temp/gross-ict-kundenverwaltung/supabase/functions/contract-page/index.ts';
let code = fs.readFileSync(indexTsPath, 'utf8');

// Update renderPage signature
code = code.replace(
  'function renderPage(contract: any, supabaseUrl: string): string {',
  'function renderPage(contract: any, supabaseUrl: string, employee: any = null): string {'
);

code = code.replace(
  `  const customerName = contract.customer?.company_name ||\n    \`\${contract.customer?.first_name || ""} \${contract.customer?.last_name || ""}\`.trim() || "Kunde";`,
  `  const customerName = contract.is_internal\n    ? (employee?.name || employee?.email || "Mitarbeiter")\n    : (contract.customer?.company_name ||\n    \`\${contract.customer?.first_name || ""} \${contract.customer?.last_name || ""}\`.trim() || "Kunde");`
);

// Conditionally render contract details (HTML view)
code = code.replace(
  `        <div class="detail-item">
          <div class="label">Vertragsende</div>
          <div class="value">\${fmtDate(contract.end_date)}</div>
        </div>
        \${durationText ? \`
        <div class="detail-item">
          <div class="label">Vertragslaufzeit</div>
          <div class="value">\${durationText}</div>
        </div>
        \` : ""}
        \${contract.annual_amount || contract.amount ? \`
        <div class="detail-item">
          <div class="label">Jahresbetrag</div>
          <div class="value highlight">CHF \${fmtCHF(Number(contract.annual_amount || contract.amount))}</div>
        </div>
        \` : ""}`,
  `        \${!contract.is_internal ? \`
        <div class="detail-item">
          <div class="label">Vertragsende</div>
          <div class="value">\${fmtDate(contract.end_date)}</div>
        </div>
        \${durationText ? \`
        <div class="detail-item">
          <div class="label">Vertragslaufzeit</div>
          <div class="value">\${durationText}</div>
        </div>
        \` : ""}
        \${contract.annual_amount || contract.amount ? \`
        <div class="detail-item">
          <div class="label">Jahresbetrag</div>
          <div class="value highlight">CHF \${fmtCHF(Number(contract.annual_amount || contract.amount))}</div>
        </div>
        \` : ""}
        \` : ""}`
);

// Conditionally render terms & conditions (HTML view)
code = code.replace(
  `    <!-- Terms & Conditions -->
    <div class="terms-card">
      <div class="card-title">Vertragsbedingungen</div>
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Kündigungsfrist</div>
          <div class="t-value">\${contract.notice_period_months || 3} \${(contract.notice_period_months || 3) === 1 ? "Monat" : "Monate"} zum Vertragsende</div>
        </div>
      </div>
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Zahlungsbedingungen</div>
          <div class="t-value">\${contract.payment_terms ? escHtml(contract.payment_terms) : "Jährliche Abrechnung, zahlbar innert 30 Tagen"}</div>
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
      </div>`,
  `    <!-- Terms & Conditions -->
    <div class="terms-card">
      <div class="card-title">Vertragsbedingungen</div>
      \${!contract.is_internal ? \`
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Kündigungsfrist</div>
          <div class="t-value">\${contract.notice_period_months || 3} \${(contract.notice_period_months || 3) === 1 ? "Monat" : "Monate"} zum Vertragsende</div>
        </div>
      </div>
      <div class="terms-item">
        <div class="terms-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div class="terms-text">
          <div class="t-label">Zahlungsbedingungen</div>
          <div class="t-value">\${contract.payment_terms ? escHtml(contract.payment_terms) : "Jährliche Abrechnung, zahlbar innert 30 Tagen"}</div>
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
      \` : ""}`
);

// Conditionally render print contract (Print view)
code = code.replace(
  `              <tr><td>Ende</td><td>\${fmtDate(contract.end_date)}</td></tr>
              \${durationText ? \`<tr><td>Laufzeit</td><td>\${durationText}</td></tr>\` : ""}
              \${(contract.annual_amount || contract.amount) ? \`<tr><td>Betrag p.a.</td><td>CHF \${fmtCHF(Number(contract.annual_amount || contract.amount))}</td></tr>\` : ""}
              <tr><td>Zahlung</td><td>\${contract.payment_terms ? escHtml(contract.payment_terms) : "30 Tage netto"}</td></tr>`,
  `              \${!contract.is_internal ? \`
              <tr><td>Ende</td><td>\${fmtDate(contract.end_date)}</td></tr>
              \${durationText ? \`<tr><td>Laufzeit</td><td>\${durationText}</td></tr>\` : ""}
              \${(contract.annual_amount || contract.amount) ? \`<tr><td>Betrag p.a.</td><td>CHF \${fmtCHF(Number(contract.annual_amount || contract.amount))}</td></tr>\` : ""}
              <tr><td>Zahlung</td><td>\${contract.payment_terms ? escHtml(contract.payment_terms) : "30 Tage netto"}</td></tr>
              \` : ""}`
);

code = code.replace(
  `        <table class="pc-terms-table">
          <tr><td>Kündigungsfrist</td><td>\${contract.notice_period_months || 3} \${(contract.notice_period_months || 3) === 1 ? "Monat" : "Monate"} zum Vertragsende</td></tr>
          <tr><td>Zahlungsbedingungen</td><td>\${contract.payment_terms ? escHtml(contract.payment_terms) : "Jährliche Abrechnung, zahlbar innert 30 Tagen"}</td></tr>
          <tr><td>Automatische Verlängerung</td><td>Bei Nichtkündigung verlängert sich der Vertrag automatisch um die gleiche Laufzeit</td></tr>
          \${contract.special_agreements ? \`<tr><td>Zusatzvereinbarungen</td><td>\${escHtml(contract.special_agreements)}</td></tr>\` : ""}
        </table>`,
  `        <table class="pc-terms-table">
          \${!contract.is_internal ? \`
          <tr><td>Kündigungsfrist</td><td>\${contract.notice_period_months || 3} \${(contract.notice_period_months || 3) === 1 ? "Monat" : "Monate"} zum Vertragsende</td></tr>
          <tr><td>Zahlungsbedingungen</td><td>\${contract.payment_terms ? escHtml(contract.payment_terms) : "Jährliche Abrechnung, zahlbar innert 30 Tagen"}</td></tr>
          <tr><td>Automatische Verlängerung</td><td>Bei Nichtkündigung verlängert sich der Vertrag automatisch um die gleiche Laufzeit</td></tr>
          \` : ""}
          \${contract.special_agreements ? \`<tr><td>Zusatzvereinbarungen</td><td>\${escHtml(contract.special_agreements)}</td></tr>\` : ""}
        </table>`
);

// Load employee
code = code.replace(
  `    const { data: contract, error: fetchErr } = await supabase
      .from("contracts")
      .select("*, customer:customers(company_name, first_name, last_name, email)")
      .eq("token", token)
      .single();`,
  `    const { data: contract, error: fetchErr } = await supabase
      .from("contracts")
      .select("*, customer:customers(company_name, first_name, last_name, email, street, address, zip, postal_code, city)")
      .eq("token", token)
      .single();
    
    let employee = null;
    if (contract && contract.is_internal && contract.employee_id) {
       const { data: emp } = await supabase.from('users').select('name, email').eq('id', contract.employee_id).single();
       employee = emp;
    }`
);

code = code.replace(
  `const html = renderPage(contract, supabaseUrl);`,
  `const html = renderPage(contract, supabaseUrl, employee);`
);

// Email notification customer details override handling
code = code.replace(
  `      // Notify admin
      const customerName = contract.customer?.company_name ||
        \`\${contract.customer?.first_name || ""} \${contract.customer?.last_name || ""}\`.trim() || "Kunde";`,
  `      // Notify admin
      const customerName = contract.is_internal ? (employee?.name || employee?.email || "Mitarbeiter") : (contract.customer?.company_name ||
        \`\${contract.customer?.first_name || ""} \${contract.customer?.last_name || ""}\`.trim() || "Kunde");`
);

code = code.replace(
  `    const customerName2 = contract.customer?.company_name ||
      \`\${contract.customer?.first_name || ""} \${contract.customer?.last_name || ""}\`.trim() || "Kunde";`,
  `    const customerName2 = contract.is_internal ? (employee?.name || employee?.email || "Mitarbeiter") : (contract.customer?.company_name ||
      \`\${contract.customer?.first_name || ""} \${contract.customer?.last_name || ""}\`.trim() || "Kunde");`
);

// Email attach generation
code = code.replace(
  `            const addressParts = [
              customerName,
              contract.customer?.street || contract.customer?.address,
              \`\${contract.customer?.zip || contract.customer?.postal_code || ""} \${contract.customer?.city || ""}\`.trim()
            ].filter(Boolean);

            pdfBase64 = generateContractPDF({
              title: contract.title,
              customerName,
              customerAddress: addressParts.join("\\n"),
              startDate: contract.start_date,
              endDate: contract.end_date,
              amount: Number(contract.annual_amount || contract.amount || 0),
              noticePeriodMonths: contract.notice_period_months || 3,
              description: contract.description || "",
              signatureName: sigName,`,
  `            const addressParts = contract.is_internal 
              ? [customerName, employee?.email].filter(Boolean)
              : [
              customerName,
              contract.customer?.street || contract.customer?.address,
              \`\${contract.customer?.zip || contract.customer?.postal_code || ""} \${contract.customer?.city || ""}\`.trim()
            ].filter(Boolean);

            pdfBase64 = generateContractPDF({
              title: contract.title,
              customerName,
              customerAddress: addressParts.join("\\n"),
              startDate: contract.start_date,
              endDate: contract.end_date,
              amount: Number(contract.annual_amount || contract.amount || 0),
              noticePeriodMonths: contract.notice_period_months || 3,
              description: contract.description || "",
              scopeOfServices: contract.scope_of_services || "",
              specialAgreements: contract.special_agreements || "",
              isInternal: contract.is_internal,
              signatureName: sigName,`
);

fs.writeFileSync(indexTsPath, code, 'utf8');


const pdfGenTsPath = 'c:/Users/stefa/Temp/gross-ict-kundenverwaltung/supabase/functions/contract-page/pdf-generator.ts';
let pdfCode = fs.readFileSync(pdfGenTsPath, 'utf8');

pdfCode = pdfCode.replace(
  `  description?: string;
  signatureName: string;`,
  `  description?: string;
  scopeOfServices?: string;
  specialAgreements?: string;
  isInternal?: boolean;
  signatureName: string;`
);

pdfCode = pdfCode.replace(
  `  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Laufzeit:", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(\`\${fmtDate(data.startDate)} – \${fmtDate(data.endDate)}\`, mValueX, metaY, { align: "right" });
  metaY += ls;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Jahresbetrag:", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cDarkGreen);
  doc.text(\`CHF \${fmtCHF(data.amount)}\`, mValueX, metaY, { align: "right" });
  metaY += ls;

  doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
  doc.text("Kündigungsfrist:", mLabelX, metaY);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
  doc.text(\`\${data.noticePeriodMonths} Monate\`, mValueX, metaY, { align: "right" });`,
  `  if (!data.isInternal) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text("Laufzeit:", mLabelX, metaY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(\`\${fmtDate(data.startDate)} – \${fmtDate(data.endDate)}\`, mValueX, metaY, { align: "right" });
    metaY += ls;

    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text("Jahresbetrag:", mLabelX, metaY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cDarkGreen);
    doc.text(\`CHF \${fmtCHF(data.amount)}\`, mValueX, metaY, { align: "right" });
    metaY += ls;

    doc.setFont("helvetica", "normal"); doc.setTextColor(...cTextMuted);
    doc.text("Kündigungsfrist:", mLabelX, metaY);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...cTextDark);
    doc.text(\`\${data.noticePeriodMonths} Monate\`, mValueX, metaY, { align: "right" });
  }`
);

pdfCode = pdfCode.replace(
  `  // 5. Contract description
  if (data.description) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(148, 163, 184);
    doc.text("VERTRAGSBESCHREIBUNG", marginX, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const safeDesc = data.description.replace(/<[^>]*>?/gm, '\\n');
    const descLines = doc.splitTextToSize(safeDesc, pageWidth - marginX * 2);
    for (const line of descLines) {
      doc.text(line, marginX, y);
      y += 4.5;
    }
    y += 8;
  }`,
  `  // 5. Contract description
  const fields = [
    { title: "BESCHREIBUNG", val: data.description },
    { title: "LEISTUNGSUMFANG", val: data.scopeOfServices },
    { title: "ZUSATZVEREINBARUNGEN", val: data.specialAgreements }
  ];

  for (const field of fields) {
    if (field.val) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(148, 163, 184);
      doc.text(field.title, marginX, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const safeDesc = field.val.replace(/<[^>]*>?/gm, '\\n');
      const lines = doc.splitTextToSize(safeDesc, pageWidth - marginX * 2);
      for (const line of lines) {
        doc.text(line, marginX, y);
        y += 4.5;
      }
      y += 8;
    }
  }`
);

fs.writeFileSync(pdfGenTsPath, pdfCode, 'utf8');

console.log("Success! Files mutated successfully.");
