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
        let resText = "";
        let errorMessage: string | undefined = undefined;

        // 1. Ping the URL
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        let serverInfo = "";
        let securityWarnings: string[] = [];
        let dnsARecords: any[] = [];
        let dnsMxRecords: any[] = [];
        let dnsWarnings: string[] = [];

        try {
          const res = await fetch(entry.url, {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; GrossICT-Monitoring/1.0; +https://gross-ict.ch)",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          responseTime = Date.now() - start;
          statusCode = res.status;
          status = (statusCode >= 200 && statusCode < 400) ? 'up' : 'down';
          sslValid = true; // If fetch succeeds, SSL is natively verified and valid
          
          const poweredBy = res.headers.get("x-powered-by");
          const serverHeader = res.headers.get("server");
          if (poweredBy) serverInfo += `Powered by: ${poweredBy}. `;
          if (serverHeader) serverInfo += `Server: ${serverHeader}.`;
          
          if (poweredBy && poweredBy.toLowerCase().includes("php/7")) {
              securityWarnings.push(`Veraltete PHP-Version erkannt: ${poweredBy} (Sicherheitsrisiko).`);
          }

          if (status === 'up' && entry.expected_keyword) {
              resText = await res.text();
              const lowerText = resText.toLowerCase();
              const keyword = entry.expected_keyword.toLowerCase();
              
              if (!lowerText.includes(keyword)) {
                  // Fallback: Check if it's an SPA and keyword is in the main JS bundle
                  let foundInJs = false;
                  const jsMatches = [...resText.matchAll(/<script[^>]+src=["']([^"']+\.js)["']/g)];
                  
                  // Only check up to 3 JS files to avoid timeouts
                  for (const match of jsMatches.slice(0, 3)) {
                      try {
                          const jsUrl = new URL(match[1], entry.url).href;
                          const jsRes = await fetch(jsUrl, { signal: controller.signal });
                          const jsText = await jsRes.text();
                          if (jsText.toLowerCase().includes(keyword)) {
                              foundInJs = true;
                              break;
                          }
                      } catch (err) {
                          // Ignore JS fetch errors
                      }
                  }
                  
                  if (!foundInJs) {
                      status = 'down';
                      errorMessage = `Suchwort "${entry.expected_keyword}" nicht gefunden.`;
                  }
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

        // 2. DNS Checks (Google DNS API)
        try {
            const urlObj = new URL(entry.url);
            const domain = urlObj.hostname;
            
            // A Records
            const aRes = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
            if (aRes.ok) {
                const aData = await aRes.json();
                dnsARecords = (aData.Answer || []).filter((a: any) => a.type === 1).map((a: any) => a.data);
            }
            
            // MX Records
            const mxRes = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
            if (mxRes.ok) {
                const mxData = await mxRes.json();
                dnsMxRecords = (mxData.Answer || []).filter((a: any) => a.type === 15).map((a: any) => a.data);
            }
            
            if (entry.dns_a_records && entry.dns_a_records.length > 0 && dnsARecords.length > 0) {
               const oldA = new Set(entry.dns_a_records);
               const newA = new Set(dnsARecords);
               if (oldA.size !== newA.size || [...oldA].some(x => !newA.has(x as string))) {
                   dnsWarnings.push("A-Record (IP-Adresse) hat sich geändert!");
               }
            }
            if (entry.dns_mx_records && entry.dns_mx_records.length > 0 && dnsMxRecords.length > 0) {
               const oldMx = new Set(entry.dns_mx_records);
               const newMx = new Set(dnsMxRecords);
               if (oldMx.size !== newMx.size || [...oldMx].some(x => !newMx.has(x as string))) {
                   dnsWarnings.push("MX-Record (Mailserver) hat sich geändert!");
               }
            }
        } catch (e) {
            // Ignore DNS errors
        }

        let blacklistStatus: any[] = [];
        let agentData: any = null;

        // 2.5 Phase 2: Spamhaus Blacklist Check (Spamhaus ZEN)
        if (dnsARecords.length > 0) {
            try {
                const ip = dnsARecords[0]; 
                if (ip.match(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/)) {
                    const reversedIp = ip.split('.').reverse().join('.');
                    const spamhausQuery = `${reversedIp}.zen.spamhaus.org`;
                    const blRes = await fetch(`https://dns.google/resolve?name=${spamhausQuery}&type=A`);
                    if (blRes.ok) {
                        const blData = await blRes.json();
                        if (blData.Answer && blData.Answer.length > 0) {
                            blacklistStatus.push({
                                type: "spamhaus",
                                ip: ip,
                                listed: true,
                                result: blData.Answer[0].data
                            });
                            securityWarnings.push(`ACHTUNG: Die Server-IP (${ip}) ist auf einer Blacklist (Spamhaus)!`);
                        }
                    }
                }
            } catch (e) {
                // Ignore blacklist fetch errors
            }
        }

        // 3. Escalation Logic
        let currentDownSince = entry.down_since;
        let currentEscalation = entry.escalation_level || 0;
        let triggerAlertLevel = 0; // 0 = none, 1 = Push, 2 = Info Email, 3 = Customer Email
        
        if (status === 'down') {
            if (!currentDownSince) {
                currentDownSince = new Date().toISOString();
            }
            
            const downMinutes = (Date.now() - new Date(currentDownSince).getTime()) / 60000;
            
            if (downMinutes >= 5 && currentEscalation < 1) {
                currentEscalation = 1;
                triggerAlertLevel = 1;
            }
            if (downMinutes >= 15 && currentEscalation < 2) {
                currentEscalation = 2;
                triggerAlertLevel = 2;
            }
            if (downMinutes >= 60 && currentEscalation < 3) {
                currentEscalation = 3;
                triggerAlertLevel = 3;
            }
        } else {
            currentDownSince = null;
            currentEscalation = 0;
        }

        let sslInfo = { valid: sslValid, expiry: undefined, issuer: undefined, errorMsg: undefined };

        // 4. Save Log
        const logRes = await supabaseAdmin.from('monitoring_logs').insert({
          url_id: entry.id,
          status,
          status_code: statusCode,
          response_time: responseTime,
          error_message: status === 'down' ? errorMessage : null,
        });
        if (logRes.error) {
            console.error("Log Insert Error:", logRes.error.message);
            throw new Error(`DB Error (Logs): ${logRes.error.message}`);
        }

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

        // 5. Update URL
        const updateRes = await supabaseAdmin.from('monitoring_urls').update({
          last_status: status,
          last_status_code: statusCode,
          last_response_time: responseTime,
          last_checked_at: new Date().toISOString(),
          last_error: status === 'down' ? errorMessage : null,
          ssl_valid: sslInfo.valid,
          down_since: currentDownSince,
          escalation_level: currentEscalation,
          server_info: serverInfo || null,
          security_warnings: securityWarnings,
          dns_a_records: dnsARecords.length > 0 ? dnsARecords : entry.dns_a_records,
          dns_mx_records: dnsMxRecords.length > 0 ? dnsMxRecords : entry.dns_mx_records,
          dns_warnings: dnsWarnings,
          blacklist_status: blacklistStatus,
          ...(domainAlertFired ? { domain_alert_sent: true } : {})
        }).eq('id', entry.id);

        if (updateRes.error) {
            console.error("URL Update Error:", updateRes.error.message);
            throw new Error(`DB Error (URL Update): ${updateRes.error.message}`);
        }

        // 6. Escalation & Alerts
        const contentMatchFailed = status === 'down' && statusCode && statusCode >= 200 && statusCode < 400 && entry.expected_keyword && !resText.toLowerCase().includes(entry.expected_keyword.toLowerCase());
        
        if (!isManualCheck && !isMuted) {
          // If domain/SSL expires, or an escalation level was hit
          if (triggerAlertLevel > 0 || (!sslInfo.valid && entry.url.startsWith('https://') && entry.ssl_valid === true) || domainAlertFired) {
            // Send Alerts
            let alertReason = `Die Webseite ist nicht erreichbar (HTTP ${statusCode || 'Timeout'}).`;
            let alertTitle = `Überwachung: ${entry.name} hat ein Problem`;
            
            if (contentMatchFailed) {
                alertReason = `Die Webseite lädt zwar (HTTP ${statusCode}), aber das Wort "${entry.expected_keyword}" wurde nicht gefunden!`;
            } else if (!sslInfo.valid && entry.ssl_valid === true) {
                alertReason = `Das SSL-Zertifikat ist ungültig oder abgelaufen.`;
            } else if (domainAlertFired) {
                alertTitle = `Domain-Ablauf: ${entry.name}`;
                const daysLeft = Math.floor((new Date(entry.domain_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                alertReason = `Die Domain läuft in ${daysLeft} Tagen ab (${new Date(entry.domain_expiry).toLocaleDateString('de-CH')}).`;
            }

            if (triggerAlertLevel >= 1 || domainAlertFired || !sslInfo.valid) {
              // Level 1: Push Notification to users
              for (const user of alertUsers) {
                const pushPayload = {
                  recipients: [user.id],
                  recipientType: "admin",
                  title: alertTitle,
                  body: alertReason + (triggerAlertLevel >= 1 ? ` (Seit ${Math.round((Date.now() - new Date(currentDownSince!).getTime())/60000)} Min down)` : ''),
                  data: { url: `/uberwachung?openId=${entry.id}`, category: "monitoring_alerts" }
                };
                await supabaseAdmin.functions.invoke('send-push', { body: pushPayload }).catch(console.error);
              }
            }

            if ((triggerAlertLevel >= 2 || domainAlertFired || !sslInfo.valid) && resendApiKey) {
              // Level 2: Email to info@gross-ict.ch
              const htmlInfo = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">Gross ICT - Escalation Level ${triggerAlertLevel}</h1>
                  </div>
                  <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
                    <p>Hallo Team,</p>
                    <p>Ein Problem erfordert Aufmerksamkeit:</p>
                    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #eee;">
                      <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${entry.name}</p>
                      <p style="margin: 0 0 8px 0;"><strong>URL:</strong> <a href="${entry.url}">${entry.url}</a></p>
                      <p style="margin: 0; color: #DC2626;"><strong>Problem:</strong> ${alertReason}</p>
                    </div>
                  </div>
                </div>
              `;

              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Gross ICT System <info@gross-ict.ch>",
                  to: ["info@gross-ict.ch"],
                  subject: `🚨 Eskalation Level ${triggerAlertLevel}: ${entry.name}`,
                  html: htmlInfo,
                }),
              }).catch(console.error);
            }

            if (triggerAlertLevel >= 3 && resendApiKey && entry.customer_id) {
              // Level 3: Email to Customer
              const { data: customer } = await supabaseAdmin.from('customers').select('email, first_name').eq('id', entry.customer_id).single();
              if (customer?.email) {
                const htmlCustomer = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1a1a2e; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; font-size: 20px;">Wichtige Info zu Ihrer Webseite</h1>
                    </div>
                    <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px;">
                      <p>Guten Tag ${customer.first_name || 'Kunde'},</p>
                      <p>unser automatisches System hat eine länger andauernde Störung auf Ihrer Webseite festgestellt:</p>
                      <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #eee;">
                        <p style="margin: 0 0 8px 0;"><strong>Webseite:</strong> <a href="${entry.url}">${entry.url}</a></p>
                        <p style="margin: 0; color: #DC2626;"><strong>Status:</strong> Seit über 60 Minuten nicht erreichbar.</p>
                      </div>
                      <p>Wir arbeiten bereits proaktiv an der Fehlerbehebung und prüfen den Sachverhalt. Sie müssen vorerst nichts weiter unternehmen.</p>
                      <p>Freundliche Grüsse<br/><strong>Gross ICT System</strong></p>
                    </div>
                  </div>
                `;

                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: "Gross ICT Support <info@gross-ict.ch>",
                    to: [customer.email],
                    subject: `Wichtige Info zu Ihrer Webseite: ${entry.name}`,
                    html: htmlCustomer,
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
