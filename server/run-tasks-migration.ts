import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFilePath = 'C:\\Users\\stefa\\.gemini\\antigravity\\brain\\a777af7b-bce1-4a66-b1af-75f09121eac6\\supabase_tasks.sql';
  let sql = fs.readFileSync(sqlFilePath, 'utf-8');
  
  console.log("Executing Tasks Migration...");
  
  // Try to use exec_sql if it exists
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error("Migration failed via exec_sql:", error);
    console.log("Please run the SQL manually in Supabase SQL Editor.");
  } else {
    console.log("Migration successful!");
    
    // Reload schema cache just in case
    await supabase.rpc('exec_sql', { query: `NOTIFY pgrst, 'reload schema';` });
    console.log("Schema cache reloaded.");
  }
}

run();
