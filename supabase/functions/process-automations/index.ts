// Tägliche Automatisierungen (per Cron aufrufen, z.B. jeden Morgen 06:00):
// 1. Fällige Vertragsrechnungen als Entwurf erstellen und next_invoice_date fortschreiben
// 2. Angebote, die in 3 Tagen ablaufen → Erinnerungs-Push an Admins
//
// Schutz: Wenn das Secret AUTOMATION_SECRET gesetzt ist, muss der Aufruf den
// Header "x-automation-secret" mit demselben Wert mitschicken.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
};

const BILLING_CYCLES = [
  { key: "monthly", label: "Monatlich", months: 1, surcharge: 2 },
  { key: "quarterly", label: "Quartal", months: 3, surcharge: 2 },
  { key: "semi_annual", label: "Halbjährlich", months: 6, surcharge: 2 },
  { key: "yearly", label: "Jährlich", months: 12, surcharge: 0 },
];

function cycleFor(key: string) {
  return BILLING_CYCLES.find((c) => c.key === key) || BILLING_CYCLES[3];
}

function calculateCycleAmount(annualAmount: number, cycleKey: string) {
  const cycle = cycleFor(cycleKey);
  const baseAmount = Math.round(((annualAmount / 12) * cycle.months) * 100) / 100;
  return { baseAmount, surcharge: cycle.surcharge, totalAmount: baseAmount + cycle.surcharge, cycleName: cycle.label };
}

function nextInvoiceDate(fromDate: string, cycleKey: string): string {
  const date = new Date(fromDate);
  date.setMonth(date.getMonth() + cycleFor(cycleKey).months);
  return date.toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("AUTOMATION_SECRET");
  if (secret && req.headers.get("x-automation-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date().toISOString().split("T")[0];
  const summary = { createdInvoices: [] as string[], expiringQuotes: [] as string[], errors: [] as string[] };

  // ── 1. Fällige Vertragsrechnungen ──────────────────────────────────────────
  try {
    const { data: dueContracts, error } = await supabase
      .from("contracts")
      .select("*, customer:customers(company_name, first_name, last_name)")
      .eq("recurring_enabled", true)
      .eq("status", "active")
      .not("customer_id", "is", null)
      .lte("next_invoice_date", today);
    if (error) throw error;

    // Nächste freie Rechnungsnummer einmal bestimmen, dann hochzählen
    const year = new Date().getFullYear();
    const prefix = `RE-${year}-`;
    const { data: lastInvoice } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `${prefix}%`)
      .order("invoice_number", { ascending: false })
      .limit(1);
    let seq = 0;
    if (lastInvoice && lastInvoice.length > 0) {
      const n = parseInt(lastInvoice[0].invoice_number.replace(prefix, ""), 10);
      if (!isNaN(n)) seq = n;
    }

    for (const contract of dueContracts || []) {
      try {
        seq += 1;
        const invoiceNumber = `${prefix}${String(seq).padStart(3, "0")}`;
        const { baseAmount, surcharge, totalAmount, cycleName } = calculateCycleAmount(
          contract.annual_amount || contract.amount || 0,
          contract.billing_cycle || "yearly",
        );
        const vatRate = contract.vat_rate ?? 0;
        const vatMultiplier = vatRate / 100;
        const ptMatch = (contract.payment_terms || "").match(/(\d+)/);
        const paymentDays = ptMatch ? parseInt(ptMatch[1]) : 30;
        const dueDate = new Date(Date.now() + paymentDays * 86400000).toISOString().split("T")[0];

        // Rechnung als ENTWURF erstellen – wird vom Benutzer geprüft und versendet
        const { data: invoice, error: invErr } = await supabase
          .from("invoices")
          .insert({
            customer_id: contract.customer_id,
            invoice_number: invoiceNumber,
            invoice_date: today,
            due_date: dueDate,
            subtotal: totalAmount,
            vat_amount: Math.round(totalAmount * vatMultiplier * 100) / 100,
            total: Math.round(totalAmount * (1 + vatMultiplier) * 100) / 100,
            status: "draft",
            notes: `Automatische Rechnung aus Vertrag: ${contract.title}`,
          })
          .select()
          .single();
        if (invErr) throw invErr;

        const items: any[] = [{
          invoice_id: invoice.id,
          description: `${contract.title} — ${cycleName}e Abrechnung`,
          quantity: 1,
          unit: "Pauschale",
          unit_price: baseAmount,
          vat_rate: vatRate,
          total: baseAmount,
        }];
        if (surcharge > 0) {
          items.push({
            invoice_id: invoice.id,
            description: `Zuschlag ${cycleName}e Abrechnung`,
            quantity: 1,
            unit: "Pauschale",
            unit_price: surcharge,
            vat_rate: vatRate,
            total: surcharge,
          });
        }
        await supabase.from("invoice_items").insert(items);
        await supabase.from("invoice_activities").insert({
          invoice_id: invoice.id,
          type: "created",
          description: `Rechnung ${invoiceNumber} automatisch aus Vertrag "${contract.title}" erstellt.`,
        });

        // Vertrag fortschreiben – dadurch ist der Lauf idempotent
        await supabase.from("contracts").update({
          last_invoice_date: today,
          next_invoice_date: nextInvoiceDate(today, contract.billing_cycle || "yearly"),
          updated_at: new Date().toISOString(),
        }).eq("id", contract.id);

        summary.createdInvoices.push(invoiceNumber);
      } catch (e: any) {
        console.error("[automations] Vertragsrechnung fehlgeschlagen:", contract.id, e.message);
        summary.errors.push(`Vertrag ${contract.contract_number || contract.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.error("[automations] Vertragslauf fehlgeschlagen:", e.message);
    summary.errors.push("Vertragslauf: " + e.message);
  }

  // ── 2. Angebote, die in 3 Tagen ablaufen ───────────────────────────────────
  try {
    const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
    const { data: expiring } = await supabase
      .from("quotes")
      .select("id, quote_number, valid_until, customer:customers(company_name, first_name, last_name)")
      .in("status", ["sent", "opened"])
      .eq("valid_until", inThreeDays);
    for (const q of expiring || []) {
      const name = (q.customer as any)?.company_name ||
        `${(q.customer as any)?.first_name || ""} ${(q.customer as any)?.last_name || ""}`.trim() || "Kunde";
      summary.expiringQuotes.push(`${q.quote_number} (${name})`);
    }
  } catch (e: any) {
    summary.errors.push("Angebots-Check: " + e.message);
  }

  // ── Push an Admins über die bestehende send-push-Funktion ──────────────────
  const pushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;
  const pushAuth = { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };

  if (summary.createdInvoices.length > 0) {
    try {
      await fetch(pushUrl, {
        method: "POST", headers: pushAuth,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Vertragsrechnungen erstellt",
          body: `${summary.createdInvoices.length} Rechnung(en) als Entwurf erstellt: ${summary.createdInvoices.join(", ")}. Bitte prüfen und versenden.`,
          data: { url: "/accounting", category: "auto_invoices" },
        }),
      });
    } catch (e) { console.error("[automations] Push (Rechnungen) fehlgeschlagen:", e); }
  }

  if (summary.expiringQuotes.length > 0) {
    try {
      await fetch(pushUrl, {
        method: "POST", headers: pushAuth,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Angebote laufen bald ab",
          body: `In 3 Tagen ablaufend: ${summary.expiringQuotes.join(", ")} – jetzt nachfassen?`,
          data: { url: "/quotes", category: "quotes" },
        }),
      });
    } catch (e) { console.error("[automations] Push (Angebote) fehlgeschlagen:", e); }
  }

  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
