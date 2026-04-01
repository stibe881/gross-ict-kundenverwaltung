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

  // Für cron-Aufrufe erfordern wir oft ein secret, aber Supabase ruft intern über Service Key auf,
  // oder wir prüfen den Auth Header. Wir lassen es vorerst offen für Aufrufe von localhost/Supabase pg_cron.

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch due reminders
    const { data: dueReminders, error: fetchError } = await supabaseAdmin
      .from("lead_reminders")
      .select("*, leads(*)")
      .eq("is_processed", false)
      .lte("remind_at", new Date().toISOString());

    if (fetchError) {
      console.error("[process-reminders] Fetch Error:", fetchError.message);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ message: "No due reminders found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let errors: string[] = [];

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    // Backup fallback if EXPO_PUBLIC_API_BASE_URL isn't in Edge env vars
    const frontendUrl = Deno.env.get("EXPO_PUBLIC_API_BASE_URL")?.replace('/api', '') || "https://app.gross-ict.ch";

    for (const reminder of dueReminders) {
      try {
        const { data: userAuth } = await supabaseAdmin.auth.admin.getUserById(reminder.user_id);
        const email = userAuth?.user?.email;
        
        let leadObj = reminder.leads;
        if (Array.isArray(leadObj) && leadObj.length > 0) {
            leadObj = leadObj[0];
        }
        
        const leadName = leadObj?.company || leadObj?.name || 'Unbekannt';

        if (email && resendApiKey) {
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 20px;">Gross ICT</h1>
                <p style="margin: 4px 0 0; opacity: 0.8; font-size: 14px;">Erinnerung: Akquise ${leadName}</p>
              </div>
              <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hallo,</p>
                <p>Dies ist deine festgelegte Erinnerung für die Akquise <strong>${leadName}</strong>.</p>
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #eee;">
                  <p style="margin: 0;"><strong>Notiz:</strong><br/>${(reminder.note || '').replace(/\\n/g, '<br/>')}</p>
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${frontendUrl}/leads" style="display: inline-block; background: #d4a432; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                    Akquise ansehen
                  </a>
                </div>
                <p>Freundliche Grüsse<br/><strong>Dein Gross ICT System</strong></p>
              </div>
            </div>
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Gross ICT <info@gross-ict.ch>",
              to: [email],
              subject: `Erinnerung Akquise: ${leadName} - Gross ICT`,
              html,
            }),
          }).catch(e => console.error("[Reminders] Failed to send email:", e));
        }

        // Send Push Notification
        const pushPayload = {
            recipients: [reminder.user_id],
            recipientType: "admin",
            title: `Erinnerung: Akquise ${leadName}`,
            body: reminder.note || 'Erinnerung fällig',
            data: { url: \`/leads\`, category: "lead_reminders" }
        };

        const { error: pushError } = await supabaseAdmin.functions.invoke('send-push', {
            body: pushPayload,
        });

        if (pushError) {
             console.error("[Reminders] Error invoking send-push:", pushError.message);
        }

        // Mark as processed
        await supabaseAdmin
            .from("lead_reminders")
            .update({ is_processed: true })
            .eq("id", reminder.id);

        processed++;
      } catch (e: any) {
        console.error(`[Reminders] Error processing reminder ${reminder.id}:`, e.message);
        errors.push(`Reminder ${reminder.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ processed, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[process-reminders] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
