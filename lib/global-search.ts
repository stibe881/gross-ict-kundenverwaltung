// Globale Suche über Kunden, Tickets, Rechnungen, Angebote, Projekte, Verträge.
// Wird vom Dashboard (mobil) und der globalen Desktop-Topbar genutzt.
import { supabase } from "@/lib/supabase";

export interface GlobalSearchResult {
    id: string;
    type: string;
    icon: string;
    color: string;
    title: string;
    subtitle: string;
    route: string;
}

export async function performGlobalSearch(query: string, colors: any): Promise<GlobalSearchResult[]> {

    if (!query || query.length < 2) return [];
    const results: any[] = [];

    // Filter-Tokens aus der Eingabe ziehen
    const STATUS_MAP: Record<string, string> = {
      offen: "open", open: "open", bezahlt: "paid", paid: "paid", versendet: "sent", sent: "sent",
      überfällig: "overdue", ueberfaellig: "overdue", overdue: "overdue", entwurf: "draft", draft: "draft",
      geschlossen: "closed", closed: "closed", aktiv: "active", active: "active",
      "in_arbeit": "in_progress", in_progress: "in_progress", abgeschlossen: "completed", completed: "completed",
      angenommen: "accepted", accepted: "accepted", abgelehnt: "declined", declined: "declined",
      gekündigt: "cancelled", cancelled: "cancelled", wartend: "waiting", waiting: "waiting",
    };
    let statusFilter: string | null = null;
    let customerFilter: string | null = null;
    let amountGt: number | null = null;
    let amountLt: number | null = null;
    const freeParts: string[] = [];
    for (const token of query.trim().split(/\s+/)) {
      const lower = token.toLowerCase();
      if (lower.startsWith("status:")) {
        const v = lower.slice(7);
        statusFilter = STATUS_MAP[v] || v;
      } else if (lower.startsWith("kunde:")) {
        customerFilter = token.slice(6);
      } else if (/^>\d+(\.\d+)?$/.test(lower)) {
        amountGt = parseFloat(lower.slice(1));
      } else if (/^<\d+(\.\d+)?$/.test(lower)) {
        amountLt = parseFloat(lower.slice(1));
      } else {
        freeParts.push(token);
      }
    }
    const hasFilters = !!(statusFilter || customerFilter || amountGt !== null || amountLt !== null);
    const freeText = freeParts.join(" ");

    // kunde:-Filter → passende Kunden-IDs ermitteln
    let customerIds: string[] | null = null;
    if (customerFilter) {
      const cq = `%${customerFilter}%`;
      const { data: matched } = await supabase
        .from("customers")
        .select("id")
        .or(`company_name.ilike.${cq},first_name.ilike.${cq},last_name.ilike.${cq}`)
        .limit(20);
      customerIds = (matched || []).map((c: any) => c.id);
      if (customerIds.length === 0) return [];
    }

    // Gefilterte Suche: Rechnungen/Angebote/Tickets nach Status/Kunde/Betrag
    if (hasFilters) {
      try {
        let invQ = supabase.from("invoices").select("id, invoice_number, status, total").limit(8);
        if (statusFilter) invQ = invQ.eq("status", statusFilter);
        if (customerIds) invQ = invQ.in("customer_id", customerIds);
        if (amountGt !== null) invQ = invQ.gt("total", amountGt);
        if (amountLt !== null) invQ = invQ.lt("total", amountLt);
        if (freeText) invQ = invQ.ilike("invoice_number", `%${freeText}%`);
        const { data: fInvoices } = await invQ;
        results.push(...(fInvoices || []).map((inv: any) => ({
          id: inv.id, type: "invoice", icon: "doc.text.fill", color: colors.success,
          title: inv.invoice_number,
          subtitle: `Rechnung · CHF ${(inv.total || 0).toFixed(2)} · ${inv.status}`,
          route: `/invoice/${inv.id}`,
        })));

        let qQ = supabase.from("quotes").select("id, quote_number, status, total").limit(8);
        if (statusFilter) qQ = qQ.eq("status", statusFilter);
        if (customerIds) qQ = qQ.in("customer_id", customerIds);
        if (amountGt !== null) qQ = qQ.gt("total", amountGt);
        if (amountLt !== null) qQ = qQ.lt("total", amountLt);
        if (freeText) qQ = qQ.ilike("quote_number", `%${freeText}%`);
        const { data: fQuotes } = await qQ;
        results.push(...(fQuotes || []).map((qa: any) => ({
          id: qa.id, type: "quote", icon: "doc.text.fill", color: "#EC4899",
          title: qa.quote_number,
          subtitle: `Angebot · CHF ${(qa.total || 0).toFixed(2)} · ${qa.status}`,
          route: `/quote/${qa.id}`,
        })));

        if (amountGt === null && amountLt === null) {
          let tQ = supabase.from("tickets").select("id, title, status").limit(8);
          if (statusFilter) tQ = tQ.eq("status", statusFilter);
          if (customerIds) tQ = tQ.in("customer_id", customerIds);
          if (freeText) tQ = tQ.ilike("title", `%${freeText}%`);
          const { data: fTickets } = await tQ;
          results.push(...(fTickets || []).map((t: any) => ({
            id: t.id, type: "ticket", icon: "ticket.fill", color: colors.warning,
            title: t.title,
            subtitle: `Ticket · ${t.status}`,
            route: "/tickets",
          })));
        }
      } catch (e) {
        console.warn("[Search] Filter-Fehler:", e);
      }
      return results;
    }

    const q = `%${query}%`;
    try {
      // Customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, company_name, first_name, last_name, email")
        .or(`company_name.ilike.${q},first_name.ilike.${q},last_name.ilike.${q},email.ilike.${q}`)
        .limit(5);
      if (customers) {
        results.push(...customers.map((c: any) => ({
          id: c.id, type: "customer", icon: "person.2.fill", color: colors.primary,
          title: c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unbekannt",
          subtitle: c.email || "Kunde",
          route: `/customer/${c.id}`,
        })));
      }
      // Tickets
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, title, status")
        .ilike("title", q)
        .limit(5);
      if (tickets) {
        results.push(...tickets.map((t: any) => ({
          id: t.id, type: "ticket", icon: "ticket.fill", color: colors.warning,
          title: t.title,
          subtitle: `Ticket · ${t.status === "open" ? "Offen" : t.status === "in_progress" ? "In Bearbeitung" : t.status === "closed" ? "Geschlossen" : t.status}`,
          route: "/tickets",
        })));
      }
      // Invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, total")
        .ilike("invoice_number", q)
        .limit(5);
      if (invoices) {
        results.push(...invoices.map((inv: any) => ({
          id: inv.id, type: "invoice", icon: "doc.text.fill", color: colors.success,
          title: inv.invoice_number,
          subtitle: `Rechnung · CHF ${(inv.total || 0).toFixed(2)}`,
          route: `/invoice/${inv.id}`,
        })));
      }
      // Quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, status, total")
        .ilike("quote_number", q)
        .limit(5);
      if (quotes) {
        results.push(...quotes.map((qa: any) => ({
          id: qa.id, type: "quote", icon: "doc.text.fill", color: "#EC4899",
          title: qa.quote_number,
          subtitle: `Angebot · CHF ${(qa.total || 0).toFixed(2)}`,
          route: `/quote/${qa.id}`,
        })));
      }
      // Projekte
      const { data: projects } = await supabase
        .from("projects")
        .select("id, project_number, title, status")
        .or(`title.ilike.${q},project_number.ilike.${q}`)
        .limit(5);
      if (projects) {
        results.push(...projects.map((p: any) => ({
          id: p.id, type: "project", icon: "folder.fill", color: "#14B8A6",
          title: `${p.project_number} · ${p.title}`,
          subtitle: `Projekt · ${p.status === "in_progress" ? "Aktiv" : p.status === "completed" ? "Abgeschlossen" : p.status === "on_hold" ? "Pausiert" : "Planung"}`,
          route: "/projects",
        })));
      }
      // Verträge
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, contract_number, title, status")
        .or(`title.ilike.${q},contract_number.ilike.${q}`)
        .limit(5);
      if (contracts) {
        results.push(...contracts.map((c: any) => ({
          id: c.id, type: "contract", icon: "doc.on.doc.fill", color: "#6366F1",
          title: `${c.contract_number ? c.contract_number + " · " : ""}${c.title}`,
          subtitle: `Vertrag · ${c.status === "active" ? "Aktiv" : c.status === "cancelled" ? "Gekündigt" : "Abgelaufen"}`,
          route: "/contracts",
        })));
      }
    } catch (e) {
      console.warn("[Search] Error:", e);
    }
    return results;
}
