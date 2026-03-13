import { Client } from "pg";
import { readFileSync } from "fs";
import { config } from "dotenv";

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const client = new Client({
  connectionString,
});

async function run() {
  try {
    const sql = readFileSync("supabase/migrations/20260313155616_add_accounting_years_table.sql", "utf-8");
    await client.connect();
    console.log("Connected to DB, running migration...");
    await client.query(sql);
    console.log("Migration applied successfully!");
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
