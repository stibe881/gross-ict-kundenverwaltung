// Ticket-Antwort per E-Mail an den Kunden senden (Resend).
// Der Betreff enthält den Marker [TKT-xxxxxxxx]; Antworten des Kunden werden
// von inbound-email über diesen Marker wieder dem Ticket zugeordnet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticket_id, message, user_name } = await req.json();
    if (!ticket_id || !message) return json({ error: "ticket_id und message erforderlich" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY nicht konfiguriert" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("id, title, customer_id, customer:customers(company_name, first_name, last_name, email)")
      .eq("id", ticket_id)
      .single();
    if (error || !ticket) return json({ error: "Ticket nicht gefunden" }, 404);

    const cust = ticket.customer as any;
    let toEmail: string | null = cust?.email || null;

    // Fallback: E-Mail eines Portal-Benutzers des Kunden
    if (!toEmail && ticket.customer_id) {
      const { data: portalUser } = await supabase
        .from("customer_portal_users")
        .select("email")
        .eq("customer_id", ticket.customer_id)
        .limit(1)
        .maybeSingle();
      toEmail = portalUser?.email || null;
    }
    if (!toEmail) return json({ error: "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt." }, 400);

    const marker = `[TKT-${String(ticket.id).substring(0, 8)}]`;
    const contact = [cust?.first_name, cust?.last_name].filter(Boolean).join(" ");
    const anrede = contact ? `Guten Tag ${contact}` : "Guten Tag";
    const htmlMessage = String(message)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Gross ICT Support <info@gross-ict.ch>",
        to: [toEmail],
        subject: `Re: ${ticket.title} ${marker}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 560px;">
            <p>${anrede}</p>
            <p>${htmlMessage}</p>
            <p style="color:#888; font-size:12px; margin-top:24px;">
              Sie können direkt auf diese E-Mail antworten – Ihre Antwort wird automatisch
              dem Ticket zugeordnet. Bitte lassen Sie dazu den Betreff unverändert.
            </p>
            <p>Freundliche Grüsse<br>${user_name || "Ihr Gross ICT Team"}<br>Gross ICT</p>
          </div>`,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `E-Mail-Versand fehlgeschlagen: ${errText}` }, 502);
    }

    return json({ success: true, to: toEmail });
  } catch (e) {
    console.error("[send-ticket-email]", e);
    return json({ error: (e as Error)?.message || "Unbekannter Fehler" }, 500);
  }
});
