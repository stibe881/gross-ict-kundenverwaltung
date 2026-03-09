/**
 * Client-side data layer — communicates directly with Supabase.
 * Replaces the old tRPC/Express server middleware.
 */
import { supabase } from "./supabase";
import { apiCall } from "./_core/api";
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
            console.error("[Push] Edge Function error:", error);
        } else {
            console.log("[Push] Edge Function response:", JSON.stringify(result));
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
    const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("customer_id", customerId)
        .order("start_date", { ascending: false });

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
            { url: "/quotes" }
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
                { url: "/quotes" }
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
    const { data, error } = await supabase
        .from("contracts")
        .select("*, customers(company_name, first_name, last_name)")
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((c: any) => ({
        ...c,
        customer_name: c.customers?.company_name ||
            `${c.customers?.first_name || ''} ${c.customers?.last_name || ''}`.trim() ||
            'Unbekannt',
    }));
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
}) {
    const { data, error } = await supabase
        .from("contracts")
        .insert([{ ...contract, status: "active" }])
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
    const { data, error } = await supabase
        .from("project_activities")
        .insert({
            project_id: projectId,
            type,
            description,
            user_name: userName || "System",
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
    triggerPushNotification("all_admins", "admin", "Neue Kunden-Antwort", `Der Kunde hat auf das Ticket "${ticket?.title || ticketId}" geantwortet.`, { url: '/tickets' }).catch(console.error);

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

    if (error) throw new Error(error.message);
    return data || [];
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
    value?: number;
    status?: string;
    source?: string;
    notes?: string;
    assigned_to?: string;
}) {
    const { data, error } = await supabase
        .from("leads")
        .insert(lead)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateLead(id: string, updates: Record<string, any>) {
    const { data, error } = await supabase
        .from("leads")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteLead(id: string) {
    const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
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
    text: string;
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
