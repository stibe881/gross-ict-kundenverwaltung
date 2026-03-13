import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log("Checking recent contracts...");
  const { data: contracts, error: err1 } = await supabase
    .from("contracts")
    .select("id, title, recurring_enabled, start_date, created_at, status")
    .order("created_at", { ascending: false })
    .limit(3);
  
  console.log("Recent contracts:", contracts);

  console.log("Checking recent invoices...");
  const { data: invoices, error: err2 } = await supabase
    .from("invoices")
    .select("id, invoice_number, created_at, notes")
    .order("created_at", { ascending: false })
    .limit(3);
    
  console.log("Recent invoices:", invoices);
}

check().catch(console.error);
