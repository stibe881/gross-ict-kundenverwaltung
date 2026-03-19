/**
 * Client-side data layer — communicates directly with Supabase.
 * Replaces the old tRPC/Express server middleware.
 */
import { supabase } from "./supabase";
import { apiCall } from "./_core/api";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import { Platform } from "react-native";
export { supabase };

export async function triggerPushNotification(
    recipients: string[] | "all_admins",
    recipientType: "admin" | "customer",
    title: string,
    body: string,
    data?: any
) {
    try {
        console.log("[Push] Sending via Edge Function:", { recipients, recipientType, title });
        const { data: result, error } = await supabase.functions.invoke('send-push', {
            body: { recipients, recipientType, title, body, data },
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

        // Also save to notifications table for the CURRENT user (sender)
        // so it appears in their own dashboard activity feed
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { error: insErr } = await supabase.from("notifications").insert({
                    user_id: session.user.id,
                    title: title,
                    message: body,
                    is_read: true,
                });
                console.log("[Push] Activity saved for user:", session.user.id, insErr ? "ERROR: " + insErr.message : "OK");
            } else {
                console.log("[Push] No session, cannot save activity");
            }
        } catch (e) {
            console.warn("[Push] Failed to save activity:", e);
        }
    } catch (e) {
        console.error("[Push] Failed to send:", e);
    }
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
    return data;
}

export async function deleteCustomer(id: string) {
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
        .select(`*, items:invoice_items(*)`)
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

    return invoiceData;
}

export async function updateInvoice(id: string, invoice: any, items: any[]) {
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

    return invoiceData;
}

