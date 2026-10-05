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
      const { userId, userType, pushToken, userEmail } = reqBody;
      console.log("[send-push] Saving token for", userType, userId, "email:", userEmail, "token:", pushToken);
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const table = userType === "customer" ? "customer_portal_users" : "users";

      // Try to find user by ID first, then fall back to email
      let { data: existing } = await supabaseAdmin
        .from(table)
        .select("id, push_token")
        .eq("id", userId)
        .single();

      // If ID not found, try by email (handles auth ID ≠ users table ID)
      if (!existing && userEmail) {
        console.log("[send-push] ID not found, trying email:", userEmail);
        const { data: byEmail } = await supabaseAdmin
          .from(table)
          .select("id, push_token")
          .eq("email", userEmail)
          .single();
        existing = byEmail;
      }

      if (!existing) {
        console.error("[send-push] User not found by ID or email");
        return new Response(JSON.stringify({ error: "User not found", userId, userEmail }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404,
        });
      }

      // Nur den aktuellsten Token speichern. Das Sammeln mehrerer Tokens
      // (Dev-Build, TestFlight, Neuinstallationen) führte dazu, dass jede
      // Push mehrfach auf demselben Gerät ankam.
      const tokens = [pushToken];
      const newValue = pushToken;
      console.log("[send-push] Storing tokens for user", existing.id, ":", newValue);

      const { error } = await supabaseAdmin.from(table).update({ push_token: newValue }).eq("id", existing.id);
      if (error) {
        console.error("[send-push] Save token error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
        });
      }
      return new Response(JSON.stringify({ success: true, tokens: tokens.length, matchedById: existing.id === userId }), {
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

    // Get users (all targeted, regardless of push token, to ensure dashboard notification history)
    const table = recipientType === "customer" ? "customer_portal_users" : "users";
    let query = supabaseAdmin.from(table).select("id, push_token, push_preferences");

    if (recipients !== "all_admins" && Array.isArray(recipients)) {
      query = query.in("id", recipients);
    }

    const { data: targetUsers, error: queryError } = await query;
    console.log("[send-push] Found users:", targetUsers?.length, "Error:", queryError?.message);

    // Filter users by push_preferences (opt-out model: missing key = enabled)
    const category = data?.category;
    const filteredUsers = (targetUsers || []).filter((u: any) => {
      if (!category) return true; // no category = always send
      const prefs = u.push_preferences || {};
      return prefs[category] !== false; // only skip if explicitly false
    });
    console.log("[send-push] After preference filter:", filteredUsers.length, "category:", category);

    if (queryError) {
      return new Response(JSON.stringify({ error: queryError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!filteredUsers || filteredUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No users with push tokens found (or all filtered by preferences)" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Save to notifications table so it appears in the app dashboard (non-blocking)
    try {
      const records = filteredUsers.map(u => {
        const base = {
            title,
            message: body,
            type: "info",
            link: data?.url || null,
            is_read: false,
        };
        if (recipientType === "customer") {
            return { ...base, customer_portal_user_id: u.id };
        } else {
            return { ...base, user_id: u.id };
        }
      });
      await supabaseAdmin.from("notifications").insert(records);
    } catch (dbErr) {
      console.warn("[send-push] Could not save notifications to DB:", dbErr);
    }

    // Ungelesene pro Empfänger zählen (inkl. der soeben eingefügten), damit
    // das App-Icon-Badge auch bei geschlossener App die richtige Zahl zeigt
    const idColumn = recipientType === "customer" ? "customer_portal_user_id" : "user_id";
    const badgeByUser = new Map<string, number>();
    await Promise.all(filteredUsers.map(async (u: any) => {
      try {
        const { count } = await supabaseAdmin
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq(idColumn, u.id)
          .eq("is_read", false);
        badgeByUser.set(u.id, count || 0);
      } catch (_e) {
        // ohne Zählung einfach keinen Badge mitsenden
      }
    }));

    // Expand comma-separated tokens into individual messages
    const messages: any[] = [];
    for (const u of filteredUsers) {
      if (!u.push_token) continue;
      const tokens = u.push_token.split(',').map((t: string) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        if (token.startsWith("ExponentPushToken")) {
          const badge = badgeByUser.get(u.id);
          messages.push({
            to: token,
            sound: "default",
            title,
            body,
            data: data || {},
            ...(typeof badge === "number" ? { badge } : {}),
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

      // Clean up invalid tokens (DeviceNotRegistered) and surface hard errors
      if (expoResult?.data) {
        const invalidTokens: string[] = [];
        for (let i = 0; i < expoResult.data.length; i++) {
          if (expoResult.data[i]?.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(messages[i].to);
          }
          // InvalidCredentials = missing/expired APNs/FCM credentials on the EAS project.
          // Without this log the function reports success while no push ever arrives.
          if (expoResult.data[i]?.details?.error === 'InvalidCredentials') {
            console.error("[send-push] PUSH CREDENTIALS INVALID — run 'eas credentials' and upload new APNs/FCM push credentials:", expoResult.data[i]?.message);
          }
        }

        if (invalidTokens.length > 0) {
          console.log("[send-push] Cleaning up", invalidTokens.length, "invalid tokens");
          // Remove invalid tokens from the DB
          for (const u of filteredUsers) {
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

    const pushErrors = (expoResult?.data || [])
      .filter((t: any) => t?.status === 'error')
      .map((t: any) => t?.details?.error || t?.message);

    return new Response(JSON.stringify({
      success: true,
      sent: messages.length,
      failed: pushErrors.length,
      pushErrors: pushErrors.length > 0 ? pushErrors : undefined,
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
