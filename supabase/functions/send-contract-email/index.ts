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
    const { contractId } = await req.json();
    if (!contractId) {
      return new Response(JSON.stringify({ error: "contractId fehlt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Vertrag mit Kundendaten laden
    const { data: contract, error: contractErr } = await supabase
      .from("contracts")
      .select("*, customer:customers(*)")
      .eq("id", contractId)
      .single();

    if (contractErr || !contract) {
      return new Response(JSON.stringify({ error: "Vertrag nicht gefunden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!contract.customer?.email) {
      return new Response(JSON.stringify({ error: "Kunde hat keine E-Mail-Adresse" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Token generieren falls noch keins existiert
    let token = contract.token;
    if (!token) {
      token = crypto.randomUUID();
      await supabase.from("contracts").update({ token }).eq("id", contractId);
    }

    const fmtDate = (d: string) => {
      if (!d) return "-";
      const parts = d.split("-");
      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
    };

    const fmtCHF = (amount: number) =>
      amount.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const customerName = contract.customer?.company_name ||
      `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde";

    // Signing-URL: Custom Subdomain on Hetzner
    const signUrl = `https://vertrag.gross-ict.ch/?token=${token}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY nicht konfiguriert" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #CAFF5A 0%, #22c55e 100%); padding: 28px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 22px; color: #111;">Gross ICT</h1>
        <p style="margin: 6px 0 0; color: #333; font-size: 14px;">Vertrag zur digitalen Unterzeichnung</p>
      </div>
      <div style="padding: 28px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; background: #ffffff;">
        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          Guten Tag ${customerName},
        </p>
        <p style="color: #333; font-size: 15px; line-height: 1.6;">
          wir haben einen Vertrag für Sie vorbereitet, den Sie bequem online einsehen und digital unterzeichnen können.
        </p>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #e5e5e5;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 13px;">Vertrag:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #111; font-size: 14px;">${contract.title}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 13px;">Laufzeit:</td>
              <td style="padding: 6px 0; text-align: right; color: #111; font-size: 14px;">${fmtDate(contract.start_date)} – ${fmtDate(contract.end_date)}</td>
            </tr>
            ${contract.annual_amount ? `<tr>
              <td style="padding: 6px 0; color: #666; font-size: 13px;">Jahresbetrag:</td>
              <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #22c55e; font-size: 14px;">CHF ${fmtCHF(Number(contract.annual_amount))}</td>
            </tr>` : ""}
            <tr>
              <td style="padding: 6px 0; color: #666; font-size: 13px;">Kündigungsfrist:</td>
              <td style="padding: 6px 0; text-align: right; color: #111; font-size: 14px;">${contract.notice_period_months || 3} Monate</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${signUrl}" style="display: inline-block; background: #CAFF5A; color: #111; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
            ✍️ Vertrag ansehen & unterzeichnen
          </a>
        </div>

        <p style="color: #666; font-size: 13px; line-height: 1.5;">
          Mit einem Klick auf den Button können Sie den Vertrag einsehen und durch Eingabe Ihres Namens digital unterzeichnen.
          Die Unterzeichnung ist rechtsverbindlich. Falls Sie Fragen haben, kontaktieren Sie uns gerne.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #333; font-size: 14px;">Freundliche Grüsse<br/><strong>Gross ICT</strong></p>
      </div>
    </div>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Gross ICT <info@gross-ict.ch>",
        to: [contract.customer.email],
        subject: `Vertrag "${contract.title}" zur Unterzeichnung – Gross ICT`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("[send-contract-email] Resend error:", errBody);
      return new Response(JSON.stringify({ error: "E-Mail konnte nicht gesendet werden" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Status auf "pending_signature" setzen
    await supabase.from("contracts").update({
      status: "pending_signature",
    }).eq("id", contractId);

    return new Response(JSON.stringify({ success: true, token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-contract-email] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Interner Fehler" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
