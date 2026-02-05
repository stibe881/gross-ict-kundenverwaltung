import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as supabaseDb from "./supabase-db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Dashboard-Statistiken
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return supabaseDb.getDashboardStats();
    }),
  }),

  // Benutzerverwaltung
  users: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new Error("Unauthorized");
      }
      return supabaseDb.getAllUsers();
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          email: z.string().email(),
          role: z.enum(["admin", "manager", "accountant", "sales", "support"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return supabaseDb.createUser(input);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          email: z.string().email().optional(),
          role: z
            .enum(["admin", "manager", "accountant", "sales", "support"])
            .optional(),
          is_active: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        const { id, ...data } = input;
        return supabaseDb.updateUser(id, data);
      }),
  }),

  // CRM - Kundenverwaltung
  customers: router({
    // TODO: Revert to protectedProcedure before production!
    list: publicProcedure.query(async () => {
      const customers = await supabaseDb.getAllCustomers();
      // Transform snake_case DB fields to camelCase for frontend
      return customers.map((c) => ({
        id: c.id,
        firstName: c.first_name,
        lastName: c.last_name,
        companyName: c.company_name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        postalCode: c.postal_code,
        country: c.country,
        notes: c.notes,
        status: c.status,
        createdAt: c.created_at,
      }));
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerById(input.id);
      }),

    // TODO: Revert to protectedProcedure before production!
    create: publicProcedure
      .input(
        z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          companyName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().default("CH"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        console.log("[API] customers.create called with:", input);
        console.log("[API] User context:", ctx.user ? `Authenticated as ${ctx.user.openId}` : "Not authenticated");
        try {
          const result = await supabaseDb.createCustomer({
            first_name: input.firstName,
            last_name: input.lastName,
            company_name: input.companyName,
            email: input.email,
            phone: input.phone,
            address: input.address,
            city: input.city,
            postal_code: input.postalCode,
            country: input.country,
            notes: input.notes,
          });
          console.log("[API] Customer created successfully:", result);
          return result;
        } catch (error) {
          console.error("[API] Error creating customer:", error);
          throw error;
        }
      }),

    // TODO: Revert to protectedProcedure before production!
    update: publicProcedure
      .input(
        z.object({
          id: z.string(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          companyName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
          notes: z.string().optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseDb.updateCustomer(id, {
          first_name: data.firstName,
          last_name: data.lastName,
          company_name: data.companyName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          postal_code: data.postalCode,
          country: data.country,
          notes: data.notes,
          status: data.status,
        });
      }),

    // TODO: Revert to protectedProcedure before production!
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return supabaseDb.deleteCustomer(input.id);
      }),
  }),

  // Kommunikation
  communications: router({
    list: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerCommunications(input.customerId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          type: z.enum(["email", "phone", "meeting", "note"]),
          subject: z.string(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.createCommunication({
          customer_id: input.customerId,
          type: input.type,
          subject: input.subject,
          notes: input.notes,
        });
      }),
  }),

  // Leads (Akquise)
  leads: router({
    list: publicProcedure.query(async () => {
      return supabaseDb.getAllLeads();
    }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string(),
          company: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          status: z
            .enum(["new", "contacted", "qualified", "proposal", "won", "lost"])
            .default("new"),
          value: z.number().optional(),
          source: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.createLead(input);
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          company: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          status: z
            .enum(["new", "contacted", "qualified", "proposal", "won", "lost"])
            .optional(),
          value: z.number().optional(),
          source: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseDb.updateLead(id, data);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return supabaseDb.deleteLead(input.id);
      }),
  }),

  // Verträge
  contracts: router({
    // TODO: Revert to protectedProcedure before production!
    list: publicProcedure.query(async () => {
      return supabaseDb.getAllContracts();
    }),

    getByCustomer: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerContracts(input.customerId);
      }),

    // TODO: Revert to protectedProcedure before production!
    create: publicProcedure
      .input(
        z.object({
          customerId: z.string(),
          title: z.string(),
          description: z.string().optional(),
          startDate: z.string(),
          endDate: z.string(),
          annualAmount: z.number(),
          noticePeriodMonths: z.number().default(3),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.createContract({
          customer_id: input.customerId,
          title: input.title,
          description: input.description,
          start_date: input.startDate,
          end_date: input.endDate,
          annual_amount: input.annualAmount,
          notice_period_months: input.noticePeriodMonths,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          annualAmount: z.number().optional(),
          noticePeriodMonths: z.number().optional(),
          status: z.enum(["active", "cancelled", "expired"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseDb.updateContract(id, {
          title: data.title,
          description: data.description,
          start_date: data.startDate,
          end_date: data.endDate,
          annual_amount: data.annualAmount,
          notice_period_months: data.noticePeriodMonths,
          status: data.status,
        });
      }),
  }),

  // Tickets
  tickets: router({
    list: protectedProcedure.query(async () => {
      return supabaseDb.getAllTickets();
    }),

    getByCustomer: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerTickets(input.customerId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          title: z.string(),
          description: z.string().optional(),
          priority: z.enum(["low", "medium", "high"]).default("medium"),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.createTicket({
          customer_id: input.customerId,
          title: input.title,
          description: input.description,
          priority: input.priority,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          description: z.string().optional(),
          status: z.enum(["open", "in_progress", "closed"]).optional(),
          priority: z.enum(["low", "medium", "high"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseDb.updateTicket(id, data);
      }),
  }),

  // Produkte
  products: router({
    // TODO: Revert to protectedProcedure before production!
    list: publicProcedure.query(async () => {
      return supabaseDb.getAllProducts();
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          price: z.number(),
          vatRate: z.number().default(8.1),
          type: z.enum(["product", "service"]).default("service"),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.createProduct({
          name: input.name,
          description: input.description,
          price: input.price,
          vat_rate: input.vatRate,
          type: input.type,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          description: z.string().optional(),
          price: z.number().optional(),
          vatRate: z.number().optional(),
          type: z.enum(["product", "service"]).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseDb.updateProduct(id, {
          name: data.name,
          description: data.description,
          price: data.price,
          vat_rate: data.vatRate,
          type: data.type,
          is_active: data.isActive,
        });
      }),
  }),

  // Rechnungen
  invoices: router({
    // TODO: Revert to protectedProcedure before production!
    list: publicProcedure.query(async () => {
      return supabaseDb.getAllInvoices();
    }),

    getByCustomer: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerInvoices(input.customerId);
      }),

    // TODO: Revert to protectedProcedure before production!
    create: publicProcedure
      .input(
        z.object({
          customerId: z.string(),
          invoiceNumber: z.string(),
          invoiceDate: z.string(),
          dueDate: z.string(),
          items: z.array(
            z.object({
              productId: z.string().optional(),
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              vatRate: z.number(),
              total: z.number(),
            })
          ),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { items, ...invoiceData } = input;

        // Berechne Summen
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const vatAmount = items.reduce(
          (sum, item) => sum + (item.total * item.vatRate) / 100,
          0
        );
        const total = subtotal + vatAmount;

        const invoice = {
          customer_id: invoiceData.customerId,
          invoice_number: invoiceData.invoiceNumber,
          invoice_date: invoiceData.invoiceDate,
          due_date: invoiceData.dueDate,
          subtotal,
          vat_amount: vatAmount,
          total,
          notes: invoiceData.notes,
        };

        const itemsData = items.map((item) => ({
          product_id: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          vat_rate: item.vatRate,
          total: item.total,
        }));

        return supabaseDb.createInvoice(invoice, itemsData);
      }),

    // TODO: Revert to protectedProcedure before production!
    update: publicProcedure
      .input(
        z.object({
          id: z.string(),
          invoiceNumber: z.string(),
          invoiceDate: z.string(),
          dueDate: z.string(),
          items: z.array(z.object({
            productId: z.string().optional(),
            description: z.string(),
            quantity: z.number(),
            unitPrice: z.number(),
            vatRate: z.number(),
            total: z.number(),
          })),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { items, id, ...invoiceData } = input;

        // Berechne Summen
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const vatAmount = items.reduce(
          (sum, item) => sum + (item.total * item.vatRate) / 100,
          0
        );
        const total = subtotal + vatAmount;

        const invoice = {
          invoice_number: invoiceData.invoiceNumber,
          invoice_date: invoiceData.invoiceDate,
          due_date: invoiceData.dueDate,
          subtotal,
          vat_amount: vatAmount,
          total,
          notes: invoiceData.notes,
        };

        const itemsData = items.map((item) => ({
          product_id: item.productId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          vat_rate: item.vatRate,
          total: item.total,
        }));

        return supabaseDb.updateInvoice(id, invoice, itemsData);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return supabaseDb.deleteInvoice(input.id);
      }),
  }),

  // Kunden-Portal
  customerPortal: router({
    // Portal-Einstellungen
    getSettings: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerPortalSettings(input.customerId);
      }),

    updateSettings: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          portalEnabled: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.updateCustomerPortalSettings(
          input.customerId,
          input.portalEnabled
        );
      }),

    // Kunden-Benutzer-Verwaltung
    listUsers: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerUsers(input.customerId);
      }),

    createUser: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          email: z.string().email(),
          firstName: z.string(),
          lastName: z.string(),
          role: z.enum(["user", "admin"]),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.createCustomerUser({
          customer_id: input.customerId,
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
          role: input.role,
          password_hash: input.password, // Wird automatisch gehasht
        });
      }),

    updateUser: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          email: z.string().email().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          role: z.enum(["user", "admin"]).optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return supabaseDb.updateCustomerUser(id, {
          email: data.email,
          first_name: data.firstName,
          last_name: data.lastName,
          role: data.role,
          is_active: data.isActive,
        });
      }),

    deleteUser: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return supabaseDb.deleteCustomerUser(input.id);
      }),

    // Kunden-Login
    authenticate: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.authenticateCustomerUser(input.email, input.password);
      }),

    // Kunden-Tickets (für Portal)
    getMyTickets: publicProcedure
      .input(z.object({ customerUserId: z.string() }))
      .query(async ({ input }) => {
        return supabaseDb.getCustomerUserTickets(input.customerUserId);
      }),

    createTicket: publicProcedure
      .input(
        z.object({
          customerUserId: z.string(),
          customerId: z.string(),
          title: z.string(),
          description: z.string().optional(),
          priority: z.enum(["low", "medium", "high"]).default("medium"),
        })
      )
      .mutation(async ({ input }) => {
        const { customerUserId, ...ticketData } = input;
        return supabaseDb.createCustomerTicket(
          {
            customer_id: ticketData.customerId,
            title: ticketData.title,
            description: ticketData.description,
            priority: ticketData.priority,
          },
          customerUserId
        );
      }),

    // Ticket-Kommentare (nur externe für Kunden)
    getTicketComments: publicProcedure
      .input(
        z.object({
          ticketId: z.string(),
          includeInternal: z.boolean().default(false),
        })
      )
      .query(async ({ input }) => {
        return supabaseDb.getTicketComments(
          input.ticketId,
          input.includeInternal
        );
      }),

    createComment: publicProcedure
      .input(
        z.object({
          ticketId: z.string(),
          comment: z.string(),
          isInternal: z.boolean().default(false),
          userId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return supabaseDb.createTicketComment({
          ticket_id: input.ticketId,
          comment: input.comment,
          is_internal: input.isInternal,
          user_id: input.userId,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
