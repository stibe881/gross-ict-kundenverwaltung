import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function main() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  console.log("Updating IBAN...");
  const { data, error } = await supabaseAdmin.from("users").update({
      iban: "123456"
  }).eq("id", "49079a19-4b6a-4568-b7ad-b3db64312cd4").select();

  console.log("Data:", data);
  if (error) {
     console.error("Error:", error);
  }
}

main();
