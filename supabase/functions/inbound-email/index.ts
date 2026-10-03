// E-Mail → Ticket: Webhook-Endpoint für eingehende Support-Mails.
// Funktioniert mit Resend Inbound (event "email.received") und mit jedem
// Dienst, der ein einfaches JSON {from, subject, text|html} POSTet
// (z.B. Cloudflare Email Worker).
//
// Absicherung: Secret INBOUND_SECRET setzen und die Webhook-URL mit
// ?secret=<wert> konfigurieren.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEmailAddress(from: string): string {
  const m = (from || "").match(/<([^>]+)>/);
  return (m ? m[1] : from || "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const secret = Deno.env.get("INBOUND_SECRET");
  if (secret && url.searchParams.get("secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // Resend Inbound: { type: "email.received", data: { from, subject, text, html } }
    // Generisch: { from, subject, text|html }
    const mail = body?.type === "email.received" ? body.data : body;
    const fromRaw = typeof mail?.from === "string" ? mail.from : mail?.from?.email || "";
    const fromEmail = extractEmailAddress(fromRaw);
    const subject = (mail?.subject || "").trim() || "E-Mail ohne Betreff";
    const text = (mail?.text || "").trim() || stripHtml(mail?.html || "") || "(kein Inhalt)";

    if (!fromEmail) {
      return new Response(JSON.stringify({ error: "Kein Absender" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Threading: Enthält der Betreff einen Ticket-Marker [TKT-xxxxxxxx],
    // wird die Mail als Kommentar an das bestehende Ticket angehängt.
    const markerMatch = subject.match(/\[TKT-([0-9a-fA-F]{8})\]/);
    if (markerMatch) {
      const idPrefix = markerMatch[1].toLowerCase();
      const { data: candidates } = await supabase.rpc("find_ticket_by_prefix", { prefix: idPrefix });
      const existing = candidates?.[0];
      if (existing) {
        await supabase.from("ticket_comments").insert({
          ticket_id: existing.id,
          comment: `${text.substring(0, 4000)}\n\n—\nPer E-Mail geantwortet von: ${fromRaw || fromEmail}`,
          user_name: fromEmail,
          is_internal: false,
        });
        // Geschlossene Tickets bei Kundenantwort wieder öffnen
        if (existing.status === "closed") {
          await supabase.from("tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", existing.id);
        }
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              recipients: "all_admins", recipientType: "admin",
              title: "Antwort auf Ticket",
              body: `${existing.title} – neue E-Mail-Antwort von ${fromEmail}`,
              data: { url: `/tickets?ticketId=${existing.id}`, category: "tickets" },
            }),
          });
        } catch (e) { console.error("[inbound-email] Push fehlgeschlagen:", e); }

        return new Response(JSON.stringify({ success: true, ticket_id: existing.id, threaded: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Kunde über Absenderadresse finden (customers.email oder Portal-Benutzer)
    let customerId: string | null = null;
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .ilike("email", fromEmail)
      .limit(1)
      .maybeSingle();
    if (customer) customerId = customer.id;
    if (!customerId) {
      const { data: portalUser } = await supabase
        .from("customer_portal_users")
        .select("customer_id")
        .ilike("email", fromEmail)
        .limit(1)
        .maybeSingle();
      if (portalUser?.customer_id) customerId = portalUser.customer_id;
    }

    // Abdeckung durch aktiven Vertrag prüfen (gleiche Automatik wie in der App)
    let covered = false;
    if (customerId) {
      const { count } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .eq("status", "active")
        .is("cancellation_date", null);
      covered = (count || 0) > 0;
    }

    const description = `${text.substring(0, 4000)}\n\n—\nPer E-Mail eingegangen von: ${fromRaw || fromEmail}`;
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        title: subject.substring(0, 200),
        description,
        status: "open",
        priority: "medium",
        customer_id: customerId,
        covered_by_contract: covered,
      })
      .select()
      .single();
    if (error) throw error;

    // Push an Admins
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Neues Ticket per E-Mail",
          body: `${subject} – von ${fromEmail}${customerId ? "" : " (Kunde nicht zugeordnet)"}`,
          data: { url: `/tickets?ticketId=${ticket.id}`, category: "tickets" },
        }),
      });
    } catch (e) { console.error("[inbound-email] Push fehlgeschlagen:", e); }

    return new Response(JSON.stringify({ success: true, ticket_id: ticket.id, customer_matched: !!customerId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[inbound-email] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
