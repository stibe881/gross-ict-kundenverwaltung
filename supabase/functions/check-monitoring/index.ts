import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as tls from "node:tls"
import * as https from "node:https"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Native Deno fetch already performs strict SSL verification.
// Due to Deno Deploy restrictions, extracting the exact expiry date via raw TCP sockets is intercepted.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let reqBody: any = {};
    if (req.body) {
      try {
        reqBody = await req.json();
      } catch (e) {
        // ignore
      }
    }

    let urlsQuery = supabaseAdmin.from("monitoring_urls").select("*");
    
    if (reqBody.url_id) {
        urlsQuery = urlsQuery.eq("id", reqBody.url_id);
    } else {
        urlsQuery = urlsQuery.eq("is_active", true);
    }

    const { data: urls, error: fetchError } = await urlsQuery;

    if (fetchError) {
      throw new Error(fetchError.message);
    }
    
    if (!urls || urls.length === 0) {
      return new Response(JSON.stringify({ message: "No active URLs to monitor" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isManualCheck = !!reqBody.url_id;

    // Fetch users who want monitoring alerts
    const { data: usersToAlert } = await supabaseAdmin
      .from("users")
      .select("id, email, push_preferences")
      .is("is_active", true);

    const alertUsers = (usersToAlert || []).filter(u => 
      u.push_preferences && u.push_preferences['monitoring_alerts'] !== false
    );

    let processed = 0;
    let errors: string[] = [];
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const frontendUrl = Deno.env.get("EXPO_PUBLIC_API_BASE_URL")?.replace('/api', '') || "https://app.gross-ict.ch";

    for (const entry of urls) {
      try {
        const start = Date.now();
        let status: 'up' | 'down' = 'down';
        let statusCode: number | undefined;
        let responseTime: number | undefined;
        let sslValid = false;

        // 1. Ping the URL
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        let resText = "";
        let errorMessage: string | undefined = undefined;

        try {
          const res = await fetch(entry.url, {
            method: "GET",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          responseTime = Date.now() - start;
          statusCode = res.status;
          status = (statusCode >= 200 && statusCode < 400) ? 'up' : 'down';
          sslValid = true; // If fetch succeeds, SSL is natively verified and valid
          
          if (status === 'up' && entry.expected_keyword) {
              resText = await res.text();
              if (!resText.toLowerCase().includes(entry.expected_keyword.toLowerCase())) {
                  status = 'down';
                  errorMessage = `Suchwort "${entry.expected_keyword}" nicht gefunden.`;
              }
          }
          if (status === 'down' && !errorMessage) {
              errorMessage = `HTTP Fehler: ${statusCode}`;
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          status = 'down';
          errorMessage = e.message || "Unbekannter Netzwerkfehler";
          if (e.message && e.message.toLowerCase().includes("certificate")) {
              sslValid = false;
              errorMessage = "SSL-Zertifikat ungültig oder abgelaufen";
          } else {
              sslValid = entry.ssl_valid === true; 
          }
        }

        // 2. Check SSL (Supabase Proxy workaround)
        let sslInfo = { valid: sslValid, expiry: undefined, issuer: undefined, errorMsg: undefined };

        // 3. Save Log
        await supabaseAdmin.from('monitoring_logs').insert({
          url_id: entry.id,
          status,
          status_code: statusCode,
          response_time: responseTime,
          error_message: status === 'down' ? errorMessage : null,
        });

        let domainAlertFired = false;
        let isMuted = false;
        
        if (entry.muted_until && new Date(entry.muted_until).getTime() > Date.now()) {
            isMuted = true;
        }

        if (entry.domain_expiry && !entry.domain_alert_sent) {
            const daysLeft = (new Date(entry.domain_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            if (daysLeft <= 30 && daysLeft > -100) {
                domainAlertFired = true;
            }
        }

        // 4. Update URL
        await supabaseAdmin.from('monitoring_urls').update({
          last_status: status,
          last_status_code: statusCode,
          last_response_time: responseTime,
          last_checked_at: new Date().toISOString(),
          last_error: status === 'down' ? errorMessage : null,
          ssl_valid: sslInfo.valid,
          ...(domainAlertFired ? { domain_alert_sent: true } : {})
        }).eq('id', entry.id);

        // 5. Check if it went down or SSL is invalid
        const wentDown = entry.last_status === 'up' && status === 'down';
        const contentMatchFailed = status === 'down' && statusCode && statusCode >= 200 && statusCode < 400 && entry.expected_keyword && !resText.toLowerCase().includes(entry.expected_keyword.toLowerCase());
        
        if (!isManualCheck && !isMuted) {
          if (wentDown || (!sslInfo.valid && entry.url.startsWith('https://') && entry.ssl_valid === true) || domainAlertFired) {
            // Send Alerts
            for (const user of alertUsers) {
              let alertReason = wentDown ? `Die Webseite ist nicht mehr erreichbar (HTTP ${statusCode || 'Timeout'}).` : `Das SSL-Zertifikat ist ungültig oder abgelaufen.`;
              let alertTitle = `Überwachung: ${entry.name} hat ein Problem`;
              
              if (contentMatchFailed) {
                  alertReason = `Die Webseite lädt zwar (HTTP ${statusCode}), aber das Wort "${entry.expected_keyword}" wurde nicht gefunden!`;
              } else if (domainAlertFired && !wentDown && sslInfo.valid) {
                  alertTitle = `Domain-Ablauf: ${entry.name}`;
                  const daysLeft = Math.floor((new Date(entry.domain_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  alertReason = `Die Domain läuft in ${daysLeft} Tagen ab (${new Date(entry.domain_expiry).toLocaleDateString('de-CH')}).`;
              }
            
            // Push Notification
            const pushPayload = {
              recipients: [user.id],
              recipientType: "admin",
              title: alertTitle,
              body: alertReason,
              data: { url: `/uberwachung?openId=${entry.id}`, category: "monitoring_alerts" }
            };

            await supabaseAdmin.functions.invoke('send-push', { body: pushPayload }).catch(console.error);

            // Email via Resend
            if (user.email && resendApiKey) {
              const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">Gross ICT - Überwachung</h1>
                  </div>
                  <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
                    <p>Hallo,</p>
                    <p>Es gab ein Problem bei der Überwachung der folgenden Webseite:</p>
                    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #eee;">
                      <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${entry.name}</p>
                      <p style="margin: 0 0 8px 0;"><strong>URL:</strong> <a href="${entry.url}">${entry.url}</a></p>
                      <p style="margin: 0; color: #DC2626;"><strong>Problem:</strong> ${alertReason}</p>
                    </div>
                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${frontendUrl}/uberwachung" style="display: inline-block; background: #d4a432; color: #1a1a2e; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                        Im CRM ansehen
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
                  to: [user.email],
                  subject: `🚨 Ausfall: ${entry.name} - Gross ICT`,
                  html,
                }),
              }).catch(console.error);
            }
          }
        }
      }

      processed++;
      } catch (e: any) {
        errors.push(`URL ${entry.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ processed, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[check-monitoring] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
