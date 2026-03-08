import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: 'diatest55@gross-ict.ch',
        password: 'TestPassword123!',
        email_confirm: true
    });
    console.log('Result:', error || (data && data.user ? data.user.id : "No user?"));

    if (data && data.user && data.user.id) {
        await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    }
}
run();
