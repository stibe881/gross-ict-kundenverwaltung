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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id, pdfBase64 } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "id fehlt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const remainingAmount = invoice.total - (invoice.paid_amount || 0);

    if (!pdfBase64) {
      console.warn("[send-reminder-email] Kein PDF vom Client erhalten, sende ohne Anhang");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const trackingUrl = `${supabaseUrl}/functions/v1/track-email?type=invoice&id=${id}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Zahlungserinnerung – Rechnung ${invoice.invoice_number}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Sehr geehrte Damen und Herren,</p>
        <p>wir möchten Sie freundlich daran erinnern, dass die Rechnung <strong>${invoice.invoice_number}</strong>
           über <strong>CHF ${fmtCHF(remainingAmount)}</strong> seit dem <strong>${fmtDate(invoice.due_date)}</strong> fällig ist.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Rechnungsnummer:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoice.invoice_number}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Rechnungsdatum:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${fmtDate(invoice.invoice_date)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Fälligkeitsdatum:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${fmtDate(invoice.due_date)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Offener Betrag:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #dc2626;">CHF ${fmtCHF(remainingAmount)}</td></tr>
        </table>
        <p>Bitte überweisen Sie den ausstehenden Betrag auf folgendes Konto:</p>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 4px;"><strong>Kontoinhaber:</strong> Stefan Gross</p>
          <p style="margin: 0 0 4px;"><strong>Bank:</strong> Bank Cler AG</p>
          <p style="margin: 0 0 4px;"><strong>IBAN:</strong> CH39 0844 0261 0416 9200 1</p>
          <p style="margin: 0;"><strong>Konto:</strong> 2610.4169.200</p>
        </div>
        <p>Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
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
      subject: `Zahlungserinnerung: Rechnung ${invoice.invoice_number} - Gross ICT`,
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

    await supabase.from("invoice_activities").insert({
      invoice_id: id,
      type: "reminder_sent",
      description: `Zahlungserinnerung per E-Mail an ${invoice.customer.email} gesendet`,
      user_name: "System",
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[send-reminder-email] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Interner Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
