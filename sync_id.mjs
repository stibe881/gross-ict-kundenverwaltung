import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncIds() {
  const { data, error } = await supabase
    .from('users')
    .update({ id: 'bf061125-9bf5-4fdb-b566-e627a97b5f61' })
    .eq('email', 'stefan.gross@gross-ict.ch');
  
  if (error) {
    console.error('Update Error:', error);
  } else {
    console.log('Successfully synced public users ID to match Supabase Auth session ID.');
  }
}

syncIds();
