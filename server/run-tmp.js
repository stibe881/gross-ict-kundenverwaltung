const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc("exec_sql", {
      sql: `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_deductible BOOLEAN DEFAULT true;`
  });
  console.log("Error:", error);
  console.log("Data:", data);
}

run();
