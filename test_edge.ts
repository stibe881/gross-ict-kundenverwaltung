import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: invoices, error: invErr } = await supabase.from("invoices").select("id").eq("status", "draft").order("created_at", { ascending: false }).limit(1);
  if (invErr || !invoices || invoices.length === 0) {
    console.error("No invoices found", invErr);
    return;
  }
  
  const invoiceId = invoices[0].id;
  console.log("Testing with Invoice ID:", invoiceId);
  
  const url = `${supabaseUrl}/functions/v1/contract-page?id=${encodeURIComponent(invoiceId)}&action=generate-invoice-pdf`;
  console.log("Fetching:", url);
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  
  if (!response.ok) {
    console.error("HTTP Error:", response.status, response.statusText);
    const text = await response.text();
    console.error("Body:", text);
    return;
  }
  
  const json = await response.json();
  console.log("Success! PDF Base64 length:", json.pdf?.length);
  if (json.error) console.log("Returned Error:", json.error);
}

run();
