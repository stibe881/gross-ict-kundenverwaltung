/**
 * Client-side data layer — communicates directly with Supabase.
 * Replaces the old tRPC/Express server middleware.
 */
import { supabase } from "./supabase";
import { apiCall } from "./_core/api";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import { Platform } from "react-native";
import { showAlert } from "./alert";
export { supabase };

export async function triggerPushNotification(
    recipients: string[] | "all_admins",
    recipientType: "admin" | "customer",
    title: string,
    body: string,
    data?: any,
    category?: string
) {
    try {
        console.log("[Push] Sending via Edge Function:", { recipients, recipientType, title, category });
        const { data: result, error } = await supabase.functions.invoke('send-push', {
            body: { recipients, recipientType, title, body, data: { ...data, category } },
        });
        if (error) {
            const ctx = (error as any)?.context;
            let details = '';
            try {
                if (ctx && typeof ctx.json === 'function') {
                    const errBody = await ctx.json();
                    details = JSON.stringify(errBody);
                } else if (ctx && typeof ctx.text === 'function') {
                    details = await ctx.text();
                }
            } catch (_) { }
            console.error("[Push] Edge Function error:", error.message, "Details:", details);
        } else {
            console.log("[Push] Edge Function response:", JSON.stringify(result));
        }
    } catch (e) {
        console.error("[Push] Failed to send:", e);
    }
}

// ==================== APP-RELEASE (Admin) ====================

