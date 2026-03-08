import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const supabaseAnon = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function test() {
  const email = 'testportal99@gross-ict.ch';
  const password = 'Test1234Password';
  
  console.log("Creating user:", email);
  const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  
  if (createError) {
    console.error("Create error:", createError.message);
    if (!createError.message.includes('already exists')) {
        return;
    }
  } else {
    console.log("Created user ID:", createData.user.id);
  }

  console.log("Attempting login...");
  const { data: loginData, error: loginError } = await supabaseAnon.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    console.error("Login failed:", loginError.message);
  } else {
    console.log("Login success! User:", loginData.user.id);
  }

  console.log("Cleaning up...");
  if (createData && createData.user && createData.user.id) {
     await supabaseAdmin.auth.admin.deleteUser(createData.user.id);
  }
}

test();
