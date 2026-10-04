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
  const summary = {
    createdInvoices: [] as string[],
    expiringQuotes: [] as string[],
    noticeDeadlines: [] as string[],
    renewedContracts: [] as string[],
    recurringExpenses: [] as string[],
    installmentReminders: [] as string[],
    slaWarnings: [] as string[],
    quoteFollowups: [] as string[],
    assetExpiries: [] as string[],
    recurringTickets: [] as string[],
    escalatedTickets: [] as string[],
    reviewRequests: [] as string[],
    errors: [] as string[],
  };

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

  // ── 3. Kündigungsfristen-Wächter ───────────────────────────────────────────
  // Stichtag = Vertragsende minus Kündigungsfrist. Gemeldet wird exakt bei
  // 30/14/7/1 Tagen Vorlauf (dadurch keine täglichen Wiederholungen).
  try {
    // Nur eigene/interne Verträge überwachen – auslaufende Kundenverträge
    // sollen keine Kündigungsfrist-Warnung auslösen
    const { data: endingContracts } = await supabase
      .from("contracts")
      .select("id, title, contract_number, end_date, notice_period_months, customer:customers(company_name, first_name, last_name)")
      .eq("status", "active")
      .is("cancellation_date", null)
      .not("end_date", "is", null)
      .or("is_internal.eq.true,customer_id.is.null");

    const todayMs = new Date(today).getTime();
    for (const c of endingContracts || []) {
      const months = c.notice_period_months || 0;
      if (months <= 0) continue;
      const deadline = new Date(c.end_date);
      deadline.setMonth(deadline.getMonth() - months);
      const daysUntil = Math.round((deadline.getTime() - todayMs) / 86400000);
      if ([30, 14, 7, 1].includes(daysUntil)) {
        const name = (c.customer as any)?.company_name ||
          `${(c.customer as any)?.first_name || ""} ${(c.customer as any)?.last_name || ""}`.trim() || "";
        summary.noticeDeadlines.push(
          `${c.title}${name ? ` (${name})` : ""}: Kündigungsfrist endet in ${daysUntil} Tag(en) am ${deadline.toLocaleDateString("de-CH")}`,
        );
      }
    }
  } catch (e: any) {
    summary.errors.push("Kündigungsfristen-Check: " + e.message);
  }

  // ── 3b. Automatische Vertragsverlängerung ──────────────────────────────────
  // Aktive, nicht gekündigte Verträge mit "Automatisch verlängern", deren
  // Enddatum erreicht ist, werden um die ursprüngliche Laufzeit verlängert.
  try {
    const { data: renewals } = await supabase
      .from("contracts")
      .select("id, title, contract_number, start_date, end_date, customer:customers(company_name, first_name, last_name)")
      .eq("status", "active")
      .eq("auto_renewal", true)
      .is("cancellation_date", null)
      .not("end_date", "is", null)
      .lte("end_date", today);

    for (const c of renewals || []) {
      try {
        const start = c.start_date ? new Date(c.start_date) : null;
        const end = new Date(c.end_date);
        // Laufzeit in Monaten bestimmen (Fallback: 12 Monate)
        let termMonths = 12;
        if (start && end > start) {
          termMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          if (termMonths <= 0) termMonths = 12;
        }
        // Enddatum so lange verlängern, bis es in der Zukunft liegt
        const newEnd = new Date(end);
        let guard = 0;
        while (newEnd.toISOString().split("T")[0] <= today && guard < 24) {
          newEnd.setMonth(newEnd.getMonth() + termMonths);
          guard++;
        }
        const newEndStr = newEnd.toISOString().split("T")[0];

        await supabase.from("contracts").update({
          end_date: newEndStr,
          updated_at: new Date().toISOString(),
        }).eq("id", c.id);

        await supabase.from("contract_activities").insert({
          contract_id: c.id,
          type: "renewed",
          description: `Vertrag automatisch um ${termMonths} Monat(e) verlängert – neues Ende: ${newEnd.toLocaleDateString("de-CH")}.`,
          user_name: "System",
        });

        const name = (c.customer as any)?.company_name ||
          `${(c.customer as any)?.first_name || ""} ${(c.customer as any)?.last_name || ""}`.trim() || "";
        summary.renewedContracts.push(`${c.title}${name ? ` (${name})` : ""} → ${newEnd.toLocaleDateString("de-CH")}`);
      } catch (e: any) {
        summary.errors.push(`Verlängerung ${c.contract_number || c.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    summary.errors.push("Vertragsverlängerung: " + e.message);
  }

  // ── 4. Wiederkehrende Ausgaben verbuchen ───────────────────────────────────
  try {
    const { data: recs } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("active", true)
      .lte("next_date", today);

    for (const rec of recs || []) {
      try {
        let nextDate = rec.next_date as string;
        // Auch nachholen, falls der Cron einige Tage nicht lief
        let guard = 0;
        while (nextDate <= today && guard < 24) {
          guard++;
          const taxAmount = rec.tax_rate ? Math.round(rec.amount * rec.tax_rate) / 100 : 0;
          const { error: expErr } = await supabase.from("expenses").insert({
            description: `${rec.description} (wiederkehrend)`,
            category: rec.category || null,
            amount: rec.amount,
            tax_rate: rec.tax_rate || 0,
            tax_amount: taxAmount,
            expense_date: nextDate,
          });
          if (expErr) throw expErr;
          const d = new Date(nextDate);
          d.setMonth(d.getMonth() + (rec.interval === "yearly" ? 12 : 1));
          nextDate = d.toISOString().split("T")[0];
          summary.recurringExpenses.push(`${rec.description} (${rec.amount} CHF)`);
        }
        await supabase.from("recurring_expenses").update({ next_date: nextDate }).eq("id", rec.id);
      } catch (e: any) {
        summary.errors.push(`Wiederkehrende Ausgabe ${rec.description}: ${e.message}`);
      }
    }
  } catch (e: any) {
    summary.errors.push("Wiederkehrende Ausgaben: " + e.message);
  }

  // ── 5. Erinnerungen für fällige Teilzahlungen ──────────────────────────────
  try {
    const { data: dueInstallments } = await supabase
      .from("invoice_installments")
      .select("*, invoice:invoices(invoice_number, customer:customers(company_name, first_name, last_name))")
      .is("paid_at", null)
      .is("reminder_sent_at", null)
      .lte("due_date", today);

    for (const inst of dueInstallments || []) {
      const inv = inst.invoice as any;
      const name = inv?.customer?.company_name ||
        `${inv?.customer?.first_name || ""} ${inv?.customer?.last_name || ""}`.trim() || "Kunde";
      summary.installmentReminders.push(`${inv?.invoice_number || "?"} – Rate CHF ${Number(inst.amount).toFixed(2)} (${name})`);
      await supabase.from("invoice_installments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", inst.id);
    }
  } catch (e: any) {
    summary.errors.push("Teilzahlungs-Check: " + e.message);
  }

  // ── 6. SLA-Wächter: Reaktionszeit aus Verträgen ────────────────────────────
  try {
    const { data: slaContracts } = await supabase
      .from("contracts")
      .select("customer_id, sla_response_hours")
      .eq("status", "active")
      .not("sla_response_hours", "is", null)
      .gt("sla_response_hours", 0);

    const slaByCustomer = new Map<string, number>();
    for (const c of slaContracts || []) {
      const prev = slaByCustomer.get(c.customer_id);
      // Strengste (kürzeste) SLA gilt
      if (!prev || c.sla_response_hours < prev) slaByCustomer.set(c.customer_id, c.sla_response_hours);
    }

    if (slaByCustomer.size > 0) {
      const { data: openTickets } = await supabase
        .from("tickets")
        .select("id, title, created_at, customer_id, sla_warning_sent")
        .eq("status", "open")
        .eq("sla_warning_sent", false)
        .in("customer_id", [...slaByCustomer.keys()]);

      const nowMs = Date.now();
      for (const t of openTickets || []) {
        const hours = slaByCustomer.get(t.customer_id);
        if (!hours || !t.created_at) continue;
        const deadlineMs = new Date(t.created_at).getTime() + hours * 3600000;
        const remainingMs = deadlineMs - nowMs;
        // Warnen, wenn weniger als 25% der Zeit übrig ist oder bereits verletzt
        if (remainingMs < hours * 3600000 * 0.25) {
          const label = remainingMs < 0
            ? `SLA VERLETZT seit ${Math.round(-remainingMs / 3600000)}h`
            : `noch ${Math.max(1, Math.round(remainingMs / 3600000))}h bis SLA-Verletzung`;
          summary.slaWarnings.push(`"${t.title}" – ${label}`);
          await supabase.from("tickets").update({ sla_warning_sent: true }).eq("id", t.id);
        }
      }
    }
  } catch (e: any) {
    summary.errors.push("SLA-Check: " + e.message);
  }

  // ── 7. Follow-up-Mail für unbeantwortete Angebote (7 Tage) ─────────────────
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const { data: staleQuotes } = await supabase
        .from("quotes")
        .select("id, quote_number, quote_date, total, valid_until, followup_sent_at, customer:customers(company_name, first_name, last_name, email)")
        .in("status", ["sent", "opened"])
        .is("followup_sent_at", null)
        .lte("quote_date", sevenDaysAgo);

      for (const q of staleQuotes || []) {
        const cust = q.customer as any;
        if (!cust?.email) continue;
        if (q.valid_until && q.valid_until < today) continue; // abgelaufen → kein Follow-up
        try {
          const contact = [cust.first_name, cust.last_name].filter(Boolean).join(" ");
          const anrede = contact ? `Guten Tag ${contact}` : "Guten Tag";
          const quoteUrl = `https://angebote.gross-ict.ch/?id=${q.id}`;
          const validHint = q.valid_until
            ? ` Das Angebot ist noch bis am ${new Date(q.valid_until).toLocaleDateString("de-CH")} gültig.`
            : "";
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Gross ICT <info@gross-ict.ch>",
              to: [cust.email],
              subject: `Erinnerung: Angebot ${q.quote_number}`,
              html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 560px;">
                  <p>${anrede}</p>
                  <p>Vor einigen Tagen haben wir Ihnen das Angebot <strong>${q.quote_number}</strong> zugestellt.
                  Gerne möchten wir nachfragen, ob Sie dazu noch Fragen haben.${validHint}</p>
                  <p style="margin: 24px 0;">
                    <a href="${quoteUrl}" target="_blank" style="display: inline-block; background-color: #D4A432; color: #1a1a2e; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px;">Angebot ansehen</a>
                  </p>
                  <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
                  <p>Freundliche Grüsse<br>Stefan Gross<br>Gross ICT</p>
                </div>`,
            }),
          });
          if (!res.ok) throw new Error(`Resend ${res.status}`);
          await supabase.from("quotes").update({ followup_sent_at: new Date().toISOString() }).eq("id", q.id);
          await supabase.from("quote_activities").insert({
            quote_id: q.id,
            type: "followup",
            description: `Automatische Erinnerung per E-Mail an ${cust.email} gesendet.`,
            user_name: "System",
          });
          summary.quoteFollowups.push(q.quote_number);
        } catch (e: any) {
          summary.errors.push(`Follow-up ${q.quote_number}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    summary.errors.push("Angebots-Follow-up: " + e.message);
  }

  // ── 8. Ablauf-Wächter für Geräte-Garantien & Lizenzen ──────────────────────
  try {
    const { data: assets } = await supabase
      .from("customer_assets")
      .select("*, customer:customers(company_name, first_name, last_name)")
      .not("expires_at", "is", null);

    const todayMs2 = new Date(today).getTime();
    for (const a of assets || []) {
      const daysUntil = Math.round((new Date(a.expires_at).getTime() - todayMs2) / 86400000);
      if (![30, 14, 7, 1].includes(daysUntil)) continue;
      if (a.expiry_warned_at === today) continue;
      const name = (a.customer as any)?.company_name ||
        `${(a.customer as any)?.first_name || ""} ${(a.customer as any)?.last_name || ""}`.trim() || "";
      const typeLabel = a.type === "license" ? "Lizenz" : "Garantie";
      summary.assetExpiries.push(`${typeLabel} "${a.name}"${name ? ` (${name})` : ""} läuft in ${daysUntil} Tag(en) ab`);
      await supabase.from("customer_assets").update({ expiry_warned_at: today }).eq("id", a.id);

      // Auch die Portal-Benutzer des Kunden informieren
      try {
        const { data: portalUsers } = await supabase
          .from("customer_portal_users")
          .select("id")
          .eq("customer_id", a.customer_id);
        const ids = (portalUsers || []).map((u: any) => u.id);
        if (ids.length) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
            method: "POST",
            headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              recipients: ids, recipientType: "customer",
              title: `${typeLabel} läuft ab`,
              body: `${a.name}: läuft in ${daysUntil} Tag(en) ab (${new Date(a.expires_at).toLocaleDateString("de-CH")}).`,
              data: { category: "assets" },
            }),
          });
        }
      } catch (e) { console.error("[automations] Asset-Push (Kunde) fehlgeschlagen:", e); }
    }
  } catch (e: any) {
    summary.errors.push("Inventar-Check: " + e.message);
  }

  // ── 10. Wiederkehrende Tickets (Wartungsplan) ──────────────────────────────
  const pushUrlEarly = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;
  const pushAuthEarly = { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" };
  try {
    const { data: recTickets } = await supabase
      .from("recurring_tickets")
      .select("*")
      .eq("active", true)
      .lte("next_date", today);

    for (const rt of recTickets || []) {
      try {
        let nextDate = rt.next_date as string;
        const months = rt.interval === "yearly" ? 12 : rt.interval === "quarterly" ? 3 : 1;
        // Nur EIN Ticket erzeugen, auch wenn der Cron Tage verpasst hat
        const { data: ticket, error: tErr } = await supabase
          .from("tickets")
          .insert({
            title: rt.title,
            description: `${rt.description || ""}\n\n—\nAutomatisch erstellt (Wartungsplan).`.trim(),
            status: "open",
            priority: rt.priority || "medium",
            customer_id: rt.customer_id,
          })
          .select()
          .single();
        if (tErr) throw tErr;

        // next_date fortschreiben, bis es in der Zukunft liegt
        let guard = 0;
        const d = new Date(nextDate);
        while (d.toISOString().split("T")[0] <= today && guard < 24) {
          d.setMonth(d.getMonth() + months);
          guard++;
        }
        await supabase.from("recurring_tickets").update({ next_date: d.toISOString().split("T")[0] }).eq("id", rt.id);
        summary.recurringTickets.push(rt.title);

        await fetch(pushUrlEarly, {
          method: "POST", headers: pushAuthEarly,
          body: JSON.stringify({
            recipients: "all_admins", recipientType: "admin",
            title: "Wartungsticket erstellt",
            body: rt.title,
            data: { url: `/tickets?ticketId=${ticket.id}`, category: "tickets" },
          }),
        }).catch(() => {});
      } catch (e: any) {
        summary.errors.push(`Wartungsticket ${rt.title}: ${e.message}`);
      }
    }
  } catch (e: any) {
    summary.errors.push("Wartungsplan: " + e.message);
  }

  // ── 11. Eskalation: offene Tickets ohne Aktivität seit 3 Tagen ─────────────
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: staleTickets } = await supabase
      .from("tickets")
      .select("id, title, priority, updated_at")
      .in("status", ["open", "in_progress"])
      .eq("escalated", false)
      .lt("updated_at", threeDaysAgo);

    for (const t of staleTickets || []) {
      const newPriority = t.priority === "low" ? "medium" : t.priority === "medium" ? "high" : t.priority || "high";
      await supabase.from("tickets").update({ escalated: true, priority: newPriority }).eq("id", t.id);
      summary.escalatedTickets.push(t.title);
    }
    if (summary.escalatedTickets.length > 0) {
      await fetch(pushUrlEarly, {
        method: "POST", headers: pushAuthEarly,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Tickets eskaliert (3 Tage ohne Aktivität)",
          body: summary.escalatedTickets.join(" · "),
          data: { url: "/tickets", category: "tickets" },
        }),
      }).catch(() => {});
    }
  } catch (e: any) {
    summary.errors.push("Eskalation: " + e.message);
  }

  // ── 9. Papierkorb aufräumen (älter als 30 Tage) ────────────────────────────
  try {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    await supabase.from("trash_bin").delete().lt("created_at", cutoff);
  } catch (e: any) {
    summary.errors.push("Papierkorb-Cleanup: " + e.message);
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

  if (summary.noticeDeadlines.length > 0) {
    try {
      await fetch(pushUrl, {
        method: "POST", headers: pushAuth,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Kündigungsfrist läuft ab",
          body: summary.noticeDeadlines.join(" · "),
          data: { url: "/contracts", category: "auto_invoices" },
        }),
      });
    } catch (e) { console.error("[automations] Push (Kündigungsfristen) fehlgeschlagen:", e); }
  }

  if (summary.renewedContracts.length > 0) {
    try {
      await fetch(pushUrl, {
        method: "POST", headers: pushAuth,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Verträge automatisch verlängert",
          body: summary.renewedContracts.join(" · "),
          data: { url: "/contracts", category: "auto_invoices" },
        }),
      });
    } catch (e) { console.error("[automations] Push (Verlängerungen) fehlgeschlagen:", e); }
  }

  if (summary.installmentReminders.length > 0) {
    try {
      await fetch(pushUrl, {
        method: "POST", headers: pushAuth,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Teilzahlung fällig",
          body: summary.installmentReminders.join(" · "),
          data: { url: "/accounting", category: "installments" },
        }),
      });
    } catch (e) { console.error("[automations] Push (Teilzahlungen) fehlgeschlagen:", e); }
  }

  if (summary.slaWarnings.length > 0) {
    try {
      await fetch(pushUrl, {
        method: "POST", headers: pushAuth,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "SLA-Warnung",
          body: summary.slaWarnings.join(" · "),
          data: { url: "/tickets", category: "sla" },
        }),
      });
    } catch (e) { console.error("[automations] Push (SLA) fehlgeschlagen:", e); }
  }

  if (summary.assetExpiries.length > 0) {
    try {
      await fetch(pushUrl, {
        method: "POST", headers: pushAuth,
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Garantie/Lizenz läuft ab",
          body: summary.assetExpiries.join(" · "),
          data: { url: "/customers", category: "assets" },
        }),
      });
    } catch (e) { console.error("[automations] Push (Inventar) fehlgeschlagen:", e); }
  }

  // ── 12. Google-Bewertungs-Mails: nach geschlossenem Ticket um Review bitten ──
  // Einstellbar: marketing_settings review_auto_enabled ('true') + review_link.
  try {
    const { data: settingsRows } = await supabase.from("marketing_settings").select("key, value");
    const settings: Record<string, string> = {};
    for (const r of settingsRows || []) settings[r.key] = r.value;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (settings.review_auto_enabled === "true" && settings.review_link && resendKey) {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const { data: closedTickets } = await supabase
        .from("tickets")
        .select("id, title, customer_id, customer:customers(id, company_name, first_name, last_name, email)")
        .eq("status", "closed")
        .gte("updated_at", twoDaysAgo)
        .lte("updated_at", dayAgo)
        .not("customer_id", "is", null)
        .limit(20);

      const halfYearAgo = new Date(Date.now() - 180 * 86400000).toISOString();
      for (const t of closedTickets || []) {
        const cust: any = t.customer;
        if (!cust?.email) continue;
        // Höchstens alle 180 Tage pro Kunde
        const { data: already } = await supabase
          .from("review_requests")
          .select("id")
          .eq("customer_id", cust.id)
          .gte("created_at", halfYearAgo)
          .limit(1);
        if (already && already.length > 0) continue;

        const name = cust.company_name || `${cust.first_name || ""} ${cust.last_name || ""}`.trim();
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px 12px 0 0;">
              <span style="color: #fff; font-size: 18px; font-weight: bold;">Gross ICT</span>
            </div>
            <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px;">Guten Tag ${name}</p>
              <p style="font-size: 14px; line-height: 1.6;">
                Ihr Anliegen «${t.title}» konnten wir erledigen – schön, dass wir helfen durften!
                Wenn Sie mit uns zufrieden waren, würden wir uns riesig über eine kurze
                Google-Bewertung freuen. Das dauert eine Minute und hilft uns sehr.
              </p>
              <p style="text-align: center; margin: 24px 0;">
                <a href="${settings.review_link}" style="background: #C19A6B; color: #1C1D27; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold;">Jetzt bewerten</a>
              </p>
              <p style="font-size: 13px; color: #6b7280;">Herzlichen Dank!<br/>Gross ICT</p>
            </div>
          </div>`;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Gross ICT <info@gross-ict.ch>",
            to: [cust.email],
            subject: "Waren Sie zufrieden mit uns?",
            html,
          }),
        });
        if (res.ok) {
          await supabase.from("review_requests").insert({ customer_id: cust.id, ticket_id: t.id, sent_to: cust.email });
          summary.reviewRequests.push(name);
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Review-Mails: ${(e as Error).message}`);
  }

  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
