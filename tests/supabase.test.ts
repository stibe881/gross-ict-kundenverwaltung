import { describe, it, expect } from "vitest";

describe("Supabase Connection", () => {
  it("should have Supabase credentials configured", () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    expect(supabaseUrl).toBeDefined();
    expect(supabaseUrl).toContain("supabase.co");
    expect(supabaseAnonKey).toBeDefined();
    expect(supabaseAnonKey).toMatch(/^eyJ/); // JWT format
  });

  it("should connect to Supabase", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test connection by querying a simple endpoint
    const { error } = await supabase.from("customers").select("count", { count: "exact", head: true });
    
    // If table doesn't exist yet, that's okay - we just want to verify the connection works
    if (error && !error.message.includes("relation") && !error.message.includes("does not exist")) {
      throw error;
    }
    
    expect(supabase).toBeDefined();
  });
});
