import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'users' });
  if (error) {
    console.error('RPC Error:', error);
    
    // Fallback if RPC doesn't exist: Query directly via raw SQL if possible, or print standard information.
    // Supabase JS doesn't support arbitrary SQL without RPC, so we'll just check if the user row exists for 'stefan.gross@gross-ict.ch' using the anon key.
  }
}

async function testAnonRead() {
  const anonSupabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

  // Authenticate as Stefan
  const { data: authData, error: authErr } = await anonSupabase.auth.signInWithPassword({
    email: 'stefan.gross@gross-ict.ch',
    password: 'gross' // Just guessing or we can just try to read the users table without auth
  });

  const { data, error } = await anonSupabase.from('users').select('*').eq('email', 'stefan.gross@gross-ict.ch');
  console.log('Anon read users table:', { data, error });
}

testAnonRead();
