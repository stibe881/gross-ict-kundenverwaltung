require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    const { data, error } = await supabase.from('expenses').select('*, user:users(name)').limit(1);
    
    if (error) {
        console.error("QUERY ERROR:", error.message, error.details);
    } else {
        console.log("QUERY SUCCESS!", data);
    }
}

testQuery();
