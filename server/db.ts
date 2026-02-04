import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// BENUTZERVERWALTUNG
// ============================================================================

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(users);
}

export async function getActiveUsers() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(users).where(eq(users.isActive, true));
}

export async function updateUser(id: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(data).where(eq(users.id, id));
}

export async function deactivateUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ isActive: false }).where(eq(users.id, id));
}

export async function activateUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ isActive: true }).where(eq(users.id, id));
}

// ============================================================================
// CRM - KUNDEN
// ============================================================================

import {
  customers,
  customerCommunications,
  type InsertCustomer,
  type InsertCustomerCommunication,
} from "../drizzle/schema";
import { desc, like, or } from "drizzle-orm";

export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(customers).orderBy(desc(customers.createdAt));
}

export async function getActiveCustomers() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(customers)
    .where(eq(customers.status, "active"))
    .orderBy(desc(customers.createdAt));
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(customers).where(eq(customers.id, id));
  return result[0] || null;
}

export async function searchCustomers(query: string) {
  const db = await getDb();
  if (!db) return [];

  const searchPattern = `%${query}%`;
  return db
    .select()
    .from(customers)
    .where(
      or(
        like(customers.firstName, searchPattern),
        like(customers.lastName, searchPattern),
        like(customers.companyName, searchPattern),
        like(customers.email, searchPattern)
      )
    )
    .orderBy(desc(customers.createdAt));
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(customers).values(data);
  return { success: true };
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(customers).where(eq(customers.id, id));
}

// Kommunikationshistorie

export async function getCustomerCommunications(customerId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(customerCommunications)
    .where(eq(customerCommunications.customerId, customerId))
    .orderBy(desc(customerCommunications.createdAt));
}

export async function createCustomerCommunication(data: InsertCustomerCommunication) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(customerCommunications).values(data);
  return { success: true };
}
