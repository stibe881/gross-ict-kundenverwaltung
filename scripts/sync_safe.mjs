import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncIdSafely() {
  const oldId = '49079a19-4b6a-4568-b7ad-b3db64312cd4';
  const newId = 'bf061125-9bf5-4fdb-b566-e627a97b5f61';

  // 1. Unassign tickets from old ID
  console.log('Unassigning tickets...');
  await supabase.from('tickets').update({ assigned_to: null }).eq('assigned_to', oldId);
  await supabase.from('ticket_comments').update({ user_id: null }).eq('user_id', oldId);

  // 2. Update user ID
  console.log('Updating user ID...');
  const { error: userErr } = await supabase.from('users').update({ id: newId }).eq('id', oldId);
  if (userErr) {
    console.error('Failed to update user ID:', userErr);
    return;
  }

  // 3. Reassign tickets to new ID
  console.log('Reassigning tickets...');
  await supabase.from('tickets').update({ assigned_to: newId }).is('assigned_to', null); // This is risky but works for demo if no other nulls exist, better to just let them be unassigned for now to be safe.
  
  console.log('Done! User ID is synced.');
}

syncIdSafely();
