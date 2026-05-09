import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtCHF(amount: number): string {
  return amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1).toString().padStart(2, "0")}.${date.getFullYear()}`;
}

const LEVEL_LABELS = ["Zahlungserinnerung", "1. Mahnung", "2. Mahnung", "Betreibungsandrohung"];
const LEVEL_COLORS = ["#f59e0b", "#f97316", "#ef4444", "#dc2626"];

const TEXT_KEYS = ["text_reminder", "text_level1", "text_level2", "text_level3"];
const SUBJECT_KEYS = ["subject_reminder", "subject_level1", "subject_level2", "subject_level3"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id, pdfBase64, level = 0 } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "id fehlt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rechnung laden
    const { data: invoice, error: invoiceErr } = await supabase
      .from("invoices")
      .select("*, customer:customers(*), items:invoice_items(*)")
      .eq("id", id)
      .single();

    if (invoiceErr || !invoice) {
      return new Response(JSON.stringify({ error: "Rechnung nicht gefunden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!invoice.customer?.email) {
      return new Response(JSON.stringify({ error: "Kunde hat keine E-Mail-Adresse" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dunning-Settings laden
    const { data: settings } = await supabase.from("dunning_settings").select("*").limit(1).single();
    const { data: invoiceSettingsData } = await supabase.from("invoice_settings").select("*").limit(1).single();

    const remainingAmount = invoice.total - (invoice.paid_amount || 0);
    const dunningLevel = Math.min(Math.max(level, 0), 3);

    // Texte aus Settings oder Defaults
    const textKey = TEXT_KEYS[dunningLevel];
    const subjectKey = SUBJECT_KEYS[dunningLevel];
    let bodyText = settings?.[textKey] || "Bitte begleichen Sie die offene Rechnung.";
    let subject = settings?.[subjectKey] || `${LEVEL_LABELS[dunningLevel]}: Rechnung ${invoice.invoice_number}`;

    // Platzhalter ersetzen
    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{invoice_number\}/g, invoice.invoice_number)
        .replace(/\{amount\}/g, fmtCHF(remainingAmount))
        .replace(/\{due_date\}/g, fmtDate(invoice.due_date));

    bodyText = replacePlaceholders(bodyText);
    subject = replacePlaceholders(subject);

    // Bei Stufe 2: Mahngebühr hinzufügen
    let feeNote = "";
    if (dunningLevel === 2 && settings?.dunning_fee) {
      const fee = parseFloat(settings.dunning_fee);
      if (fee > 0) {
        // Mahngebühr als invoice_item hinzufügen
        await supabase.from("invoice_items").insert({
          invoice_id: id,
          description: "Mahngebühr",
          quantity: 1,
          unit_price: fee,
          vat_rate: 0,
          total: fee,
        });
        // Rechnungstotal aktualisieren
        await supabase.from("invoices").update({
          total: invoice.total + fee,
          subtotal: invoice.subtotal + fee,
        }).eq("id", id);

        feeNote = `<p style="background:#fef2f2;padding:12px;border-radius:8px;border:1px solid #fecaca;color:#dc2626;font-weight:bold;">Mahngebühr: CHF ${fmtCHF(fee)} wurde der Rechnung hinzugefügt.</p>`;
      }
    }

    // Bankverbindung aus Settings
    const bankName = invoiceSettingsData?.bank_name || "Luzerner Kantonalbank AG";
    const accountHolder = invoiceSettingsData?.account_holder || "Gross ICT";
    const iban = invoiceSettingsData?.iban || "CH32 0077 8229 1386 9200 1";

    const levelColor = LEVEL_COLORS[dunningLevel];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const trackingUrl = `${supabaseUrl}/functions/v1/track-email?type=invoice&id=${id}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${levelColor}; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">${LEVEL_LABELS[dunningLevel]} – Rechnung ${invoice.invoice_number}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>${bodyText.replace(/\n/g, "<br/>")}</p>
        ${feeNote}
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Rechnungsnummer:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoice.invoice_number}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Fälligkeitsdatum:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${fmtDate(invoice.due_date)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Offener Betrag:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: ${levelColor};">CHF ${fmtCHF(remainingAmount + (dunningLevel === 2 ? parseFloat(settings?.dunning_fee || "0") : 0))}</td></tr>
        </table>
        <p>Bitte überweisen Sie den ausstehenden Betrag auf folgendes Konto:</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 4px;"><strong>Zahlungsempfänger:</strong> ${accountHolder}</p>
          <p style="margin: 0 0 4px;"><strong>Bank:</strong> ${bankName}</p>
          <p style="margin: 0;"><strong>IBAN:</strong> ${iban}</p>
        </div>
        <p>${invoiceSettingsData?.closing_text || "Freundliche Grüsse"}<br/><strong>Gross ICT</strong></p>
      </div>
      ${trackingPixel}
    </div>`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY nicht konfiguriert" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailPayload: any = {
      from: "Gross ICT <info@gross-ict.ch>",
      to: [invoice.customer.email],
      subject: subject + " - Gross ICT",
      html,
    };

    if (pdfBase64) {
      emailPayload.attachments = [{ filename: `Rechnung_${invoice.invoice_number}.pdf`, content: pdfBase64 }];
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("[send-reminder-email] Resend error:", errBody);
      return new Response(JSON.stringify({ error: "Mahnung konnte nicht gesendet werden" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dunning History eintragen
    await supabase.from("invoice_dunning_history").insert({
      invoice_id: id,
      dunning_level: dunningLevel,
      email_to: invoice.customer.email,
      notes: `${LEVEL_LABELS[dunningLevel]} gesendet`,
    });

    // Invoice dunning_level aktualisieren
    await supabase.from("invoices").update({
      dunning_level: dunningLevel,
      last_dunning_at: new Date().toISOString(),
      status: "overdue",
    }).eq("id", id);

    // Aktivität loggen
    await supabase.from("invoice_activities").insert({
      invoice_id: id,
      type: "reminder_sent",
      description: `${LEVEL_LABELS[dunningLevel]} per E-Mail an ${invoice.customer.email} gesendet`,
      user_name: "System",
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[send-reminder-email] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Interner Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
