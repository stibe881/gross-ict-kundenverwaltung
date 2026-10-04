// Cross-Selling-Analyse: Claude prüft Kunden, Verträge und Produktkatalog
// und schlägt vor, welchem Kunden welches Angebot fehlt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

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

function customerName(c: any): string {
  return c?.company_name || `${c?.first_name || ""} ${c?.last_name || ""}`.trim() || "Unbekannt";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY ist nicht konfiguriert." }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [customersRes, contractsRes, productsRes] = await Promise.all([
      supabase.from("customers").select("id, company_name, first_name, last_name").eq("status", "active").limit(100),
      supabase.from("contracts").select("customer_id, title, status").eq("status", "active").limit(300),
      supabase.from("products").select("name, description, type, price, unit").eq("is_active", true).limit(100),
    ]);

    const customers = customersRes.data || [];
    const contracts = contractsRes.data || [];
    const products = productsRes.data || [];

    const lines = customers.map((c: any) => {
      const own = contracts.filter((k: any) => k.customer_id === c.id).map((k: any) => k.title).join(", ");
      return `- [${c.id}] ${customerName(c)}: Verträge: ${own || "keine"}`;
    }).join("\n");

    const catalog = products.map((p: any) => `- ${p.name} (${p.type || "Dienstleistung"}): ${p.description || ""}`).join("\n");

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: `Du bist Vertriebsberater eines Schweizer IT-Dienstleisters (Gross ICT).
Analysiere, welchen aktiven Kunden sinnvolle Zusatzleistungen fehlen (Cross-Selling).
Typische Muster: Hosting ohne Wartungsvertrag, Microsoft 365 ohne Backup, Webseite ohne Überwachung/SSL-Monitoring, Geräte ohne Supportvertrag.
Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown:
{"suggestions": [{"customerId": "...", "customer": "...", "idea": "kurzer Vorschlag", "reason": "1 Satz Begründung"}]}
Maximal 10 Vorschläge, nur wirklich plausible. Sprache: Schweizer Hochdeutsch ohne ß.`,
      messages: [{
        role: "user",
        content: `Kunden und ihre aktiven Verträge:\n${lines}\n\nUnser Leistungskatalog:\n${catalog || "(leer)"}`,
      }],
    });

    if (response.stop_reason === "refusal") return json({ suggestions: [] });

    const text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ suggestions: [] });
    const parsed = JSON.parse(match[0]);

    return json({ suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 10) : [] });
  } catch (e) {
    console.error("[cross-sell]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