async function invokeAppUpdate(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('trigger-app-update', { body });
    if (error) {
        let details = '';
        try {
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.json === 'function') {
                const errBody = await ctx.json();
                details = errBody?.error || '';
            }
        } catch (_) { /* ignore */ }
        throw new Error(details || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
}

export async function triggerAppRelease(
    bump: "build" | "patch" | "minor" = "build",
    target: "all" | "apps" | "web" = "all"
) {
    return invokeAppUpdate({ action: 'trigger', bump, target });
}

export async function getAppReleaseStatus() {
    return invokeAppUpdate({ action: 'status' });
}

// ==================== DIGITALE VISITENKARTE ====================

// Kartendaten zentral im Benutzerprofil speichern (Spalte users.business_card),
// damit sie auf allen Geräten verfügbar sind. Braucht Migration 20261002_business_card.sql.
export async function getBusinessCard(email: string): Promise<any | null> {
    const { data, error } = await supabase
        .from("users")
        .select("business_card")
        .eq("email", email)
        .maybeSingle();
    if (error) {
        console.warn("[BusinessCard] Laden fehlgeschlagen:", error.message);
        return null;
    }
    return (data as any)?.business_card || null;
}

// Portal: Ansprechpartner-Karte (erste hinterlegte Visitenkarte eines Mitarbeiters)
export async function getPortalContactCard(): Promise<any | null> {
    const { data, error } = await supabase
        .from("users")
        .select("business_card")
        .not("business_card", "is", null)
        .limit(1)
        .maybeSingle();
    if (error) return null;
    return (data as any)?.business_card || null;
}

export async function saveBusinessCard(email: string, card: any): Promise<boolean> {
    const { data, error } = await supabase
        .from("users")
        .update({ business_card: card } as any)
        .eq("email", email)
        .select("id");
    if (error) {
        console.warn("[BusinessCard] Speichern fehlgeschlagen:", error.message);
        return false;
    }
    // RLS erlaubt nur das eigene Profil — 0 aktualisierte Zeilen heisst: nicht gespeichert
    return (data || []).length > 0;
}

// ==================== KUNDEN ====================

export async function getCustomersWithCounts() {
    const { data: customers, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    if (!customers || customers.length === 0) return [];

    const [contractsRes, ticketsRes, invoicesRes] = await Promise.all([
        supabase.from("contracts").select("customer_id, status"),
        supabase.from("tickets").select("customer_id, status"),
        supabase.from("invoices").select("customer_id, status"),
    ]);

    const contracts = contractsRes.data || [];
    const tickets = ticketsRes.data || [];
    const invoices = invoicesRes.data || [];

    return customers.map((customer: any) => {
        const activeContracts = contracts.filter(
            (c: any) => c.customer_id === customer.id && c.status === "active"
        ).length;
        const openTickets = tickets.filter(
            (t: any) =>
                t.customer_id === customer.id &&
                (t.status === "open" || t.status === "in_progress")
        ).length;
        const openInvoices = invoices.filter(
            (i: any) =>
                i.customer_id === customer.id &&
                (i.status === "open" || i.status === "overdue")
        ).length;

        return {
            ...customer,
            _counts: { activeContracts, openTickets, openInvoices },
        };
    });
}

export async function getCustomerById(id: string) {
    const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function createCustomer(customer: any) {
    const { data, error } = await supabase
        .from("customers")
        .insert([customer])
        .select()
        .single();

    if (error) throw new Error(error.message);
    logActivity("customer", data.id, "created", `Kunde "${data.company_name || `${data.first_name || ""} ${data.last_name || ""}`.trim()}" erstellt`);
    // Onboarding-Checkliste für den neuen Kunden anlegen
    try { await createOnboardingSteps(data.id); } catch (_) { /* optional */ }
    return data;
}

export async function updateCustomer(id: string, customer: any) {
    const { data, error } = await supabase
        .from("customers")
        .update(customer)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    logActivity("customer", id, "updated", `Kunde "${data.company_name || `${data.first_name || ""} ${data.last_name || ""}`.trim()}" geändert (${Object.keys(customer).join(", ")})`);
    return data;
}

export async function deleteCustomer(id: string) {
    // Papierkorb: Kundendaten + Kontakte + Links sichern (30 Tage wiederherstellbar)
    try {
        const [{ data: cust }, { data: contacts }, { data: links }] = await Promise.all([
            supabase.from("customers").select("*").eq("id", id).single(),
            (supabase as any).from("customer_contacts").select("*").eq("customer_id", id),
            (supabase as any).from("customer_links").select("*").eq("customer_id", id),
        ]);
        if (cust) {
            const label = (cust as any).company_name || `${(cust as any).first_name || ""} ${(cust as any).last_name || ""}`.trim() || "Kunde";
            await addToTrash("customer", label, { ...cust, contacts: contacts || [], links: links || [] });
            logActivity("customer", id, "deleted", `Kunde "${label}" gelöscht (inkl. Angebote, Rechnungen, Tickets, Verträge)`);
        }
    } catch (e) { console.warn("[trash] Kunden-Snapshot fehlgeschlagen:", e); }

    // 1. Quote-Items der Kunden-Angebote löschen
    const { data: customerQuotes } = await supabase
        .from("quotes")
        .select("id")
        .eq("customer_id", id);

    if (customerQuotes && customerQuotes.length > 0) {
        const quoteIds = customerQuotes.map((q: any) => q.id);
        await supabase.from("quote_items").delete().in("quote_id", quoteIds);
    }

    // 2. Angebote löschen
    await supabase.from("quotes").delete().eq("customer_id", id);

    // 3. Rechnungs-Positionen und Aktivitäten löschen
    const { data: customerInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("customer_id", id);

    if (customerInvoices && customerInvoices.length > 0) {
        const invoiceIds = customerInvoices.map((inv: any) => inv.id);
        await supabase.from("invoice_items").delete().in("invoice_id", invoiceIds);
        await supabase.from("invoice_activities").delete().in("invoice_id", invoiceIds);
    }

    // 4. Rechnungen löschen
    await supabase.from("invoices").delete().eq("customer_id", id);

    // 5. Tickets löschen
    await supabase.from("tickets").delete().eq("customer_id", id);

    // 6. Verträge löschen
    await supabase.from("contracts").delete().eq("customer_id", id);

    // 7. Kommunikationen löschen
    await supabase.from("communications").delete().eq("customer_id", id);

    // 8. Kunden-Kontakte löschen
    await supabase.from("customer_contacts").delete().eq("customer_id", id);

    // 9. Kunden-Benutzer löschen
    await (supabase as any).from("customer_users").delete().eq("customer_id", id);

    // 10. Kunden löschen
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

// ── Customer Logo ──

export async function uploadCustomerLogo(customerId: string, uri: string): Promise<string> {
    let fileData: FormData | Blob;
    let contentType = "image/jpeg";
    const ext = "jpeg";
    const path = `${customerId}/logo_${Date.now()}.${ext}`;

    if (uri.startsWith("data:")) {
        // Web/Expo: data URI from image picker
        // Use XMLHttpRequest which reliably converts data URIs to blobs
        const blob = await new Promise<Blob>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = () => reject(new Error("Failed to convert image"));
            xhr.responseType = "blob";
            xhr.open("GET", uri, true);
            xhr.send(null);
        });
        contentType = blob.type || "image/jpeg";

        const formData = new FormData();
        formData.append("", blob, `logo.${ext}`);
        fileData = formData;
    } else {
        // Native: file URI — fetch as blob (natively supported)
        const response = await fetch(uri);
        const blob = await response.blob();
        contentType = blob.type || "image/jpeg";

        const formData = new FormData();
        formData.append("", {
            uri: uri,
            name: `logo.${ext}`,
            type: contentType,
        } as any);
        fileData = formData;
    }

    const { error } = await supabase.storage
        .from("customer-logos")
        .upload(path, fileData, { contentType, upsert: true });
    if (error) throw new Error(error.message);

    const { data: publicUrlData } = supabase.storage
        .from("customer-logos")
        .getPublicUrl(path);

    // Update the customer record
    await updateCustomer(customerId, { logo_url: publicUrlData.publicUrl });
    return publicUrlData.publicUrl;
}

// ── Customer Contacts ──

export async function getCustomerContacts(customerId: string) {
    const { data, error } = await supabase
        .from("customer_contacts")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_primary", { ascending: false })
        .order("last_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createCustomerContact(contact: any) {
    const { data, error } = await supabase
        .from("customer_contacts")
        .insert([contact])
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateCustomerContact(id: string, updates: any) {
    const { data, error } = await supabase
        .from("customer_contacts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteCustomerContact(id: string) {
    const { error } = await supabase.from("customer_contacts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

// ==================== PRODUKTE ====================

export async function getAllProducts() {
    const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createProduct(product: any) {
    const { data, error } = await supabase
        .from("products")
        .insert([{
            name: product.name,
            description: product.description,
            price: product.price,
            vat_rate: product.vatRate ?? product.vat_rate ?? 8.1,
            unit: product.unit,
            type: product.type,
            category: product.category || null,
            purchase_price: product.purchase_price ?? null,
        }])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateProduct(id: string, product: any) {
    const cleanProduct: any = {};
    for (const [key, value] of Object.entries(product)) {
        if (value !== undefined) cleanProduct[key] = value;
    }

    const { data, error } = await supabase
        .from("products")
        .update(cleanProduct)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ==================== RECHNUNGEN ====================

export async function getNextInvoiceNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `RE-${currentYear}-`;

    // Check existing invoices for the highest number
    const { data: invoiceData } = await supabase
        .from("invoices")
        .select("invoice_number")
        .like("invoice_number", `${prefix}%`)
        .order("invoice_number", { ascending: false })
        .limit(1);

    // Also check invoice_activities for "created" entries — these persist after deletion
    const { data: activityData } = await supabase
        .from("invoice_activities")
        .select("description")
        .like("description", `%${prefix}%`)
        .order("created_at", { ascending: false })
        .limit(50);

    let maxSeq = 0;

    // Check max from existing invoices
    if (invoiceData && invoiceData.length > 0) {
        const seq = parseInt(invoiceData[0].invoice_number.replace(prefix, ""), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }

    // Check max from activities (catches deleted invoices)
    if (activityData) {
        for (const act of activityData) {
            const match = act.description?.match(new RegExp(`${prefix.replace('-', '\\-')}(\\d+)`));
            if (match) {
                const seq = parseInt(match[1], 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        }
    }

    return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export async function getAllInvoices() {
    const { data, error } = await supabase
        .from("invoices")
        .select(`*, customer:customers(*), items:invoice_items(*)`)
        .order("invoice_date", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getInvoiceById(id: string) {
    const { data, error } = await supabase
        .from("invoices")
        .select(`*, customer:customers(*), items:invoice_items(*)`)
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function getCustomerInvoices(customerId: string) {
    const { data, error } = await supabase
        .from("invoices")
        .select(`*, items:invoice_items(*), installments:invoice_installments(*)`)
        .eq("customer_id", customerId)
        .order("invoice_date", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createInvoice(invoice: any, items: any[]) {
    const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert([invoice])
        .select()
        .single();

    if (invoiceError) throw new Error(invoiceError.message);
    logActivity("invoice", invoiceData.id, "created", `Rechnung ${invoiceData.invoice_number} erstellt`);

    if (items.length > 0) {
        const itemsWithId = items.map((item) => ({
            ...item,
            invoice_id: invoiceData.id,
        }));

        const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(itemsWithId);

        if (itemsError) throw new Error(itemsError.message);
    }

    try {
        await addInvoiceActivity(invoiceData.id, "created", `Rechnung ${invoice.invoice_number} wurde erstellt.`);
    } catch (_) { /* ignore */ }

    return invoiceData;
}

export async function updateInvoice(id: string, invoice: any, items: any[]) {
    // Vor dem Update die alten Daten laden, um einen Diff zu erzeugen
    const { data: oldInvoice } = await supabase.from('invoices').select('*').eq('id', id).single();
    const { data: oldItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', id);

    const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .update(invoice)
        .eq("id", id)
        .select()
        .single();

    if (invoiceError) throw new Error(invoiceError.message);

    // Delete old items, insert new
    const { error: deleteError } = await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", id);

    if (deleteError) throw new Error(deleteError.message);

    if (items.length > 0) {
        const itemsWithId = items.map((item) => ({
            ...item,
            invoice_id: id,
        }));

        const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(itemsWithId);

        if (itemsError) throw new Error(itemsError.message);
    }

    try {
        const changedFields: string[] = [];
        if (oldInvoice) {
            if (invoice.customer_id && invoice.customer_id !== oldInvoice.customer_id) changedFields.push("Kunde");
            if (invoice.invoice_number && invoice.invoice_number !== oldInvoice.invoice_number) changedFields.push("Rechnungsnummer");
            if (invoice.invoice_date && invoice.invoice_date !== oldInvoice.invoice_date) changedFields.push("Rechnungsdatum");
            if (invoice.due_date && invoice.due_date !== oldInvoice.due_date) changedFields.push("Fälligkeitsdatum");
            if (invoice.total !== undefined && Number(invoice.total) !== Number(oldInvoice.total)) changedFields.push(`Total (CHF ${oldInvoice.total} -> CHF ${invoice.total})`);
            if (invoice.notes !== undefined && invoice.notes !== oldInvoice.notes) changedFields.push("Notizen");
            if (invoice.status && invoice.status !== oldInvoice.status) changedFields.push("Status");
        }

        let itemsChanged = false;
        if (oldItems) {
            if (oldItems.length !== items.length) itemsChanged = true;
            else {
               const oldTotal = oldItems.reduce((acc: number, i: any) => acc + Number(i.total), 0);
               const newTotal = items.reduce((acc: number, i: any) => acc + Number(i.total), 0);
               if (oldTotal !== newTotal) itemsChanged = true;
               else {
                   const oldDesc = oldItems.map((i: any) => i.description).sort().join();
                   const newDesc = items.map((i: any) => i.description).sort().join();
                   if (oldDesc !== newDesc) itemsChanged = true;
               }
            }
        }
        if (itemsChanged) changedFields.push("Positionen");

        let text = `Rechnung ${invoice.invoice_number || invoiceData.invoice_number} wurde bearbeitet.`;
        if (changedFields.length > 0) {
            text += ` Geändert: ${changedFields.join(", ")}`;
        }

        await addInvoiceActivity(id, "edited", text);
    } catch (_) { /* ignore */ }

    return invoiceData;
}

export async function deleteInvoice(id: string) {
    // Papierkorb: Rechnung + Positionen sichern (30 Tage wiederherstellbar)
    try {
        const [{ data: inv }, { data: items }] = await Promise.all([
            supabase.from("invoices").select("*").eq("id", id).single(),
            supabase.from("invoice_items").select("*").eq("invoice_id", id),
        ]);
        if (inv) {
            await addToTrash("invoice", `Rechnung ${(inv as any).invoice_number}`, { ...inv, items: items || [] });
            logActivity("invoice", id, "deleted", `Rechnung ${(inv as any).invoice_number} gelöscht`);
        }
    } catch (e) { console.warn("[trash] Rechnungs-Snapshot fehlgeschlagen:", e); }

    const { error: itemsError } = await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", id);
    if (itemsError) throw new Error(itemsError.message);

    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function addPayment(invoiceId: string, amount: number, method?: string) {
    const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("total, paid_amount")
        .eq("id", invoiceId)
        .single();
    if (fetchError) throw new Error(fetchError.message);

    const newPaidAmount = (invoice.paid_amount || 0) + amount;
    const newStatus = newPaidAmount >= invoice.total ? "paid" : "open";

    const { data, error } = await supabase
        .from("invoices")
        .update({ paid_amount: newPaidAmount, status: newStatus })
        .eq("id", invoiceId)
        .select()
        .single();
    if (error) throw new Error(error.message);

    try {
        await addInvoiceActivity(invoiceId, "payment_added", `Zahlung von CHF ${amount.toFixed(2)}${method ? ` via ${method}` : ""} erfasst. ${newStatus === "paid" ? "Rechnung vollständig bezahlt." : ""}`);
    } catch (_) { /* ignore */ }

    return data;
}

export async function getInvoiceActivities(invoiceId: string) {
    const { data, error } = await supabase
        .from("invoice_activities")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addInvoiceActivity(
    invoiceId: string,
    type: string,
    description: string,
    userName?: string
) {
    let resolvedName = userName;
    if (!resolvedName) {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData?.session?.user;
            if (user) {
                const { data: profile } = await supabase.from("users").select("name").eq("id", user.id).single();
                if (profile && profile.name) resolvedName = profile.name;
                else if (user.user_metadata) resolvedName = `${user.user_metadata.first_name || user.user_metadata.name || ""} ${user.user_metadata.last_name || ""}`.trim();
                if (!resolvedName && user.email) resolvedName = user.email.split("@")[0];
            }
        } catch (e) {}
    }

    const { data, error } = await supabase
        .from("invoice_activities")
        .insert({
            invoice_id: invoiceId,
            type,
            description,
            user_name: resolvedName || "System",
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ==================== VERTRÄGE ====================

export async function getCustomerContracts(customerId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    let isAdmin = false;
    if (session?.user?.id) {
        const { data: profile } = await supabase.from('users').select('roles').eq('id', session.user.id).single();
        if (profile?.roles?.includes('admin')) isAdmin = true;
    }

    let query = supabase
        .from("contracts")
        .select("*")
        .eq("customer_id", customerId)
        .order("start_date", { ascending: false });

    if (!isAdmin) {
        query = query.eq('is_internal', false);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data || [];
}

// ==================== TICKETS ====================

export async function getAllTickets() {
    const { data, error } = await supabase
        .from("tickets")
        .select(`*, customer:customers(company_name, first_name, last_name)`)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getCustomerTickets(customerId: string) {
    const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

// Prüft, ob ein Kunde einen aktiven (nicht gekündigten) Vertrag hat
export async function customerHasActiveContract(customerId: string): Promise<boolean> {
    if (!customerId) return false;
    const { count, error } = await supabase
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .eq("status", "active")
        .is("cancellation_date", null);
    if (error) return false;
    return (count || 0) > 0;
}

export async function createTicket(ticket: any) {
    // Automatik: Kunde mit aktivem Vertrag → Ticket als "im Vertrag abgedeckt" markieren
    // (manuell übersteuerbar; explizit gesetzter Wert wird nicht überschrieben)
    if (ticket.customer_id && ticket.covered_by_contract === undefined) {
        try {
            ticket = { ...ticket, covered_by_contract: await customerHasActiveContract(ticket.customer_id) };
        } catch (_) { /* Automatik ist optional */ }
    }

    const { data, error } = await supabase
        .from("tickets")
        .insert([ticket])
        .select()
        .single();

    if (error) throw new Error(error.message);
    logActivity("ticket", data.id, "created", `Ticket "${data.title}" erstellt`);

    // Push Notifizierung: Neues Ticket
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id;
        
        let authorName = 'Ein Benutzer';
        if (currentUserId) {
            if (session?.user?.user_metadata?.customer_id) {
                const { data: cUser } = await supabase.from('customer_portal_users').select('first_name, last_name').eq('id', currentUserId).single();
                const cName = cUser ? `${cUser.first_name || ""} ${cUser.last_name || ""}`.trim() : "";
                if (cName) authorName = cName;
            } else {
                const { data: aUser } = await supabase.from('users').select('name').eq('id', currentUserId).single();
                if (aUser?.name) authorName = aUser.name;
            }
        }
        await triggerPushNotification(
            "all_admins",
            "admin",
            "Neues Ticket erstellt",
            `${authorName} hat ein neues Ticket "${data.title}" erstellt.`,
            { url: `/tickets?ticketId=${data.id}` },
            "portal"
        );
    } catch (e) {
        console.warn("Fehler beim Ticket Create Push:", e);
    }

    return data;
}

export async function updateTicket(id: string, updates: any) {
    const { data, error } = await supabase
        .from("tickets")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Push Notifizierung bei Zuweisung
    if (updates.assigned_to) {
        try {
            await triggerPushNotification(
                [updates.assigned_to],
                "admin",
                "Ticket zugewiesen",
                `Ihnen wurde das Ticket "${data.title}" zugewiesen.`,
                { url: `/tickets?ticketId=${data.id}` },
                "portal"
            );
        } catch (e) {
            console.warn("Fehler beim Ticket Update Push:", e);
        }
    }

    return data;
}

export async function deleteTicket(id: string) {
    // Papierkorb: Ticket + Kommentare + Positionen sichern (30 Tage wiederherstellbar)
    try {
        const [{ data: ticket }, { data: comments }, { data: items }] = await Promise.all([
            supabase.from("tickets").select("*").eq("id", id).single(),
            supabase.from("ticket_comments").select("*").eq("ticket_id", id),
            supabase.from("ticket_items").select("*").eq("ticket_id", id),
        ]);
        if (ticket) {
            await addToTrash("ticket", `Ticket "${(ticket as any).title}"`, { ...ticket, comments: comments || [], items: items || [] });
            logActivity("ticket", id, "deleted", `Ticket "${(ticket as any).title}" gelöscht`);
        }
    } catch (e) { console.warn("[trash] Ticket-Snapshot fehlgeschlagen:", e); }

    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getTicketComments(ticketId: string) {
    const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addTicketComment(ticketId: string, comment: string, userName: string = "Admin", isInternal: boolean = true) {
    const { data, error } = await supabase
        .from("ticket_comments")
        .insert({
            ticket_id: ticketId,
            comment,
            user_name: userName,
            is_internal: isInternal,
            is_system: false,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ==================== KOMMUNIKATION ====================

export async function getCustomerCommunications(customerId: string) {
    const { data, error } = await supabase
        .from("communications")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createCommunication(communication: any) {
    const { data, error } = await supabase
        .from("communications")
        .insert([communication])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}


// ==================== ANGEBOTE (QUOTES) ====================

export async function getNextQuoteNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `AN-${currentYear}-`;

    const { data } = await supabase
        .from("quotes")
        .select("quote_number")
        .like("quote_number", `${prefix}%`)
        .order("quote_number", { ascending: false })
        .limit(1);

    let maxSeq = 0;
    if (data && data.length > 0) {
        const seq = parseInt(data[0].quote_number.replace(prefix, ""), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }

    return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export async function getAllQuotes() {
    const { data, error } = await supabase
        .from("quotes")
        .select(`*, customer:customers(*), items:quote_items(*)`)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getCustomerQuotes(customerId: string) {
    const { data, error } = await supabase
        .from("quotes")
        .select(`*, items:quote_items(*)`)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

// ── Kunden-Timeline: alle Aktivitäten eines Kunden chronologisch ──
export interface TimelineEvent {
    id: string;
    date: string;
    category: "invoice" | "contract" | "quote" | "ticket" | "project";
    title: string;
    subtitle?: string;
    user_name?: string;
}

export async function getCustomerTimeline(customerId: string): Promise<TimelineEvent[]> {
    const [invoicesRes, contractsRes, quotesRes, ticketsRes, projectsRes] = await Promise.all([
        supabase.from("invoices").select("id, invoice_number").eq("customer_id", customerId),
        supabase.from("contracts").select("id, contract_number, title").eq("customer_id", customerId),
        supabase.from("quotes").select("id, quote_number").eq("customer_id", customerId),
        supabase.from("tickets").select("id, title, status, created_at").eq("customer_id", customerId),
        supabase.from("projects").select("id, project_number, title, status, created_at").eq("customer_id", customerId),
    ]);

    const invoices = invoicesRes.data || [];
    const contracts = contractsRes.data || [];
    const quotes = quotesRes.data || [];
    const tickets = ticketsRes.data || [];
    const projects = projectsRes.data || [];

    const invoiceIds = invoices.map((i: any) => i.id);
    const contractIds = contracts.map((c: any) => c.id);
    const quoteIds = quotes.map((q: any) => q.id);

    const [invActsRes, conActsRes, quoActsRes] = await Promise.all([
        invoiceIds.length
            ? supabase.from("invoice_activities").select("id, invoice_id, description, user_name, created_at").in("invoice_id", invoiceIds)
            : Promise.resolve({ data: [] as any[] }),
        contractIds.length
            ? supabase.from("contract_activities").select("id, contract_id, description, user_name, created_at").in("contract_id", contractIds)
            : Promise.resolve({ data: [] as any[] }),
        quoteIds.length
            ? supabase.from("quote_activities").select("id, quote_id, description, user_name, created_at").in("quote_id", quoteIds)
            : Promise.resolve({ data: [] as any[] }),
    ]);

    const invoiceNumberById = new Map(invoices.map((i: any) => [i.id, i.invoice_number]));
    const contractLabelById = new Map(contracts.map((c: any) => [c.id, c.contract_number || c.title]));
    const quoteNumberById = new Map(quotes.map((q: any) => [q.id, q.quote_number]));

    const events: TimelineEvent[] = [];

    for (const a of invActsRes.data || []) {
        events.push({
            id: `inv-${a.id}`,
            date: a.created_at,
            category: "invoice",
            title: `Rechnung ${invoiceNumberById.get(a.invoice_id) || ""}`.trim(),
            subtitle: a.description,
            user_name: a.user_name,
        });
    }
    for (const a of conActsRes.data || []) {
        events.push({
            id: `con-${a.id}`,
            date: a.created_at,
            category: "contract",
            title: `Vertrag ${contractLabelById.get(a.contract_id) || ""}`.trim(),
            subtitle: a.description,
            user_name: a.user_name,
        });
    }
    for (const a of quoActsRes.data || []) {
        events.push({
            id: `quo-${a.id}`,
            date: a.created_at,
            category: "quote",
            title: `Angebot ${quoteNumberById.get(a.quote_id) || ""}`.trim(),
            subtitle: a.description,
            user_name: a.user_name,
        });
    }
    for (const t of tickets) {
        if (!t.created_at) continue;
        events.push({
            id: `tic-${t.id}`,
            date: t.created_at,
            category: "ticket",
            title: "Ticket erstellt",
            subtitle: t.title,
        });
    }
    for (const p of projects) {
        if (!p.created_at) continue;
        events.push({
            id: `pro-${p.id}`,
            date: p.created_at,
            category: "project",
            title: `Projekt ${p.project_number || ""} erstellt`.replace("  ", " "),
            subtitle: p.title,
        });
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events.slice(0, 100);
}

export async function getQuoteById(id: string) {
    const { data, error } = await supabase
        .from("quotes")
        .select(`*, customer:customers(*), items:quote_items(*)`)
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ── Angebots-Vorlagen ──
export async function getQuoteTemplates() {
    // quote_templates ist noch nicht in den generierten DB-Typen enthalten
    const { data, error } = await (supabase as any)
        .from("quote_templates")
        .select("*")
        .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createQuoteTemplate(template: {
    name: string;
    notes?: string | null;
    special_discount?: number;
    special_discount_type?: string;
    items: any[];
}) {
    const { data, error } = await (supabase as any)
        .from("quote_templates")
        .insert([template])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteQuoteTemplate(id: string) {
    const { error } = await (supabase as any).from("quote_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function createQuote(quote: any, items: any[]) {
    const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .insert([quote])
        .select()
        .single();

    if (quoteError) throw new Error(quoteError.message);
    logActivity("quote", quoteData.id, "created", `Angebot ${quoteData.quote_number} erstellt`);

    if (items.length > 0) {
        const itemsWithId = items.map((item) => ({
            ...item,
            quote_id: quoteData.id,
        }));

        const { error: itemsError } = await supabase
            .from("quote_items")
            .insert(itemsWithId);

        if (itemsError) throw new Error(itemsError.message);
    }

    try {
        await logQuoteActivity(quoteData.id, "created", "Angebot erstellt.");
    } catch (_) { /* ignore error so we don't block */ }

    return quoteData;
}

export async function updateQuote(id: string, quote: any, items: any[]) {
    const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .update(quote)
        .eq("id", id)
        .select()
        .single();

    if (quoteError) throw new Error(quoteError.message);

    // Delete old items, insert new
    await supabase.from("quote_items").delete().eq("quote_id", id);

    if (items.length > 0) {
        const itemsWithId = items.map((item) => ({
            ...item,
            quote_id: id,
        }));
        await supabase.from("quote_items").insert(itemsWithId);
    }

    try {
        await logQuoteActivity(id, "edited", "Angebot bearbeitet.");
    } catch (_) { /* ignore error so we don't block */ }

    return quoteData;
}

export async function deleteQuote(id: string) {
    try {
        const { data: q } = await supabase.from("quotes").select("quote_number").eq("id", id).single();
        if (q) logActivity("quote", id, "deleted", `Angebot ${(q as any).quote_number} gelöscht`);
    } catch (_) { /* Log ist optional */ }

    await supabase.from("quote_items").delete().eq("quote_id", id);
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function convertQuoteToInvoice(quoteId: string, includeOptions: boolean = false) {
    // 1. Fetch the quote with items
    const quote = await getQuoteById(quoteId);
    if (!quote) throw new Error("Angebot nicht gefunden");

    // 2. Get next invoice number
    const invoiceNumber = await getNextInvoiceNumber();

    // 3. Create the invoice
    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Optionale Positionen nur übernehmen, wenn gewünscht;
    // quote.subtotal/tax/total sind immer OHNE Optionen gerechnet
    const allItems = (quote.items || []) as any[];
    const invoiceItems = allItems.filter((it: any) => !it.optional || includeOptions);
    let optionalTotal = 0;
    let optionalTax = 0;
    if (includeOptions) {
        allItems.filter((it: any) => !!it.optional).forEach((it: any) => {
            optionalTotal += it.total || 0;
            optionalTax += (it.total || 0) * ((it.vat_rate ?? 8.1) / 100);
        });
    }

    // Verknüpfung: Quell-Angebot und (falls vorhanden) zugehöriges Projekt
    const linkedProject = await getProjectForQuote(quoteId).catch(() => null);

    const invoice = await createInvoice(
        {
            customer_id: quote.customer_id,
            invoice_number: invoiceNumber,
            invoice_date: today,
            due_date: dueDate,
            subtotal: (quote.subtotal || 0) + optionalTotal,
            vat_amount: (quote.tax || 0) + optionalTax,
            total: (quote.total || 0) + optionalTotal + optionalTax,
            status: "draft",
            quote_id: quoteId,
            project_id: linkedProject?.id || null,
        },
        invoiceItems.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            vat_rate: item.vat_rate,
            total: item.total,
            product_id: item.product_id || null,
        }))
    );

    // 4. Mark quote as accepted
    await supabase.from("quotes").update({ status: "accepted" }).eq("id", quoteId);

    // Neutrale Meldung: Die Umwandlung wurde intern ausgelöst – "Angebot
    // angenommen" meldet bereits die Online-Annahme durch den Kunden
    if (quote.quote_number) {
        triggerPushNotification(
            "all_admins",
            "admin",
            "Rechnung erstellt",
            `Aus Angebot ${quote.quote_number} wurde die Rechnung ${invoice.invoice_number} erstellt.`,
            { url: `/invoice/${invoice.id}` },
            "invoices"
        );
    }

    return invoice;
}

// ─── Dokumentenablage pro Kunde (Storage-Bucket customer-documents) ─────────

export async function listCustomerDocuments(customerId: string) {
    const { data, error } = await supabase.storage
        .from("customer-documents")
        .list(customerId, { sortBy: { column: "created_at", order: "desc" }, limit: 100 });
    if (error) throw new Error(error.message);
    return (data || []).filter((f: any) => f.name && !f.name.startsWith("."));
}

export async function uploadCustomerDocument(customerId: string, uri: string, filename: string) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const safeName = filename.replace(/[^a-zA-Z0-9äöüÄÖÜ._\- ]/g, "_");
    const path = `${customerId}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage
        .from("customer-documents")
        .upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
    if (error) throw new Error(error.message);
    return path;
}

export async function getCustomerDocumentUrl(customerId: string, name: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from("customer-documents")
        .createSignedUrl(`${customerId}/${name}`, 3600);
    if (error || !data?.signedUrl) throw new Error(error?.message || "Link konnte nicht erstellt werden");
    return data.signedUrl;
}

export async function deleteCustomerDocument(customerId: string, name: string) {
    const { error } = await supabase.storage
        .from("customer-documents")
        .remove([`${customerId}/${name}`]);
    if (error) throw new Error(error.message);
}

// ─── Kunden-Profitabilität ───────────────────────────────────────────────────
// Umsatz = Zahlungseingänge aus Rechnungen des Jahres
// Kosten = interne Kosten aktiver Verträge + im Vertrag abgedeckte Ticket-Aufwände
export async function getCustomerProfitability(year: number) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const [invoicesRes, contractsRes, ticketsRes] = await Promise.all([
        supabase.from("invoices")
            .select("customer_id, total, paid_amount, status, invoice_date")
            .gte("invoice_date", start).lte("invoice_date", end)
            .not("customer_id", "is", null),
        supabase.from("contracts")
            .select("customer_id, internal_costs")
            .eq("status", "active")
            .not("customer_id", "is", null),
        supabase.from("tickets")
            .select("customer_id, created_at, items:ticket_items(quantity, unit_price)")
            .eq("covered_by_contract", true)
            .gte("created_at", start)
            .not("customer_id", "is", null),
    ]);

    const map: Record<string, { revenue: number; internalCosts: number; coveredEffort: number }> = {};
    const entry = (id: string) => (map[id] = map[id] || { revenue: 0, internalCosts: 0, coveredEffort: 0 });

    for (const inv of invoicesRes.data || []) {
        const e = entry(inv.customer_id as string);
        if (inv.paid_amount && inv.paid_amount > 0) e.revenue += inv.paid_amount;
        else if (inv.status === "paid") e.revenue += inv.total || 0;
    }
    for (const c of contractsRes.data || []) {
        entry(c.customer_id as string).internalCosts += c.internal_costs || 0;
    }
    for (const t of ticketsRes.data || []) {
        const e = entry((t as any).customer_id as string);
        e.coveredEffort += ((t as any).items || []).reduce(
            (s: number, i: any) => s + (i.quantity || 0) * (i.unit_price || 0), 0,
        );
    }

    const ids = Object.keys(map);
    if (ids.length === 0) return [];
    const { data: customers } = await supabase
        .from("customers")
        .select("id, company_name, first_name, last_name")
        .in("id", ids);
    const nameFor = (id: string) => {
        const c = (customers || []).find((x: any) => x.id === id);
        return c?.company_name || `${c?.first_name || ""} ${c?.last_name || ""}`.trim() || "Unbekannt";
    };

    return ids
        .map((id) => {
            const e = map[id];
            const costs = e.internalCosts + e.coveredEffort;
            return { customerId: id, name: nameFor(id), revenue: e.revenue, costs, coveredEffort: e.coveredEffort, internalCosts: e.internalCosts, margin: e.revenue - costs };
        })
        .filter((r) => r.revenue > 0 || r.costs > 0)
        .sort((a, b) => b.margin - a.margin);
}

// ─── Modul-Verknüpfungen (Angebot ↔ Projekt ↔ Rechnung) ─────────────────────

export async function getProjectForQuote(quoteId: string) {
    const { data } = await supabase
        .from("projects")
        .select("id, project_number, title, status")
        .eq("quote_id", quoteId)
        .limit(1)
        .maybeSingle();
    return data || null;
}

export async function getInvoicesForQuote(quoteId: string) {
    const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, total")
        .eq("quote_id", quoteId as any)
        .order("created_at", { ascending: false });
    return data || [];
}

export async function getInvoicesForProject(projectId: string) {
    const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, total")
        .eq("project_id", projectId as any)
        .order("created_at", { ascending: false });
    return data || [];
}

export async function getQuoteBasic(quoteId: string) {
    const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, status, total")
        .eq("id", quoteId)
        .maybeSingle();
    return data || null;
}

// Tickets eines Projekts inkl. Aufwandssumme (aus ticket_items)
export async function getProjectTickets(projectId: string) {
    const { data } = await supabase
        .from("tickets")
        .select("id, title, status, created_at, items:ticket_items(quantity, unit_price)")
        .eq("project_id" as any, projectId)
        .order("created_at", { ascending: false });
    return (data || []).map((t: any) => ({
        ...t,
        itemsTotal: (t.items || []).reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unit_price || 0), 0),
    }));
}

// Laufende Projekte eines Kunden (für die Zuordnung im Ticket)
export async function getCustomerProjects(customerId: string) {
    const { data } = await supabase
        .from("projects")
        .select("id, project_number, title, status")
        .eq("customer_id", customerId)
        .in("status", ["planning", "in_progress", "on_hold"])
        .order("created_at", { ascending: false });
    return data || [];
}

export async function getProjectBasic(projectId: string) {
    const { data } = await supabase
        .from("projects")
        .select("id, project_number, title, status")
        .eq("id", projectId)
        .maybeSingle();
    return data || null;
}

export async function updateQuoteStatus(quoteId: string, status: string) {
    const { error } = await supabase
        .from("quotes")
        .update({ status })
        .eq("id", quoteId);
    if (error) throw new Error(error.message);

    // Push wenn Angebot angenommen
    if (status === "accepted") {
        const quote = await getQuoteById(quoteId).catch(() => null);
        if (quote) {
            triggerPushNotification(
                "all_admins",
                "admin",
                "Angebot angenommen",
                `Das Angebot ${quote.quote_number || quoteId} wurde angenommen!`,
                { url: `/quotes?quoteId=${quoteId}` },
                "quotes"
            );
        }
    }
}

// Auto-expire quotes whose valid_until date has passed
export async function autoExpireQuotes() {
    const today = new Date().toISOString().split("T")[0];
    await supabase
        .from("quotes")
        .update({ status: "expired" })
        .in("status", ["draft", "sent"])
        .lt("valid_until", today)
        .not("valid_until", "is", null);
}

export async function sendQuoteEmail(quoteId: string, pdfBase64: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-quote-email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || anonKey}`,
            "apikey": anonKey || "",
        },
        body: JSON.stringify({ quoteId, pdfBase64 }),
    });

    if (!response.ok) {
        let errorMsg = "E-Mail konnte nicht gesendet werden";
        try {
            const errData = await response.json();
            if (errData.error) errorMsg = errData.error;
        } catch(e) {
            errorMsg = `Serverfehler (${response.status}): ${await response.text()}`;
        }
        throw new Error(errorMsg);
    }
    
    return await response.json();
}

// ==================== VERTRÄGE ====================

export async function getContracts() {
    const { data: { session } } = await supabase.auth.getSession();
    let isAdmin = false;
    if (session?.user?.id) {
        const { data: profile } = await supabase.from('users').select('roles').eq('id', session.user.id).single();
        if (profile?.roles?.includes('admin')) isAdmin = true;
    }

    let query = supabase
        .from("contracts")
        .select("*, customers(company_name, first_name, last_name)")
        .order("created_at", { ascending: false });

    if (!isAdmin) {
        query = query.eq("is_internal", false);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let allUsers: any[] = [];
    if (isAdmin) {
        const { data: ud } = await supabase.from('users').select('id, name, email');
        allUsers = ud || [];
    }

    return (data || []).map((c: any) => {
        let empName = 'Mitarbeiter';
        if (c.is_internal && c.employee_id) {
            const u = allUsers.find(x => x.id === c.employee_id);
            if (u) empName = u.name || u.email || 'Mitarbeiter';
        }

        return {
            ...c,
            customer_name: c.is_internal
                ? empName
                : (c.customers?.company_name ||
                    `${c.customers?.first_name || ''} ${c.customers?.last_name || ''}`.trim() ||
                    'Unbekannt'),
        };
    });
}

// Payment terms options
export const PAYMENT_TERMS_OPTIONS = [
    { key: "7", label: "7 Tage netto", days: 7 },
    { key: "14", label: "14 Tage netto", days: 14 },
    { key: "30", label: "30 Tage netto", days: 30 },
] as const;

// Billing cycle configuration
export const BILLING_CYCLES = [
    { key: "monthly", label: "Monatlich", months: 1, surcharge: 2 },
    { key: "quarterly", label: "Quartal", months: 3, surcharge: 2 },
    { key: "semi_annual", label: "Halbjährlich", months: 6, surcharge: 2 },
    { key: "yearly", label: "Jährlich", months: 12, surcharge: 0 },
] as const;

export function calculateCycleAmount(annualAmount: number, cycleKey: string): { baseAmount: number; surcharge: number; totalAmount: number } {
    const cycle = BILLING_CYCLES.find(c => c.key === cycleKey) || BILLING_CYCLES[3];
    const baseAmount = Math.round((annualAmount / 12 * cycle.months) * 100) / 100;
    return { baseAmount, surcharge: cycle.surcharge, totalAmount: baseAmount + cycle.surcharge };
}

function calculateNextInvoiceDate(fromDate: string, cycleKey: string): string {
    const date = new Date(fromDate);
    const cycle = BILLING_CYCLES.find(c => c.key === cycleKey) || BILLING_CYCLES[3];
    date.setMonth(date.getMonth() + cycle.months);
    return date.toISOString().split("T")[0];
}

export async function createRecurringInvoiceFromContract(contract: any): Promise<any> {
    const invoiceNumber = await getNextInvoiceNumber();
    const { baseAmount, surcharge, totalAmount } = calculateCycleAmount(
        contract.annual_amount || contract.amount || 0,
        contract.billing_cycle || "yearly"
    );
    const cycleName = BILLING_CYCLES.find(c => c.key === contract.billing_cycle)?.label || "Jährlich";
    const today = new Date().toISOString().split("T")[0];

    // Parse payment terms days from contract (e.g. "30 Tage netto" → 30)
    const ptMatch = (contract.payment_terms || "").match(/(\d+)/);
    const paymentDays = ptMatch ? parseInt(ptMatch[1]) : 30;
    const dueDate = new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const vatRate = contract.vat_rate ?? 0;
    const vatMultiplier = vatRate / 100;

    const items: any[] = [
        {
            description: `${contract.title} — ${cycleName}e Abrechnung`,
            quantity: 1,
            unit: "Pauschale",
            unit_price: baseAmount,
            vat_rate: vatRate,
            total: baseAmount,
        },
    ];
    if (surcharge > 0) {
        items.push({
            description: `Zuschlag ${cycleName}e Abrechnung`,
            quantity: 1,
            unit: "Pauschale",
            unit_price: surcharge,
            vat_rate: vatRate,
            total: surcharge,
        });
    }

    const invoice = await createInvoice({
        customer_id: contract.customer_id,
        invoice_number: invoiceNumber,
        invoice_date: today,
        due_date: dueDate,
        subtotal: totalAmount,
        vat_amount: Math.round(totalAmount * vatMultiplier * 100) / 100,
        total: Math.round(totalAmount * (1 + vatMultiplier) * 100) / 100,
        status: "open",
        notes: `Automatische Rechnung aus Vertrag: ${contract.title}`,
    }, items);

    // Update contract with last/next invoice date
    const nextDate = calculateNextInvoiceDate(today, contract.billing_cycle || "yearly");
    await supabase.from("contracts").update({
        last_invoice_date: today,
        next_invoice_date: nextDate,
        updated_at: new Date().toISOString(),
    }).eq("id", contract.id);

    return invoice;
}

export async function getNextContractNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `VT-${currentYear}-`;

    // Höchste bestehende Nummer für dieses Jahr suchen
    const { data: contractData } = await supabase
        .from("contracts")
        .select("contract_number")
        .like("contract_number", `${prefix}%`)
        .order("contract_number", { ascending: false })
        .limit(1);

    let maxSeq = 0;
    if (contractData && contractData.length > 0) {
        const seq = parseInt((contractData[0].contract_number || "").replace(prefix, ""), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }

    return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export async function createContract(contract: {
    customer_id?: string | null;
    employee_id?: string | null;
    title: string;
    description?: string;
    amount?: number;
    start_date: string;
    end_date?: string;
    duration_months?: number;
    notice_period_months?: number;
    template_id?: string;
    contact_person?: string;
    payment_terms?: string;
    scope_of_services?: string;
    special_agreements?: string;
    cancellation_date?: string;
    cancellation_document_url?: string;
    recurring_enabled?: boolean;
    billing_cycle?: string;
    next_invoice_date?: string;
    auto_renewal?: boolean;
    vat_rate?: number;
    is_internal?: boolean;
}) {
    // Vertragsnummer automatisch generieren
    const contractNumber = await getNextContractNumber();

    // Calculate next_invoice_date if recurring is enabled
    const insertData: any = { ...contract, status: "active", contract_number: contractNumber };
    if (contract.recurring_enabled && !contract.next_invoice_date) {
        insertData.next_invoice_date = contract.start_date;
    }

    const { data, error } = await supabase
        .from("contracts")
        .insert([insertData])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateContract(id: string, updates: any) {
    const { data, error } = await supabase
        .from("contracts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteContract(id: string) {
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getContractActivities(contractId: string) {
    const { data, error } = await supabase
        .from("contract_activities")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function logContractActivity(
    contractId: string,
    type: string,
    description: string,
    userName?: string
) {
    let resolvedName = userName || "System";
    if (!userName) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            resolvedName = session?.user?.user_metadata?.full_name ||
                session?.user?.user_metadata?.name ||
                `${session?.user?.user_metadata?.first_name || ""} ${session?.user?.user_metadata?.last_name || ""}`.trim() ||
                session?.user?.email || "System";
        } catch { /* keep default */ }
    }
    const { error } = await supabase
        .from("contract_activities")
        .insert({
            contract_id: contractId,
            type,
            description,
            user_name: resolvedName,
        });
    if (error) console.error("Failed to log contract activity:", error.message);
}

export async function getQuoteActivities(quoteId: string) {
    const { data, error } = await supabase
        .from("quote_activities")
        .select("*")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function logQuoteActivity(
    quoteId: string,
    type: string,
    description: string,
    userName?: string
) {
    let resolvedName = userName || "System";
    if (!userName) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            resolvedName = session?.user?.user_metadata?.full_name ||
                session?.user?.user_metadata?.name ||
                `${session?.user?.user_metadata?.first_name || ""} ${session?.user?.user_metadata?.last_name || ""}`.trim() ||
                session?.user?.email || "System";
        } catch { /* keep default */ }
    }
    const { error } = await supabase
        .from("quote_activities")
        .insert({
            quote_id: quoteId,
            type,
            description,
            user_name: resolvedName,
        });
    if (error) console.error("Failed to log quote activity:", error.message);
}

export async function uploadDocument(customerId: string, uri: string, filename: string): Promise<string> {
    try {
        const path = `${customerId}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

        // NATIVE FIX: Use Expo FileSystem and Buffer to read file as base64.
        // fetch().blob() produces 0-byte corrupt files in React Native Supabase uploads.
        let fileBody: any;
        if (Platform.OS === 'web') {
            const res = await fetch(uri);
            fileBody = await res.blob();
        } else {
            const base64Str = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            fileBody = Buffer.from(base64Str, 'base64');
        }

        const ext = filename.split(".").pop()?.toLowerCase();
        let mimeType = "application/octet-stream";
        if (ext === "pdf") mimeType = "application/pdf";
        else if (ext === "png") mimeType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("customer_documents")
            .upload(path, fileBody, {
                contentType: mimeType,
                upsert: true,
            });

        if (uploadError) throw new Error(uploadError.message);

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from("customer_documents")
            .getPublicUrl(path);

        return publicUrlData.publicUrl;
    } catch (err: any) {
        throw new Error(err.message || "Fehler beim Hochladen des Dokuments");
    }
}

export async function uploadCancellationDocument(contractId: string, uri: string, filename: string): Promise<string> {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();

        const path = `${contractId}/${Date.now()}_${filename}`;

        const { data, error } = await supabase.storage
            .from("documents") // assuming generic documents bucket, or you could create 'cancellations'
            .upload(path, blob, {
                contentType: blob.type || "application/pdf",
                upsert: true,
            });

        if (error) throw new Error(error.message);

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from("documents")
            .getPublicUrl(path);

        return publicUrlData.publicUrl;
    } catch (err: any) {
        throw new Error(err.message || "Fehler beim Hochladen des Kündigungsdokuments");
    }
}

// ==================== VERTRAGSVORLAGEN ====================

export async function getContractTemplates() {
    const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createContractTemplate(template: {
    name: string;
    description?: string;
    default_amount?: number;
    default_duration_months?: number;
    default_notice_period_months?: number;
    default_payment_terms?: string;
    default_scope_of_services?: string;
    default_special_agreements?: string;
}) {
    const { data, error } = await supabase
        .from("contract_templates")
        .insert([template])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateContractTemplate(id: string, template: any) {
    const { data, error } = await supabase
        .from("contract_templates")
        .update(template)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteContractTemplate(id: string) {
    // Prüfen ob Verträge diese Vorlage referenzieren
    const { count } = await supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("template_id", id);

    if (count && count > 0) {
        throw new Error(
            `Diese Vorlage kann nicht gelöscht werden, da noch ${count} Vertrag/Verträge darauf basieren. Bitte löschen Sie zuerst die zugehörigen Verträge.`
        );
    }

    const { error } = await supabase.from("contract_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

// ==================== PROJEKTE ====================

export async function getNextProjectNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PRJ-${year}-`;

    const { data } = await supabase
        .from("projects")
        .select("project_number")
        .like("project_number", `${prefix}%`)
        .order("project_number", { ascending: false })
        .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
        const last = data[0].project_number;
        const num = parseInt(last.replace(prefix, ""), 10);
        if (!isNaN(num)) nextNum = num + 1;
    }
    return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

export async function getAllProjects() {
    const { data, error } = await supabase
        .from("projects")
        .select(`*, customer:customers(*), milestones:project_milestones(*)`)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getProjectById(id: string) {
    const { data, error } = await supabase
        .from("projects")
        .select(`*, customer:customers(*), milestones:project_milestones(*)`)
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function createProject(project: any) {
    const projectNumber = await getNextProjectNumber();
    const { data, error } = await supabase
        .from("projects")
        .insert({ ...project, project_number: projectNumber })
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Auto-add creation activity
    try {
        await addProjectActivity(data.id, "system", `Projekt ${projectNumber} erstellt`);
    } catch (_) { /* non-critical */ }

    return data;
}

export async function updateProject(id: string, updates: any) {
    const { data, error } = await supabase
        .from("projects")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteProject(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ==================== MEILENSTEINE ====================

export async function getProjectMilestones(projectId: string) {
    const { data, error } = await supabase
        .from("project_milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createMilestone(milestone: any) {
    const { data, error } = await supabase
        .from("project_milestones")
        .insert(milestone)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateMilestone(id: string, updates: any) {
    const { data, error } = await supabase
        .from("project_milestones")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMilestone(id: string) {
    const { error } = await supabase.from("project_milestones").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ==================== MEILENSTEIN-NOTIZEN ====================

export async function getMilestoneNotes(milestoneId: string) {
    const { data, error } = await supabase
        .from("milestone_notes")
        .select("*")
        .eq("milestone_id", milestoneId)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addMilestoneNote(milestoneId: string, text: string, isPublic: boolean) {
    let createdBy = "System";
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (user) {
            const { data: profile } = await supabase.from("users").select("name").eq("id", user.id).single();
            createdBy = profile?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "System";
        }
    } catch { /* non-critical */ }

    const { data, error } = await supabase
        .from("milestone_notes")
        .insert({ milestone_id: milestoneId, text, is_public: isPublic, created_by: createdBy })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateMilestoneNote(id: string, updates: { text?: string; is_public?: boolean }) {
    const { data, error } = await supabase
        .from("milestone_notes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMilestoneNote(id: string) {
    const { error } = await supabase.from("milestone_notes").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ==================== PROJEKT-AKTIVITÄTEN (TIMELINE) ====================

export async function getProjectActivities(projectId: string) {
    const { data, error } = await supabase
        .from("project_activities")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addProjectActivity(
    projectId: string,
    type: string,
    description: string,
    userName?: string
) {
    // Automatisch den eingeloggten Benutzer holen, falls kein Name übergeben
    let resolvedName = userName;
    if (!resolvedName) {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const user = sessionData?.session?.user;
            console.log("[Activity Debug] user id:", user?.id, "email:", user?.email);
            if (user) {
                // Versuch 1: Users-Tabelle
                const { data: profile, error: profileError } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", user.id)
                    .single();
                console.log("[Activity Debug] profile:", JSON.stringify(profile), "error:", profileError?.message);
                if (profile && profile.name) {
                    resolvedName = profile.name;
                }
                // Versuch 2: User Metadata
                if (!resolvedName && user.user_metadata) {
                    const meta = user.user_metadata;
                    console.log("[Activity Debug] metadata:", JSON.stringify(meta));
                    const metaName = `${meta.first_name || meta.name || ""} ${meta.last_name || ""}`.trim();
                    if (metaName) resolvedName = metaName;
                }
                // Versuch 3: Email
                if (!resolvedName && user.email) {
                    resolvedName = user.email.split("@")[0];
                }
            }
            console.log("[Activity Debug] resolvedName:", resolvedName);
        } catch (e) {
            console.warn("Could not resolve user name for activity:", e);
        }
        if (!resolvedName) resolvedName = "System";
    }

    const { data, error } = await supabase
        .from("project_activities")
        .insert({
            project_id: projectId,
            type,
            description,
            user_name: resolvedName,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ==================== PROJEKT-AUFGABEN ====================

export async function getProjectTasks(projectId: string) {
    const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createProjectTask(task: any) {
    const { data, error } = await supabase
        .from("project_tasks")
        .insert(task)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateProjectTask(id: string, updates: any) {
    const { data, error } = await supabase
        .from("project_tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteProjectTask(id: string) {
    const { error } = await supabase.from("project_tasks").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ==================== JAHRESABSCHLUSS / ARCHIVIERUNG ====================

export async function getAccountingYear(year: number) {
    const { data, error } = await supabase
        .from("accounting_years")
        .select("*")
        .eq("year", year)
        .maybeSingle();

    if (error) {
        console.error("[getAccountingYear] Error:", error.message);
        return null;
    }
    return data;
}

export async function closeAccountingYear(year: number) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    // First try to update
    let { data, error: updateError } = await supabase
        .from("accounting_years")
        .update({
            is_closed: true,
            closed_at: new Date().toISOString(),
            closed_by: userId,
        })
        .eq("year", year)
        .select()
        .single();

    // If it doesn't exist, insert it
    if (updateError || !data) {
        const { data: insertData, error: insertError } = await supabase
            .from("accounting_years")
            .insert({
                year,
                is_closed: true,
                closed_at: new Date().toISOString(),
                closed_by: userId,
            })
            .select()
            .single();

        if (insertError) throw new Error(insertError.message);
        data = insertData;
    }

    return data;
}

// ==================== PROJEKT-VERKNÜPFUNGEN ====================

export async function getProjectQuotes(projectId: string) {
    const { data, error } = await supabase
        .from("quotes")
        .select("*, customer:customers(*)")
        .or(`id.in.(select quote_id from projects where id='${projectId}')`)
        .order("created_at", { ascending: false });

    // Fallback: query by quote_id on the project
    if (error || !data || data.length === 0) {
        const { data: project } = await supabase
            .from("projects")
            .select("quote_id")
            .eq("id", projectId)
            .single();

        if (project?.quote_id) {
            const { data: quotes } = await supabase
                .from("quotes")
                .select("*, customer:customers(*)")
                .eq("id", project.quote_id);
            return quotes || [];
        }
        return [];
    }
    return data;
}

export async function getProjectInvoices(projectId: string) {
    // Fetch the project to get quote_id, then find invoices from same customer
    const { data: project } = await supabase
        .from("projects")
        .select("customer_id, quote_id")
        .eq("id", projectId)
        .single();

    if (!project?.customer_id) return [];

    const { data, error } = await supabase
        .from("invoices")
        .select("*, customer:customers(*)")
        .eq("customer_id", project.customer_id)
        .order("invoice_date", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function convertQuoteToProject(quoteId: string, includeOptions: boolean = false) {
    const quote = await getQuoteById(quoteId);
    if (!quote) throw new Error("Angebot nicht gefunden");

    // Optionale Positionen nur übernehmen, wenn gewünscht
    const allItems = (quote.items || []) as any[];
    const items = allItems.filter((it: any) => !it.optional || includeOptions);
    let optionalTotal = 0;
    let optionalTax = 0;
    if (includeOptions) {
        allItems.filter((it: any) => !!it.optional).forEach((it: any) => {
            optionalTotal += it.total || 0;
            optionalTax += (it.total || 0) * ((it.vat_rate ?? 8.1) / 100);
        });
    }

    const project = await createProject({
        title: `Projekt aus ${quote.quote_number}`,
        description: quote.notes || "",
        customer_id: quote.customer_id,
        quote_id: quoteId,
        budget: (quote.total || 0) + optionalTotal + optionalTax,
        status: "planning",
        priority: "medium",
    });

    // Create milestones from quote items
    for (let i = 0; i < items.length; i++) {
        await createMilestone({
            project_id: project.id,
            title: items[i].description?.split("\n")[0] || `Position ${i + 1}`,
            status: "pending",
            sort_order: i,
        });
    }

    return project;
}

// ==================== KUNDENPORTAL ====================

export async function getCustomerPortalUsers(customerId: string) {
    const { data, error } = await supabase
        .from("customer_portal_users")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createCustomerPortalUser(user: any) {
    // Session token is handled automatically by apiCall for native apps, 
    // but for web, we manually pass it to bypass the Edge Function hangs.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const payload = { ...user, password: user.password_hash };

    // Use local Custom Express Server API Route instead of Supabase Edge function
    // to bypass the CLI deployment hang / Unauthorized errors
    try {
        const data = await apiCall<any>("/api/create-portal-user", {
            method: "POST",
            headers: {
                "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify(payload)
        });

        if (!data || !data.success) {
            throw new Error(data?.error || "Fehler beim Erstellen des Portal-Benutzers");
        }

        return data.user;
    } catch (err: any) {
        throw new Error(err.message || "Fehler beim Erstellen des Portal-Benutzers");
    }
}

// ==================== KUNDENPORTAL TICKETS ====================

export async function getPortalTickets(customerId: string) {
    if (!customerId) return [];
    const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getPortalTicketComments(ticketId: string) {
    const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addPortalTicketComment(ticketId: string, comment: string, customerName: string) {
    const { data, error } = await supabase
        .from("ticket_comments")
        .insert({
            ticket_id: ticketId,
            comment,
            user_name: customerName,
            is_internal: false,
            // A system comment wouldn't be added directly by the customer this way,
            // so we hardcode is_system to false
            is_system: false
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Add Trigger Push here
    const { data: ticket } = await supabase.from("tickets").select("title").eq("id", ticketId).single();
    triggerPushNotification("all_admins", "admin", "Neue Kunden-Antwort", `Der Kunde hat auf das Ticket "${ticket?.title || ticketId}" geantwortet.`, { url: `/tickets?ticketId=${ticketId}` }, "portal").catch(console.error);

    return data;
}

export async function updateCustomerPortalUser(id: string, updates: any) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    // Fallback: update table directly
    const { data: portalUser, error } = await supabase
        .from("customer_portal_users")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);

    return portalUser;
}

export async function deleteCustomerPortalUser(id: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    // Fallback: Delete directly from the table since the Edge Function
    // is throwing Unauthorized due to deployment issues.
    // Note: This leaves the Auth User intact, but removes their portal access.
    // The Auth User will need to be cleaned up manually or via a DB trigger.
    const { error } = await supabase
        .from("customer_portal_users")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);

    return { success: true };
}

export async function toggleCustomerPortal(customerId: string, hasPortal: boolean) {
    const { data, error } = await supabase
        .from("customers")
        .update({ has_portal: hasPortal })
        .eq("id", customerId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ==================== BENUTZER / MITARBEITER ====================

export async function getAllUsers() {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("name", { ascending: true });

    if (error) {
        console.error("[getAllUsers] Error:", error.message);
        return [];
    }
    
    // Filter out dummy or auto-created portal users that shouldn't appear in the employee list
    return (data || []).filter(u => {
        // App User without roles is typically from Apple TestFlight SSO
        if (u.name === "App User" && (!u.roles || u.roles.length === 0)) return false;
        return true;
    });
}

export async function getUserProfile(id: string) {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return data;
}

// Eigene Push-Einstellungen speichern (RLS: Benutzer darf nur die eigene Zeile ändern)
export async function updateOwnPushPreferences(userId: string, prefs: Record<string, boolean>) {
    const { error } = await supabase
        .from("users")
        .update({ push_preferences: prefs } as any)
        .eq("id", userId);
    if (error) throw new Error(error.message);
}

// ── Role Definitions ──
export const ROLE_DEFINITIONS = [
    { key: "admin", label: "Admin", color: "#EF4444", description: "Vollzugriff, inkl. Konfiguration (Produkte, Benutzer etc.)" },
    { key: "administration", label: "Administration", color: "#8B5CF6", description: "Kunden, Akquise, Angebote, Verträge" },
    { key: "akquise", label: "Akquise", color: "#0EA5E9", description: "Akquise und Angebote" },
    { key: "finanzen", label: "Finanzen", color: "#22C55E", description: "Buchhaltung" },
    { key: "technik", label: "Technik", color: "#F59E0B", description: "Tickets, Wissensdatenbank, Projekte, Verträge, Links, Überwachung" },
    { key: "projekte", label: "Projekte", color: "#14B8A6", description: "Projekte" },
];

// Role → allowed dashboard tile IDs
export const ROLE_TILE_ACCESS: Record<string, string[]> = {
    admin: [], // empty = everything
    administration: ["customers", "leads", "quotes", "contracts"],
    akquise: ["leads", "quotes"],
    finanzen: ["accounting", "tap-to-pay"],
    technik: ["tickets", "knowledge-base", "projects", "contracts", "links", "tasks", "uberwachung"],
    projekte: ["projects"],
};

// Konfiguration tiles are always visible for all roles (except restricted ones)
const ALWAYS_VISIBLE_TILES = ["business-card"];

export function getAllowedTileIds(userRoles: string[]): string[] | null {
    // Admin role = access to everything
    if (userRoles?.includes("admin")) {
        return null; // null = no filtering, show everything
    }

    const allowed = new Set<string>(ALWAYS_VISIBLE_TILES);
    for (const role of userRoles) {
        const tiles = ROLE_TILE_ACCESS[role];
        if (tiles) {
            for (const t of tiles) allowed.add(t);
        }
    }
    return Array.from(allowed);
}

export async function updateUserRoles(userId: string, roles: string[]) {
    const { error } = await supabase
        .from("users")
        .update({ roles })
        .eq("id", userId);
    if (error) throw new Error(error.message);
}

export async function updateUserProfileAndRoles(userId: string, updates: { roles: string[]; address?: string; postal_code?: string; city?: string; iban: string; push_preferences?: Record<string, boolean>; read_only?: boolean }) {
    const { data, error } = await supabase
        .from("users")
        .update(updates as any)
        .eq("id", userId)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateUserProfile(userId: string, updates: any) {
    const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function createUser(user: { name: string; email: string; roles: string[]; password: string }) {
    // Use a separate Supabase client for signUp to avoid disrupting the current admin session
    const { createClient } = await import("@supabase/supabase-js");
    const signUpClient = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL || "",
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
        { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 1. Try to create auth user
    const { data: authData, error: authError } = await signUpClient.auth.signUp({
        email: user.email,
        password: user.password,
        options: { data: { full_name: user.name } },
    });

    let userId = authData?.user?.id;

    if (authError) {
        // If user already exists in auth, try to sign in to get their ID
        if (authError.message.includes("already registered") || authError.message.includes("already been registered")) {
            const { data: signInData, error: signInError } = await signUpClient.auth.signInWithPassword({
                email: user.email,
                password: user.password,
            });
            if (signInError) {
                // Can't sign in — just create public profile without auth link
                // Generate a UUID for the user
                userId = crypto.randomUUID();
            } else {
                userId = signInData.user?.id;
            }
        } else {
            throw new Error(authError.message);
        }
    }

    // 2. Insert/update public users table (RLS disabled)
    if (userId) {
        const { error } = await supabase
            .from("users")
            .upsert({
                id: userId,
                name: user.name,
                email: user.email,
                roles: user.roles,
                provider: "local",
                is_active: true,
            } as any, { onConflict: "id" });
        if (error) throw new Error(error.message);
    }
}

export async function deleteUser(id: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    
    try {
        const data = await apiCall<{ success: boolean; error?: string }>("/api/delete-admin-user", {
            method: "POST",
            headers: {
                "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({ userId: id })
        });
        
        if (!data || !data.success) {
            throw new Error(data?.error || "Fehler beim Löschen des Benutzers");
        }
    } catch (err: any) {
        // Fallback: If server is unreachable, delete directly from users table (legacy behavior)
        if (err.message === "Failed to fetch" || err.message?.includes("Network")) {
            const { error: dbError } = await supabase.from("users").delete().eq("id", id);
            if (dbError) throw new Error(dbError.message);
            return;
        }
        throw new Error(err.message || "Fehler beim Löschen des Benutzers");
    }
}

// ==================== LEADS / AKQUISE ====================

export async function getLeads() {
    const { data, error } = await supabase
        .from("leads")
        .select("*, lead_reminders(*)")
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createLead(lead: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    website?: string;
    address?: string;
    zip?: string;
    city?: string;
    value?: number;
    extra_amount?: number;
    status?: string;
    priority?: string;
    source?: string;
    notes?: string;
    assigned_to?: string;
}, items?: { description: string; quantity: number; unit_price: number; product_id?: string }[]) {
    const { data, error } = await supabase
        .from("leads")
        .insert(lead)
        .select()
        .single();

    if (error) throw new Error(error.message);

    if (items && items.length > 0) {
        const itemsWithLeadId = items.map((item) => ({
            ...item,
            lead_id: data.id,
        }));
        const { error: itemsError } = await supabase
            .from("lead_items")
            .insert(itemsWithLeadId);
        if (itemsError) console.error("[Lead] Items insert error:", itemsError.message);
    }

    return data;
}

export async function updateLead(id: string, updates: Record<string, any>, items?: { description: string; quantity: number; unit_price: number; product_id?: string }[]) {
    const { data, error } = await supabase
        .from("leads")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);

    if (items !== undefined) {
        // Delete old items, insert new
        await supabase.from("lead_items").delete().eq("lead_id", id);
        if (items.length > 0) {
            const itemsWithLeadId = items.map((item) => ({
                ...item,
                lead_id: id,
            }));
            const { error: itemsError } = await supabase
                .from("lead_items")
                .insert(itemsWithLeadId);
            if (itemsError) console.error("[Lead] Items update error:", itemsError.message);
        }
    }
    return data;
}

export async function createLeadReminder(reminder: { lead_id: string; remind_at: string; note: string }) {
    // For local trpc we'd use apiCall, but let's use apiCall to hit the TRPC endpoint if we have one.
    // Or we can just use supabase directly since we're using "Client-side data layer".
    // Wait, the backend trpc was added under /api/trpc/leads.addReminder. But this app uses Supabase directly for everything!
    // I will use Supabase directly, but wait, the reminder needs `user_id`! Let's get the user_id from session.
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const { data, error } = await supabase
        .from("lead_reminders")
        .insert([{ ...reminder, user_id: userId }])
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function getLeadReminders(leadId: string) {
    const { data, error } = await supabase
        .from("lead_reminders")
        .select("*")
        .eq("lead_id", leadId)
        .order("remind_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function deleteLeadReminder(id: string) {
    const { error } = await supabase.from("lead_reminders").delete().eq("id", id as any);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function updateLeadReminder(id: string, updates: { remind_at: string; note: string }) {
    const { data, error } = await supabase
        .from("lead_reminders")
        .update(updates)
        .eq("id", id as any)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}
export async function deleteLead(id: string) {
    // Items get cascade-deleted by FK constraint
    const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
}

export async function convertLeadToCustomer(leadId: string) {
    // 1. Hole den Lead
    const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

    if (leadError || !lead) throw new Error("Lead nicht gefunden");

    // 2. Extrahiere Vor- und Nachname (rudimentär)
    const nameParts = lead.name ? lead.name.split(" ") : [];
    const firstName = nameParts.length > 1 ? nameParts[0] : "";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : lead.name || "";

    // 3. Erstelle Kunden-Objekt
    const customerData: any = {
        first_name: firstName,
        last_name: lastName,
        company_name: lead.company || "",
        email: lead.email || "",
        phone: lead.phone || "",
        mobile: lead.mobile || "",
        website: lead.website || "",
        street: lead.address || "",
        zip_code: lead.zip || "",
        city: lead.city || "",
        country: "Schweiz", // Default oder leer lassen
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    // 4. In "customers" einfügen
    const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert([customerData])
        .select()
        .single();

    if (customerError) throw new Error("Fehler beim Erstellen des Kunden: " + customerError.message);

    // 5. Lead-Status aktualisieren und Notiz hinzufügen
    await updateLead(leadId, { status: "won" });
    await (supabase as any).from("leadActivities").insert([{
        lead_id: leadId,
        type: "system",
        content: `Lead erfolgreich in Kunde umgewandelt: ${customerData.company_name || lead.name}`,
    }]);

    return customer;
}

export async function getLeadItems(leadId: string) {
    const { data, error } = await supabase
        .from("lead_items")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getLeadWithItems(leadId: string) {
    const { data, error } = await supabase
        .from("leads")
        .select("*, items:lead_items(*)")
        .eq("id", leadId)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function getLeadActivities(leadId: string) {
    const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addLeadActivity(activity: {
    lead_id: string;
    type: string;
    content: string;
    user_name: string;
}) {
    const { data, error } = await supabase
        .from("lead_activities")
        .insert(activity)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteLeadActivity(id: string) {
    const { error } = await supabase
        .from("lead_activities")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}

// ==================== AUSGABEN ====================

export const EXPENSE_CATEGORIES = [
    { value: "accounting", label: "Buchhaltung & Beratung" },
    { value: "office", label: "Büro & Miete" },
    { value: "customer_order", label: "Kundenbestellung" },
    { value: "software", label: "Lizenzen & Software" },
    { value: "salary", label: "Lohnzahlung" },
    { value: "travel", label: "Reisen & Spesen" },
    { value: "other", label: "Sonstiges" },
    { value: "social_security", label: "Sozialversicherungen" },
    { value: "telecom", label: "Telefon & Internet" },
    { value: "insurance", label: "Versicherungen" },
    { value: "education", label: "Weiterbildung" },
    { value: "marketing", label: "Werbung & Marketing" },
] as const;

export const PAYMENT_METHODS = [
    { value: "bank", label: "Banküberweisung" },
    { value: "card", label: "Kreditkarte" },
    { value: "cash", label: "Bargeld" },
    { value: "twint", label: "TWINT" },
    { value: "other", label: "Sonstiges" },
] as const;

export async function getAllEmployees() {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("name", { ascending: true });
    
    if (error) throw new Error(error.message);
    return data || [];
}

export async function getAllExpenses() {
    const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createExpense(expense: any) {
    const taxAmount = expense.tax_rate
        ? (expense.amount * expense.tax_rate) / 100
        : 0;

    const { date, receipt_path, receipt_url, ...rest } = expense;
    const { data: sessionData } = await supabase.auth.getSession();
    
    const { data, error } = await supabase
        .from("expenses")
        .insert({
            ...rest,
            user_id: expense.user_id !== undefined && expense.user_id !== "" ? expense.user_id : sessionData.session?.user.id,
            expense_date: date,
            tax_amount: taxAmount,
            receipt_path: receipt_path || null,
            receipt_url: receipt_url || null,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateExpense(id: string, expense: any) {
    const taxAmount = expense.tax_rate
        ? (expense.amount * expense.tax_rate) / 100
        : 0;

    const { date, receipt_path, receipt_url, ...rest } = expense;
    
    // Create update payload
    const payload: any = {
        ...rest,
        expense_date: date,
        tax_amount: taxAmount,
        updated_at: new Date().toISOString(),
    };
    
    if (expense.user_id !== undefined && expense.user_id !== "") {
        payload.user_id = expense.user_id;
    }
    
    // Only update receipt fields if they are explicitly provided in the object
    if (expense.hasOwnProperty('receipt_path')) payload.receipt_path = receipt_path;
    if (expense.hasOwnProperty('receipt_url')) payload.receipt_url = receipt_url;

    const { data, error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteExpense(id: string) {
    // Delete receipt from storage first if it exists
    const { data: expense } = await supabase.from("expenses").select("receipt_path").eq("id", id).single();
    if (expense?.receipt_path) {
        await supabase.storage.from("expense_receipts").remove([expense.receipt_path]);
    }

    const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
}

export async function uploadExpenseReceipt(file: { name: string; type: string; uri: string; size?: number }, expenseId?: string) {
    const timestamp = Date.now();
    // Sanitize filename to avoid weird character issues in storage URLs
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `${timestamp}_${safeName}`;

    // NATIVE FIX: Use Expo FileSystem and Buffer to read file as base64.
    let fileBody: any;
    if (Platform.OS === 'web') {
        const res = await fetch(file.uri);
        fileBody = await res.blob();
    } else {
        const base64Str = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
        fileBody = Buffer.from(base64Str, 'base64');
    }

    const ext = safeName.split(".").pop()?.toLowerCase();
    let mimeType = file.type || "application/octet-stream";
    if (ext === "pdf") mimeType = "application/pdf";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";

    const { error: uploadErr } = await supabase.storage
        .from("expense_receipts")
        .upload(filePath, fileBody, { contentType: mimeType, upsert: true });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data: { publicUrl } } = supabase.storage
        .from("expense_receipts")
        .getPublicUrl(filePath);

    if (expenseId) {
        await updateExpense(expenseId, { receipt_path: filePath, receipt_url: publicUrl });
    }

    return { filePath, publicUrl };
}

export async function deleteExpenseReceipt(filePath: string, expenseId?: string) {
    const { error } = await supabase.storage.from("expense_receipts").remove([filePath]);
    if (error) throw new Error(error.message);

    if (expenseId) {
        await updateExpense(expenseId, { receipt_path: null, receipt_url: null });
    }
}

// ==================== MAHNWESEN ====================

export const DUNNING_LEVELS = [
    { value: 0, label: "Zahlungserinnerung", color: "#f59e0b" },
    { value: 1, label: "1. Mahnung", color: "#f97316" },
    { value: 2, label: "2. Mahnung", color: "#ef4444" },
    { value: 3, label: "Betreibungsandrohung", color: "#dc2626" },
] as const;

export async function getDunningSettings() {
    // Deterministisch die zuletzt geänderte Zeile lesen — falls durch
    // mehrfach gelaufene Migrationen Duplikate existieren
    const { data, error } = await supabase
        .from("dunning_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        // Return defaults if table doesn't exist yet
        return {
            auto_enabled: false,
            days_after_due_reminder: 5,
            days_between_levels: 10,
            dunning_fee: 20,
            text_reminder: "Wir möchten Sie freundlich daran erinnern, dass die Rechnung {invoice_number} über CHF {amount} am {due_date} fällig war.",
            text_level1: "Trotz unserer Erinnerung ist die Zahlung der Rechnung {invoice_number} über CHF {amount} noch ausstehend.",
            text_level2: "Die Rechnung {invoice_number} über CHF {amount} ist trotz mehrfacher Mahnung weiterhin unbezahlt.",
            text_level3: "Letzte Mahnung vor Einleitung des Betreibungsverfahrens für Rechnung {invoice_number} über CHF {amount}.",
            subject_reminder: "Zahlungserinnerung: Rechnung {invoice_number}",
            subject_level1: "1. Mahnung: Rechnung {invoice_number}",
            subject_level2: "2. Mahnung: Rechnung {invoice_number}",
            subject_level3: "Betreibungsandrohung: Rechnung {invoice_number}",
        };
    }
    return data;
}

export async function updateDunningSettings(settings: any) {
    try {
        const existing: any = await getDunningSettings();
        if (existing?.id) {
            const { data, error } = await supabase
                .from("dunning_settings")
                .update({ ...settings, updated_at: new Date().toISOString() })
                .eq("id", existing.id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return data;
        } else {
            // Try insert if no row exists
            const { data, error } = await supabase
                .from("dunning_settings")
                .insert({ ...settings })
                .select()
                .single();
            if (error) throw new Error("Bitte führe zuerst die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
            return data;
        }
    } catch (e: any) {
        if (e.message?.includes("schema cache") || e.message?.includes("relation")) {
            throw new Error("Tabelle 'dunning_settings' existiert noch nicht. Bitte führe die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
        }
        throw e;
    }
}

export async function getInvoiceDunningHistory(invoiceId: string) {
    const { data, error } = await supabase
        .from("invoice_dunning_history")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sent_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addDunningRecord(record: {
    invoice_id: string;
    dunning_level: number;
    email_to: string;
    notes?: string;
}) {
    const { data, error } = await supabase
        .from("invoice_dunning_history")
        .insert(record)
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Update invoice dunning_level
    await supabase
        .from("invoices")
        .update({
            dunning_level: record.dunning_level,
            last_dunning_at: new Date().toISOString(),
        })
        .eq("id", record.invoice_id);

    return data;
}

// ==================== RECHNUNGSEINSTELLUNGEN ====================

export async function getInvoiceSettings() {
    // Deterministisch die zuletzt geänderte Zeile lesen (siehe getDunningSettings)
    const { data, error } = await supabase
        .from("invoice_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        // Return defaults if table doesn't exist yet
        return {
            greeting_text: "Vielen Dank für Ihren Auftrag. Wir erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:",
            closing_text: "Freundliche Grüsse",
            payment_terms_days: 30,
            bank_name: "",
            account_holder: "",
            iban: "",
            swift_bic: "",
            account_number: "",
        };
    }
    return data;
}

export async function updateInvoiceSettings(settings: any) {
    try {
        const existing: any = await getInvoiceSettings();
        if (existing?.id) {
            const { data, error } = await supabase
                .from("invoice_settings")
                .update({ ...settings, updated_at: new Date().toISOString() })
                .eq("id", existing.id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return data;
        } else {
            // Try insert if no row exists
            const { data, error } = await supabase
                .from("invoice_settings")
                .insert({ ...settings })
                .select()
                .single();
            if (error) throw new Error("Bitte führe zuerst die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
            return data;
        }
    } catch (e: any) {
        if (e.message?.includes("schema cache") || e.message?.includes("relation")) {
            throw new Error("Tabelle 'invoice_settings' existiert noch nicht. Bitte führe die SQL-Migration '20260311_dunning.sql' im Supabase SQL-Editor aus.");
        }
        throw e;
    }
}

// ==================== DOKUMENTE ====================

export async function getDocumentFolders(parentId?: string | null) {
    let query = supabase.from("document_folders").select("*").order("name");
    if (parentId) {
        query = query.eq("parent_id", parentId);
    } else {
        query = query.is("parent_id", null);
    }
    const { data, error } = await query;
    if (error) return [];
    return data || [];
}

export async function createDocumentFolder(name: string, parentId?: string | null) {
    const { data, error } = await supabase
        .from("document_folders")
        .insert({ name, parent_id: parentId || null })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteDocumentFolder(id: string) {
    // Delete all documents in folder first
    const docs = await getDocuments(id);
    for (const doc of docs) {
        await deleteDocument(doc.id, doc.file_path);
    }
    const { error } = await supabase.from("document_folders").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

export async function getDocuments(folderId: string) {
    const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
}



export async function deleteDocument(id: string, filePath: string) {
    await supabase.storage.from("documents").remove([filePath]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

export async function getDocumentDownloadUrl(filePath: string) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600);
    return data?.signedUrl || "";
}

// ==================== KNOWLEDGE BASE ====================

// ── Kategorien ──

export async function getKbCategories() {
    const { data, error } = await supabase
        .from("kb_categories")
        .select("*")
        .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createKbCategory(category: {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    sort_order?: number;
}) {
    const { data, error } = await supabase
        .from("kb_categories")
        .insert([category])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateKbCategory(id: string, updates: any) {
    const { data, error } = await supabase
        .from("kb_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteKbCategory(id: string) {
    // Check if articles reference this category
    const { count } = await supabase
        .from("kb_articles")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id);

    if (count && count > 0) {
        throw new Error(
            `Diese Kategorie kann nicht gelöscht werden, da noch ${count} Artikel zugeordnet sind. Bitte verschieben oder löschen Sie zuerst die zugehörigen Artikel.`
        );
    }

    const { error } = await supabase.from("kb_categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

// ── Artikel ──

export async function getKbArticles(filters?: {
    category_id?: string;
    status?: string;
    visibility?: string;
    tag?: string;
    search?: string;
    sort?: "newest" | "popular" | "alphabetical";
}) {
    let query = supabase
        .from("kb_articles")
        .select("*, category:kb_categories(id, name, icon, color)");

    if (filters?.category_id) {
        query = query.eq("category_id", filters.category_id);
    }
    if (filters?.status) {
        query = query.eq("status", filters.status);
    }
    if (filters?.visibility) {
        query = query.eq("visibility", filters.visibility);
    }
    if (filters?.tag) {
        query = query.contains("tags", [filters.tag]);
    }

    // Sorting
    if (filters?.sort === "popular") {
        query = query.order("view_count", { ascending: false });
    } else if (filters?.sort === "alphabetical") {
        query = query.order("title", { ascending: true });
    } else {
        query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let results = data || [];

    // Client-side text search (Supabase JS doesn't easily support plainto_tsquery)
    if (filters?.search && filters.search.trim()) {
        const term = filters.search.toLowerCase().trim();
        results = results.filter(
            (a: any) =>
                a.title?.toLowerCase().includes(term) ||
                a.content?.toLowerCase().includes(term) ||
                (a.tags || []).some((t: string) => t.toLowerCase().includes(term))
        );
    }

    return results;
}

export async function getKbArticleById(id: string) {
    const { data, error } = await supabase
        .from("kb_articles")
        .select("*, category:kb_categories(id, name, icon, color), attachments:kb_article_attachments(*)")
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);

    // Increment view count (fire-and-forget)
    supabase
        .from("kb_articles")
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq("id", id)
        .then(() => {});

    return data;
}

export async function createKbArticle(article: {
    title: string;
    content?: string;
    category_id?: string;
    status?: string;
    visibility?: string;
    tags?: string[];
    is_pinned?: boolean;
    author_name?: string;
}) {
    // Resolve author name if not provided
    let authorName = article.author_name;
    if (!authorName) {
        try {
            const { data: session } = await supabase.auth.getSession();
            const user = session?.session?.user;
            if (user) {
                authorName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Admin";
            }
        } catch (_) { /* ignore */ }
        if (!authorName) authorName = "Admin";
    }

    const { data, error } = await supabase
        .from("kb_articles")
        .insert([{ ...article, author_name: authorName }])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateKbArticle(id: string, updates: any) {
    const { data, error } = await supabase
        .from("kb_articles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteKbArticle(id: string) {
    const { error } = await supabase.from("kb_articles").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getPopularKbArticles(limit: number = 5) {
    const { data, error } = await supabase
        .from("kb_articles")
        .select("*, category:kb_categories(id, name, icon, color)")
        .eq("status", "published")
        .order("view_count", { ascending: false })
        .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getRelatedKbArticles(articleId: string, limit: number = 3) {
    // Get the current article to find category + tags
    const { data: article } = await supabase
        .from("kb_articles")
        .select("category_id, tags")
        .eq("id", articleId)
        .single();

    if (!article) return [];

    let query = supabase
        .from("kb_articles")
        .select("id, title, category_id, tags, view_count, created_at")
        .neq("id", articleId)
        .eq("status", "published")
        .limit(limit);

    if (article.category_id) {
        query = query.eq("category_id", article.category_id);
    }

    const { data, error } = await query.order("view_count", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
}

// ── Anhänge ──

export async function addKbArticleAttachment(articleId: string, uri: string, filename: string) {
    const response = await fetch(uri);
    const blob = await response.blob();

    const path = `kb/${articleId}/${Date.now()}_${filename}`;

    const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, blob, {
            contentType: blob.type || "application/octet-stream",
            upsert: true,
        });

    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(path);

    const { data, error: dbErr } = await supabase
        .from("kb_article_attachments")
        .insert({
            article_id: articleId,
            file_name: filename,
            file_url: publicUrlData.publicUrl,
            file_type: blob.type || "application/octet-stream",
            file_size: blob.size || 0,
        })
        .select()
        .single();

    if (dbErr) throw new Error(dbErr.message);
    return data;
}

export async function deleteKbArticleAttachment(id: string) {
    const { error } = await supabase.from("kb_article_attachments").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

// ==================== USEFUL LINKS ====================

export async function uploadLinkLogo(linkId: string, uri: string): Promise<string> {
    let fileData: FormData | Blob;
    let contentType = "image/jpeg";
    const ext = "jpeg";
    const path = `${linkId}/logo_${Date.now()}.${ext}`;

    if (uri.startsWith("data:")) {
        // Web: data URI from image picker — convert via XHR
        const blob = await new Promise<Blob>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => resolve(xhr.response);
            xhr.onerror = () => reject(new Error("Failed to convert image"));
            xhr.responseType = "blob";
            xhr.open("GET", uri, true);
            xhr.send(null);
        });
        contentType = blob.type || "image/jpeg";
        const formData = new FormData();
        formData.append("", blob, `logo.${ext}`);
        fileData = formData;
    } else if (uri.startsWith("blob:")) {
        // Web: blob URI (e.g. from expo-image-picker on web)
        const response = await fetch(uri);
        const blob = await response.blob();
        contentType = blob.type || "image/jpeg";
        const formData = new FormData();
        formData.append("", blob, `logo.${ext}`);
        fileData = formData;
    } else {
        // Native (iOS/Android): file URI — fetch as blob
        const response = await fetch(uri);
        const blob = await response.blob();
        contentType = blob.type || "image/jpeg";
        const formData = new FormData();
        formData.append("", {
            uri: uri,
            name: `logo.${ext}`,
            type: contentType,
        } as any);
        fileData = formData;
    }

    const { error } = await supabase.storage
        .from("link-logos")
        .upload(path, fileData, { contentType, upsert: true });
    if (error) throw new Error(error.message);

    const { data: publicUrlData } = supabase.storage
        .from("link-logos")
        .getPublicUrl(path);

    // Update the link record
    await updateUsefulLink(linkId, { logo_url: publicUrlData.publicUrl });
    return publicUrlData.publicUrl;
}

export async function getUsefulLinks() {
    const { data: session } = await supabase.auth.getSession();
    const user = session?.session?.user;
    
    // Default fallback if not logged in (e.g. public only)
    if (!user) {
        const { data, error } = await supabase
            .from("useful_links")
            .select("*")
            .eq("visibility", "public")
            .is("customer_id", null)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return data || [];
    }

    // Get user roles
    const { data: userProfile } = await supabase
        .from("users")
        .select("roles")
        .eq("id", user.id)
        .single();
    
    const roles = userProfile?.roles || [];
    const isAdmin = roles.includes("admin");

    const { data, error } = await supabase
        .from("useful_links")
        .select("*")
        .is("customer_id", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    
    const allLinks = data || [];
    
    // Admins see everything
    if (isAdmin) {
        return allLinks;
    }

    // Filter based on visibility
    return allLinks.filter(link => {
        // Own links are always visible
        if (link.user_id === user.id) return true;
        
        // Public links are visible to everyone
        if (!link.visibility || link.visibility === "public") return true;
        
        // Private links where user is not owner (handled above) are hidden
        if (link.visibility === "private") return false;
        
        // Role-based visibility
        if (link.visibility === "roles" && link.allowed_roles) {
            const allowedRoles: string[] = link.allowed_roles;
            return roles.some((role: string) => allowedRoles.includes(role));
        }

        return false;
    });
}

export async function createUsefulLink(link: {
    title: string;
    url: string;
    description?: string;
    icon?: string;
    sort_order?: number;
    visibility?: string;
    allowed_roles?: string[];
}) {
    const { data: session } = await supabase.auth.getSession();
    const user = session?.session?.user;

    const { data, error } = await supabase
        .from("useful_links")
        .insert([{
            ...link,
            icon: link.icon || 'link.circle.fill',
            sort_order: link.sort_order || 0,
            user_id: user?.id,
        }])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateUsefulLink(id: string, updates: any) {
    const { data, error } = await supabase
        .from("useful_links")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteUsefulLink(id: string) {
    const { error } = await supabase
        .from("useful_links")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}

// ==================== CUSTOMER LINKS ====================

export async function getCustomerLinks(customerId: string) {
    const { data, error } = await supabase
        .from("useful_links")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createCustomerLink(link: {
    customer_id: string;
    title: string;
    url: string;
    description?: string;
}) {
    const { data: session } = await supabase.auth.getSession();
    const user = session?.session?.user;

    let finalUrl = link.url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
    }

    const { data, error } = await supabase
        .from("useful_links")
        .insert([{
            title: link.title,
            url: finalUrl,
            description: link.description || null,
            customer_id: link.customer_id,
            visibility: "private",
            icon: "link",
            user_id: user?.id,
        }])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateCustomerLink(id: string, updates: { title?: string; url?: string; description?: string }) {
    if (updates.url) {
        let finalUrl = updates.url.trim();
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }
        updates.url = finalUrl;
    }

    const { data, error } = await supabase
        .from("useful_links")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteCustomerLink(id: string) {
    const { error } = await supabase
        .from("useful_links")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}

// ==================== TASKS / AUFGABEN ====================

export async function getTasks() {
    const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned_user:users!tasks_assigned_to_fkey(name)")
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function getTaskById(id: string) {
    const { data, error } = await supabase
        .from("tasks")
        .select("*, assigned_user:users!tasks_assigned_to_fkey(name)")
        .eq("id", id)
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function createTask(task: any) {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase
        .from("tasks")
        .insert([{
            ...task,
            created_by: session?.user?.id || null
        }])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateTask(id: string, updates: any) {
    const { data, error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteTask(id: string) {
    const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
    return { success: true };
}

// -----------------------------
// Ticket Items (Time Tracking & Positions)
// -----------------------------

export async function getTicketItems(ticketId: string) {
    const { data, error } = await supabase
        .from('ticket_items')
        .select('*, product:product_id ( id, name, price, type, unit, vat_rate )')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
}

export async function addTicketItem(item: any) {
    const { data, error } = await supabase
        .from('ticket_items')
        .insert([item])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteTicketItem(id: string) {
    const { error } = await supabase
        .from('ticket_items')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
}

// -----------------------------
// Ticket Attachments
// -----------------------------

export async function getTicketAttachments(ticketId: string) {
    const { data, error } = await supabase
        .from('ticket_attachments' as any)
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function uploadTicketAttachment(ticketId: string, file: any) {
    // Determine a safe file name and path
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `tickets/${ticketId}/${timestamp}_${safeName}`;

    let uploadData;

    // React Native environment (Web vs Mobile handling)
    if (file.file) {
        // Web: use File object directly
        const { data, error } = await supabase.storage
            .from('ticket_attachments' as any)
            .upload(filePath, file.file, {
                contentType: file.mimeType || file.type || 'application/octet-stream',
            });
        if (error) throw new Error(error.message);
        uploadData = data;
    } else {
        // Mobile: fetch blob from URI or use base64
        const response = await fetch(file.uri);
        const blob = await response.blob();
        
        const { data, error } = await supabase.storage
            .from('ticket_attachments' as any)
            .upload(filePath, blob, {
                contentType: file.mimeType || 'application/octet-stream',
            });
        if (error) throw new Error(error.message);
        uploadData = data;
    }

    // Determine created_by from current user session
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || null;

    // Save attachment metadata to the database
    const { data: dbData, error: dbError } = await supabase
        .from('ticket_attachments' as any)
        .insert([{
            ticket_id: ticketId,
            file_name: file.name,
            file_path: uploadData.path,
            file_type: file.mimeType || file.type || 'unknown',
            created_by: userId
        }])
        .select()
        .single();

    if (dbError) throw new Error(dbError.message);
    return dbData;
}

export async function getTicketAttachmentUrl(filePath: string) {
    const { data, error } = await supabase.storage
        .from('ticket_attachments' as any)
        .createSignedUrl(filePath, 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
}

export async function deleteTicketAttachment(attachmentId: string, filePath: string) {
    // Delete from Storage first
    const { error: storageError } = await supabase.storage
        .from('ticket_attachments' as any)
        .remove([filePath]);

    if (storageError) {
        console.warn("Could not delete file from storage:", storageError.message);
        // We still proceed to delete the record if storage deletion fails
        // (e.g. file might already be gone)
    }

    // Delete Database record
    const { error: dbError } = await supabase
        .from('ticket_attachments' as any)
        .delete()
        .eq('id', attachmentId);

    if (dbError) throw new Error(dbError.message);
    return { success: true };
}

// ==================== STICKY NOTES ====================

export async function getStickyNotes() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
        .from('sticky_notes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.warn("getStickyNotes error:", error.message);
        showAlert("Lade-Fehler", error.message);
        return [];
    }
    return data || [];
}

export async function createStickyNote(note: { id?: string, text: string, color: string }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Nicht eingeloggt");

    const payload: any = {
        user_id: session.user.id,
        text: note.text,
        color: note.color,
    };
    if (note.id) payload.id = note.id;

    const { data, error } = await supabase
        .from('sticky_notes')
        .insert([payload])
        .select()
        .single();
    
    if (error) {
        console.warn("createStickyNote error:", error.message);
        showAlert("Speicher-Fehler", error.message);
        throw new Error(error.message);
    }

    // Neue Sticky Note: Push-Benachrichtigung an alle berechtigten User senden
    try {
        const { data: users } = await supabase
            .from('users')
            .select('id, roles')
            .eq('is_active', true)
            .neq('id', session.user.id);

        if (users && users.length > 0) {
            // Nur User mit Tasks-Zugriff (admin = alles, technik = tasks implizit erlaubt)
            const recipientIds = users
                .filter(u => u.roles?.includes('admin') || u.roles?.includes('technik'))
                .map(u => u.id);

            if (recipientIds.length > 0) {
                const { data: creator } = await supabase
                    .from('users')
                    .select('name')
                    .eq('id', session.user.id)
                    .single();
                const authorName = creator?.name || 'Ein Benutzer';

                await supabase.functions.invoke('send-push', {
                    body: {
                        recipients: recipientIds,
                        recipientType: "admin",
                        title: "Neue Notiz",
                        body: `${authorName} hat eine neue Notiz auf dem Whiteboard erstellt.`,
                        data: { category: "sticky_notes", url: "/tasks" }
                    }
                });
            }
        }
    } catch (pushErr) {
        console.warn("Fehler beim Senden der Push-Benachrichtigung:", pushErr);
    }

    return data;
}

export async function updateStickyNote(id: string, text: string, color: string) {
    const { data, error } = await supabase
        .from('sticky_notes')
        .update({ text, color, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteStickyNote(id: string) {
    const { error } = await supabase
        .from('sticky_notes')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
}

// ─── App-Einstellungen (key/value, genutzt für eigene Ausgaben-Kategorien) ───

export async function getMarketingSettings(): Promise<Record<string, string>> {
    const { data, error } = await supabase.from('marketing_settings').select('key, value');
    if (error) return {}; // graceful: table might not exist yet
    const result: Record<string, string> = {};
    for (const row of data || []) {
        result[row.key] = row.value || '';
    }
    return result;
}

export async function setMarketingSetting(key: string, value: string) {
    const { error } = await supabase
        .from('marketing_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ACCOUNTING BUDGET ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export async function getBudgets(year: number) {
    const { data, error } = await supabase
        .from('accounting_budgets')
        .select('*')
        .eq('year', year);
    if (error) throw new Error(error.message);
    return (data || []) as { id: string; year: number; category: string; budget_amount: number; notes?: string }[];
}

export async function upsertBudget(year: number, category: string, budgetAmount: number, notes?: string) {
    const { error } = await supabase
        .from('accounting_budgets')
        .upsert({ year, category, budget_amount: budgetAmount, notes: notes || null, updated_at: new Date().toISOString() }, { onConflict: 'year,category' });
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function deleteBudget(year: number, category: string) {
    const { error } = await supabase
        .from('accounting_budgets')
        .delete()
        .eq('year', year)
        .eq('category', category);
    if (error) throw new Error(error.message);
    return { success: true };
}

// ==================== ÜBERWACHUNG (URL MONITORING) ====================

export async function getMonitoringUrls() {
    const { data, error } = await supabase
        .from('monitoring_urls')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createMonitoringUrl(payload: {
    name: string;
    url: string;
    check_interval?: number;
    notes?: string;
    expected_keyword?: string;
    customer_id?: string;
    muted_until?: string;
    domain_expiry?: string;
}) {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    const { data, error } = await supabase
        .from('monitoring_urls')
        .insert({
            ...payload,
            user_id: userId,
            check_interval: payload.check_interval ?? 5,
            last_status: 'unknown',
        })
        .select()
        .single();
    if (error) throw new Error(error.message);

    // Auto-Ping nach Erstellung (Hintergrund)
    pingAndSaveBackground(data.id, payload.url).catch(() => {});

    return data;
}

async function pingAndSaveBackground(id: string, url: string) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const start = Date.now();
        let status: 'up' | 'down' = 'down';
        let statusCode: number | undefined;
        let responseTime: number | undefined;
        
        try {
            const res = await fetch(url, {
                method: "GET",
                signal: controller.signal,
                ...(Platform.OS === "web" ? { mode: "no-cors" } : {}),
            });
            clearTimeout(timeout);
            responseTime = Date.now() - start;
            statusCode = res.status;
            status = 'up';
        } catch {
            clearTimeout(timeout);
            status = 'down';
        }
        
        await saveMonitoringCheckResult(id, {
            last_status: status,
            last_status_code: statusCode,
            last_response_time: responseTime,
        });
    } catch (e) {
        console.error("Auto-Ping failed", e);
    }
}

export async function checkMonitoringUrlViaEdgeFunction(url_id: string) {
    const { data, error } = await supabase.functions.invoke('check-monitoring', {
        body: { url_id }
    });
    if (error) throw error;
    return data;
}

export async function updateMonitoringUrl(id: string, updates: Partial<{
    name: string;
    url: string;
    check_interval: number;
    notes: string;
    is_active: boolean;
    expected_keyword: string;
    customer_id: string;
    muted_until: string | null;
    domain_expiry: string | null;
}>) {
    const { data, error } = await supabase
        .from('monitoring_urls')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMonitoringUrl(id: string) {
    const { error } = await supabase
        .from('monitoring_urls')
        .delete()
        .eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function saveMonitoringCheckResult(id: string, result: {
    last_status: 'up' | 'down' | 'unknown';
    last_status_code?: number;
    last_response_time?: number;
}) {
    const { data, error } = await supabase
        .from('monitoring_urls')
        .update({
            ...result,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw new Error(error.message);

    // Historie eintragen
    const { error: logError } = await supabase
        .from('monitoring_logs')
        .insert({
            url_id: id,
            status: result.last_status,
            status_code: result.last_status_code,
            response_time: result.last_response_time,
        });
    if (logError) console.error("Error saving monitoring log:", logError);

    return data;
}

export async function getMonitoringLogs(urlId: string) {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('monitoring_logs')
        .select('*')
        .eq('url_id', urlId)
        .gte('checked_at', oneYearAgo)
        .order('checked_at', { ascending: false })
        .limit(10000);
    if (error) throw new Error(error.message);
    return data || [];
}

// ============================================================
// Runde 4: Wiederkehrende Ausgaben, Zahlungspläne, Meilensteine,
// Aufgaben, SLA, Leads, Portal-Ausbau, Inventar, Wartung, Log
// (neue Tabellen sind noch nicht in den generierten DB-Typen)
// ============================================================
const db = supabase as any;

async function resolveCurrentUserName(): Promise<string> {
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return "System";
        const { data: profile } = await supabase.from("users").select("name").eq("id", user.id).single();
        if (profile?.name) return profile.name;
        const meta = user.user_metadata || {};
        const metaName = `${meta.first_name || meta.name || ""} ${meta.last_name || ""}`.trim();
        if (metaName) return metaName;
        if (user.email) return user.email.split("@")[0];
    } catch (e) {}
    return "System";
}

// ── Aktivitäts-Log ──
export async function logActivity(entityType: string, entityId: string | null, action: string, description: string) {
    try {
        const userName = await resolveCurrentUserName();
        await db.from("audit_log").insert({
            entity_type: entityType,
            entity_id: entityId,
            action,
            description,
            user_name: userName,
        });
    } catch (e) {
        console.warn("[audit_log]", e);
    }
}

export async function getAuditLog(limit = 200) {
    const { data, error } = await db
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
}

// ── Papierkorb ──
export async function addToTrash(entityType: string, entityLabel: string, payload: any) {
    const userName = await resolveCurrentUserName();
    const { error } = await db.from("trash_bin").insert({
        entity_type: entityType,
        entity_label: entityLabel,
        payload,
        deleted_by: userName,
    });
    if (error) console.warn("[trash_bin]", error.message);
}

export async function getTrash() {
    const { data, error } = await db
        .from("trash_bin")
        .select("*")
        .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function removeFromTrash(id: string) {
    const { error } = await db.from("trash_bin").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

export async function restoreFromTrash(trashId: string) {
    const { data: entry, error } = await db.from("trash_bin").select("*").eq("id", trashId).single();
    if (error || !entry) throw new Error(error?.message || "Eintrag nicht gefunden");
    const p = entry.payload || {};

    if (entry.entity_type === "customer") {
        const { contacts, links, ...customer } = p;
        const { error: e1 } = await db.from("customers").insert(customer);
        if (e1) throw new Error(e1.message);
        if (contacts?.length) await db.from("customer_contacts").insert(contacts);
        if (links?.length) await db.from("customer_links").insert(links);
    } else if (entry.entity_type === "invoice") {
        const { items, payments, ...invoice } = p;
        const { error: e1 } = await db.from("invoices").insert(invoice);
        if (e1) throw new Error(e1.message);
        if (items?.length) await db.from("invoice_items").insert(items);
        if (payments?.length) await db.from("invoice_payments").insert(payments);
    } else if (entry.entity_type === "ticket") {
        const { comments, items, ...ticket } = p;
        const { error: e1 } = await db.from("tickets").insert(ticket);
        if (e1) throw new Error(e1.message);
        if (comments?.length) await db.from("ticket_comments").insert(comments);
        if (items?.length) await db.from("ticket_items").insert(items);
    } else {
        throw new Error(`Unbekannter Typ: ${entry.entity_type}`);
    }

    await db.from("trash_bin").delete().eq("id", trashId);
    await logActivity(entry.entity_type, null, "restored", `${entry.entity_label} aus dem Papierkorb wiederhergestellt`);
    return { success: true };
}

// ── Wiederkehrende Ausgaben ──
export async function getRecurringExpenses() {
    const { data, error } = await db
        .from("recurring_expenses")
        .select("*")
        .order("next_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createRecurringExpense(rec: {
    description: string;
    category?: string | null;
    amount: number;
    tax_rate?: number;
    interval: string;
    next_date: string;
}) {
    const { data, error } = await db.from("recurring_expenses").insert([rec]).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateRecurringExpense(id: string, updates: any) {
    const { error } = await db.from("recurring_expenses").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
}

export async function deleteRecurringExpense(id: string) {
    const { error } = await db.from("recurring_expenses").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ── Teilzahlungen / Zahlungspläne ──
export async function getInvoiceInstallments(invoiceId: string) {
    const { data, error } = await db
        .from("invoice_installments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("sort", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createInstallmentPlan(invoiceId: string, installments: { amount: number; due_date: string }[]) {
    await db.from("invoice_installments").delete().eq("invoice_id", invoiceId).is("paid_at", null);
    const rows = installments.map((r, idx) => ({ invoice_id: invoiceId, amount: r.amount, due_date: r.due_date, sort: idx }));
    const { error } = await db.from("invoice_installments").insert(rows);
    if (error) throw new Error(error.message);
}

export async function markInstallmentPaid(installmentId: string, paid: boolean) {
    const { error } = await db
        .from("invoice_installments")
        .update({ paid_at: paid ? new Date().toISOString() : null })
        .eq("id", installmentId);
    if (error) throw new Error(error.message);
}

export async function deleteInstallments(invoiceId: string) {
    const { error } = await db.from("invoice_installments").delete().eq("invoice_id", invoiceId);
    if (error) throw new Error(error.message);
}

// ── Zeit → Rechnung: unverrechnete Ticket-Aufwände eines Kunden ──
export async function getUnbilledTicketItems(customerId: string) {
    // Vertraglich abgedeckte Tickets zählen nicht als offene Aufwände
    const { data: tickets } = await supabase
        .from("tickets")
        .select("id, title")
        .eq("customer_id", customerId)
        .or("covered_by_contract.is.null,covered_by_contract.eq.false");
    const ticketIds = (tickets || []).map((t: any) => t.id);
    if (!ticketIds.length) return [];
    const { data, error } = await db
        .from("ticket_items")
        .select("*")
        .in("ticket_id", ticketIds)
        .is("invoice_id", null);
    if (error) throw new Error(error.message);
    const titleById = new Map((tickets || []).map((t: any) => [t.id, t.title]));
    return (data || []).map((i: any) => ({ ...i, ticket_title: titleById.get(i.ticket_id) || "" }));
}

export async function markTicketItemsBilled(itemIds: string[], invoiceId: string) {
    if (!itemIds.length) return;
    const { error } = await db.from("ticket_items").update({ invoice_id: invoiceId }).in("id", itemIds);
    if (error) throw new Error(error.message);
}

// ── Kunden-Inventar (Geräte & Lizenzen) ──
export async function getCustomerAssets(customerId: string) {
    const { data, error } = await db
        .from("customer_assets")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createCustomerAsset(asset: {
    customer_id: string;
    type: string;
    name: string;
    serial_number?: string | null;
    expires_at?: string | null;
    notes?: string | null;
}) {
    const { data, error } = await db.from("customer_assets").insert([asset]).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateCustomerAsset(id: string, updates: any) {
    const { error } = await db.from("customer_assets").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
}

export async function deleteCustomerAsset(id: string) {
    const { error } = await db.from("customer_assets").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ── Portal: geteilte Dokumente ──
export async function getSharedDocumentNames(customerId: string): Promise<string[]> {
    const { data, error } = await db
        .from("customer_document_shares")
        .select("file_name")
        .eq("customer_id", customerId);
    if (error) throw new Error(error.message);
    return (data || []).map((r: any) => r.file_name);
}

export async function setDocumentShared(customerId: string, fileName: string, shared: boolean) {
    if (shared) {
        const { error } = await db
            .from("customer_document_shares")
            .upsert({ customer_id: customerId, file_name: fileName });
        if (error) throw new Error(error.message);
    } else {
        const { error } = await db
            .from("customer_document_shares")
            .delete()
            .eq("customer_id", customerId)
            .eq("file_name", fileName);
        if (error) throw new Error(error.message);
    }
}

// ── Portal: Stammdaten-Änderungsanträge ──
export async function createChangeRequest(customerId: string, requestedBy: string, changes: Record<string, any>) {
    const { error } = await db.from("customer_change_requests").insert({
        customer_id: customerId,
        requested_by: requestedBy,
        changes,
    });
    if (error) throw new Error(error.message);
}

export async function getPendingChangeRequests() {
    const { data, error } = await db
        .from("customer_change_requests")
        .select("*, customer:customers(company_name, first_name, last_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function resolveChangeRequest(id: string, approve: boolean) {
    const { data: req, error } = await db.from("customer_change_requests").select("*").eq("id", id).single();
    if (error || !req) throw new Error(error?.message || "Antrag nicht gefunden");
    if (approve) {
        const { error: e1 } = await supabase
            .from("customers")
            .update({ ...req.changes, updated_at: new Date().toISOString() } as any)
            .eq("id", req.customer_id);
        if (e1) throw new Error(e1.message);
    }
    const { error: e2 } = await db
        .from("customer_change_requests")
        .update({ status: approve ? "approved" : "rejected", resolved_at: new Date().toISOString() })
        .eq("id", id);
    if (e2) throw new Error(e2.message);
    await logActivity("customer", req.customer_id, "updated", approve ? "Stammdaten-Änderung aus dem Portal übernommen" : "Stammdaten-Änderung aus dem Portal abgelehnt");
}

// ── Wartungsfenster ──
export async function getMaintenanceWindows(includePast = false) {
    let query = db.from("maintenance_windows").select("*").order("starts_at", { ascending: true });
    if (!includePast) query = query.gte("ends_at", new Date().toISOString());
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createMaintenanceWindow(w: {
    title: string;
    description?: string | null;
    starts_at: string;
    ends_at: string;
    customer_ids?: string[] | null;
}) {
    const { data, error } = await db.from("maintenance_windows").insert([w]).select().single();
    if (error) throw new Error(error.message);

    // Portal-Benutzer der betroffenen Kunden benachrichtigen
    try {
        let portalQuery = db.from("customer_portal_users").select("id, customer_id");
        if (w.customer_ids && w.customer_ids.length > 0) {
            portalQuery = portalQuery.in("customer_id", w.customer_ids);
        }
        const { data: portalUsers } = await portalQuery;
        const ids = (portalUsers || []).map((u: any) => u.id);
        if (ids.length) {
            const when = new Date(w.starts_at).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
            await triggerPushNotification(ids, "customer", "Geplante Wartung", `${w.title} – ab ${when}`, { category: "maintenance" });
        }
    } catch (e) {
        console.warn("[maintenance] Push fehlgeschlagen:", e);
    }
    return data;
}

export async function deleteMaintenanceWindow(id: string) {
    const { error } = await db.from("maintenance_windows").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

export async function getPortalMaintenanceWindows(customerId: string) {
    const { data, error } = await db
        .from("maintenance_windows")
        .select("*")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).filter(
        (w: any) => !w.customer_ids || w.customer_ids.length === 0 || w.customer_ids.includes(customerId)
    );
}

// ============================================================
// Runde 5: Debitoren, Mahn-Center, Gutschriften, Anzahlungen,
// Versionen, Vorlagen, Onboarding, Präsenz
// ============================================================

// ── Debitoren: Zahlungsmoral pro Kunde ──
export async function getDebtorStats() {
    const { data: invoices } = await supabase
        .from("invoices")
        .select("id, customer_id, invoice_date, due_date, status, total, paid_amount, updated_at, customer:customers(company_name, first_name, last_name)")
        .neq("status", "draft")
        .neq("status", "cancelled");

    const today = new Date().toISOString().split("T")[0];
    const byCustomer = new Map<string, any>();
    for (const inv of (invoices as any[]) || []) {
        if (!inv.customer_id) continue;
        let e = byCustomer.get(inv.customer_id);
        if (!e) {
            const name = inv.customer?.company_name ||
                `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.trim() || "Kunde";
            e = { customerId: inv.customer_id, name, paidCount: 0, paidDaysSum: 0, lateCount: 0, openAmount: 0, overdueCount: 0 };
            byCustomer.set(inv.customer_id, e);
        }
        if (inv.status === "paid") {
            // Näherung: Zahlungsdatum = letzte Änderung der Rechnung
            const days = Math.max(0, Math.round((new Date(inv.updated_at || inv.invoice_date).getTime() - new Date(inv.invoice_date).getTime()) / 86400000));
            e.paidCount++;
            e.paidDaysSum += days;
            if (inv.due_date && (inv.updated_at || "").split("T")[0] > inv.due_date) e.lateCount++;
        } else {
            const rest = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0));
            e.openAmount += rest;
            if (inv.due_date && inv.due_date < today) e.overdueCount++;
        }
    }
    const list = [...byCustomer.values()].map((e) => ({
        ...e,
        avgDays: e.paidCount ? Math.round(e.paidDaysSum / e.paidCount) : null,
        latePct: e.paidCount ? Math.round((e.lateCount / e.paidCount) * 100) : null,
    }));
    list.sort((a, b) => (b.openAmount + b.overdueCount * 1000) - (a.openAmount + a.overdueCount * 1000));
    return list;
}

// ── Mahn-Center: mahnfähige Rechnungen mit Stufen-Empfehlung ──
export async function getDunnableInvoices() {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
        .from("invoices")
        .select("*, customer:customers(company_name, first_name, last_name, email), items:invoice_items(*)")
        .in("status", ["open", "sent", "overdue"])
        .eq("dunning_stopped", false)
        .lt("due_date", today);

    let daysBetween = 10;
    try {
        const settings: any = await getDunningSettings();
        if (settings?.days_between_levels) daysBetween = settings.days_between_levels;
    } catch (_) {}

    const todayMs = new Date(today).getTime();
    return ((data as any[]) || [])
        .filter((inv) => !inv.is_credit_note)
        .map((inv) => {
            const level = inv.dunning_level || 0;
            const lastAction = inv.last_dunning_at ? inv.last_dunning_at.split("T")[0] : inv.due_date;
            const daysSince = Math.round((todayMs - new Date(lastAction).getTime()) / 86400000);
            const nextLevel = Math.min(level + 1, 3);
            const due = daysSince >= daysBetween || level === 0;
            return { ...inv, recommendedLevel: nextLevel, daysSinceLastAction: daysSince, dunningDue: due };
        })
        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
}

// ── Gutschriften ──
export async function getNextCreditNoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `GS-${year}-`;
    const { data } = await db
        .from("invoices")
        .select("invoice_number")
        .like("invoice_number", `${prefix}%`)
        .order("invoice_number", { ascending: false })
        .limit(1);
    let seq = 0;
    if (data && data.length > 0) {
        const n = parseInt(data[0].invoice_number.replace(prefix, ""), 10);
        if (!isNaN(n)) seq = n;
    }
    return `${prefix}${String(seq + 1).padStart(3, "0")}`;
}

// Gutschrift mit offener Rechnung verrechnen (bucht Zahlung in deren Höhe)
export async function settleCreditNote(creditNoteId: string, targetInvoiceId: string) {
    const { data: cn } = await db.from("invoices").select("invoice_number, total").eq("id", creditNoteId).single();
    if (!cn) throw new Error("Gutschrift nicht gefunden");
    await addPayment(targetInvoiceId, Number(cn.total) || 0, `Verrechnung Gutschrift ${cn.invoice_number}`);
    await db.from("invoices").update({ status: "paid", paid_amount: cn.total, credit_note_for: targetInvoiceId }).eq("id", creditNoteId);
    logActivity("invoice", creditNoteId, "updated", `Gutschrift ${cn.invoice_number} mit Rechnung verrechnet`);
}

// ── Anzahlungsrechnung aus Angebot ──
export async function createDepositInvoiceFromQuote(quoteId: string, percent: number) {
    const quote: any = await getQuoteById(quoteId);
    if (!quote) throw new Error("Angebot nicht gefunden");
    const base = Number(quote.total) || 0;
    const gross = Math.round(base * percent) / 100;
    // Anteil netto/MwSt aus dem Angebot übernehmen
    const ratio = base > 0 ? gross / base : 0;
    const subtotal = Math.round((Number(quote.subtotal) || 0) * ratio * 100) / 100;
    const vat = Math.round((gross - subtotal) * 100) / 100;

    const invoiceNumber = await getNextInvoiceNumber();
    const today = new Date().toISOString().split("T")[0];
    const invoice = await createInvoice(
        {
            customer_id: quote.customer_id,
            invoice_number: invoiceNumber,
            invoice_date: today,
            due_date: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
            subtotal,
            vat_amount: vat,
            total: gross,
            status: "draft",
            quote_id: quoteId,
            notes: `Anzahlung ${percent}% zu Angebot ${quote.quote_number}`,
        },
        [{
            description: `Anzahlung ${percent}% gemäss Angebot ${quote.quote_number}`,
            quantity: 1,
            unit: "Pauschale",
            unit_price: subtotal,
            vat_rate: subtotal > 0 ? Math.round(((gross / subtotal) - 1) * 1000) / 10 : 8.1,
            total: gross,
        }]
    );
    return invoice;
}

// ── Angebots-Versionen ──
export async function createQuoteNewVersion(quoteId: string) {
    const quote: any = await getQuoteById(quoteId);
    if (!quote) throw new Error("Angebot nicht gefunden");
    const rootId = quote.parent_quote_id || quote.id;
    // Höchste Version der Familie bestimmen
    const { data: family } = await db
        .from("quotes")
        .select("version")
        .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);
    const maxVersion = Math.max(1, ...((family || []).map((q: any) => q.version || 1)));

    const { customer, items, id, created_at, updated_at, ...rest } = quote;
    const { data: newQuote, error } = await db
        .from("quotes")
        .insert({
            ...rest,
            quote_number: quote.quote_number,
            status: "draft",
            version: maxVersion + 1,
            parent_quote_id: rootId,
            followup_sent_at: null,
        })
        .select()
        .single();
    if (error) throw new Error(error.message);

    const newItems = (items || []).map((i: any) => {
        const { id: _i, quote_id: _q, created_at: _c, ...itemRest } = i;
        return { ...itemRest, quote_id: newQuote.id };
    });
    if (newItems.length) await db.from("quote_items").insert(newItems);
    logActivity("quote", newQuote.id, "created", `Angebot ${quote.quote_number} – neue Version V${maxVersion + 1} erstellt`);
    return newQuote;
}

export async function getQuoteVersions(quote: any) {
    const rootId = quote.parent_quote_id || quote.id;
    const { data } = await db
        .from("quotes")
        .select("id, version, status, created_at, total")
        .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
        .order("version", { ascending: true });
    return data || [];
}

// ── Ticket-Vorlagen ──
export async function getTicketTemplates() {
    const { data, error } = await db.from("ticket_templates").select("*").order("name");
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createTicketTemplate(t: any) {
    const { data, error } = await db.from("ticket_templates").insert([t]).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteTicketTemplate(id: string) {
    const { error } = await db.from("ticket_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ── Wiederkehrende Tickets (Wartungsplan) ──
export async function getRecurringTickets() {
    const { data, error } = await db
        .from("recurring_tickets")
        .select("*, customer:customers(company_name, first_name, last_name)")
        .order("next_date");
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createRecurringTicket(t: any) {
    const { data, error } = await db.from("recurring_tickets").insert([t]).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateRecurringTicket(id: string, updates: any) {
    const { error } = await db.from("recurring_tickets").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
}

export async function deleteRecurringTicket(id: string) {
    const { error } = await db.from("recurring_tickets").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// ── Projekt-Vorlagen ──
export async function getProjectTemplates() {
    const { data, error } = await db.from("project_templates").select("*").order("name");
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createProjectTemplate(t: { name: string; tasks: any[]; milestones: any[] }) {
    const { data, error } = await db.from("project_templates").insert([t]).select().single();
    if (error) throw new Error(error.message);
    return data;
}

export async function deleteProjectTemplate(id: string) {
    const { error } = await db.from("project_templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

export async function applyProjectTemplate(projectId: string, template: any) {
    const tasks = (template.tasks || []).map((t: any, idx: number) => ({
        project_id: projectId,
        title: typeof t === "string" ? t : t.title,
        status: "open",
        sort_order: idx,
    }));
    if (tasks.length) await db.from("project_tasks").insert(tasks);
    const milestones = (template.milestones || []).map((m: any, idx: number) => ({
        project_id: projectId,
        title: typeof m === "string" ? m : m.title,
        percent: typeof m === "object" ? (m.percent || 0) : 0,
        status: "pending",
        sort_order: idx,
    }));
    if (milestones.length) await db.from("project_milestones").insert(milestones);
}

// ── Nachkalkulation: Aufwände eines Projekts ──
export async function getProjectCosting(projectId: string) {
    const { data: tickets } = await supabase
        .from("tickets")
        .select("id, items:ticket_items(quantity, unit_price, invoice_id)")
        .eq("project_id" as any, projectId);
    let billed = 0, unbilled = 0;
    for (const t of (tickets as any[]) || []) {
        for (const i of t.items || []) {
            const v = (Number(i.quantity) || 0) * (Number(i.unit_price) || 0);
            if (i.invoice_id) billed += v; else unbilled += v;
        }
    }
    return { billed, unbilled, total: billed + unbilled };
}

// ── Kunden-Onboarding ──
export const DEFAULT_ONBOARDING_STEPS = [
    "Vertrag erstellen & unterzeichnen lassen",
    "Portal-Zugang einrichten",
    "Geräte & Lizenzen im Inventar erfassen",
    "Überwachung einrichten (Webseite/Server)",
    "Willkommens-E-Mail senden",
];

export async function createOnboardingSteps(customerId: string) {
    const rows = DEFAULT_ONBOARDING_STEPS.map((step, idx) => ({ customer_id: customerId, step, sort: idx }));
    await db.from("customer_onboarding").insert(rows);
}

export async function getOnboardingSteps(customerId: string) {
    const { data, error } = await db
        .from("customer_onboarding")
        .select("*")
        .eq("customer_id", customerId)
        .order("sort");
    if (error) throw new Error(error.message);
    return data || [];
}

export async function toggleOnboardingStep(id: string, done: boolean) {
    const { error } = await db.from("customer_onboarding").update({ done }).eq("id", id);
    if (error) throw new Error(error.message);
}

// ── Team-Präsenz ──
let lastPresencePing = 0;
export async function pingPresence() {
    if (Date.now() - lastPresencePing < 4 * 60 * 1000) return; // max. alle 4 Minuten
    lastPresencePing = Date.now();
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;
        await db.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", userId);
    } catch (_) { /* Präsenz ist optional */ }
}

// ════════════════ RUNDE 6 ════════════════

// ── (10) Tickets zusammenführen: Kommentare, Aufwände, Anhänge wandern mit ──
export async function mergeTickets(sourceId: string, targetId: string) {
    if (sourceId === targetId) throw new Error("Quelle und Ziel sind identisch.");
    const { data: source } = await supabase.from("tickets").select("id, title").eq("id", sourceId).single();
    const { data: target } = await supabase.from("tickets").select("id, title").eq("id", targetId).single();
    if (!source || !target) throw new Error("Ticket nicht gefunden.");

    await supabase.from("ticket_comments").update({ ticket_id: targetId }).eq("ticket_id", sourceId);
    await supabase.from("ticket_items").update({ ticket_id: targetId }).eq("ticket_id", sourceId);
    await db.from("ticket_attachments").update({ ticket_id: targetId }).eq("ticket_id", sourceId);

    await supabase.from("ticket_comments").insert({
        ticket_id: targetId,
        comment: `Ticket "${(source as any).title}" wurde in dieses Ticket zusammengeführt.`,
        user_name: "System",
        is_internal: true,
        is_system: true,
    } as any);

    const { error } = await supabase
        .from("tickets")
        .update({ status: "closed", description: `[Zusammengeführt mit Ticket "${(target as any).title}"]` } as any)
        .eq("id", sourceId);
    if (error) throw new Error(error.message);
    logActivity("ticket", targetId, "updated", `Ticket "${(source as any).title}" zusammengeführt`);
}

// ── (16) Abwesenheiten ──
export async function getAbsences() {
    const { data, error } = await db
        .from("user_absences")
        .select("*, user:users(id, name, email)")
        .gte("end_date", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
        .order("start_date");
    if (error) throw new Error(error.message);
    return data || [];
}

export async function createAbsence(a: { user_id: string; start_date: string; end_date: string; type?: string; note?: string | null }) {
    const { error } = await db.from("user_absences").insert([a]);
    if (error) throw new Error(error.message);
}

export async function deleteAbsence(id: string) {
    const { error } = await db.from("user_absences").delete().eq("id", id);
    if (error) throw new Error(error.message);
}

// Hilfsfunktion: Welche Benutzer sind heute abwesend? → Map user_id → Typ
export async function getAbsentToday(): Promise<Record<string, string>> {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await db
        .from("user_absences")
        .select("user_id, type")
        .lte("start_date", today)
        .gte("end_date", today);
    const map: Record<string, string> = {};
    for (const a of (data as any[]) || []) map[a.user_id] = a.type;
    return map;
}

// ── (17) Meine Woche: mir zugewiesene offene Arbeit ──
export async function getMyWeek(userId: string) {
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const [tickets, tasks, leads] = await Promise.all([
        supabase
            .from("tickets")
            .select("id, title, status, priority, due_date")
            .eq("assigned_to", userId)
            .in("status", ["open", "in_progress", "waiting"])
            .order("created_at", { ascending: false })
            .limit(10),
        supabase
            .from("tasks")
            .select("id, title, status, due_date")
            .eq("assigned_to", userId)
            .neq("status", "done")
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(10),
        supabase
            .from("leads")
            .select("id, name, company, next_action, next_action_date")
            .not("next_action_date", "is", null)
            .lte("next_action_date", in7)
            .not("status", "in", "(won,lost)")
            .order("next_action_date")
            .limit(10),
    ]);
    return {
        tickets: tickets.data || [],
        tasks: tasks.data || [],
        leads: leads.data || [],
    };
}

// ── (18) @-Erwähnungen in Kommentaren: Benutzer benachrichtigen ──
export async function notifyMentions(comment: string, context: string, link?: string) {
    const mentions = comment.match(/@([A-Za-zÀ-ž]+)/g);
    if (!mentions || mentions.length === 0) return;
    try {
        const { data: users } = await supabase.from("users").select("id, name");
        const notified = new Set<string>();
        for (const m of mentions) {
            const needle = m.slice(1).toLowerCase();
            const hit = (users || []).find((u: any) => (u.name || "").toLowerCase().includes(needle));
            if (!hit || notified.has(hit.id)) continue;
            notified.add(hit.id);
            await supabase.from("notifications").insert({
                user_id: hit.id,
                title: `Sie wurden erwähnt (${context})`,
                message: comment.slice(0, 200),
                is_read: false,
            } as any);
            triggerPushNotification([hit.id], "admin", `Erwähnung: ${context}`, comment.slice(0, 150), link ? { url: link } : undefined, "tickets");
        }
    } catch (_) { /* Erwähnungen sind Komfort, kein Muss */ }
}

// ── (19) Dublettenwarnung beim Kundenanlegen ──
export async function findSimilarCustomers(name: string, email?: string, phone?: string) {
    const checks: any[] = [];
    if (name && name.length >= 3) {
        checks.push(
            supabase.from("customers").select("id, company_name, first_name, last_name, email").ilike("company_name", `%${name}%`).limit(3),
            supabase.from("customers").select("id, company_name, first_name, last_name, email").ilike("last_name", `%${name}%`).limit(3)
        );
    }
    if (email) checks.push(supabase.from("customers").select("id, company_name, first_name, last_name, email").ilike("email", email).limit(3));
    if (phone && phone.length >= 7) checks.push(supabase.from("customers").select("id, company_name, first_name, last_name, email").ilike("phone", `%${phone.replace(/\s/g, "")}%`).limit(3));
    const settled = await Promise.all(checks);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const r of settled) {
        for (const c of r.data || []) {
            if (!seen.has(c.id)) { seen.add(c.id); out.push(c); }
        }
    }
    return out;
}

// ── (21) Geburtstage & Kunden-Jubiläen (nächste 14 Tage) ──
export async function getUpcomingCelebrations() {
    const out: { type: "birthday" | "anniversary"; label: string; date: string; customerId?: string }[] = [];
    const today = new Date();
    const inDays = (month: number, day: number) => {
        const d = new Date(today.getFullYear(), month - 1, day);
        if (d < new Date(today.getFullYear(), today.getMonth(), today.getDate())) d.setFullYear(d.getFullYear() + 1);
        return Math.round((d.getTime() - today.getTime()) / 86400000);
    };
    try {
        const { data: contacts } = await db
            .from("customer_contacts")
            .select("first_name, last_name, birthday, customer_id, customer:customers(company_name)")
            .not("birthday", "is", null);
        for (const c of (contacts as any[]) || []) {
            const [y, m, d] = String(c.birthday).split("-").map(Number);
            const diff = inDays(m, d);
            if (diff <= 14) {
                const name = `${c.first_name || ""} ${c.last_name || ""}`.trim();
                const comp = c.customer?.company_name ? ` (${c.customer.company_name})` : "";
                out.push({
                    type: "birthday",
                    label: diff === 0 ? `${name}${comp} hat heute Geburtstag 🎂` : `${name}${comp} hat in ${diff} Tag${diff === 1 ? "" : "en"} Geburtstag`,
                    date: c.birthday,
                    customerId: c.customer_id,
                });
            }
        }
        const { data: customers } = await supabase
            .from("customers")
            .select("id, company_name, first_name, last_name, created_at")
            .eq("status", "active");
        for (const c of (customers as any[]) || []) {
            if (!c.created_at) continue;
            const created = new Date(c.created_at);
            const years = today.getFullYear() - created.getFullYear();
            if (years < 1) continue;
            const diff = inDays(created.getMonth() + 1, created.getDate());
            if (diff <= 14) {
                const name = c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim();
                out.push({
                    type: "anniversary",
                    label: diff === 0 ? `${name} ist seit heute ${years} Jahr${years === 1 ? "" : "e"} Kunde 🎉` : `${name} ist in ${diff} Tag${diff === 1 ? "" : "en"} ${years} Jahr${years === 1 ? "" : "e"} Kunde`,
                    date: c.created_at,
                    customerId: c.id,
                });
            }
        }
    } catch (_) { /* optional */ }
    return out.sort((a, b) => a.label.localeCompare(b.label));
}

// ── (22) E-Mail-Kampagne light ──
export async function getCampaignRecipients(filter: { tag?: string; status?: string }) {
    let q = supabase
        .from("customers")
        .select("id, company_name, first_name, last_name, email, tags, newsletter_opt_out" as any)
        .not("email", "is", null)
        .neq("email", "");
    if (filter.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    let list = (data as any[]) || [];
    list = list.filter((c) => c.newsletter_opt_out !== true);
    if (filter.tag) list = list.filter((c) => (c.tags || []).includes(filter.tag));
    return list;
}

export async function sendCampaign(subject: string, body: string, recipients: { email: string; name: string; id: string }[]) {
    const { data, error } = await supabase.functions.invoke("send-campaign", {
        body: { subject, body, recipients },
    });
    if (error) throw new Error(error.message);
    return data;
}

export async function getCampaigns() {
    const { data, error } = await db.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return data || [];
}

// Alle verwendeten Kunden-Tags (für Filter & Vorschläge)
export async function getAllCustomerTags(): Promise<string[]> {
    const { data } = await supabase.from("customers").select("tags" as any);
    const set = new Set<string>();
    for (const c of (data as any[]) || []) for (const t of c.tags || []) set.add(t);
    return Array.from(set).sort();
}

// ── (24) Angebots-Öffnungen: Anzahl + letzter Zeitpunkt aus dem Aktivitätslog ──
export async function getQuoteOpenStats(quoteId: string) {
    const { data } = await supabase
        .from("quote_activities")
        .select("created_at, type")
        .eq("quote_id", quoteId)
        .eq("user_name", "Kunde")
        .order("created_at", { ascending: false });
    const opens = (data || []).filter((a: any) => a.type === "Angebot aufgerufen" || a.type === "Status geändert");
    return { count: opens.length, lastOpenedAt: opens[0]?.created_at || null };
}

// ── (27) KI-Angebotstexte ──
export async function generateQuoteText(keywords: string, customerName?: string) {
    const { data, error } = await supabase.functions.invoke("quote-ai", {
        body: { keywords, customerName },
    });
    if (error) throw new Error(error.message);
    return data as { intro: string; items: { description: string; quantity: number; unit: string; unitPrice: number }[] };
}

// ── Entra-Profilfoto: nach SSO-Login via Microsoft Graph holen und cachen ──
// Das Foto ist nicht im Login-Token enthalten; wir laden es mit dem
// provider_token (nur direkt nach dem Login gültig) und speichern es im
// Storage-Bucket "avatars" + users.avatar_url. Danach überall verfügbar.
let avatarSyncDone = false;
export async function syncEntraAvatar(session: any) {
    if (avatarSyncDone) return;
    try {
        const token = session?.provider_token;
        const userId = session?.user?.id;
        if (!token || !userId) return;
        avatarSyncDone = true;

        let res = await fetch("https://graph.microsoft.com/v1.0/me/photos/96x96/$value", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            // Fallback: Originalgrösse (manche Konten haben keine 96x96-Variante)
            res = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
                headers: { Authorization: `Bearer ${token}` },
            });
        }
        if (!res.ok) {
            console.warn("[Avatar] Graph-Foto nicht verfügbar:", res.status);
            return; // kein Foto hinterlegt oder kein Graph-Zugriff (fehlt User.Read?)
        }

        const blob = await res.blob();
        const { error: upErr } = await supabase.storage
            .from("avatars")
            .upload(`${userId}.jpg`, blob, { upsert: true, contentType: "image/jpeg" });
        if (upErr) { console.warn("[Avatar] Upload fehlgeschlagen:", upErr.message); return; }

        const { data } = supabase.storage.from("avatars").getPublicUrl(`${userId}.jpg`);
        // Cache-Buster, damit ein neues Foto sofort sichtbar wird
        const url = `${data.publicUrl}?v=${Date.now()}`;
        await db.from("users").update({ avatar_url: url }).eq("id", userId);
    } catch (e: any) {
        console.warn("[Avatar] Sync fehlgeschlagen:", e?.message);
    }
}

// ════════════════ RUNDE 7 ════════════════

// ── (14) ABC-Klassierung: Umsatz (bezahlt, 12 Monate) → A/B/C ──
export async function getAbcClasses(): Promise<Record<string, { cls: "A" | "B" | "C"; revenue: number }>> {
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0];
    const { data } = await supabase
        .from("invoices")
        .select("customer_id, total")
        .eq("status", "paid")
        .gte("invoice_date", yearAgo);
    const revenue = new Map<string, number>();
    for (const i of (data as any[]) || []) {
        if (!i.customer_id) continue;
        revenue.set(i.customer_id, (revenue.get(i.customer_id) || 0) + (i.total || 0));
    }
    const sorted = Array.from(revenue.entries()).sort((a, b) => b[1] - a[1]);
    const totalSum = sorted.reduce((s, [, v]) => s + v, 0) || 1;
    const out: Record<string, { cls: "A" | "B" | "C"; revenue: number }> = {};
    let cum = 0;
    for (const [id, v] of sorted) {
        cum += v;
        out[id] = { cls: cum / totalSum <= 0.7 ? "A" : cum / totalSum <= 0.95 ? "B" : "C", revenue: v };
    }
    return out;
}

// ── (15) Inaktive Kunden: aktiv, aber seit 180 Tagen ohne Rechnung und Ticket ──
export async function getInactiveCustomers() {
    const cutoff = new Date(Date.now() - 180 * 86400000).toISOString();
    const cutoffDate = cutoff.split("T")[0];
    const [customersRes, invoicesRes, ticketsRes] = await Promise.all([
        supabase.from("customers").select("id, company_name, first_name, last_name, created_at").eq("status", "active"),
        supabase.from("invoices").select("customer_id").gte("invoice_date", cutoffDate),
        supabase.from("tickets").select("customer_id").gte("created_at", cutoff),
    ]);
    const recent = new Set<string>();
    for (const i of (invoicesRes.data as any[]) || []) if (i.customer_id) recent.add(i.customer_id);
    for (const t of (ticketsRes.data as any[]) || []) if (t.customer_id) recent.add(t.customer_id);
    return ((customersRes.data as any[]) || [])
        .filter((c) => !recent.has(c.id) && new Date(c.created_at).getTime() < Date.now() - 180 * 86400000)
        .map((c) => ({
            id: c.id,
            name: c.company_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Kunde",
        }));
}

// ── (11) Cross-Selling-Analyse (KI) ──
export async function getCrossSellSuggestions() {
    const { data, error } = await supabase.functions.invoke("cross-sell", { body: {} });
    if (error) throw new Error(error.message);
    return (data?.suggestions || []) as { customerId: string; customer: string; idea: string; reason: string }[];
}

// ── (18) Willkommenspaket senden (respektiert den Schalter in den Einstellungen) ──
export async function sendWelcomePackage(customerId: string) {
    try {
        const { data } = await supabase.functions.invoke("send-welcome", { body: { customerId } });
        return data;
    } catch (_) {
        return null; // Willkommens-Mail ist Komfort, kein Muss
    }
}

// ── (28) Duplizieren: Angebot / Rechnung / Projekt (optional für anderen Kunden) ──
export async function duplicateQuote(quoteId: string, targetCustomerId?: string) {
    const quote: any = await getQuoteById(quoteId);
    if (!quote) throw new Error("Angebot nicht gefunden");
    const { customer, items, id, created_at, updated_at, ...rest } = quote;
    const newNumber = await getNextQuoteNumber();
    const { data: newQuote, error } = await db
        .from("quotes")
        .insert({
            ...rest,
            quote_number: newNumber,
            customer_id: targetCustomerId || quote.customer_id,
            status: "draft",
            version: 1,
            parent_quote_id: null,
            followup_sent_at: null,
            quote_date: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();
    if (error) throw new Error(error.message);
    const newItems = (items || []).map((i: any) => {
        const { id: _i, quote_id: _q, created_at: _c, ...itemRest } = i;
        return { ...itemRest, quote_id: newQuote.id };
    });
    if (newItems.length) await db.from("quote_items").insert(newItems);
    logActivity("quote", newQuote.id, "created", `Angebot ${newNumber} als Kopie von ${quote.quote_number} erstellt`);
    return newQuote;
}

export async function duplicateInvoice(invoiceId: string, targetCustomerId?: string) {
    const { data: invoice, error: loadErr } = await supabase
        .from("invoices")
        .select("*, items:invoice_items(*)")
        .eq("id", invoiceId)
        .single();
    if (loadErr || !invoice) throw new Error("Rechnung nicht gefunden");
    const { items, id, created_at, updated_at, ...rest } = invoice as any;
    const newNumber = await getNextInvoiceNumber();
    const today = new Date().toISOString().split("T")[0];
    const { data: newInvoice, error } = await db
        .from("invoices")
        .insert({
            ...rest,
            invoice_number: newNumber,
            customer_id: targetCustomerId || (invoice as any).customer_id,
            status: "draft",
            invoice_date: today,
            due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
            paid_amount: 0,
            dunning_level: 0,
            last_dunning_at: null,
            quote_id: null,
            is_credit_note: false,
            credit_note_for: null,
        })
        .select()
        .single();
    if (error) throw new Error(error.message);
    const newItems = ((items as any[]) || []).map((i: any) => {
        const { id: _i, invoice_id: _inv, created_at: _c, ...itemRest } = i;
        return { ...itemRest, invoice_id: newInvoice.id };
    });
    if (newItems.length) await db.from("invoice_items").insert(newItems);
    logActivity("invoice", newInvoice.id, "created", `Rechnung ${newNumber} als Kopie erstellt`);
    return newInvoice;
}

export async function duplicateProject(projectId: string, targetCustomerId?: string) {
    const { data: project, error: loadErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
    if (loadErr || !project) throw new Error("Projekt nicht gefunden");
    const { id, created_at, updated_at, project_number, ...rest } = project as any;
    const { data: newProject, error } = await db
        .from("projects")
        .insert({
            ...rest,
            title: `${(project as any).title} (Kopie)`,
            customer_id: targetCustomerId || (project as any).customer_id,
            status: "planning",
            quote_id: null,
        })
        .select()
        .single();
    if (error) throw new Error(error.message);
    // Aufgaben und Meilensteine mitkopieren (offen/pending)
    const [tasksRes, msRes] = await Promise.all([
        db.from("project_tasks").select("title, description, priority, sort_order").eq("project_id", projectId),
        db.from("project_milestones").select("title, description, percent, sort_order").eq("project_id", projectId),
    ]);
    const tasks = ((tasksRes.data as any[]) || []).map((t) => ({ ...t, project_id: newProject.id, status: "open" }));
    if (tasks.length) await db.from("project_tasks").insert(tasks);
    const ms = ((msRes.data as any[]) || []).map((m) => ({ ...m, project_id: newProject.id, status: "pending" }));
    if (ms.length) await db.from("project_milestones").insert(ms);
    return newProject;
}

// ── (35) Umsatz-Forecast: nächste 3 Monate ──
export async function getForecast() {
    const [contractsRes, leadsRes, quotesRes] = await Promise.all([
        supabase.from("contracts").select("billing_cycle, annual_amount, amount").eq("status", "active").eq("recurring_enabled", true),
        supabase.from("leads").select("value, rating, status").not("status", "in", '("won","lost")').not("value", "is", null),
        supabase.from("quotes").select("total, status").in("status", ["sent", "opened"]),
    ]);
    // Verträge auf Monatswert normalisieren
    let monthlyContract = 0;
    for (const c of (contractsRes.data as any[]) || []) {
        const amount = Number(c.annual_amount || c.amount) || 0;
        const cycle = c.billing_cycle || "yearly";
        monthlyContract += cycle === "monthly" ? amount : cycle === "quarterly" ? amount / 3 : amount / 12;
    }
    // Pipeline gewichtet (gleiche Gewichte wie die Akquise-Prognose), verteilt auf 3 Monate
    const weights: Record<string, number> = { hot: 0.7, warm: 0.4, cold: 0.15 };
    let pipeline = 0;
    for (const l of (leadsRes.data as any[]) || []) {
        pipeline += (Number(l.value) || 0) * (weights[l.rating] ?? 0.3);
    }
    // Offene Angebote mit 50% Abschlusswahrscheinlichkeit, verteilt auf 3 Monate
    let openQuotes = 0;
    for (const q of (quotesRes.data as any[]) || []) openQuotes += (Number(q.total) || 0) * 0.5;

    const months: { label: string; contract: number; pipeline: number; quotes: number }[] = [];
    for (let m = 0; m < 3; m++) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() + m, 1);
        months.push({
            label: d.toLocaleDateString("de-CH", { month: "long" }),
            contract: Math.round(monthlyContract),
            pipeline: Math.round(pipeline / 3),
            quotes: Math.round(openQuotes / 3),
        });
    }
    return months;
}

// ── (24) Einsatzplan: alles Terminiertes einer Woche ──
export async function getWeekPlan(weekStart: string) {
    const start = new Date(weekStart);
    const end = new Date(start.getTime() + 7 * 86400000);
    const startIso = start.toISOString().split("T")[0];
    const endIso = end.toISOString().split("T")[0];
    const [ticketsRes, tasksRes, maintRes, absRes] = await Promise.all([
        supabase
            .from("tickets")
            .select("id, title, due_date, status, priority, assignee:users!tickets_assigned_to_fkey(name)")
            .gte("due_date", startIso).lt("due_date", endIso).neq("status", "closed"),
        supabase
            .from("tasks")
            .select("id, title, due_date, status, assigned_user:users!tasks_assigned_to_fkey(name)")
            .gte("due_date", startIso).lt("due_date", endIso).neq("status", "done"),
        db.from("maintenance_windows")
            .select("id, title, starts_at, ends_at")
            .gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()),
        db.from("user_absences")
            .select("id, start_date, end_date, type, user:users(name)")
            .lte("start_date", endIso).gte("end_date", startIso),
    ]);
    return {
        tickets: ticketsRes.data || [],
        tasks: tasksRes.data || [],
        maintenance: maintRes.data || [],
        absences: absRes.data || [],
    };
}
