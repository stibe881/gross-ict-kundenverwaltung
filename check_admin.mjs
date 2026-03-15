import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdmin() {
  const { data, error } = await supabase.from('users').select('*').eq('id', 'bf061125-9bf5-4fdb-b566-e627a97b5f61');
  console.log('Result for bf061125:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

checkAdmin();
