import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as tls from "node:tls"
import * as https from "node:https"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function checkSsl(url: string): Promise<{ valid: boolean; expiry?: string; issuer?: string; errorMsg?: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val: any) => {
        if (!resolved) {
            resolved = true;
            resolve(val);
        }
    };

    const fallbackTimeout = setTimeout(() => {
        safeResolve({ valid: false, errorMsg: "Fallback timeout after 6s" });
    }, 6000);

    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'https:') {
        clearTimeout(fallbackTimeout);
        return safeResolve({ valid: false, errorMsg: "Not HTTPS" });
      }

      const socket = tls.connect({
        host: urlObj.hostname,
        port: urlObj.port || 443,
        servername: urlObj.hostname,
        rejectUnauthorized: false,
      }, () => {
        clearTimeout(fallbackTimeout);
        try {
            if (typeof (socket as any)?.getPeerCertificate !== 'function') {
                socket.destroy();
                return safeResolve({ valid: false, errorMsg: "getPeerCertificate is not a function" });
            }
            
            const cert = socket.getPeerCertificate(true);
            socket.destroy();

            if (cert && cert.valid_to) {
              const isNotExpired = new Date(cert.valid_to).getTime() > Date.now();
              safeResolve({
                valid: isNotExpired,
                expiry: new Date(cert.valid_to).toISOString(),
                issuer: cert.issuer?.O || cert.issuer?.CN,
                errorMsg: isNotExpired ? undefined : "Expired",
              });
            } else {
              safeResolve({ valid: false, errorMsg: "Certificate empty or valid_to missing. cert=" + JSON.stringify(cert || {}) });
            }
        } catch (e: any) {
            socket.destroy();
            safeResolve({ valid: false, errorMsg: "Error parsing cert: " + e.message });
        }
      });

      socket.setTimeout(5000);
      socket.on('timeout', () => {
        socket.destroy();
        clearTimeout(fallbackTimeout);
        safeResolve({ valid: false, errorMsg: "tls.connect timeout" });
      });

      socket.on('error', (e) => {
        clearTimeout(fallbackTimeout);
        safeResolve({ valid: false, errorMsg: "tls.connect error: " + e.message });
      });

    } catch (e: any) {
      clearTimeout(fallbackTimeout);
      safeResolve({ valid: false, errorMsg: "Outer catch: " + e.message });
    }
  });
}

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
    ); // Assuming undefined means true, or we only alert if true. Let's alert if not explicitly false.

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

        // 1. Ping the URL
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          const res = await fetch(entry.url, {
            method: "GET",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          responseTime = Date.now() - start;
          statusCode = res.status;
          // Consider 2xx and 3xx as up, others as down
          status = (statusCode >= 200 && statusCode < 400) ? 'up' : 'down';
        } catch {
          clearTimeout(timeoutId);
          status = 'down';
        }

        // 2. Check SSL
        let sslInfo = { valid: false, expiry: undefined, issuer: undefined, errorMsg: undefined };
        if (entry.url.startsWith('https://')) {
          sslInfo = await checkSsl(entry.url) as any;
          if (sslInfo.errorMsg) {
              errors.push(`URL ${entry.url} SSL Error: ${sslInfo.errorMsg}`);
          }
        }

        // 3. Save Log
        await supabaseAdmin.from('monitoring_logs').insert({
          url_id: entry.id,
          status,
          status_code: statusCode,
          response_time: responseTime,
        });

        // 4. Update URL
        await supabaseAdmin.from('monitoring_urls').update({
          last_status: status,
          last_status_code: statusCode,
          last_response_time: responseTime,
          last_checked_at: new Date().toISOString(),
          ssl_valid: sslInfo.valid,
          ssl_expiry: sslInfo.expiry,
          ssl_issuer: sslInfo.issuer,
        }).eq('id', entry.id);

        // 5. Check if it went down or SSL is expiring soon (e.g., < 7 days)
        const wentDown = entry.last_status === 'up' && status === 'down';
        
        let sslExpiringAlert = false;
        if (sslInfo.valid && sslInfo.expiry) {
            const daysUntilExpiry = (new Date(sslInfo.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            // We could alert if daysUntilExpiry < 7, but we don't want to spam every 30 minutes. 
            // Better to only alert if the URL went down for now, as requested: "wenn eine webseite ein problem hat".
        }

        if (wentDown || (!sslInfo.valid && entry.url.startsWith('https://') && entry.ssl_valid === true)) {
          if (!isManualCheck) {
            // Send Alerts
            for (const user of alertUsers) {
              const alertReason = wentDown ? `Die Webseite ist nicht mehr erreichbar (HTTP ${statusCode || 'Timeout'}).` : `Das SSL-Zertifikat ist ungültig oder abgelaufen.`;
              const alertTitle = `Überwachung: ${entry.name} hat ein Problem`;
            
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
