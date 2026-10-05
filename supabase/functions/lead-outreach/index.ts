// Erstkontakt-Mail für einen Lead: KI generiert eine personalisierte
// E-Mail aus Lead-Daten und Website-Analyse; optional direkt via Resend
// versenden. action: "generate" | "send"
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

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, leadId, subject, body, mode } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (!lead) return json({ error: "Lead nicht gefunden." }, 404);

    if (action === "send") {
      if (!lead.email) return json({ error: "Der Lead hat keine E-Mail-Adresse." }, 400);
      if (!subject || !body) return json({ error: "Betreff und Text fehlen." }, 400);

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) return json({ error: "RESEND_API_KEY ist nicht konfiguriert." }, 500);

      const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#1f2430;">
  <div style="background:#1C1D27;padding:18px 24px;border-radius:12px 12px 0 0;">
    <span style="color:#C19A6B;font-size:17px;font-weight:700;">Gross ICT</span>
  </div>
  <div style="border:1px solid #e3e3e8;border-top:none;border-radius:0 0 12px 12px;padding:24px;font-size:14.5px;line-height:1.65;">
    ${escapeHtml(String(body)).replace(/\n/g, "<br>")}
  </div>
</div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Gross ICT <info@gross-ict.ch>",
          to: [lead.email],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        console.error("[lead-outreach] Resend-Fehler:", await res.text());
        return json({ error: "Versand fehlgeschlagen." }, 500);
      }

      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        type: "system",
        content: `Erstkontakt-Mail gesendet an ${lead.email}: «${subject}»`,
        user_name: "System",
      });
      return json({ ok: true });
    }

    // action: "generate"
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY ist nicht konfiguriert." }, 500);

    const wc = lead.web_check || null;
    const webInfo = wc
      ? `Website-Check (${lead.website}): SSL ${wc.sslValid ? "ok" : "FEHLT"}, Impressum ${wc.hasImpressum ? "ok" : "FEHLT"}, Datenschutzerklärung ${wc.hasPrivacy ? "ok" : "FEHLT"}, Mobil-Optimierung ${wc.isResponsive ? "ok" : "FEHLT"}`
      : lead.website
        ? `Website: ${lead.website} (noch nicht analysiert)`
        : "Keine Website bekannt.";

    const isCall = mode === "call";
    const systemPrompt = isCall
      ? `Du schreibst für Gross ICT (Schweizer IT-Dienstleister & Webagentur, Inhaber Stefan Gross) einen Gesprächseinstieg für ein Erstkontakt-Telefonat mit einem potenziellen Kunden.
Antworte AUSSCHLIESSLICH mit gültigem JSON ohne Markdown, in genau dieser Struktur:
{"greeting": "...", "pitch": "...", "question": "...", "objections": [{"say": "...", "answer": "..."}]}

Regeln:
- Sie-Form, Schweizer Hochdeutsch ohne ß, natürliche gesprochene Sprache — so, wie man es am Telefon wirklich sagt.
- "greeting": kurze Begrüssung/Vorstellung (1-2 Sätze, endet mit "Haben Sie kurz einen Moment?").
- "pitch": konkreter Aufhänger zur Firma bzw. zu erkannten Website-Mängeln (als gut gemeinter Hinweis, nie als Vorwurf), 2-3 Sätze.
- "question": eine offene Anschlussfrage.
- "objections": 2-3 typische Einwände; "say" ist der Einwand in Kundenworten, "answer" die kurze, entspannte Antwort darauf.
- Insgesamt kompakt — in 30 Sekunden sprechbar.`
      : `Du schreibst für Gross ICT (Schweizer IT-Dienstleister & Webagentur, Inhaber Stefan Gross) kurze Erstkontakt-E-Mails an potenzielle Kunden.
Antworte AUSSCHLIESSLICH mit gültigem JSON ohne Markdown:
{"subject": "...", "body": "..."}

Regeln:
- Sie-Form, Schweizer Hochdeutsch ohne ß, freundlich und auf Augenhöhe — kein Verkaufsdruck, keine Floskeln wie "ich hoffe, diese E-Mail erreicht Sie gut".
- 5-8 Sätze. Konkret auf die Firma und erkannte Website-Mängel eingehen (als gut gemeinten Hinweis, nie als Vorwurf).
- Mit einer einfachen, unverbindlichen Frage enden (z.B. kurzes Telefonat anbieten).
- Grussformel: "Freundliche Grüsse\\nStefan Gross\\nGross ICT".
- "subject": kurz und konkret, kein Clickbait.`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 900,
      output_config: { effort: "low" },
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Firma: ${lead.company || "-"}
Kontaktperson: ${lead.name || "-"}${lead.position ? ` (${lead.position})` : ""}
Ort: ${lead.city || "-"}
Quelle: ${lead.source || "-"}
${webInfo}
Notizen (interne Infos, nur als Kontext): ${(lead.notes || "").slice(0, 1500)}`,
      }],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "Die KI konnte zu diesem Lead keinen Text erstellen." }, 422);
    }
    const text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Unerwartetes Antwortformat." }, 500);
    const parsed = JSON.parse(match[0]);

    if (isCall) {
      const script = {
        greeting: String(parsed.greeting || ""),
        pitch: String(parsed.pitch || ""),
        question: String(parsed.question || ""),
        objections: Array.isArray(parsed.objections)
          ? parsed.objections.map((o: any) => ({ say: String(o.say || ""), answer: String(o.answer || "") }))
          : [],
      };
      const body = [
        script.greeting, script.pitch, script.question,
        script.objections.length
          ? "Einwände:\n" + script.objections.map((o) => `• «${o.say}» → ${o.answer}`).join("\n")
          : "",
      ].filter(Boolean).join("\n\n");
      return json({ subject: "", body, script });
    }

    return json({ subject: String(parsed.subject || ""), body: String(parsed.body || "") });
  } catch (e) {
    console.error("[lead-outreach]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
