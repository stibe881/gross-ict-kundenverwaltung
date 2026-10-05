import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import * as Data from "@/lib/data";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import { LinkedRecord } from "@/components/linked-records";

// "Heute"-Feed: was jetzt Aufmerksamkeit braucht – über alle Module hinweg.
// allowed() filtert nach Rolle (gleiche IDs wie die Dashboard-Kacheln).
export function TodayFeed({ allowed, isWide, rolesKey }: { allowed: (tileId: string) => boolean; isWide: boolean; rolesKey: string }) {
  const colors = useColors();
  const router = useRouter();

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

      // Unverrechnete Ticket-Aufwände (ohne vertraglich abgedeckte Tickets), pro Kunde gebündelt
      let unbilledByCustomer: { id: string; name: string; total: number; count: number }[] = [];
      if (allowed("accounting")) {
        try {
          const { data: openItems } = await (supabase as any)
            .from("ticket_items")
            .select("quantity, unit_price, written_off, ticket:tickets(customer_id, covered_by_contract, customer:customers(company_name, first_name, last_name))")
            .is("invoice_id", null)
            .or("written_off.is.null,written_off.eq.false")
            .limit(300);
          const map = new Map<string, { id: string; name: string; total: number; count: number }>();
          for (const it of (openItems as any[]) || []) {
            const t = it.ticket;
            if (!t?.customer_id || t.covered_by_contract === true) continue;
            const name = t.customer?.company_name ||
              `${t.customer?.first_name || ""} ${t.customer?.last_name || ""}`.trim() || "Kunde";
            const entry = map.get(t.customer_id) || { id: t.customer_id, name, total: 0, count: 0 };
            entry.total += (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
            entry.count += 1;
            map.set(t.customer_id, entry);
          }
          unbilledByCustomer = Array.from(map.values()).filter((e) => e.total > 0).sort((a, b) => b.total - a.total);
        } catch (_) { /* optional */ }
      }
      for (const u of unbilledByCustomer.slice(0, 5)) {
        result.push({
          key: `unbilled-${u.id}`,
          icon: "clock.badge.exclamationmark",
          color: "#F59E0B",
          title: u.name,
          subtitle: `Offene Aufwände: ${formatCurrency(u.total)} (${u.count} Position${u.count === 1 ? "" : "en"}) – in Rechnung übernehmen`,
          route: `/customer/${u.id}`,
        });
      }

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

      // Inaktive Kunden: aktiv, aber 6 Monate ohne Rechnung und Ticket
      if (allowed("customers")) {
        try {
          const inactive = await Data.getInactiveCustomers();
          for (const c of inactive.slice(0, 3)) {
            result.push({
              key: `inactive-${c.id}`,
              icon: "zzz",
              color: "#8A8498",
              title: c.name,
              subtitle: "Seit 6 Monaten keine Rechnung und kein Ticket – Lebenszeichen senden",
              route: `/customer/${c.id}`,
            });
          }
        } catch (_) { /* optional */ }
      }

      // Jahresgespräch: A-Kunden rund um ihr Kundenjubiläum
      if (allowed("customers")) {
        try {
          const abc = await Data.getAbcClasses();
          const { data: aCustomers } = await supabase
            .from("customers")
            .select("id, company_name, first_name, last_name, created_at")
            .eq("status", "active");
          const now = new Date();
          for (const c of (aCustomers as any[]) || []) {
            if (abc[c.id]?.cls !== "A" || !c.created_at) continue;
            const created = new Date(c.created_at);
            if (created.getTime() > now.getTime() - 300 * 86400000) continue; // erst ab ~1 Jahr
            const next = new Date(now.getFullYear(), created.getMonth(), created.getDate());
            if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(next.getFullYear() + 1);
            const diff = Math.round((next.getTime() - now.getTime()) / 86400000);
            if (diff <= 14) {
              const name = c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim();
              result.push({
                key: `annual-${c.id}`,
                icon: "person.2.wave.2.fill",
                color: "#FBBF24",
                title: `Jahresgespräch mit ${name} planen`,
                subtitle: `A-Kunde · Kundenjubiläum in ${diff} Tag${diff === 1 ? "" : "en"}`,
                route: `/customer/${c.id}`,
              });
            }
          }
        } catch (_) { /* optional */ }
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

  return (
    <View
      style={{
        marginBottom: isWide ? 24 : 18,
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {/* Kopfzeile */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border + "80",
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>Heute wichtig</Text>
        <View
          style={{
            backgroundColor: items.length > 0 ? "#F8717118" : "#4ADE8018",
            paddingHorizontal: 9,
            paddingVertical: 2,
            borderRadius: 99,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: items.length > 0 ? "#F87171" : "#4ADE80" }}>
            {items.length > 0 ? `${items.length} PUNKTE` : "ALLES ERLEDIGT"}
          </Text>
        </View>
      </View>

      {items.length === 0 ? (
        <Text style={{ fontSize: 13, color: colors.muted, paddingHorizontal: 18, paddingVertical: 16 }}>
          Aktuell braucht nichts Ihre Aufmerksamkeit.
        </Text>
      ) : (
        items.slice(0, 10).map((item, idx) => (
          <TouchableOpacity
            key={item.key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderBottomWidth: idx < Math.min(items.length, 10) - 1 ? 1 : 0,
              borderBottomColor: colors.border + "50",
            }}
            onPress={() => item.route && router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                backgroundColor: item.color + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSymbol name={item.icon as any} size={15} color={item.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={13} color={colors.muted} />
          </TouchableOpacity>
        ))
      )}
      {items.length > 10 && (
        <Text style={{ fontSize: 11, color: colors.muted, textAlign: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border + "80" }}>
          +{items.length - 10} weitere Einträge
        </Text>
      )}
    </View>
  );
}
