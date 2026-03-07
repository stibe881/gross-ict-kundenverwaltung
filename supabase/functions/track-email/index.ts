import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent GIF pixel
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // "invoice" or "quote"
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
      await supabase.from("invoice_activities").insert({
        invoice_id: id,
        type: "viewed",
        description: "Rechnung wurde vom Empfänger geöffnet",
        user_name: "System",
      });
    }
    // Für quotes: könnte man ebenfalls eine quote_activities Tabelle nutzen

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
