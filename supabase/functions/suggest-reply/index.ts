// KI-Antwortentwurf für Tickets: lädt Ticket + Verlauf und lässt Claude
// einen höflichen Antwortentwurf (de-CH, Sie-Form) für den Kunden schreiben.
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) return json({ error: "ticket_id fehlt" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY ist nicht konfiguriert (supabase secrets set ANTHROPIC_API_KEY=...)" }, 500);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("*, customer:customers(company_name, first_name, last_name)")
      .eq("id", ticket_id)
      .single();
    if (ticketError || !ticket) {
      return json({ error: "Ticket nicht gefunden" }, 404);
    }

    const { data: comments } = await supabaseAdmin
      .from("ticket_comments")
      .select("comment, user_name, is_internal, created_at")
      .eq("ticket_id", ticket_id)
      .order("created_at", { ascending: true });

    const customer = ticket.customer as
      | { company_name?: string; first_name?: string; last_name?: string }
      | null;
    const customerName =
      customer?.company_name ||
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
      "Kunde";
    const contactName =
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "";

    const historyLines = (comments || []).map((c) => {
      const role = c.is_internal ? "Intern (nur Team)" : `Öffentlich – ${c.user_name}`;
      const when = c.created_at ? new Date(c.created_at).toLocaleString("de-CH") : "";
      return `[${role}${when ? ", " + when : ""}]\n${c.comment}`;
    });

    const prompt = [
      `Ticket #${ticket.ticket_number || ticket.id}: ${ticket.title || "(ohne Titel)"}`,
      `Kunde: ${customerName}${contactName && contactName !== customerName ? ` (Kontakt: ${contactName})` : ""}`,
      `Status: ${ticket.status || "offen"} | Priorität: ${ticket.priority || "normal"}`,
      ticket.contract_covered ? "Durch Servicevertrag abgedeckt: ja" : "",
      "",
      "Beschreibung:",
      ticket.description || "(keine Beschreibung)",
      "",
      historyLines.length ? "Bisheriger Verlauf:\n\n" + historyLines.join("\n\n") : "Noch keine Kommentare.",
    ]
      .filter((l) => l !== "")
      .join("\n");

    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: [
        "Du bist Support-Mitarbeiter von Gross ICT, einem Schweizer IT-Dienstleister (Inhaber: Stefan Gross).",
        "Verfasse einen Antwortentwurf an den Kunden zum vorliegenden Support-Ticket.",
        "Regeln:",
        "- Schweizer Hochdeutsch, höfliche Sie-Form, kein ß (stattdessen ss).",
        "- Kurz und konkret: Problem anerkennen, Lösung bzw. nächste Schritte nennen, bei Bedarf gezielte Rückfragen stellen.",
        "- Erfinde keine technischen Details, Preise oder Zusagen, die nicht aus dem Ticketverlauf hervorgehen.",
        "- Interne Kommentare dienen dir nur als Kontext und dürfen nicht wörtlich an den Kunden gelangen.",
        "- Beginne mit einer passenden Anrede (z. B. «Guten Tag Herr/Frau …» oder «Guten Tag» bei unklarem Namen) und schliesse mit «Freundliche Grüsse\\nStefan Gross\\nGross ICT».",
        "- Gib nur den fertigen Antworttext aus, ohne Betreff, Einleitung oder Erklärungen.",
      ].join("\n"),
      messages: [{ role: "user", content: prompt }],
    });

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    if (response.stop_reason === "refusal" || !reply) {
      return json({ error: "Es konnte kein Antwortentwurf erstellt werden." }, 502);
    }

    return json({ reply });
  } catch (err) {
    console.error("[suggest-reply]", err);
    const message = err instanceof Anthropic.APIError
      ? `Claude API Fehler (${err.status}): ${err.message}`
      : (err as Error)?.message || "Unbekannter Fehler";
    return json({ error: message }, 500);
  }
});
