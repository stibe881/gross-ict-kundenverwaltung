import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAdmin() {
  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById('bf061125-9bf5-4fdb-b566-e627a97b5f61');
  if (authErr) {
    console.error('Auth User Error:', authErr);
    return;
  }
  
  const email = authUser.user.email;
  const name = authUser.user.user_metadata?.full_name || email.split('@')[0];

  console.log(`Inserting missing public user record for: ${email}`);

  const { error: insertErr } = await supabase.from('users').upsert({
    id: 'bf061125-9bf5-4fdb-b566-e627a97b5f61',
    email: email,
    name: name,
    provider: 'local',
    role: 'admin',
    is_active: true
  });

  if (insertErr) {
    console.error('Insert Error:', insertErr);
  } else {
    console.log('Successfully inserted admin user row. The dashboard should now work.');
  }
}

fixAdmin();
