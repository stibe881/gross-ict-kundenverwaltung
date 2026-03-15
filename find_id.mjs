import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findCorrectId() {
  const { data, error } = await supabase.from('users').select('id, email, role').eq('email', 'stefan.gross@gross-ict.ch');
  console.log('Users table record:', JSON.stringify(data, null, 2));
}

findCorrectId();
