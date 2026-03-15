import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRoles() {
  const { data, error } = await supabase.from('users').select('id, name, email, role');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Users role data:', JSON.stringify(data, null, 2));
  }
}

checkRoles();
