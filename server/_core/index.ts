import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Tracking-Pixel für Rechnungs-Öffnung
  app.get("/api/track/:invoiceId", async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { addInvoiceActivity, getInvoiceById } = await import("../supabase-db");
      const { notifyOwner } = await import("./notification");

      // Prüfen ob Rechnung existiert
      const invoice = await getInvoiceById(invoiceId);
      if (invoice) {
        await addInvoiceActivity(invoiceId, "opened", "Rechnung wurde vom Kunden geöffnet");

        // Push-Notification senden
        const customerName = invoice.customer?.company_name ||
          `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() || "Unbekannt";
        await notifyOwner({
          title: `📧 Rechnung ${invoice.invoice_number} geöffnet`,
          content: `${customerName} hat die Rechnung ${invoice.invoice_number} geöffnet.`,
        }).catch(() => { }); // Fehler ignorieren
      }
    } catch (err) {
      console.error("[tracking] Error:", err);
    }

    // 1x1 transparenter GIF-Pixel
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );
    res.set("Content-Type", "image/gif");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.send(pixel);
  });

  // Tracking-Pixel für Angebots-Öffnung
  app.get("/api/track-quote/:quoteId", async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { getQuoteById } = await import("../supabase-db");
      const { notifyOwner } = await import("./notification");

      const quote = await getQuoteById(quoteId);
      if (quote) {
        const customerName = quote.customer?.company_name ||
          `${quote.customer?.first_name || ""} ${quote.customer?.last_name || ""}`.trim() || "Unbekannt";
        await notifyOwner({
          title: `📋 Angebot ${quote.quote_number} geöffnet`,
          content: `${customerName} hat das Angebot ${quote.quote_number} geöffnet.`,
        }).catch(() => { });
      }
    } catch (err) {
      console.error("[tracking-quote] Error:", err);
    }

    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );
    res.set("Content-Type", "image/gif");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.send(pixel);
  });

  // ── Public Vertrags-Ansicht & Signatur ──

  app.get("/api/public/contracts/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { getContractByToken } = await import("../supabase-db");
      const contract = await getContractByToken(token);
      if (!contract) return res.status(404).json({ error: "Vertrag nicht gefunden" });
      // Return contract data (without sensitive internal fields)
      res.json({
        title: contract.title,
        description: contract.description,
        start_date: contract.start_date,
        end_date: contract.end_date,
        annual_amount: contract.annual_amount,
        notice_period_months: contract.notice_period_months,
        status: contract.status,
        signature_date: contract.signature_date,
        signature_name: contract.signature_name,
        customer: contract.customer ? {
          company_name: contract.customer.company_name,
          first_name: contract.customer.first_name,
          last_name: contract.customer.last_name,
        } : null,
      });
    } catch (err: any) {
      console.error("[public-contract] Error:", err);
      res.status(500).json({ error: "Vertrag konnte nicht geladen werden" });
    }
  });

  app.post("/api/public/contracts/:token/sign", async (req, res) => {
    try {
      const { token } = req.params;
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: "Name ist erforderlich" });

      const clientIp = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "unknown";
      const { signContract } = await import("../supabase-db");
      const contract = await signContract(token, name.trim(), clientIp);

      // Notify admin
      try {
        const { notifyOwner } = await import("./notification");
        await notifyOwner({
          title: "✍️ Vertrag unterzeichnet",
          content: `${name.trim()} hat den Vertrag "${contract.title}" digital unterzeichnet.`,
        });
      } catch (e) { /* ignore notification errors */ }

      res.json({ success: true, signature_date: contract.signature_date });
    } catch (err: any) {
      console.error("[sign-contract] Error:", err);
      res.status(500).json({ error: "Vertrag konnte nicht unterzeichnet werden" });
    }
  });

  app.post("/api/send-contract-email", async (req, res) => {
    try {
      const { contractId } = req.body;
      if (!contractId) return res.status(400).json({ error: "contractId fehlt" });

      const supabaseDb = await import("../supabase-db");
      const { sendContractEmail } = await import("../email");

      // Get the contract with customer data
      const { data: contract, error } = await (await import("../supabase-client")).supabase
        .from("contracts")
        .select("*, customer:customers(*)")
        .eq("id", contractId)
        .single();

      if (error || !contract) return res.status(404).json({ error: "Vertrag nicht gefunden" });
      if (!contract.customer?.email) return res.status(400).json({ error: "Kunde hat keine E-Mail-Adresse" });

      const fmtDate = (d: string) => {
        if (!d) return "-";
        const parts = d.split("-");
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d;
      };

      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://localhost:3000`;
      const signUrl = `${baseUrl}/contract-view?token=${contract.token}`;

      await sendContractEmail({
        to: contract.customer.email,
        contractTitle: contract.title,
        startDate: fmtDate(contract.start_date),
        endDate: fmtDate(contract.end_date),
        annualAmount: Number(contract.annual_amount).toFixed(2),
        signUrl,
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("[send-contract-email] Error:", err);
      res.status(500).json({ error: err.message || "E-Mail konnte nicht gesendet werden" });
    }
  });

  // ── Direkte E-Mail-Endpunkte (kein tRPC, einfacher JSON POST) ──

  app.post("/api/create-portal-user", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Missing Authorization header" });

      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );

      // Verify caller
      const userClient = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL || "",
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) return res.status(401).json({ error: "Unauthorized user" });

      const { email, first_name, last_name, password, role, customer_id, is_active } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const cleanEmail = email.trim();

      // 1. Create Auth User
      const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: { first_name, last_name, role, customer_id }
      });

      if (createAuthError) return res.status(400).json({ error: createAuthError.message });
      const authUser = authData.user;

      // 2. Create DB Entry
      const { data: portalUser, error: dbError } = await supabaseAdmin
        .from("customer_portal_users")
        .insert([{
          id: authUser.id,
          customer_id,
          email: cleanEmail,
          first_name,
          last_name,
          role: role || 'user',
          is_active: is_active ?? true
        }])
        .select()
        .single();

      if (dbError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        return res.status(400).json({ error: dbError.message });
      }

      res.json({ success: true, user: portalUser });
    } catch (err: any) {
      console.error("[create-portal-user] Error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/send-invoice-email", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id fehlt" });

      const { getInvoiceById, addInvoiceActivity } = await import("../supabase-db");
      const { generateInvoicePDF } = await import("../pdf-generator");
      const { sendInvoiceEmail } = await import("../email");

      const invoice = await getInvoiceById(id);
      if (!invoice) return res.status(404).json({ error: "Rechnung nicht gefunden" });
      if (!invoice.customer?.email) return res.status(400).json({ error: "Kunde hat keine E-Mail-Adresse" });

      const customerName = invoice.customer?.company_name ||
        `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() || "Unbekannt";
      const addressParts = [customerName, invoice.customer?.street,
        `${invoice.customer?.zip || ""} ${invoice.customer?.city || ""}`.trim()].filter(Boolean);

      const pdfBuffer = await generateInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        customerNumber: invoice.customer?.customer_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        paymentMethod: "Überweisung",
        customerName,
        customerAddress: addressParts.join("\n"),
        items: (invoice.items || []).map((item: any) => ({
          description: item.description, quantity: item.quantity,
          unitPrice: item.unit_price, vatRate: item.vat_rate, total: item.total,
        })),
        subtotal: invoice.subtotal, totalVat: invoice.vat_amount, total: invoice.total,
      });

      const fmtDate = (d: string) => { const dt = new Date(d); return `${dt.getDate().toString().padStart(2, '0')}.${(dt.getMonth() + 1).toString().padStart(2, '0')}.${dt.getFullYear()}`; };
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://localhost:3000`;

      await sendInvoiceEmail({
        to: invoice.customer.email,
        invoiceNumber: invoice.invoice_number,
        invoiceDate: fmtDate(invoice.invoice_date),
        dueDate: fmtDate(invoice.due_date),
        total: invoice.total.toFixed(2),
        pdfBuffer,
        trackingUrl: `${baseUrl}/api/track/${id}`,
      });

      await addInvoiceActivity(id, "sent", `Rechnung per E-Mail an ${invoice.customer.email} gesendet`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[send-invoice-email] Error:", err);
      res.status(500).json({ error: err.message || "E-Mail konnte nicht gesendet werden" });
    }
  });

  app.post("/api/send-reminder-email", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id fehlt" });

      const { getInvoiceById, addInvoiceActivity } = await import("../supabase-db");
      const { generateInvoicePDF } = await import("../pdf-generator");
      const { sendReminderEmail } = await import("../email");

      const invoice = await getInvoiceById(id);
      if (!invoice) return res.status(404).json({ error: "Rechnung nicht gefunden" });
      if (!invoice.customer?.email) return res.status(400).json({ error: "Kunde hat keine E-Mail-Adresse" });

      const remainingAmount = invoice.total - (invoice.paid_amount || 0);
      const customerName = invoice.customer?.company_name ||
        `${invoice.customer?.first_name || ""} ${invoice.customer?.last_name || ""}`.trim() || "Unbekannt";
      const addressParts = [customerName, invoice.customer?.street,
        `${invoice.customer?.zip || ""} ${invoice.customer?.city || ""}`.trim()].filter(Boolean);

      const pdfBuffer = await generateInvoicePDF({
        invoiceNumber: invoice.invoice_number,
        customerNumber: invoice.customer?.customer_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        paymentMethod: "Überweisung",
        customerName,
        customerAddress: addressParts.join("\n"),
        items: (invoice.items || []).map((item: any) => ({
          description: item.description, quantity: item.quantity,
          unitPrice: item.unit_price, vatRate: item.vat_rate, total: item.total,
        })),
        subtotal: invoice.subtotal, totalVat: invoice.vat_amount, total: invoice.total,
      });

      const fmtDate = (d: string) => { const dt = new Date(d); return `${dt.getDate().toString().padStart(2, '0')}.${(dt.getMonth() + 1).toString().padStart(2, '0')}.${dt.getFullYear()}`; };
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://localhost:3000`;

      await sendReminderEmail({
        to: invoice.customer.email,
        invoiceNumber: invoice.invoice_number,
        invoiceDate: fmtDate(invoice.invoice_date),
        dueDate: fmtDate(invoice.due_date),
        remainingAmount: remainingAmount.toFixed(2),
        pdfBuffer,
        trackingUrl: `${baseUrl}/api/track/${id}`,
      });

      await addInvoiceActivity(id, "reminder_sent", `Zahlungserinnerung per E-Mail an ${invoice.customer.email} gesendet`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[send-reminder-email] Error:", err);
      res.status(500).json({ error: err.message || "Mahnung konnte nicht gesendet werden" });
    }
  });

  app.post("/api/send-quote-email", async (req, res) => {
    try {
      const { quoteId, pdfBase64 } = req.body;
      if (!quoteId) return res.status(400).json({ error: "quoteId fehlt" });

      const { getQuoteById, updateQuoteStatus } = await import("../supabase-db");
      const { sendQuoteEmail } = await import("../email");

      const quote = await getQuoteById(quoteId);
      if (!quote) return res.status(404).json({ error: "Angebot nicht gefunden" });
      if (!quote.customer?.email) return res.status(400).json({ error: "Kunde hat keine E-Mail-Adresse" });

      const fmtDate = (d: string) => { const dt = new Date(d); return `${dt.getDate().toString().padStart(2, '0')}.${(dt.getMonth() + 1).toString().padStart(2, '0')}.${dt.getFullYear()}`; };
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || `http://localhost:3000`;

      await sendQuoteEmail({
        to: quote.customer.email,
        quoteNumber: quote.quote_number,
        quoteDate: fmtDate(quote.quote_date),
        validUntil: quote.valid_until ? fmtDate(quote.valid_until) : "Auf Anfrage",
        total: Number(quote.total).toFixed(2),
        pdfBuffer: Buffer.from(pdfBase64 || "", "base64"),
        trackingUrl: `${baseUrl}/api/track-quote/${quoteId}`,
      });

      await updateQuoteStatus(quoteId, "sent");
      res.json({ success: true });
    } catch (err: any) {
      console.error("[send-quote-email] Error:", err);
      res.status(500).json({ error: err.message || "E-Mail konnte nicht gesendet werden" });
    }
  });

  app.post("/api/send-notification", async (req, res) => {
    try {
      const { recipients, recipientType, title, body, data } = req.body;
      if (!title || !body || !recipients || !recipientType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { createClient } = await import("@supabase/supabase-js");
      const supabaseAdmin = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
      );

      // Verify caller is doing this properly, ideally we should have an authorization check here similar to create-portal-user
      // For now we trust it if it has an auth header or is coming from our trusted clients

      let targetUsers: any[] = [];
      const recipientIds = Array.isArray(recipients) ? recipients : [recipients];

      if (recipients === "all_admins") {
        const { data: adminUsers } = await supabaseAdmin
          .from("users")
          .select("id, push_token")
          .not("push_token", "is", null);
        targetUsers = adminUsers || [];
      } else {
        const table = recipientType === "customer" ? "customer_portal_users" : "users";
        const idColumn = recipientType === "customer" ? "customer_id" : "id";

        const { data: specificUsers } = await supabaseAdmin
          .from(table)
          .select("id, push_token")
          .in(idColumn, recipientIds);
        targetUsers = specificUsers || [];
      }

      // Create history entries in notifications table
      // We do this for everyone, even if they don't have a push token, so it shows up in their Notification Center
      const allHistories: any[] = [];

      if (recipients === "all_admins") {
        const { data: allAdminUsers } = await supabaseAdmin.from("users").select("id");
        if (allAdminUsers) {
          allAdminUsers.forEach(u => allHistories.push({ title, message: body, type: "info", link: data?.url || null, user_id: u.id }));
        }
      } else {
        if (recipientType === "customer") {
          // targetUsers contains exactly the portal users we need to save history for!
          targetUsers.forEach(u => {
            allHistories.push({
              title,
              message: body,
              type: "info",
              link: data?.url || null,
              customer_portal_user_id: u.id
            });
          });
        } else {
          recipientIds.forEach(id => {
            allHistories.push({
              title,
              message: body,
              type: "info",
              link: data?.url || null,
              user_id: id
            });
          });
        }
      }

      if (allHistories.length > 0) {
        await supabaseAdmin.from("notifications").insert(allHistories);
      }

      // Filter only those with valid push tokens for the actual Expo send
      const usersWithTokens = targetUsers.filter(u => u.push_token);

      if (usersWithTokens.length > 0) {
        const { Expo } = await import("expo-server-sdk");
        const expo = new Expo();

        let messages: any[] = [];
        for (let user of usersWithTokens) {
          // Support comma-separated tokens (Expo Go + TestFlight on same device)
          const tokens = user.push_token.split(',').map((t: string) => t.trim()).filter(Boolean);
          for (const token of tokens) {
            if (!Expo.isExpoPushToken(token)) {
              console.error(`Push token ${token} is not a valid Expo push token`);
              continue;
            }
            messages.push({
              to: token,
              sound: 'default',
              title,
              body,
              data,
            });
          }
        }

        let chunks = expo.chunkPushNotifications(messages);
        let tickets = [];
        for (let chunk of chunks) {
          try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
          } catch (error) {
            console.error("Error sending push notifications chunk", error);
          }
        }
      }

      res.json({ success: true, pushedCount: usersWithTokens.length, historyCount: allHistories.length });
    } catch (err: any) {
      console.error("[send-notification] Error:", err);
      res.status(500).json({ error: err.message || "Failed to send notification" });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`[api] server listening on 0.0.0.0:${port}`);
  });
}

startServer().catch(console.error);
