import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceUpdateId() {
  const oldId = '49079a19-4b6a-4568-b7ad-b3db64312cd4';
  const newId = 'bf061125-9bf5-4fdb-b566-e627a97b5f61';

  console.log(Attempting to replace old ID  with new auth ID );

  // Using raw RPC to update ID cascade. 
  // We don't have a direct postgres connection here, so we will try a two step process: delete the old one, insert the new one
  
  // 1. Unassign tickets and comments
  await supabase.from('tickets').update({ assigned_to: null }).eq('assigned_to', oldId);
  await supabase.from('ticket_comments').update({ user_id: null }).eq('user_id', oldId);

  // 2. Fetch old user data
  const { data: oldUser } = await supabase.from('users').select('*').eq('id', oldId).single();
  
  if (oldUser) {
      // 3. Delete old user
      await supabase.from('users').delete().eq('id', oldId);
      
      // 4. Insert new user with old data
      const { error } = await supabase.from('users').insert({
          ...oldUser,
          id: newId
      });
      if (error) console.error("Insert error:", error);
      else console.log("SUCCESS! User ID swapped.");
  } else {
      console.error("Old user not found.");
  }
}

forceUpdateId();
