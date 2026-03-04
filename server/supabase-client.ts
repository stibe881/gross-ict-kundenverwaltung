import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

// Prefer service_role key (bypasses RLS) for server-side operations.
// Falls back to anon key if service_role is not set.
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
    console.warn("[Supabase] WARNING: SUPABASE_URL or key not set. Database operations will fail.");
}

if (!supabaseServiceRoleKey) {
    console.warn("[Supabase] WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Using anon key — RLS may block queries.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
