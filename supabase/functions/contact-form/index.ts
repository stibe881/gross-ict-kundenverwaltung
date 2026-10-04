// Website-Kontaktformular → Lead: öffentlicher Endpoint für gross-ict.ch.
// POST { name, email, phone?, company?, message?, website? }
// "website" ist ein Honeypot-Feld: Menschen lassen es leer, Bots füllen es aus.
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
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const company = String(body.company || "").trim();
    const message = String(body.message || "").trim();
    const honeypot = String(body.website || "").trim();

    // Honeypot gefüllt → Bot: freundlich tun, nichts speichern
    if (honeypot) return json({ success: true });

    if (!name || !email || !/.+@.+\..+/.test(email)) {
      return json({ error: "Bitte Name und gültige E-Mail angeben." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Doppel-Anfragen derselben Adresse innert 10 Minuten verwerfen
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("leads")
      .select("id")
      .eq("email", email)
      .gte("created_at", tenMinAgo)
      .limit(1);
    if (recent && recent.length > 0) return json({ success: true });

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        name,
        company: company || null,
        email,
        phone: phone || null,
        status: "new",
        source: "Website",
        priority: "high",
        notes: message ? `Anfrage über das Kontaktformular:\n\n${message}` : "Anfrage über das Kontaktformular",
        next_action: "Rückmeldung auf Website-Anfrage",
        next_action_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Push an alle Admins: schnelle Reaktion gewinnt den Auftrag
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: "all_admins",
          recipientType: "admin",
          title: "🔥 Neue Website-Anfrage",
          body: `${name}${company ? ` (${company})` : ""}${message ? `: ${message.slice(0, 100)}` : ""}`,
          data: { url: `/leads?leadId=${lead.id}`, category: "lead_reminders" },
        }),
      });
    } catch (_) { /* Push ist Komfort */ }

    return json({ success: true });
  } catch (e) {
    console.error("[contact-form]", e);
    return json({ error: "Anfrage konnte nicht gespeichert werden." }, 500);
  }
});
