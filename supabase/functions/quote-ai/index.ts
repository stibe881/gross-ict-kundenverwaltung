// KI-Angebotstexte: aus Stichworten einen Einleitungstext und Positionsvorschläge
// generieren. Nutzt den Produktkatalog als Preisreferenz.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { keywords, customerName } = await req.json();
    if (!keywords || String(keywords).trim().length < 3) {
      return json({ error: "Bitte Stichworte angeben." }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY ist nicht konfiguriert." }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Produktkatalog als Preisreferenz
    const { data: products } = await supabase
      .from("products")
      .select("name, description, price, unit, type")
      .eq("is_active", true)
      .limit(100);

    const catalog = (products || [])
      .map((p: any) => `- ${p.name} (${p.unit || "Stk."}, CHF ${p.price}): ${p.description || ""}`)
      .join("\n");

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1500,
      output_config: { effort: "low" },
      system: `Du hilfst einem Schweizer IT-Dienstleister (Gross ICT), Angebote zu schreiben.
Antworte AUSSCHLIESSLICH mit gültigem JSON in genau diesem Format, ohne Markdown:
{"intro": "...", "items": [{"description": "...", "quantity": 1, "unit": "Stk.", "unitPrice": 0}]}

Regeln:
- "intro": höflicher Einleitungstext fürs Angebot (3-5 Sätze, Sie-Form, Schweizer Hochdeutsch ohne ß)${customerName ? `, gerichtet an ${customerName}` : ""}.
- "items": 2-8 sinnvolle Angebotspositionen zu den Stichworten. Beschreibungen konkret und kundentauglich.
- Nutze Preise aus dem Produktkatalog, wenn eine Position dazu passt; sonst realistische Schweizer Marktpreise (IT-Dienstleistung ca. CHF 120-150/h).
- Mengen realistisch schätzen (z.B. Stunden für Arbeitsschritte).

Produktkatalog:
${catalog || "(leer)"}`,
      messages: [{ role: "user", content: `Stichworte für das Angebot: ${keywords}` }],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "Die KI konnte zu diesen Stichworten keinen Text erstellen." }, 422);
    }

    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    // JSON herauslösen (falls die Antwort doch Zusatztext enthält)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Unerwartetes Antwortformat." }, 500);
    const parsed = JSON.parse(match[0]);

    return json({
      intro: String(parsed.intro || ""),
      items: Array.isArray(parsed.items)
        ? parsed.items.map((i: any) => ({
            description: String(i.description || ""),
            quantity: Number(i.quantity) || 1,
            unit: String(i.unit || "Stk."),
            unitPrice: Number(i.unitPrice) || 0,
          }))
        : [],
    });
  } catch (e) {
    console.error("[quote-ai]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
