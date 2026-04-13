import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent GIF pixel
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

async function sendPushToAdmins(supabase: any, title: string, body: string, url: string, category?: string) {
  try {
    const { data: admins } = await supabase
      .from("users")
      .select("id, push_token, push_preferences")
      .not("push_token", "is", null);

    if (!admins || admins.length === 0) return;

    const messages: any[] = [];
    for (const a of admins) {
      if (!a.push_token) continue;
      // Check push_preferences (opt-out: missing key = enabled)
      if (category && a.push_preferences && a.push_preferences[category] === false) continue;
      const tokens = a.push_token.split(",").map((t: string) => t.trim()).filter(Boolean);
      for (const t of tokens) {
        if (t.startsWith("ExponentPushToken")) {
          messages.push({ to: t, sound: "default", title, body, data: { url, category } });
        }
      }
    }

    if (messages.length > 0) {
      try {
        const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages),
        });
        console.log(`[track-email] Push sent: ${pushRes.status}`, await pushRes.text());
      } catch (e) {
        console.warn("[track-email] Push send failed:", e);
      }
    }
  } catch (err) {
    console.warn("[track-email] Push error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // "invoice", "quote", or "contract"
    const id = url.searchParams.get("id");

    if (!id || !type) {
      return new Response(new Uint8Array(PIXEL), {
        headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (type === "invoice") {
      // Anti-False-Positive: E-Mail-Server fetchen Tracking-Pixel sofort nach
      // Zustellung für Spam-Checks – 30s Verzögerung filtert diese heraus.
      const { data: lastSent } = await supabase
        .from("invoice_activities")
        .select("created_at")
        .eq("invoice_id", id)
        .eq("type", "sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      if (lastSent && new Date(lastSent.created_at) > thirtySecondsAgo) {
        console.log(`[track-email] Invoice ${id}: Pixel within 30s of send, ignoring (server prefetch)`);
        return new Response(new Uint8Array(PIXEL), {
          headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store", ...corsHeaders },
        });
      }

      // Aktivität loggen
      const { error: activityError } = await supabase.from("invoice_activities").insert({
        invoice_id: id,
        type: "viewed",
        description: "Rechnung wurde vom Empfänger geöffnet",
        user_name: "System",
      });
      console.log(`[track-email] Invoice ${id}: Activity logged`, activityError ? `Error: ${activityError.message}` : "OK");

      // Status auf 'sent' setzen (Empfänger hat die E-Mail geöffnet)
      await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", id)
        .in("status", ["open"]); // Nur wenn aktuell 'open', nicht z.B. 'paid' zurücksetzen

      // Push bei jedem echten Öffnen senden
      const { data: invoice } = await supabase
        .from("invoices")
        .select("invoice_number, customer:customers(company_name, first_name, last_name)")
        .eq("id", id)
        .single();

      if (invoice) {
        const customerName = invoice.customer?.company_name ||
          `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() || "Kunde";
        console.log(`[track-email] Sending push for invoice ${invoice.invoice_number} (${customerName})`);
        await sendPushToAdmins(
          supabase,
          "📧 Rechnung geöffnet",
          `${customerName} hat die Rechnung ${invoice.invoice_number} geöffnet.`,
          `/invoice/${id}`,
          "invoices"
        );
      } else {
        console.log(`[track-email] Invoice ${id} not found in DB`);
      }
    }

    if (type === "quote") {
      // Get quote details for push notification
      const { data: quote } = await supabase
        .from("quotes")
        .select("quote_number, customer:customers(company_name, first_name, last_name)")
        .eq("id", id)
        .single();

      if (quote) {
        const customerName = quote.customer?.company_name ||
          `${quote.customer?.first_name || ""} ${quote.customer?.last_name || ""}`.trim() || "Kunde";
        sendPushToAdmins(
          supabase,
          "📋 Angebot geöffnet",
          `${customerName} hat das Angebot ${quote.quote_number} geöffnet.`,
          "/quotes",
          "quotes"
        );
      }
    }

    if (type === "contract") {
      // Get contract details for push notification
      const { data: contract } = await supabase
        .from("contracts")
        .select("title, customer:customers(company_name, first_name, last_name)")
        .eq("id", id)
        .single();

      if (contract) {
        const customerName = contract.customer?.company_name ||
          `${contract.customer?.first_name || ""} ${contract.customer?.last_name || ""}`.trim() || "Kunde";
        sendPushToAdmins(
          supabase,
          "📄 Vertrag geöffnet",
          `${customerName} hat den Vertrag "${contract.title}" geöffnet.`,
          "/contracts",
          "invoices"
        );
      }
    }

    if (type === "newsletter") {
      // Basic open tracking (increments total opens)
      // Retrieve current opened_count
      const { data: campaign } = await supabase
        .from("newsletter_campaigns")
        .select("opened_count")
        .eq("id", id)
        .single();
      
      if (campaign) {
        await supabase
          .from("newsletter_campaigns")
          .update({ opened_count: (campaign.opened_count || 0) + 1 })
          .eq("id", id);
      }
    }

    return new Response(new Uint8Array(PIXEL), {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("[track-email] Error:", err);
    return new Response(new Uint8Array(PIXEL), {
      headers: { "Content-Type": "image/gif", ...corsHeaders },
    });
  }
});
