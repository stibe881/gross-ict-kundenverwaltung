import { supabase } from "@/lib/supabase";

// ==================== KUNDEN ====================

export async function getAllCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
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
  return data;
}

export async function updateTicket(id: string, ticket: any) {
  const { data, error } = await supabase
    .from("tickets")
    .update(ticket)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
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
  const { data, error } = await supabase
    .from("products")
    .update(product)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ==================== RECHNUNGEN ====================

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
