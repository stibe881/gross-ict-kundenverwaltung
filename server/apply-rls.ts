import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260309_push_tokens_rls.sql'), 'utf-8');
  
  console.log("Applying RLS policies via exec_sql...");
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error("RPC Error:", error.message);
    console.log("FALLBACK: Du musst die Datei 'supabase/migrations/20260309_push_tokens_rls.sql' manuell im Supabase SQL Editor ausführen.");
  } else {
    console.log("Success! RLS policies applied.");
  }
}

run();
