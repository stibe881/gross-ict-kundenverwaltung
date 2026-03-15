const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFilePath = 'C:\\Users\\stefa\\.gemini\\antigravity\\brain\\a777af7b-bce1-4a66-b1af-75f09121eac6\\supabase_tasks.sql';
  const sql = fs.readFileSync(sqlFilePath, 'utf-8');
  
  console.log("Executing Tasks Migration...");
  
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error("Migration failed:", error);
  } else {
    console.log("Migration successful!");
    await supabase.rpc('exec_sql', { query: `NOTIFY pgrst, 'reload schema';` });
    console.log("Schema cache reloaded.");
  }
}

run();
