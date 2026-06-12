import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const query = `
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS special_discount DECIMAL(10, 2) DEFAULT 0.00;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS special_discount_type TEXT DEFAULT 'amount' CHECK (special_discount_type IN ('amount', 'percentage'));

    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS special_discount DECIMAL(10, 2) DEFAULT 0.00;
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS special_discount_type TEXT DEFAULT 'amount' CHECK (special_discount_type IN ('amount', 'percentage'));
  `;
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    console.error('RPC failed:', error.message);
  } else {
    console.log('Migration applied successfully using RPC');
  }
}
run();
