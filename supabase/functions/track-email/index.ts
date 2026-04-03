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
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      }).catch(e => console.warn("[track-email] Push send failed:", e));
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
      // Anti-False-Positive: Prüfen ob die Rechnung erst vor weniger als 2 Minuten
      // gesendet wurde. E-Mail-Server (Resend, Gmail etc.) fetchen Tracking-Pixel
      // sofort nach der Zustellung für Spam-Checks – das ist kein echtes Öffnen.
      const { data: lastSent } = await supabase
        .from("invoice_activities")
        .select("created_at")
        .eq("invoice_id", id)
        .eq("type", "sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      if (lastSent && new Date(lastSent.created_at) > twoMinutesAgo) {
        // Zu kurz nach dem Senden – wahrscheinlich Server-Prefetch, ignorieren
        console.log(`[track-email] Invoice ${id}: Pixel within 2min of send, ignoring (server prefetch)`);
        return new Response(new Uint8Array(PIXEL), {
          headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store", ...corsHeaders },
        });
      }

      // Prüfen ob bereits als geöffnet markiert (kein zweites 'viewed' loggen für Push)
      const { data: alreadyViewed } = await supabase
        .from("invoice_activities")
        .select("id")
        .eq("invoice_id", id)
        .eq("type", "viewed")
        .limit(1)
        .maybeSingle();

      const isFirstView = !alreadyViewed;

      // Aktivität loggen
      await supabase.from("invoice_activities").insert({
        invoice_id: id,
        type: "viewed",
        description: "Rechnung wurde vom Empfänger geöffnet",
        user_name: "System",
      });

      // Status auf 'sent' setzen (Empfänger hat die E-Mail geöffnet)
      await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", id)
        .in("status", ["open"]); // Nur wenn aktuell 'open', nicht z.B. 'paid' zurücksetzen

      // Push nur beim ersten echten Öffnen senden
      if (isFirstView) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("invoice_number, customer:customers(company_name, first_name, last_name)")
          .eq("id", id)
          .single();

        if (invoice) {
          const customerName = invoice.customer?.company_name ||
            `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() || "Kunde";
          sendPushToAdmins(
            supabase,
            "📧 Rechnung geöffnet",
            `${customerName} hat die Rechnung ${invoice.invoice_number} geöffnet.`,
            `/invoice/${id}`,
            "invoices"
          );
        }
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
