import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking if any users have a push_token...");
  const { data: users, error: usersError } = await supabase.from('users').select('email, push_token').not('push_token', 'is', null);
  if (usersError) {
    console.error("users error:", usersError.message);
  } else {
    console.log(`Found ${users.length} admins/employees with a push_token.`);
    if (users.length > 0) console.log("Example:", users[0].push_token);
  }

  console.log("Checking if any customer_portal_users have a push_token...");
  const { data: customers, error: cError } = await supabase.from('customer_portal_users').select('email, push_token').not('push_token', 'is', null);
  if (cError) {
    console.error("customer_portal_users error:", cError.message);
  } else {
    console.log(`Found ${customers.length} customers with a push_token.`);
    if (customers.length > 0) console.log("Example:", customers[0].push_token);
  }
}

check();
