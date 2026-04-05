import { supabase } from "./supabase-client";

export async function triggerPushNotification(
  recipients: string[] | "all_admins",
  recipientType: "admin" | "customer",
  title: string,
  body: string,
  data?: any,
  category?: string
) {
  try {
    console.log("[Push Server] Sending via Edge Function:", { recipients, recipientType, title, category });
    const payload = { recipients, recipientType, title, body, data: { ...data, category } };
    const { data: result, error } = await supabase.functions.invoke('send-push', {
      body: payload,
    });
    if (error) {
      console.error("[Push Server] Edge Function error:", error);
    } else {
      console.log("[Push Server] Edge Function response:", JSON.stringify(result));
    }
  } catch (e) {
    console.warn("[Push Server] Failed to send:", e);
  }
}

// ==================== KUNDEN ====================

export async function getAllCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getCustomersWithCounts() {
  // Kunden laden
  const { data: customers, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!customers || customers.length === 0) return [];

  // Parallel: Counts für Verträge, Tickets, Rechnungen laden
  const [contractsRes, ticketsRes, invoicesRes] = await Promise.all([
    supabase.from("contracts").select("customer_id, status"),
    supabase.from("tickets").select("customer_id, status"),
    supabase.from("invoices").select("customer_id, status"),
  ]);

  const contracts = contractsRes.data || [];
  const tickets = ticketsRes.data || [];
  const invoices = invoicesRes.data || [];

  // Counts pro Kunde aggregieren
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
      _counts: {
        activeContracts,
        openTickets,
        openInvoices,
      },
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
  // 1. Quote-Items der Kunden-Angebote löschen
  const { data: customerQuotes } = await supabase
    .from("quotes")
    .select("id")
    .eq("customer_id", id);

  if (customerQuotes && customerQuotes.length > 0) {
    const quoteIds = customerQuotes.map((q) => q.id);
    await supabase.from("quote_items").delete().in("quote_id", quoteIds);
  }

  // 2. Angebote löschen
  await supabase.from("quotes").delete().eq("customer_id", id);

  // 3. Rechnungs-Positionen und Aktivitäten der Kunden-Rechnungen löschen
  const { data: customerInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("customer_id", id);

  if (customerInvoices && customerInvoices.length > 0) {
    const invoiceIds = customerInvoices.map((inv) => inv.id);
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
  await supabase.from("customer_users").delete().eq("customer_id", id);

  // 10. Kunden löschen
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  return { success: true };
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
  
  if (data.customer_id) {
    triggerPushNotification([data.customer_id], "customer", "Neuer Timeline-Eintrag", `Es gibt eine neue Information in Ihrer Timeline.`, { url: '/portal' }, "portal").catch(console.error);
  }

  return data;
}

// ==================== LEADS ====================

export async function getAllLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createLead(lead: any) {
  const { data, error } = await supabase
    .from("leads")
    .insert([lead])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateLead(id: string, lead: any) {
  const { data, error } = await supabase
    .from("leads")
    .update(lead)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ==================== LEAD REMINDERS ====================

export async function getLeadReminders(leadId: string) {
  const { data, error } = await supabase
    .from("lead_reminders")
    .select("*")
    .eq("lead_id", leadId)
    .order("remind_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createLeadReminder(reminder: any) {
  const { data, error } = await supabase
    .from("lead_reminders")
    .insert([reminder])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteLeadReminder(id: string) {
  const { error } = await supabase
    .from("lead_reminders")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getDueLeadReminders() {
  const { data, error } = await supabase
    .from("lead_reminders")
    .select("*, leads(*)")
    .eq("is_processed", false)
    .lte("remind_at", new Date().toISOString());

  if (error) {
    if (error.message.includes("does not exist") || error.code === "PGRST204") {
      // Table doesn't exist yet, ignore silently during dev
      return [];
    }
    throw new Error(error.message);
  }
  return data || [];
}

export async function markLeadReminderProcessed(id: string) {
  const { data, error } = await supabase
    .from("lead_reminders")
    .update({ is_processed: true })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ==================== VERTRÄGE ====================

export async function getAllContracts() {
  const { data, error } = await supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(*)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getCustomerContracts(customerId: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("customer_id", customerId)
    .order("start_date", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createContract(contract: any) {
  const { data, error } = await supabase
    .from("contracts")
    .insert([contract])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateContract(id: string, contract: any) {
  const { data, error } = await supabase
    .from("contracts")
    .update(contract)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getContractByToken(token: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select(`
      *,
      customer:customers(*)
    `)
    .eq("token", token)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function signContract(token: string, signatureName: string, signatureIp: string) {
  const { data, error } = await supabase
    .from("contracts")
    .update({
      signature_name: signatureName,
      signature_ip: signatureIp,
      signature_date: new Date().toISOString(),
      status: "active",
    })
    .eq("token", token)
    .is("signature_date", null)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ==================== TICKETS ====================

export async function getAllTickets() {
  const { data, error } = await supabase
    .from("tickets")
    .select(`
      *,
      customer:customers(*)
    `)
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
  
  if (data.customer_id) {
    triggerPushNotification([data.customer_id], "customer", "Neues Ticket", `Es wurde ein neues Ticket für Sie eröffnet: ${data.title}`, { url: `/portal-tickets-customer?ticketId=${data.id}` }, "tickets").catch(console.error);
    triggerPushNotification("all_admins", "admin", "Neues Ticket", `Ein neues Ticket wurde erstellt: ${data.title}`, { url: `/tickets?ticketId=${data.id}` }, "tickets").catch(console.error);
  }

  return data;
}

export async function updateTicket(id: string, ticket: any) {
  const { data: oldTicket } = await supabase.from("tickets").select("status").eq("id", id).single();
  
  const { data, error } = await supabase
    .from("tickets")
    .update(ticket)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (oldTicket && data.status && oldTicket.status !== data.status && data.customer_id) {
    triggerPushNotification([data.customer_id], "customer", "Ticket Status", `Der Status von Ticket "${data.title}" hat sich geändert.`, { url: `/portal-tickets-customer?ticketId=${data.id}` }, "tickets").catch(console.error);
    triggerPushNotification("all_admins", "admin", "Ticket Status", `Der Status von Ticket "${data.title}" hat sich geändert.`, { url: `/tickets?ticketId=${data.id}` }, "tickets").catch(console.error);
  }

  return data;
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
    .insert([product])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProduct(id: string, product: any) {
  // Undefined-Werte entfernen, damit sie nicht auf NULL gesetzt werden
  const cleanProduct: any = {};
  for (const [key, value] of Object.entries(product)) {
    if (value !== undefined) {
      cleanProduct[key] = value;
    }
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

  // Finde die höchste bestehende Rechnungsnummer für dieses Jahr
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastNumber = data[0].invoice_number;
    const lastSeq = parseInt(lastNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(3, "0")}`;
}

export async function getAllInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      customer:customers(*),
      items:invoice_items(*)
    `)
    .order("invoice_date", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getInvoiceById(id: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      customer:customers(*),
      items:invoice_items(*)
    `)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getCustomerInvoices(customerId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      items:invoice_items(*)
    `)
    .eq("customer_id", customerId)
    .order("invoice_date", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createInvoice(invoice: any, items: any[]) {
  // Rechnung erstellen
  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .insert([invoice])
    .select()
    .single();

  if (invoiceError) throw new Error(invoiceError.message);

  // Rechnungspositionen erstellen
  const itemsWithInvoiceId = items.map((item) => ({
    ...item,
    invoice_id: invoiceData.id,
  }));

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(itemsWithInvoiceId);

  if (itemsError) throw new Error(itemsError.message);

  return invoiceData;
}

export async function updateInvoice(id: string, invoice: any, items: any[]) {
  // Rechnung aktualisieren
  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .update(invoice)
    .eq("id", id)
    .select()
    .single();

  if (invoiceError) throw new Error(invoiceError.message);

  // Alte Positionen löschen
  const { error: deleteError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);

  if (deleteError) throw new Error(deleteError.message);

  // Neue Positionen erstellen
  if (items.length > 0) {
    const itemsWithInvoiceId = items.map((item) => ({
      ...item,
      invoice_id: id,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemsWithInvoiceId);

    if (itemsError) throw new Error(itemsError.message);
  }

  return invoiceData;
}

// ==================== RECHNUNGS-AKTIONEN ====================

export async function deleteInvoice(id: string) {
  const { error: itemsError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);
  if (itemsError) throw new Error(itemsError.message);

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id);
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

// ==================== RECHNUNGS-AKTIVITÄTEN ====================

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

// ==================== BENUTZER ====================

export async function getAllUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createUser(user: any) {
  const { data, error } = await supabase
    .from("users")
    .insert([user])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateUser(id: string, user: any) {
  const { data, error } = await supabase
    .from("users")
    .update(user)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ==================== DASHBOARD STATISTIKEN ====================

export async function getDashboardStats() {
  // Kunden-Statistiken
  const { count: totalCustomers } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });

  const { count: activeCustomers } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // Lead-Statistiken
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { data: leadsByStatus } = await supabase
    .from("leads")
    .select("status")
    .in("status", ["new", "contacted", "qualified", "proposal"]);

  // Vertrags-Statistiken
  const { count: activeContracts } = await supabase
    .from("contracts")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { data: contractsData } = await supabase
    .from("contracts")
    .select("annual_amount")
    .eq("status", "active");

  const totalContractValue = contractsData?.reduce(
    (sum, contract) => sum + Number(contract.annual_amount || 0),
    0
  ) || 0;

  // Ticket-Statistiken
  const { count: openTickets } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  // Rechnungs-Statistiken
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select("total, paid_amount, status");

  const totalRevenue = invoicesData?.reduce(
    (sum, inv) => sum + Number(inv.total || 0),
    0
  ) || 0;

  const openInvoicesAmount = invoicesData
    ?.filter((inv) => inv.status === "open")
    .reduce((sum, inv) => sum + (Number(inv.total || 0) - Number(inv.paid_amount || 0)), 0) || 0;

  return {
    customers: {
      total: totalCustomers || 0,
      active: activeCustomers || 0,
    },
    leads: {
      total: totalLeads || 0,
      active: leadsByStatus?.length || 0,
    },
    contracts: {
      active: activeContracts || 0,
      totalValue: totalContractValue,
    },
    tickets: {
      open: openTickets || 0,
    },
    revenue: {
      total: totalRevenue,
      open: openInvoicesAmount,
    },
  };
}


// ==================== KUNDEN-PORTAL ====================

export async function getCustomerPortalSettings(customerId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("portal_enabled")
    .eq("id", customerId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCustomerPortalSettings(
  customerId: string,
  portalEnabled: boolean
) {
  const { data, error } = await supabase
    .from("customers")
    .update({ portal_enabled: portalEnabled })
    .eq("id", customerId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ==================== KUNDEN-BENUTZER ====================

export async function getCustomerUsers(customerId: string) {
  const { data, error } = await supabase
    .from("customer_users")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createCustomerUser(customerUser: any) {
  const { data, error } = await supabase
    .from("customer_users")
    .insert([customerUser])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCustomerUser(id: string, customerUser: any) {
  const { data, error } = await supabase
    .from("customer_users")
    .update(customerUser)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCustomerUser(id: string) {
  const { error } = await supabase
    .from("customer_users")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function authenticateCustomerUser(email: string, password: string) {
  // In Produktion: Verwenden Sie Supabase Auth oder eine sichere Passwort-Verifikation
  const { data, error } = await supabase
    .from("customer_users")
    .select("*")
    .eq("email", email)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error("Invalid credentials");
  }

  // TODO: Passwort-Verifikation mit bcrypt/argon2
  // Für jetzt: Einfacher Vergleich (NICHT PRODUKTIONSREIF!)

  // Update last_login
  await supabase
    .from("customer_users")
    .update({ last_login: new Date().toISOString() })
    .eq("id", data.id);

  return data;
}

// ==================== TICKET-KOMMENTARE (INTERN/EXTERN) ====================

export async function getTicketComments(ticketId: string, includeInternal: boolean = true) {
  let query = supabase
    .from("ticket_comments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (!includeInternal) {
    query = query.eq("is_internal", false);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createTicketComment(comment: any) {
  const { data, error } = await supabase
    .from("ticket_comments")
    .insert([comment])
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (!comment.is_internal) {
    const { data: ticket } = await supabase.from("tickets").select("title, customer_id").eq("id", comment.ticket_id).single();
    if (ticket?.customer_id) {
      triggerPushNotification([ticket.customer_id], "customer", "Neue Ticket-Antwort", `Gross-ICT hat auf das Ticket "${ticket.title}" geantwortet.`, { url: `/portal-tickets-customer?ticketId=${comment.ticket_id}` }, "tickets").catch(console.error);
    }
  }

  return data;
}

// ==================== KUNDEN-PORTAL: TICKETS ====================

export async function getCustomerUserTickets(customerUserId: string) {
  const { data: customerUser, error: userError } = await supabase
    .from("customer_users")
    .select("customer_id, role")
    .eq("id", customerUserId)
    .single();

  if (userError) throw new Error(userError.message);

  let query = supabase
    .from("tickets")
    .select(`
      *,
      customer:customers(*)
    `)
    .eq("customer_id", customerUser.customer_id);

  // Wenn Rolle 'user', nur eigene Tickets
  if (customerUser.role === "user") {
    query = query.eq("created_by_customer_user_id", customerUserId);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createCustomerTicket(ticket: any, customerUserId: string) {
  const ticketData = {
    ...ticket,
    created_by_customer_user_id: customerUserId,
  };

  const { data, error } = await supabase
    .from("tickets")
    .insert([ticketData])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ==================== ANGEBOTE (SERVER) ====================

export async function getQuoteById(id: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select(`*, customer:customers(*), items:quote_items(*)`)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuoteStatus(quoteId: string, status: string) {
  const { error } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", quoteId);
  if (error) throw new Error(error.message);
}

// ==================== NEWSLETTER ====================

export async function getNewsletterById(id: string) {
  const { data, error } = await supabase
    .from("newsletters")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getNewsletterRecipients(newsletterId: string) {
  const { data, error } = await supabase
    .from("newsletter_recipients")
    .select("*")
    .eq("newsletter_id", newsletterId);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateNewsletter(id: string, updates: any) {
  const { data, error } = await supabase
    .from("newsletters")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
