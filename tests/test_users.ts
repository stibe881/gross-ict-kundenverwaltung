import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUsers() {
    console.log("Fetching users from 'users' table...");
    const { data: users, error: usersError } = await supabase.from('users').select('*');
    if (usersError) {
        console.error("Error fetching users:", usersError);
    } else {
        console.log(`Found ${users?.length || 0} users in 'users' table.`);
        console.log(users);
    }
}

testUsers().catch(console.error);
