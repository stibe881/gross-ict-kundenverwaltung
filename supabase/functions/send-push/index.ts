import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const reqBody = await req.json();

    // Handle save-token action — APPENDS token (keeps max 5, deduplicates)
    if (reqBody.action === 'save-token') {
      const { userId, userType, pushToken } = reqBody;
      console.log("[send-push] Saving token for", userType, userId, "token:", pushToken);
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const table = userType === "customer" ? "customer_portal_users" : "users";

      // Read existing token(s)
      const { data: existing } = await supabaseAdmin
        .from(table)
        .select("push_token")
        .eq("id", userId)
        .single();

      // Parse existing tokens (could be single token or comma-separated)
      let tokens: string[] = [];
      if (existing?.push_token) {
        tokens = existing.push_token.split(',').map((t: string) => t.trim()).filter(Boolean);
      }

      // Add new token if not already present, keep max 5 most recent
      if (!tokens.includes(pushToken)) {
        tokens.push(pushToken);
        if (tokens.length > 5) tokens = tokens.slice(-5);
      }

      const newValue = tokens.join(',');
      console.log("[send-push] Storing tokens:", newValue);

      const { error } = await supabaseAdmin.from(table).update({ push_token: newValue }).eq("id", userId);
      if (error) {
        console.error("[send-push] Save token error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
        });
      }
      return new Response(JSON.stringify({ success: true, tokens: tokens.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { recipients, recipientType, title, body, data } = reqBody;
    console.log("[send-push] Request:", { recipients, recipientType, title });

    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get push tokens
    const table = recipientType === "customer" ? "customer_portal_users" : "users";
    let query = supabaseAdmin.from(table).select("id, push_token").not("push_token", "is", null);

    if (recipients !== "all_admins" && Array.isArray(recipients)) {
      query = query.in("id", recipients);
    }

    const { data: targetUsers, error: queryError } = await query;
    console.log("[send-push] Found users:", targetUsers?.length, "Error:", queryError?.message);

    if (queryError) {
      return new Response(JSON.stringify({ error: queryError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!targetUsers || targetUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No users with push tokens found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Save notification history (non-blocking)
    try {
      const histories = targetUsers.map(u => ({
        user_id: u.id,
        title,
        body,
        data: data || {},
        read: false,
      }));
      await supabaseAdmin.from("notification_history").insert(histories);
    } catch (histErr) {
      console.warn("[send-push] Could not save notification history:", histErr);
    }

    // Expand comma-separated tokens into individual messages
    const messages: any[] = [];
    for (const u of targetUsers) {
      if (!u.push_token) continue;
      const tokens = u.push_token.split(',').map((t: string) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        if (token.startsWith("ExponentPushToken")) {
          messages.push({
            to: token,
            sound: "default",
            title,
            body,
            data: data || {},
          });
        }
      }
    }

    console.log("[send-push] Sending", messages.length, "messages to Expo");

    let expoResult = null;
    if (messages.length > 0) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(messages),
      });
      expoResult = await response.json();
      console.log("[send-push] Expo response:", JSON.stringify(expoResult));

      // Clean up invalid tokens (DeviceNotRegistered)
      if (expoResult?.data) {
        const invalidTokens: string[] = [];
        for (let i = 0; i < expoResult.data.length; i++) {
          if (expoResult.data[i]?.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(messages[i].to);
          }
        }

        if (invalidTokens.length > 0) {
          console.log("[send-push] Cleaning up", invalidTokens.length, "invalid tokens");
          // Remove invalid tokens from the DB
          for (const u of targetUsers) {
            if (!u.push_token) continue;
            const validTokens = u.push_token.split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => t && !invalidTokens.includes(t));

            if (validTokens.length !== u.push_token.split(',').length) {
              await supabaseAdmin.from(table)
                .update({ push_token: validTokens.join(',') || null })
                .eq("id", u.id);
              console.log("[send-push] Cleaned tokens for user", u.id);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: messages.length,
      expoResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[send-push] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
