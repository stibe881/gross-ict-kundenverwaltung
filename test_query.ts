import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log("Teste Query '*, user:users(name)'...");
    const { data, error } = await supabase.from('expenses').select('*, user:users(name)').limit(1);
    
    if (error) {
        console.error("QUERY ERROR:", error.message, error.details, error.hint);
    } else {
        console.log("QUERY SUCCESS!", data);
    }
}

testQuery();
