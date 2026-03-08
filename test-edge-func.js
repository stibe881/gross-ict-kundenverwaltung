const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testEdge() {
    // 1. Get an existing Session (Auth token)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'dev@gross-ict.ch', // need a real admin user to have a token. Or use service role.
        password: 'use-test-user-or-so' // Actually, let's just make the request using the raw anon key if the edge function needs Auth.
    });
    // Wait, the edge function checks `await userClient.auth.getUser()`. We need a real JWT!
}
testEdge();
