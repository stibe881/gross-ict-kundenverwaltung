// Öffentlicher Endpoint für gross-ict.ch: liefert die aktiven
// Website-Referenzen aus dem CRM (Tabelle website_references).
// GET → { references: [...] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // 5 Minuten cachen, damit die Website schnell bleibt
      "Cache-Control": "public, max-age=300",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Nur GET" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("website_references")
      .select("name, titel, beschreibung, url, url_label, tags, bild_url, umgebung_bild_url")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return json({ references: data ?? [] });
  } catch (e) {
    console.error("website-referenzen:", e);
    return json({ error: "Referenzen konnten nicht geladen werden." }, 500);
  }
});
