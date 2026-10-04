// Willkommenspaket: sendet die konfigurierbare Willkommens-Mail an einen
// neuen Kunden. Ein-/ausschaltbar und anpassbar in den Einstellungen
// (marketing_settings: welcome_enabled, welcome_subject, welcome_body).
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
    const { customerId } = await req.json();
    if (!customerId) return json({ error: "customerId fehlt" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await supabase.from("marketing_settings").select("key, value");
    const settings: Record<string, string> = {};
    for (const r of settingsRows || []) settings[r.key] = r.value;

    if (settings.welcome_enabled !== "true") {
      return json({ skipped: true, reason: "Willkommenspaket ist deaktiviert" });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, company_name, first_name, last_name, email")
      .eq("id", customerId)
      .single();
    if (!customer?.email) return json({ skipped: true, reason: "Kunde hat keine E-Mail" });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return json({ error: "RESEND_API_KEY nicht konfiguriert" }, 500);

    const name = customer.company_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    const subject = (settings.welcome_subject || "Herzlich willkommen bei Gross ICT").replace(/\{name\}/g, name);
    const bodyText = (settings.welcome_body ||
      "Guten Tag {name}\n\nHerzlich willkommen bei Gross ICT! Wir freuen uns auf die Zusammenarbeit.\n\nBei Fragen sind wir jederzeit für Sie da.\n\nFreundliche Grüsse\nGross ICT"
    ).replace(/\{name\}/g, name);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <span style="color: #fff; font-size: 18px; font-weight: bold;">Gross ICT</span>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${bodyText
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Gross ICT <info@gross-ict.ch>",
        to: [customer.email],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[send-welcome] Resend:", await res.text());
      return json({ error: "Mail konnte nicht gesendet werden" }, 500);
    }

    return json({ success: true, to: customer.email });
  } catch (e) {
    console.error("[send-welcome]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
