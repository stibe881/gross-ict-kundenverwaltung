import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "manager", "accountant", "sales", "support"])
    .default("sales")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// CRM - KUNDEN
// ============================================================================

export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  companyName: varchar("companyName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  mobile: varchar("mobile", { length: 50 }),
  website: varchar("website", { length: 255 }),
  
  // Adresse
  street: varchar("street", { length: 255 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),
  
  // Status & Kategorisierung
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  category: varchar("category", { length: 100 }),
  tags: text("tags"), // JSON array
  
  // Metadaten
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customerCommunications = mysqlTable("customerCommunications", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  type: mysqlEnum("type", ["email", "call", "meeting", "note"]).notNull(),
  subject: varchar("subject", { length: 255 }),
  content: text("content"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// AKQUISE - LEADS
// ============================================================================

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  companyName: varchar("companyName", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  
  // Pipeline-Status
  status: mysqlEnum("status", [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ])
    .default("new")
    .notNull(),
  
  // Wert & Wahrscheinlichkeit
  estimatedValue: decimal("estimatedValue", { precision: 10, scale: 2 }),
  probability: int("probability").default(0), // 0-100%
  
  // Quelle & Zuständigkeit
  source: varchar("source", { length: 100 }), // z.B. "Website", "Empfehlung", "Messe"
  assignedTo: int("assignedTo"),
  
  // Metadaten
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const leadActivities = mysqlTable("leadActivities", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  type: mysqlEnum("type", ["call", "email", "meeting", "note", "status_change"]).notNull(),
  subject: varchar("subject", { length: 255 }),
  content: text("content"),
  oldStatus: varchar("oldStatus", { length: 50 }),
  newStatus: varchar("newStatus", { length: 50 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// VERTRÄGE
// ============================================================================

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  contractNumber: varchar("contractNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").notNull(),
  
  // Vertragsdetails
  contractType: varchar("contractType", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  
  // Laufzeit
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  noticePeriodDays: int("noticePeriodDays").default(0), // Kündigungsfrist in Tagen
  
  // Finanziell
  value: decimal("value", { precision: 10, scale: 2 }),
  paymentInterval: mysqlEnum("paymentInterval", [
    "once",
    "monthly",
    "quarterly",
    "yearly",
  ]).default("monthly"),
  
  // Status
  status: mysqlEnum("status", ["active", "expired", "cancelled"]).default("active").notNull(),
  
  // Dokumente
  documentUrl: varchar("documentUrl", { length: 500 }),
  
  // Metadaten
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contractHistory = mysqlTable("contractHistory", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  action: mysqlEnum("action", ["created", "renewed", "cancelled", "modified"]).notNull(),
  description: text("description"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// TICKETSYSTEM
// ============================================================================

export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  ticketNumber: varchar("ticketNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId"),
  
  // Ticket-Details
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  
  // Status & Priorität
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"])
    .default("open")
    .notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"])
    .default("medium")
    .notNull(),
  
  // Zuständigkeit
  assignedTo: int("assignedTo"),
  
  // Metadaten
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export const ticketComments = mysqlTable("ticketComments", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("isInternal").default(false), // Interne Notiz oder Kundenkommentar
  attachmentUrl: varchar("attachmentUrl", { length: 500 }),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const knowledgeBase = mysqlTable("knowledgeBase", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 100 }),
  visibility: mysqlEnum("visibility", ["internal", "external"]).default("internal").notNull(),
  
  // Verlinkung zu Ticket (optional)
  sourceTicketId: int("sourceTicketId"),
  
  // Metadaten
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// BUCHHALTUNG - KONTENPLAN
// ============================================================================

export const chartOfAccounts = mysqlTable("chartOfAccounts", {
  id: int("id").autoincrement().primaryKey(),
  accountNumber: varchar("accountNumber", { length: 20 }).notNull().unique(),
  accountName: varchar("accountName", { length: 255 }).notNull(),
  accountType: mysqlEnum("accountType", [
    "asset",
    "liability",
    "equity",
    "revenue",
    "expense",
  ]).notNull(),
  parentAccountId: int("parentAccountId"), // Für hierarchische Struktur
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// BUCHHALTUNG - RECHNUNGEN
// ============================================================================

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId").notNull(),
  
  // Daten
  invoiceDate: timestamp("invoiceDate").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  
  // Beträge
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  
  // Status
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "cancelled"])
    .default("draft")
    .notNull(),
  
  // Zahlungsinformationen
  paidAt: timestamp("paidAt"),
  paymentMethod: varchar("paymentMethod", { length: 50 }),
  
  // Notizen
  notes: text("notes"),
  
  // Metadaten
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const invoiceItems = mysqlTable("invoiceItems", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).notNull(), // z.B. 19.00 für 19%
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  accountId: int("accountId"), // Verknüpfung zum Kontenplan
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// BUCHHALTUNG - AUSGABEN/BELEGE
// ============================================================================

export const expenses = mysqlTable("expenses", {
  id: int("id").autoincrement().primaryKey(),
  expenseDate: timestamp("expenseDate").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  category: varchar("category", { length: 100 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }).default("0.00"),
  accountId: int("accountId"), // Verknüpfung zum Kontenplan
  receiptUrl: varchar("receiptUrl", { length: 500 }), // Beleg-Upload
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// NEWSLETTER
// ============================================================================

export const newsletters = mysqlTable("newsletters", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(), // HTML-Inhalt
  
  // Status
  status: mysqlEnum("status", ["draft", "scheduled", "sent"]).default("draft").notNull(),
  
  // Versand
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  
  // Statistiken
  totalRecipients: int("totalRecipients").default(0),
  delivered: int("delivered").default(0),
  opened: int("opened").default(0),
  clicked: int("clicked").default(0),
  unsubscribed: int("unsubscribed").default(0),
  
  // Metadaten
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const newsletterRecipients = mysqlTable("newsletterRecipients", {
  id: int("id").autoincrement().primaryKey(),
  newsletterId: int("newsletterId").notNull(),
  customerId: int("customerId").notNull(),
  
  // Tracking
  delivered: boolean("delivered").default(false),
  opened: boolean("opened").default(false),
  clicked: boolean("clicked").default(false),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// DASHBOARD - ANPASSBARE KACHELN
// ============================================================================

export const dashboardTiles = mysqlTable("dashboardTiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tileType: varchar("tileType", { length: 50 }).notNull(), // z.B. "customers", "tickets", "revenue"
  position: int("position").notNull(), // Reihenfolge
  isVisible: boolean("isVisible").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// BENACHRICHTIGUNGEN
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // z.B. "ticket", "contract_expiring", "invoice_overdue"
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  relatedEntityType: varchar("relatedEntityType", { length: 50 }), // z.B. "ticket", "contract"
  relatedEntityId: int("relatedEntityId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

export type CustomerCommunication = typeof customerCommunications.$inferSelect;
export type InsertCustomerCommunication = typeof customerCommunications.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export type LeadActivity = typeof leadActivities.$inferSelect;
export type InsertLeadActivity = typeof leadActivities.$inferInsert;

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

export type ContractHistory = typeof contractHistory.$inferSelect;
export type InsertContractHistory = typeof contractHistory.$inferInsert;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;

export type TicketComment = typeof ticketComments.$inferSelect;
export type InsertTicketComment = typeof ticketComments.$inferInsert;

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = typeof knowledgeBase.$inferInsert;

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = typeof chartOfAccounts.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

export type Newsletter = typeof newsletters.$inferSelect;
export type InsertNewsletter = typeof newsletters.$inferInsert;

export type NewsletterRecipient = typeof newsletterRecipients.$inferSelect;
export type InsertNewsletterRecipient = typeof newsletterRecipients.$inferInsert;

export type DashboardTile = typeof dashboardTiles.$inferSelect;
export type InsertDashboardTile = typeof dashboardTiles.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================================
// ARTIKEL & DIENSTLEISTUNGEN
// ============================================================================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["article", "service"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }).default("Stück"), // Stück, Stunden, kg, etc.
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("8.10").notNull(), // 8.1%, 2.6%, etc.
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================================================
// REMINDERS
// ============================================================================

export const leadReminders = mysqlTable("leadReminders", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  userId: int("userId").notNull(),
  remindAt: timestamp("remindAt").notNull(),
  note: text("note").notNull(),
  isProcessed: boolean("isProcessed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadReminder = typeof leadReminders.$inferSelect;
export type InsertLeadReminder = typeof leadReminders.$inferInsert;

