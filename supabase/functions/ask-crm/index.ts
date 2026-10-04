// «Frag dein CRM»: beantwortet Freitextfragen aus den CRM-Daten.
// Lädt einen kompakten Daten-Schnappschuss (Rechnungen, Tickets, Verträge,
// Leads, Projekte) und lässt Claude die Frage ausschliesslich daraus beantworten.
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
    const { question } = await req.json();
    if (!question || String(question).trim().length < 3) {
      return json({ error: "Bitte eine Frage stellen." }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY ist nicht konfiguriert." }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [invoicesRes, ticketsRes, contractsRes, leadsRes, projectsRes, customersRes] = await Promise.all([
      supabase.from("invoices")
        .select("invoice_number, status, total, paid_amount, invoice_date, due_date, is_credit_note, customer:customers(company_name, first_name, last_name)")
        .neq("status", "cancelled")
        .order("invoice_date", { ascending: false })
        .limit(150),
      supabase.from("tickets")
        .select("title, status, priority, created_at, customer:customers(company_name, first_name, last_name)")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("contracts")
        .select("title, status, annual_amount, amount, end_date, billing_cycle, customer:customers(company_name, first_name, last_name)")
        .eq("status", "active")
        .limit(100),
      supabase.from("leads")
        .select("name, company, status, value, rating, next_action, next_action_date")
        .not("status", "in", '("won","lost")')
        .limit(100),
      supabase.from("projects")
        .select("project_number, title, status, budget, customer:customers(company_name, first_name, last_name)")
        .limit(100),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

    const today = new Date().toISOString().split("T")[0];
    const lines: string[] = [];
    lines.push(`Stichtag: ${today}. Aktive Kunden: ${customersRes.count ?? "?"}.`);

    lines.push("\n== RECHNUNGEN (letzte 150, ohne stornierte) ==");
    for (const i of invoicesRes.data || []) {
      const rest = Math.max(0, (i.total || 0) - (i.paid_amount || 0));
      lines.push(`${i.invoice_number}${i.is_credit_note ? " (GUTSCHRIFT)" : ""} | ${customerName(i.customer)} | Status ${i.status} | Total CHF ${(i.total || 0).toFixed(2)} | offen CHF ${rest.toFixed(2)} | Datum ${i.invoice_date} | fällig ${i.due_date || "-"}`);
    }

    lines.push("\n== TICKETS (letzte 30 Tage) ==");
    for (const t of ticketsRes.data || []) {
      lines.push(`${(t.created_at || "").split("T")[0]} | ${customerName(t.customer)} | ${t.status}/${t.priority} | ${t.title}`);
    }

    lines.push("\n== AKTIVE VERTRÄGE ==");
    for (const c of contractsRes.data || []) {
      lines.push(`${c.title} | ${customerName(c.customer)} | CHF ${(c.annual_amount || c.amount || 0)}/Jahr | ${c.billing_cycle || "-"} | Ende ${c.end_date || "unbefristet"}`);
    }

    lines.push("\n== OFFENE LEADS ==");
    for (const l of leadsRes.data || []) {
      lines.push(`${l.company || l.name} | Status ${l.status} | Wert CHF ${l.value || 0} | ${l.rating || "-"} | nächste Aktion: ${l.next_action || "-"} (${l.next_action_date || "-"})`);
    }

    lines.push("\n== PROJEKTE ==");
    for (const p of projectsRes.data || []) {
      lines.push(`${p.project_number} | ${p.title} | ${customerName(p.customer)} | Status ${p.status} | Budget CHF ${p.budget || 0}`);
    }

    const snapshot = lines.join("\n").substring(0, 150000);

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: [
        "Du bist der CRM-Assistent von Gross ICT (Schweizer IT-Dienstleister, Inhaber Stefan Gross).",
        "Beantworte Fragen ausschliesslich anhand des mitgelieferten Daten-Schnappschnitts.",
        "Regeln:",
        "- Schweizer Hochdeutsch, kein ß (stattdessen ss). Beträge als CHF mit zwei Nachkommastellen.",
        "- Antworte kurz und konkret; bei Listen die relevanten Positionen mit Zahlen aufführen.",
        "- Rechne wo nötig selbst (Summen, Anzahl, Durchschnitte) und zeige das Ergebnis.",
        "- Wenn die Daten die Frage nicht hergeben (z. B. älter als der Schnappschuss), sage das ehrlich.",
        "- Erfinde keine Daten.",
      ].join("\n"),
      messages: [{
        role: "user",
        content: `DATEN-SCHNAPPSCHUSS:\n${snapshot}\n\nFRAGE: ${String(question).trim()}`,
      }],
    });

    const answer = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    if (response.stop_reason === "refusal" || !answer) {
      return json({ error: "Die Frage konnte nicht beantwortet werden." }, 502);
    }
    return json({ answer });
  } catch (e) {
    console.error("[ask-crm]", e);
    const message = e instanceof Anthropic.APIError
      ? `Claude API Fehler (${e.status}): ${e.message}`
      : (e as Error)?.message || "Unbekannter Fehler";
    return json({ error: message }, 500);
  }
});
