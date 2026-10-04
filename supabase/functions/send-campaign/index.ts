// E-Mail-Kampagne light: Info-Mail an gefilterte Kundengruppe via Resend,
// mit Abmelde-Link (bestehende newsletter-optout-Funktion) und Versandprotokoll.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { subject, body, recipients } = await req.json();
    if (!subject || !body || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "subject, body und recipients sind erforderlich" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (recipients.length > 200) {
      return new Response(JSON.stringify({ error: "Maximal 200 Empfänger pro Kampagne" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY nicht konfiguriert" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const baseUrl = Deno.env.get("SUPABASE_URL")!;

    let sent = 0;
    const failed: string[] = [];

    for (const r of recipients) {
      if (!r?.email) continue;
      const unsubscribeUrl = `${baseUrl}/functions/v1/newsletter-optout?user=${r.id}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px 12px 0 0;">
            <span style="color: #fff; font-size: 18px; font-weight: bold;">Gross ICT</span>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 14px;">Guten Tag ${r.name || ""}</p>
            <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${String(body)
              .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Freundliche Grüsse<br/>Gross ICT</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
            <p style="font-size: 11px; color: #9ca3af;">
              Sie erhalten diese E-Mail als Kunde von Gross ICT.
              <a href="${unsubscribeUrl}" style="color: #9ca3af;">Von Info-Mails abmelden</a>
            </p>
          </div>
        </div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Gross ICT <info@gross-ict.ch>",
          to: [r.email],
          subject,
          html,
        }),
      });
      if (res.ok) sent++;
      else {
        failed.push(r.email);
        console.error("[send-campaign] Resend-Fehler für", r.email, await res.text());
      }
      // Resend-Rate-Limit (2/s) respektieren
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    await supabase.from("email_campaigns").insert({
      subject,
      body,
      recipient_count: sent,
      recipients: recipients.map((r: any) => ({ email: r.email, name: r.name })),
    });

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-campaign]", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
