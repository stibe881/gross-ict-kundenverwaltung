import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // Verify caller has permissions
    const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
        throw new Error(`Unauthorized (User validation failed): ${authError?.message || "No user found"}`);
    }

    const { action, payload } = await req.json();

    if (action === "create") {
      let { email, first_name, last_name, password, role, customer_id, is_active } = payload;
      
      if (!email || !password) throw new Error("Email and password required");
      email = email.trim();

      // 1. Create Auth User
      const { data: authData, error: createAuthError } = await supabaseClient.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
            first_name,
            last_name,
            role,
            customer_id
        }
      });

      if (createAuthError) throw createAuthError;

      const authUser = authData.user;

      // 2. Create Portal User Entry matching Auth User ID
      const { data: portalUser, error: dbError } = await supabaseClient
        .from("customer_portal_users")
        .insert([{
          id: authUser.id,
          customer_id,
          email,
          first_name,
          last_name,
          role: role || 'user',
          is_active: is_active ?? true
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      return new Response(JSON.stringify({ success: true, user: portalUser }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "update") {
        const { id, updates } = payload;
        
        if (updates.email) {
            const { error } = await supabaseClient.auth.admin.updateUserById(id, {
                email: updates.email
            });
            if (error) {
                console.error("Auth update error (ignoring, user might not exist in auth):", error.message);
            }
        }

        const { data: portalUser, error: dbError } = await supabaseClient
            .from("customer_portal_users")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (dbError) throw dbError;
        
        return new Response(JSON.stringify({ success: true, user: portalUser }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    if (action === "delete") {
        const { id } = payload;
        
        const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(id);
        if (authDeleteError) {
             console.error("Auth delete error (ignoring, user might not exist in auth):", authDeleteError.message);
        }

        const { error: dbError } = await supabaseClient.from("customer_portal_users").delete().eq("id", id);
        if (dbError) throw dbError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    }

    throw new Error("Invalid action");

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Returning 200 with success=false for easier client-side error reading
    });
  }
});
