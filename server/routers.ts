import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
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

  // Benutzerverwaltung
  users: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Nur Admin und Manager dürfen alle Benutzer sehen
      if (ctx.user.role !== "admin" && ctx.user.role !== "manager") {
        throw new Error("Unauthorized");
      }
      return db.getAllUsers();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        // Benutzer können nur sich selbst sehen, Admin/Manager alle
        if (
          ctx.user.id !== input.id &&
          ctx.user.role !== "admin" &&
          ctx.user.role !== "manager"
        ) {
          throw new Error("Unauthorized");
        }
        return db.getUserById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          email: z.string().email().optional(),
          role: z
            .enum(["admin", "manager", "accountant", "sales", "support"])
            .optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Nur Admin darf Benutzer bearbeiten
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        const { id, ...data } = input;
        await db.updateUser(id, data);
        return { success: true };
      }),

    deactivate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Nur Admin darf Benutzer deaktivieren
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        await db.deactivateUser(input.id);
        return { success: true };
      }),

    activate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Nur Admin darf Benutzer aktivieren
        if (ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        await db.activateUser(input.id);
        return { success: true };
      }),
  }),

  // CRM - Kundenverwaltung
  customers: router({
    list: protectedProcedure.query(async () => {
      return db.getAllCustomers();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerById(input.id);
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchCustomers(input.query);
      }),

    create: protectedProcedure
      .input(
        z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          companyName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          mobile: z.string().optional(),
          website: z.string().optional(),
          street: z.string().optional(),
          city: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
          category: z.string().optional(),
          tags: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return db.createCustomer({ ...input, createdBy: ctx.user.id });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          companyName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          mobile: z.string().optional(),
          website: z.string().optional(),
          street: z.string().optional(),
          city: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
          status: z.enum(["active", "inactive"]).optional(),
          category: z.string().optional(),
          tags: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCustomer(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCustomer(input.id);
        return { success: true };
      }),

    // Kommunikationshistorie
    getCommunications: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .query(async ({ input }) => {
        return db.getCustomerCommunications(input.customerId);
      }),

    addCommunication: protectedProcedure
      .input(
        z.object({
          customerId: z.number(),
          type: z.enum(["email", "call", "meeting", "note"]),
          subject: z.string().optional(),
          content: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return db.createCustomerCommunication({
          ...input,
          createdBy: ctx.user.id,
        });
      }),
  }),

  // Produkte (Artikel & Dienstleistungen)
  products: router({
    list: publicProcedure.query(async () => {
      return await db.listProducts();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductById(input.id);
      }),

    create: publicProcedure
      .input(
        z.object({
          type: z.enum(["article", "service"]),
          name: z.string(),
          description: z.string().optional(),
          unitPrice: z.string(),
          unit: z.string().optional(),
          vatRate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createProduct(input);
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          type: z.enum(["article", "service"]).optional(),
          name: z.string().optional(),
          description: z.string().optional(),
          unitPrice: z.string().optional(),
          unit: z.string().optional(),
          vatRate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await db.updateProduct(id, data);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteProduct(input.id);
      }),
  }),

  // PDF-Export
  pdf: router({
    generateInvoice: protectedProcedure
      .input(
        z.object({
          invoiceNumber: z.string(),
          invoiceDate: z.string(),
          dueDate: z.string(),
          customerName: z.string(),
          customerAddress: z.string(),
          items: z.array(
            z.object({
              description: z.string(),
              quantity: z.number(),
              unitPrice: z.number(),
              vatRate: z.number(),
              total: z.number(),
            })
          ),
          subtotal: z.number(),
          totalVat: z.number(),
          total: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { generateInvoicePDF } = await import("./pdf-generator.js");
        const pdfBuffer = await generateInvoicePDF(input);
        
        // PDF als Base64 zurückgeben
        return {
          pdf: pdfBuffer.toString("base64"),
          filename: `Rechnung-${input.invoiceNumber}.pdf`,
        };
      }),
  }),

  // Dashboard-Statistiken
  dashboard: router({
    getStats: protectedProcedure.query(async ({ ctx }) => {
      // Echte Daten aus der Datenbank abrufen
      const customers = await db.getAllCustomers();
      const leads = await db.getAllLeads();
      const contracts = await db.getAllContracts();
      
      // Statistiken berechnen
      const activeCustomers = customers.filter((c: any) => c.status === "active").length;
      const activeLeads = leads.filter((l: any) => l.status !== "lost").length;
      const activeContracts = contracts.filter((c: any) => c.status === "active").length;
      
      return {
        totalCustomers: customers.length,
        activeCustomers,
        totalLeads: leads.length,
        activeLeads,
        totalContracts: contracts.length,
        activeContracts,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
