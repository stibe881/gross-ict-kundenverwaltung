import { View, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import * as Data from "@/lib/data";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import { LinkedRecords, LinkedRecord } from "@/components/linked-records";

// "Heute"-Feed: was jetzt Aufmerksamkeit braucht – über alle Module hinweg.
// allowed() filtert nach Rolle (gleiche IDs wie die Dashboard-Kacheln).
export function TodayFeed({ allowed, isWide, rolesKey }: { allowed: (tileId: string) => boolean; isWide: boolean; rolesKey: string }) {
  const colors = useColors();

  const { data: items = [] } = useQuery({
    // rolesKey sorgt dafür, dass der Feed neu lädt, sobald die Rollen geladen sind
    queryKey: ["todayFeed", rolesKey],
    queryFn: async (): Promise<LinkedRecord[]> => {
      const today = new Date().toISOString().split("T")[0];
      const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
      const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const endOfToday = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
      const result: LinkedRecord[] = [];

      const [tickets, invoices, reminders, contracts, quotes, noticeContracts, leadActions, changeRequests] = await Promise.all([
        allowed("tickets")
          ? supabase.from("tickets").select("id, title, due_date, status").neq("status", "closed").lte("due_date", today).limit(5)
          : Promise.resolve({ data: [] } as any),
        allowed("accounting")
          ? supabase.from("invoices").select("id, invoice_number, total, paid_amount, due_date, status, customer:customers(company_name, first_name, last_name)").in("status", ["open", "sent", "overdue"]).lt("due_date", today).eq("dunning_stopped", false).limit(5)
          : Promise.resolve({ data: [] } as any),
        allowed("leads")
          ? supabase.from("lead_reminders").select("id, remind_at, note, lead:leads(id, name, company)").eq("is_processed", false).lte("remind_at", endOfToday).limit(5)
          : Promise.resolve({ data: [] } as any),
        allowed("accounting")
          ? supabase.from("contracts").select("id, title, contract_number, next_invoice_date").eq("recurring_enabled", true).eq("status", "active").lte("next_invoice_date", in7Days).limit(5)
          : Promise.resolve({ data: [] } as any),
        allowed("quotes")
          ? supabase.from("quotes").select("id, quote_number, valid_until, total").in("status", ["sent", "opened"]).gte("valid_until", today).lte("valid_until", in3Days).limit(5)
          : Promise.resolve({ data: [] } as any),
        // Kündigungsfristen: nur eigene/interne Verträge – auslaufende
        // Kundenverträge gehören nicht in den Heute-Feed
        allowed("contracts")
          ? supabase.from("contracts").select("id, title, end_date, notice_period_months").eq("status", "active").is("cancellation_date", null).not("end_date", "is", null).or("is_internal.eq.true,customer_id.is.null").limit(50)
          : Promise.resolve({ data: [] } as any),
        allowed("leads")
          ? (supabase as any).from("leads").select("id, name, company, next_action, next_action_date").not("next_action", "is", null).lte("next_action_date", today).not("status", "in", '("won","lost")').limit(5)
          : Promise.resolve({ data: [] } as any),
        allowed("customers")
          ? (supabase as any).from("customer_change_requests").select("id, customer_id, requested_by, customer:customers(company_name, first_name, last_name)").eq("status", "pending").limit(5)
          : Promise.resolve({ data: [] } as any),
      ]);

      for (const t of tickets.data || []) {
        const overdue = t.due_date < today;
        result.push({
          key: `tkt-${t.id}`,
          icon: overdue ? "exclamationmark.triangle.fill" : "ticket.fill",
          color: overdue ? "#EF4444" : "#F59E0B",
          title: t.title,
          subtitle: overdue ? `Ticket überfällig seit ${formatDate(t.due_date)}` : "Ticket heute fällig",
          route: `/tickets?ticketId=${t.id}`,
        });
      }
      for (const inv of invoices.data || []) {
        const name = (inv.customer as any)?.company_name ||
          `${(inv.customer as any)?.first_name || ""} ${(inv.customer as any)?.last_name || ""}`.trim() || "Kunde";
        const rest = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
        result.push({
          key: `inv-${inv.id}`,
          icon: "doc.text.fill",
          color: "#EF4444",
          title: `${inv.invoice_number} · ${name}`,
          subtitle: `Rechnung überfällig · offen ${formatCurrency(rest)}`,
          route: `/invoice/${inv.id}`,
        });
      }
      for (const r of reminders.data || []) {
        const lead = r.lead as any;
        result.push({
          key: `rem-${r.id}`,
          icon: "bell.fill",
          color: "#0EA5E9",
          title: lead?.company || lead?.name || "Lead",
          subtitle: `Follow-up fällig${r.note ? ` · ${r.note}` : ""}`,
          route: lead?.id ? `/leads?leadId=${lead.id}` : "/leads",
        });
      }
      for (const c of contracts.data || []) {
        result.push({
          key: `ct-${c.id}`,
          icon: "arrow.clockwise",
          color: "#6366F1",
          title: c.title,
          subtitle: `Vertragsrechnung fällig am ${formatDate(c.next_invoice_date)}`,
          route: `/contracts?contractId=${c.id}`,
        });
      }
      for (const q of quotes.data || []) {
        result.push({
          key: `qt-${q.id}`,
          icon: "clock",
          color: "#F59E0B",
          title: q.quote_number,
          subtitle: `Angebot läuft am ${formatDate(q.valid_until)} ab · ${formatCurrency(q.total || 0)}`,
          route: `/quote/${q.id}`,
        });
      }

      for (const l of leadActions.data || []) {
        result.push({
          key: `la-${l.id}`,
          icon: "flag.fill",
          color: "#EF4444",
          title: l.company || l.name || "Lead",
          subtitle: `Nächste Aktion überfällig: ${l.next_action}`,
          route: `/leads?leadId=${l.id}`,
        });
      }
      for (const cr of changeRequests.data || []) {
        const name = (cr.customer as any)?.company_name ||
          `${(cr.customer as any)?.first_name || ""} ${(cr.customer as any)?.last_name || ""}`.trim() || "Kunde";
        result.push({
          key: `cr-${cr.id}`,
          icon: "person.crop.circle.badge.exclamationmark",
          color: "#8B5CF6",
          title: name,
          subtitle: `Stammdaten-Änderung aus dem Portal prüfen${cr.requested_by ? ` (${cr.requested_by})` : ""}`,
          route: `/customer/${cr.customer_id}`,
        });
      }

      // Geburtstage & Kunden-Jubiläen (nächste 14 Tage)
      if (allowed("customers")) {
        try {
          const celebrations = await Data.getUpcomingCelebrations();
          for (const [idx, cel] of celebrations.slice(0, 5).entries()) {
            result.push({
              key: `cel-${idx}-${cel.date}`,
              icon: cel.type === "birthday" ? "gift.fill" : "star.fill",
              color: cel.type === "birthday" ? "#EC4899" : "#F59E0B",
              title: cel.label,
              subtitle: cel.type === "birthday" ? "Geburtstag" : "Kunden-Jubiläum",
              route: cel.customerId ? `/customer/${cel.customerId}` : "/customers",
            });
          }
        } catch (_) { /* optional */ }
      }

      // Kündigungsfristen: Stichtag = Vertragsende minus Frist, Warnung ab 30 Tagen
      const todayMs = new Date(today).getTime();
      for (const c of noticeContracts.data || []) {
        const months = c.notice_period_months || 0;
        if (months <= 0) continue;
        const deadline = new Date(c.end_date);
        deadline.setMonth(deadline.getMonth() - months);
        const daysUntil = Math.round((deadline.getTime() - todayMs) / 86400000);
        if (daysUntil >= 0 && daysUntil <= 30) {
          result.push({
            key: `notice-${c.id}`,
            icon: "exclamationmark.triangle.fill",
            color: daysUntil <= 7 ? "#EF4444" : "#F59E0B",
            title: c.title,
            subtitle: `Kündigungsfrist endet in ${daysUntil} Tag(en) – ${formatDate(deadline.toISOString().split("T")[0])}`,
            route: `/contracts?contractId=${c.id}`,
          });
        }
      }

      return result;
    },
    refetchInterval: 120000,
  });

  if (items.length === 0) return null;

  return (
    <View style={{ marginBottom: isWide ? 24 : 18 }}>
      <LinkedRecords title={`Heute (${items.length})`} records={items.slice(0, 10)} />
      {items.length > 10 && (
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6, textAlign: "center" }}>
          +{items.length - 10} weitere Einträge
        </Text>
      )}
    </View>
  );
}
