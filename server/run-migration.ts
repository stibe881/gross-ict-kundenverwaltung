import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260308_push_notifications.sql'), 'utf-8');
  
  // Da der JS Client keine direkte `rpc('exec_sql')` Methode hat, 
  // müssen wir die Migration theoretisch über einen Hack ausführen oder 
  // den User bitten es ins Supabase Dashboard einzufügen, WENN rpc nicht klappt.
  // Glücklicherweise können wir einfache Alternativen probieren:
  
  console.log("Adding push_token to users...");
  const { error: e1 } = await supabase.rpc('exec_sql', { query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;` });
  if (e1) console.error(e1);

  console.log("Adding push_token to customer_portal_users...");
  const { error: e2 } = await supabase.rpc('exec_sql', { query: `ALTER TABLE customer_portal_users ADD COLUMN IF NOT EXISTS push_token TEXT;` });
  if (e2) console.error(e2);

  console.log("Modifying notifications table...");
  const { error: e3 } = await supabase.rpc('exec_sql', { query: `ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;` });
  if (e3) console.error(e3);
  const { error: e4 } = await supabase.rpc('exec_sql', { query: `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_portal_user_id UUID REFERENCES customer_portal_users(id) ON DELETE CASCADE;` });
  if (e4) console.error(e4);

  console.log("Creating RLS Policy...");
  const { error: e5 } = await supabase.rpc('exec_sql', { query: `
    CREATE POLICY "Customers can see their own notifications" ON notifications
      FOR SELECT USING (
        auth.role() = 'authenticated' AND 
        customer_portal_user_id IN (
          SELECT id FROM customer_portal_users WHERE id = auth.uid() OR email = (auth.jwt() ->> 'email')
        )
      );
  ` });
  if (e5) console.error(e5);

  console.log("Creating Index...");
  const { error: e6 } = await supabase.rpc('exec_sql', { query: `CREATE INDEX IF NOT EXISTS idx_notifications_customer_portal_user ON notifications(customer_portal_user_id);` });
  if (e6) console.error(e6);
  
  console.log("Done. If this failed, the user needs to paste the sql file into their Supabase SQL editor.");
}

run();
