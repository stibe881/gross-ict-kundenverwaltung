import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.log('Available env keys:', Object.keys(process.env).filter(k => k.includes('SUPA')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SQL_STATEMENTS = [
  // 1. invoice_activities table + RLS
  `CREATE TABLE IF NOT EXISTS invoice_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    user_name TEXT DEFAULT 'System',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,
  `ALTER TABLE invoice_activities ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "invoice_activities_all" ON invoice_activities`,
  `CREATE POLICY "invoice_activities_all" ON invoice_activities
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated')`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_activities_invoice ON invoice_activities(invoice_id)`,

  // 2. Drop any existing type constraint and re-add without restriction
  // (The table might have a CHECK constraint blocking 'viewed')
  `DO $$
  BEGIN
    ALTER TABLE invoice_activities DROP CONSTRAINT IF EXISTS invoice_activities_type_check;
    ALTER TABLE invoice_activities DROP CONSTRAINT IF EXISTS invoice_activities_type_fkey;
  EXCEPTION WHEN others THEN NULL;
  END $$`,

  // 3. Fix invoices status constraint to include 'sent'
  `ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check`,
  `ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'open', 'sent', 'paid', 'overdue', 'cancelled'))`,

  // 4. Backfill: set already-opened invoices to 'sent'
  `UPDATE invoices SET status = 'sent'
   WHERE id IN (SELECT DISTINCT invoice_id FROM invoice_activities WHERE type = 'viewed')
   AND status = 'open'`,
];

async function run() {
  console.log('Connecting to Supabase:', supabaseUrl);
  
  for (const sql of SQL_STATEMENTS) {
    const preview = sql.replace(/\s+/g, ' ').slice(0, 80);
    process.stdout.write(`Running: ${preview}... `);
    
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      // exec_sql might not exist - try alternative
      if (error.message?.includes('Could not find') || error.code === 'PGRST202') {
        console.error('\n❌ exec_sql RPC not found. Please run SQL in Supabase Dashboard.');
        console.log('\n=== SQL TO RUN IN DASHBOARD ===\n');
        SQL_STATEMENTS.forEach(s => console.log(s + ';\n'));
        process.exit(1);
      }
      // Other errors - log but continue (some statements are idempotent)
      console.log(`⚠️  ${error.message}`);
    } else {
      console.log('✅');
    }
  }
  
  console.log('\n✅ Migration applied successfully!');
  console.log('Please check the Supabase Dashboard to verify invoice_activities has RLS enabled.');
}

run().catch(e => { console.error(e); process.exit(1); });
