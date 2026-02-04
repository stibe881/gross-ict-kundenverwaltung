import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const supabaseUrl = Constants.expoConfig?.extra?.SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
