import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const env = config({ path: "./.env" });
const supabaseUrl = env["SUPABASE_URL"];
const supabaseKey = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables.");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc("exec_sql", {
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_deductible BOOLEAN DEFAULT true;`
  });
  console.log(error || data);
}

run();
