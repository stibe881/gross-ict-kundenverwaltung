import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id fehlt" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY nicht konfiguriert" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Lade die Kampagne
    const { data: campaign, error: campaignErr } = await supabase
      .from("newsletter_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignErr || !campaign) {
      return new Response(JSON.stringify({ error: "Kampagne nicht gefunden" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (campaign.status === "sent") {
       // Nur zur Sicherheit. Im Frontend ändern wir den Status parallel, also kann es okay sein.
       // Aber doppeltes Senden sollte vermieden werden.
    }

    // 2. Lade Abonnenten
    // Hole alle aktiven Kunden (ohne Opt-Out)
    const { data: customers, error: custErr } = await supabase
      .from("customers")
      .select(`
        id, email, first_name, last_name, company_name, newsletter_opt_out,
        customer_newsletter_categories(category_id)
      `)
      .not('email', 'is', null);

    if (custErr) throw new Error("Fehler beim Laden der Abonnenten");

    let validSubscribers = (customers || []).filter((c: any) => 
       c.email && c.email.trim() !== '' && c.newsletter_opt_out !== true
    );

    // 3. Nach Zielgruppen (Kategorien) filtern
    const targetCategories = campaign.target_category_ids || [];
    if (targetCategories.length > 0) {
        validSubscribers = validSubscribers.filter((c: any) => {
            const userCategories = c.customer_newsletter_categories?.map((cat: any) => cat.category_id) || [];
            return targetCategories.some((tc: string) => userCategories.includes(tc));
        });
    }

    if (validSubscribers.length === 0) {
       return new Response(JSON.stringify({ error: "Keine Abonnenten gefunden (evtl. falsche Kategorie?)." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. E-Mails generieren (Batch Processinging - max 100 per request recommended by Resend, but Resend API Batch max is 100)
    // Wir machen Arrays von 100 max.
    const batchChunks = [];
    const chunkSize = 100;
    
    for (let i = 0; i < validSubscribers.length; i += chunkSize) {
        batchChunks.push(validSubscribers.slice(i, i + chunkSize));
    }

    let sentCount = 0;

    for (const chunk of batchChunks) {
        const emailsBatch = chunk.map((c: any) => {
            // Opt-Out Link anhängen
           const unsubscribeUrl = `https://www.gross-ict.ch/abmeldung-newsletter?user=${c.id}`;
           const unsubscribeHtml = `
             <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #9CA3AF; font-size: 11px; font-family: sans-serif;">
               Sie erhalten diese E-Mail, weil Ihre E-Mail-Adresse bei uns für Updates registriert ist.<br>
               Falls Sie keine weiteren Informationen mehr wünschen, können Sie sich jederzeit <a href="${unsubscribeUrl}" style="color: #e6b24a; text-decoration: underline;">hier abmelden</a>.
             </div>
           `;
           
           // Falls die Mail den optout link noch nicht hat (sicherheitshalber)
           let finalHtml = campaign.content || '';
           if (!finalHtml.includes("newsletter-optout")) {
              finalHtml += unsubscribeHtml;
           } else {
              finalHtml = finalHtml.replace(/\[CUSTOMER_ID\]/g, c.id);
           }
           
           // Tracking Pixel
           const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-email?type=newsletter&id=${campaign_id}" width="1" height="1" alt="" style="display:none;" />`;
           finalHtml += trackingPixel;

           return {
             from: "Gross ICT <info@gross-ict.ch>",
             to: [c.email],
             subject: campaign.subject,
             html: finalHtml
           };
        });

        // Ab ans Resend
        const emailRes = await fetch("https://api.resend.com/emails/batch", {
           method: "POST",
           headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
           body: JSON.stringify(emailsBatch),
        });

        if (!emailRes.ok) {
           const errBody = await emailRes.text();
           console.error("[send-newsletter] Resend error details:", errBody);
           
           let detailedMessage = "Fehler beim Resend Batch Versand";
           try {
             const json = JSON.parse(errBody);
             if (json.message) detailedMessage = "Resend API: " + json.message;
           } catch(e) {}
           
           throw new Error(detailedMessage);
        }

        sentCount += chunk.length;
    }

    // 5. Update Kampagne: status & stats
    await supabase
      .from("newsletter_campaigns")
      .update({ 
          status: "sent",
          sent_at: new Date().toISOString(),
          recipients_count: sentCount
      })
      .eq("id", campaign_id);

    return new Response(JSON.stringify({ success: true, sentCount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[send-newsletter] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Interner Fehler" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
