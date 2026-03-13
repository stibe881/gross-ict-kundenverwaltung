import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function main() {
    const supabaseAdmin = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data: users, error: fetchError } = await supabaseAdmin.from("users").select("id, email").limit(1);
    if (fetchError || !users?.length) {
        console.log("Error or no users:", fetchError);
        return;
    }
    const userId = users[0].id;
    console.log("Updating user:", userId);

    const { data, error } = await supabaseAdmin.from("users").update({
        iban: "CH93 0000 0000 0000 0000 0",
        address: "Teststr 5"
    }).eq("id", userId).select();

    console.log("Result:", data);
    console.log("Error:", error);
}

main().catch(console.error);
