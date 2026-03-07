import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(
      JSON.stringify({ error: "id fehlt" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Quote laden
    const { data: quote, error: fetchErr } = await supabase
      .from("quotes")
      .select("id, status, quote_number, customer:customers(email, company_name, first_name, last_name)")
      .eq("id", id)
      .single();

    if (fetchErr || !quote) {
      return new Response(
        JSON.stringify({ error: "Angebot nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prüfen ob bereits angenommen
    if (quote.status === "accepted") {
      return new Response(
        JSON.stringify({ success: true, message: "Angebot wurde bereits angenommen" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prüfen ob abgelaufen oder abgelehnt
    if (quote.status === "expired" || quote.status === "rejected") {
      return new Response(
        JSON.stringify({ error: "Dieses Angebot ist nicht mehr gültig" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Status auf "accepted" setzen
    const { error: updateErr } = await supabase
      .from("quotes")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[accept-quote] Update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Status konnte nicht aktualisiert werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional: E-Mail-Benachrichtigung an Gross ICT
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const customerName = (quote.customer as any)?.company_name ||
        `${(quote.customer as any)?.first_name || ""} ${(quote.customer as any)?.last_name || ""}`.trim() || "Kunde";

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Gross ICT <info@gross-ict.ch>",
            to: ["info@gross-ict.ch"],
            subject: `✅ Angebot ${quote.quote_number} angenommen – ${customerName}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                <h2 style="color:#22c55e;">Angebot angenommen! 🎉</h2>
                <p><strong>${customerName}</strong> hat das Angebot <strong>${quote.quote_number}</strong> soeben online angenommen.</p>
                <p style="color:#666;margin-top:16px;">Zeitpunkt: ${new Date().toLocaleString("de-CH")}</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("[accept-quote] Notification email failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[accept-quote] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Interner Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
