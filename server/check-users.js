const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const { data: publicUsers } = await supabase.from('users').select('id');
  
  console.log("Auth users:", authUsers.users.map(u => u.id));
  console.log("Public users:", publicUsers.map(u => u.id));
  
  const missing = authUsers.users.filter(au => !publicUsers.find(pu => pu.id === au.id));
  if(missing.length > 0) {
      console.log("Missing users:", missing.map(u => u.id));
      for(const u of missing) {
         await supabase.from('users').insert({
             id: u.id,
             email: u.email,
             first_name: u.user_metadata?.first_name || 'Admin',
             last_name: u.user_metadata?.last_name || 'User',
             role: u.user_metadata?.role || 'admin'
         });
         console.log("Inserted missing user", u.id);
      }
  } else {
      console.log("All users synced.");
  }
}
run();