export async function deleteInvoice(id: string) {
    const { error: itemsError } = await supabase
        .from("invoice_items")
        .delete()
        .eq("invoice_id", id);
    if (itemsError) throw new Error(itemsError.message);

    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function addPayment(invoiceId: string, amount: number) {
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
    const { data, error } = await supabase
        .from("invoice_activities")
        .insert({
            invoice_id: invoiceId,
            type,
            description,
            user_name: userName || "System",
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

// ==================== VERTRÄGE ====================

export async function getCustomerContracts(customerId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const isAdmin = session?.user?.user_metadata?.role === 'admin' || (session?.user as any)?.role === 'admin';

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

export async function createTicket(ticket: any) {
    const { data, error } = await supabase
        .from("tickets")
        .insert([ticket])
        .select()
        .single();

    if (error) throw new Error(error.message);
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
    return data;
}

export async function deleteTicket(id: string) {
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

export async function getQuoteById(id: string) {
    const { data, error } = await supabase
        .from("quotes")
        .select(`*, customer:customers(*), items:quote_items(*)`)
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function createQuote(quote: any, items: any[]) {
    const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .insert([quote])
        .select()
        .single();

    if (quoteError) throw new Error(quoteError.message);

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

    return quoteData;
}

export async function deleteQuote(id: string) {
    await supabase.from("quote_items").delete().eq("quote_id", id);
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
}

export async function convertQuoteToInvoice(quoteId: string) {
    // 1. Fetch the quote with items
    const quote = await getQuoteById(quoteId);
    if (!quote) throw new Error("Angebot nicht gefunden");

    // 2. Get next invoice number
    const invoiceNumber = await getNextInvoiceNumber();

    // 3. Create the invoice
    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const invoice = await createInvoice(
        {
            customer_id: quote.customer_id,
            invoice_number: invoiceNumber,
            invoice_date: today,
            due_date: dueDate,
            subtotal: quote.subtotal,
            vat_amount: quote.tax,
            total: quote.total,
            status: "open",
        },
        (quote.items || []).map((item: any) => ({
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

    if (quote.quote_number) {
        triggerPushNotification(
            "all_admins",
            "admin",
            "Angebot angenommen",
            `Das Angebot ${quote.quote_number} wurde angenommen und in eine Rechnung umgewandelt!`,
            { url: `/quotes?quoteId=${quote.id}` }
        );
    }

    return invoice;
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
                { url: `/quotes?quoteId=${quoteId}` }
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
    const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { quoteId, pdfBase64 },
    });
    if (error) throw new Error(error.message || "E-Mail konnte nicht gesendet werden");
    if (data?.error) throw new Error(data.error);
    return data;
}

// ==================== VERTRÄGE ====================

export async function getContracts() {
    const { data: { session } } = await supabase.auth.getSession();
    const isAdmin = session?.user?.user_metadata?.role === 'admin' || (session?.user as any)?.role === 'admin';

    let query = supabase
        .from("contracts")
        .select("*, customers(company_name, first_name, last_name)")
        .order("created_at", { ascending: false });

    if (!isAdmin) {
        query = query.eq('is_internal', false);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return (data || []).map((c: any) => ({
        ...c,
        customer_name: c.customers?.company_name ||
            `${c.customers?.first_name || ''} ${c.customers?.last_name || ''}`.trim() ||
            'Unbekannt',
    }));
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

export async function createContract(contract: {
    customer_id: string;
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
    // Calculate next_invoice_date if recurring is enabled
    const insertData: any = { ...contract, status: "active" };
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

        const { data, error } = await supabase.storage
            .from("customer_documents")
            .upload(path, fileBody, {
                contentType: mimeType,
                upsert: true,
            });

        if (error) throw new Error(error.message);

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from("customer_documents")
            .getPublicUrl(path);

        return publicUrlData.publicUrl;
    } catch (err: any) {
        throw new Error(err.message || "Fehler beim Hochladen des Dokuments");
    }
}

export async function deleteCustomerDocument(fileUrl: string) {
    // Determine the path from the URL
    // e.g. .../storage/v1/object/public/customer_documents/c43fb3f5/12345_test.pdf
    try {
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split("customer_documents/");
        if (pathParts.length === 2) {
            const filePath = decodeURIComponent(pathParts[1]);
            const { error } = await supabase.storage.from("customer_documents").remove([filePath]);
            if (error) console.error("Storage delete fail:", error);
        }
    } catch(e) { console.error("Could not parse Document URL for deletion:", e); }

    const { error } = await supabase
        .from("customer_documents")
        .delete()
        .eq("file_url", fileUrl);
    if (error) throw new Error(error.message);
    return { success: true };
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
        .single();

    if (error && error.code !== "PGRST116") {
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

    if (!project) return [];

    const { data, error } = await supabase
        .from("invoices")
        .select("*, customer:customers(*)")
        .eq("customer_id", project.customer_id)
        .order("invoice_date", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function convertQuoteToProject(quoteId: string) {
    const quote = await getQuoteById(quoteId);
    if (!quote) throw new Error("Angebot nicht gefunden");

    const project = await createProject({
        title: `Projekt aus ${quote.quote_number}`,
        description: quote.notes || "",
        customer_id: quote.customer_id,
        quote_id: quoteId,
        budget: quote.total || 0,
        status: "planning",
        priority: "medium",
    });

    // Create milestones from quote items
    const items = quote.items || [];
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

export async function getPortalTicketComments(ticketId: number) {
    const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .eq("is_internal", false)
        .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function addPortalTicketComment(ticketId: number, comment: string, customerName: string) {
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
    triggerPushNotification("all_admins", "admin", "Neue Kunden-Antwort", `Der Kunde hat auf das Ticket "${ticket?.title || ticketId}" geantwortet.`, { url: `/tickets?ticketId=${ticketId}` }).catch(console.error);

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

// ── Role Definitions ──
export const ROLE_DEFINITIONS = [
    { key: "admin", label: "Admin", color: "#EF4444", description: "Vollzugriff, inkl. Konfiguration (Produkte, Benutzer etc.)" },
    { key: "administration", label: "Administration", color: "#8B5CF6", description: "Kunden, Akquise, Angebote, Verträge" },
    { key: "akquise", label: "Akquise", color: "#0EA5E9", description: "Akquise und Angebote" },
    { key: "finanzen", label: "Finanzen", color: "#22C55E", description: "Buchhaltung" },
    { key: "technik", label: "Technik", color: "#F59E0B", description: "Tickets, Wissensdatenbank, Projekte, Verträge, Links" },
    { key: "projekte", label: "Projekte", color: "#14B8A6", description: "Projekte" },
];

// Role → allowed dashboard tile IDs
export const ROLE_TILE_ACCESS: Record<string, string[]> = {
    admin: [], // empty = everything
    administration: ["customers", "leads", "quotes", "contracts"],
    akquise: ["leads", "quotes"],
    finanzen: ["accounting"],
    technik: ["tickets", "knowledge-base", "projects", "contracts", "links", "tasks"],
    projekte: ["projects"],
};

// Konfiguration tiles are always visible for all roles (except restricted ones)
const ALWAYS_VISIBLE_TILES = ["business-card", "newsletter"];

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

export async function updateUserProfileAndRoles(userId: string, updates: { roles: string[]; address: string; iban: string }) {
    const { data, error } = await supabase
        .from("users")
        .update(updates)
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
            }, { onConflict: "id" });
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
        throw new Error(err.message || "Fehler beim Löschen des Benutzers");
    }
}

// ==================== LEADS / AKQUISE ====================

export async function getLeads() {
    const { data, error } = await supabase
        .from("leads")
        .select("*")
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

export async function deleteLead(id: string) {
    // Items get cascade-deleted by FK constraint
    const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
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

// ==================== AUSGABEN ====================

export const EXPENSE_CATEGORIES = [
    { value: "accounting", label: "Buchhaltung & Beratung" },
    { value: "office", label: "Büro & Miete" },
    { value: "vehicle", label: "Fahrzeug & Transport" },
    { value: "equipment", label: "Geräte & Werkzeug" },
    { value: "software", label: "Lizenzen & Software" },
    { value: "salary", label: "Lohnzahlung" },
    { value: "material", label: "Material & Waren" },
    { value: "travel", label: "Reisen & Spesen" },
    { value: "other", label: "Sonstiges" },
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
            user_id: sessionData.session?.user.id,
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
    const { data, error } = await supabase
        .from("dunning_settings")
        .select("*")
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
        const existing = await getDunningSettings();
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
    const { data, error } = await supabase
        .from("invoice_settings")
        .select("*")
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
        const existing = await getInvoiceSettings();
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
            return roles.some((role: string) => link.allowed_roles.includes(role));
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
        .from('ticket_attachments')
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
            .from('ticket_attachments')
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
            .from('ticket_attachments')
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
        .from('ticket_attachments')
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

export async function deleteTicketAttachment(attachmentId: string, filePath: string) {
    // Delete from Storage first
    const { error: storageError } = await supabase.storage
        .from('ticket_attachments')
        .remove([filePath]);

    if (storageError) {
        console.warn("Could not delete file from storage:", storageError.message);
        // We still proceed to delete the record if storage deletion fails
        // (e.g. file might already be gone)
    }

    // Delete Database record
    const { error: dbError } = await supabase
        .from('ticket_attachments')
        .delete()
        .eq('id', attachmentId);

    if (dbError) throw new Error(dbError.message);
    return { success: true };
}
