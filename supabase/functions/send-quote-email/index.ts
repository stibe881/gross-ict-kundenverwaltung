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
    const { quoteId, pdfBase64 } = await req.json();
    if (!quoteId) return new Response(JSON.stringify({ error: "quoteId fehlt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*, customer:customers(*), items:quote_items(*)")
      .eq("id", quoteId)
      .single();

    if (quoteErr || !quote) {
      return new Response(JSON.stringify({ error: "Angebot nicht gefunden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!quote.customer?.email) {
      return new Response(JSON.stringify({ error: "Kunde hat keine E-Mail-Adresse" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PDF generieren falls nicht vom Client mitgeschickt
    let finalPdfBase64 = pdfBase64;
    if (!finalPdfBase64) {
      const { jsPDF } = await import("https://esm.sh/jspdf@2.5.2");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const marginLeft = 20;
      const marginRight = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;
      let y = 20;

      doc.setFontSize(16); doc.setTextColor(85, 85, 85);
      doc.text("Gross · ICT", marginLeft, y + 10);
      doc.setFontSize(18); doc.setTextColor(51, 51, 51);
      doc.text("ANGEBOT", pageWidth - marginRight, y + 10, { align: "right" });
      y += 22;

      doc.setFontSize(9);
      const companyRightX = pageWidth - marginRight;
      doc.setFont("helvetica", "bold"); doc.text("Gross ICT", companyRightX, y, { align: "right" }); y += 4;
      doc.setFont("helvetica", "normal");
      doc.text("Neuhushof 3", companyRightX, y, { align: "right" }); y += 4;
      doc.text("6144 Zell LU", companyRightX, y, { align: "right" }); y += 4;
      doc.text("Schweiz", companyRightX, y, { align: "right" }); y += 10;

      const customerName = quote.customer?.company_name ||
        `${quote.customer?.first_name || ""} ${quote.customer?.last_name || ""}`.trim() || "Unbekannt";
      doc.setFontSize(10); doc.text(customerName, marginLeft, y); y += 10;

      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Angebotsnummer: ${quote.quote_number}`, marginLeft, y); y += 5;
      doc.text(`Datum: ${fmtDate(quote.created_at)}`, marginLeft, y); y += 5;
      if (quote.valid_until) { doc.text(`Gültig bis: ${fmtDate(quote.valid_until)}`, marginLeft, y); y += 5; }
      y += 5;

      doc.setFont("helvetica", "bold");
      doc.text(`Total: CHF ${fmtCHF(quote.total)}`, marginLeft, y);

      const pdfArrayBuffer = doc.output("arraybuffer");
      let binary = "";
      const bytes = new Uint8Array(pdfArrayBuffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      finalPdfBase64 = btoa(binary);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const trackingUrl = `${supabaseUrl}/functions/v1/track-email?type=quote&id=${quoteId}`;
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none" alt="" />`;
    const quoteUrl = `https://angebote.gross-ict.ch/?id=${quoteId}`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Angebot ${quote.quote_number}</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Sehr geehrte Damen und Herren,</p>
        <p>vielen Dank für Ihr Interesse. Anbei erhalten Sie unser Angebot <strong>${quote.quote_number}</strong> über <strong>CHF ${fmtCHF(quote.total)}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Angebotsdatum:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${fmtDate(quote.created_at)}</td></tr>
          ${quote.valid_until ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Gültig bis:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${fmtDate(quote.valid_until)}</td></tr>` : ""}
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Gesamtbetrag:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #1a1a2e;">CHF ${fmtCHF(quote.total)}</td></tr>
        </table>
        
        <div style="margin: 32px 0; text-align: center; background: #fcfbf7; border: 1px dashed #D4A432; padding: 20px; border-radius: 8px;">
          <p style="margin: 0 0 16px 0; font-size: 15px; color: #1a1a2e; line-height: 1.5;">
            Sie können dieses Angebot direkt online prüfen und mit einem Klick akzeptieren:
          </p>
          <a href="${quoteUrl}" target="_blank" style="display: inline-block; background-color: #D4A432; color: #1a1a2e; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; box-shadow: 0 4px 12px rgba(212,164,50,0.25);">
            Angebot online ansehen & akzeptieren
          </a>
          <p style="margin: 12px 0 0 0; font-size: 11px; color: #666; line-height: 1.4;">
            Oder Link kopieren: <a href="${quoteUrl}" style="color: #D4A432; text-decoration: underline;">${quoteUrl}</a>
          </p>
        </div>

        <p>Das Angebot ist${quote.valid_until ? ` gültig bis zum <strong>${fmtDate(quote.valid_until)}</strong>.` : " unbefristet gültig."} Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Wir freuen uns auf Ihre Rückmeldung.</p>
        <p>Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
      ${trackingPixel}
    </div>`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY nicht konfiguriert" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Gross ICT <info@gross-ict.ch>",
        to: [quote.customer.email],
        subject: `Angebot ${quote.quote_number} - Gross ICT`,
        html,
        attachments: [{ filename: `Angebot_${quote.quote_number}.pdf`, content: finalPdfBase64 }],
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("[send-quote-email] Resend error:", errBody);
      let errorDetails = "Unbekannter Fehler";
      try {
        const parsed = JSON.parse(errBody);
        errorDetails = parsed.message || parsed.error?.message || errBody;
      } catch (e) {
        errorDetails = errBody;
      }
      return new Response(JSON.stringify({ error: `E-Mail konnte nicht gesendet werden: ${errorDetails}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Status auf "sent" setzen
    await supabase.from("quotes").update({ status: "sent" }).eq("id", quoteId);

    // Aktivität loggen
    await supabase.from("quote_activities").insert({
        quote_id: quoteId,
        type: "sent",
        description: `Angebot per E-Mail an ${quote.customer.email} gesendet.`,
        user_name: "System",
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[send-quote-email] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Interner Fehler" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
