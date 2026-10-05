import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  // Entscheidung des Kunden zu optionalen Leistungen ("1" = mit, "0" = ohne, fehlt = keine Optionen)
  const optionsParam = url.searchParams.get("options");
  const withOptions = optionsParam === "1";

  if (!id) {
    return new Response(
      JSON.stringify({ error: "id fehlt" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Quote laden
    const { data: quote, error: fetchErr } = await supabase
      .from("quotes")
      .select("id, status, quote_number, customer:customers(email, company_name, first_name, last_name)")
      .eq("id", id)
      .single();

    if (fetchErr || !quote) {
      return new Response(
        JSON.stringify({ error: "Angebot nicht gefunden" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prüfen ob bereits angenommen
    if (quote.status === "accepted") {
      return new Response(
        JSON.stringify({ success: true, message: "Angebot wurde bereits angenommen" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prüfen ob abgelaufen oder abgelehnt
    if (quote.status === "expired" || quote.status === "rejected") {
      return new Response(
        JSON.stringify({ error: "Dieses Angebot ist nicht mehr gültig" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Status auf "accepted" setzen - ATOMAR (nur wenn noch nicht accepted)
    const { data: updatedQuotes, error: updateErr } = await supabase
      .from("quotes")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        ...(optionsParam !== null ? { accepted_with_options: withOptions } : {}),
      })
      .eq("id", id)
      .neq("status", "accepted")
      .select();

    if (updateErr) {
      console.error("[accept-quote] Update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Status konnte nicht aktualisiert werden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!updatedQuotes || updatedQuotes.length === 0) {
      // Wurde bereits parallel von einem anderen Request accepted!
      return new Response(
        JSON.stringify({ success: true, message: "Angebot wurde bereits angenommen" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Interessent aktivieren: ein aus einem Lead erstellter Kunde (Status
    // inaktiv) wird mit der Angebotsannahme zum aktiven Kunden
    try {
      const customerId = (updatedQuotes[0] as { customer_id?: string }).customer_id;
      if (customerId) {
        await supabase
          .from("customers")
          .update({ status: "active" })
          .eq("id", customerId)
          .eq("status", "inactive");
      }
    } catch (e) {
      console.error("[accept-quote] Interessent-Aktivierung fehlgeschlagen:", e);
    }

    // Auto-create project from accepted quote
    try {
      // Prüfen, ob bereits ein Projekt für dieses Angebot existiert (Doppelungen verhindern)
      const { data: existingProject } = await supabase
        .from("projects")
        .select("id")
        .eq("quote_id", id)
        .maybeSingle();

      if (existingProject) {
        console.log("[accept-quote] Projekt existiert bereits für dieses Angebot, überspringe Erstellung.");
        return new Response(
          JSON.stringify({ success: true, message: "Angebot bereits verarbeitet" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get full quote with items for project creation
      const { data: fullQuote } = await supabase
        .from("quotes")
        .select("*, items:quote_items(*)")
        .eq("id", id)
        .single();

      if (fullQuote) {
        // Optionale Positionen nur übernehmen, wenn der Kunde sie dazubestellt hat
        const allItems = fullQuote.items || [];
        const includedItems = allItems.filter((it: any) => !it.optional || withOptions);
        const optionalItems = allItems.filter((it: any) => !!it.optional);
        let optionalTotal = 0;
        let optionalTax = 0;
        optionalItems.forEach((it: any) => {
          optionalTotal += it.total || 0;
          optionalTax += (it.total || 0) * ((it.vat_rate ?? 8.1) / 100);
        });
        const budget = (fullQuote.total || 0) + (withOptions ? optionalTotal + optionalTax : 0);

        // Generate project number
        const year = new Date().getFullYear();
        const prefix = `PRJ-${year}-`;
        const { data: lastProject } = await supabase
          .from("projects")
          .select("project_number")
          .like("project_number", `${prefix}%`)
          .order("project_number", { ascending: false })
          .limit(1);

        let nextNum = 1;
        if (lastProject && lastProject.length > 0) {
          const num = parseInt(lastProject[0].project_number.replace(prefix, ""), 10);
          if (!isNaN(num)) nextNum = num + 1;
        }
        const projectNumber = `${prefix}${String(nextNum).padStart(3, "0")}`;

        // Create project
        const { data: project } = await supabase
          .from("projects")
          .insert({
            project_number: projectNumber,
            title: `Projekt aus ${fullQuote.quote_number}`,
            description: fullQuote.notes || "",
            customer_id: fullQuote.customer_id,
            quote_id: id,
            budget,
            status: "planning",
          })
          .select()
          .single();

        // Create milestones from quote items (ohne abgewählte Optionen)
        if (project && includedItems.length > 0) {
          const milestones = includedItems.map((item: any, i: number) => ({
            project_id: project.id,
            title: (item.description || `Position ${i + 1}`).split("\n")[0],
            status: "pending",
            sort_order: i,
          }));
          await supabase.from("project_milestones").insert(milestones);
        }

        console.log("[accept-quote] Project created:", projectNumber);
      }
    } catch (projErr) {
      console.error("[accept-quote] Project creation failed (non-critical):", projErr);
      // Non-critical — quote acceptance still succeeded
    }

    // Optional: E-Mail-Benachrichtigung an Gross ICT
    const customerName = (quote.customer as any)?.company_name ||
      `${(quote.customer as any)?.first_name || ""} ${(quote.customer as any)?.last_name || ""}`.trim() || "Kunde";
    const optionsInfo = optionsParam === null ? "" : withOptions ? " – MIT optionalen Leistungen" : " – ohne optionale Leistungen";

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Gross ICT <info@gross-ict.ch>",
            to: ["info@gross-ict.ch"],
            subject: `✅ Angebot ${quote.quote_number} angenommen – ${customerName}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
                <h2 style="color:#22c55e;">Angebot angenommen! 🎉</h2>
                <p><strong>${customerName}</strong> hat das Angebot <strong>${quote.quote_number}</strong> soeben online angenommen${optionsInfo ? `<strong>${optionsInfo}</strong>` : ""}.</p>
                <p style="color:#666;margin-top:16px;">Zeitpunkt: ${new Date().toLocaleString("de-CH")}</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("[accept-quote] Notification email failed:", emailErr);
      }
    }

    // Push-Benachrichtigung an alle Admins
    try {
      // Get all admin users with push tokens
      const { data: admins } = await supabase
        .from("users")
        .select("id, push_token")
        .not("push_token", "is", null);

      if (admins && admins.length > 0) {
        const messages: any[] = [];
        for (const a of admins) {
          if (!a.push_token) continue;
          const tokens = a.push_token.split(',').map((t: string) => t.trim()).filter(Boolean);
          for (const token of tokens) {
            if (token.startsWith("ExponentPushToken")) {
              messages.push({
                to: token,
                sound: "default",
                title: "Angebot angenommen! 🎉",
                body: `${customerName} hat das Angebot ${quote.quote_number} angenommen${optionsInfo}.`,
                data: { url: "/quotes" },
              });
            }
          }
        }

        if (messages.length > 0) {
          const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(messages),
          });
          const pushResult = await pushRes.json();
          console.log("[accept-quote] Push sent:", JSON.stringify(pushResult));
        }
      }
    } catch (pushErr) {
      console.error("[accept-quote] Push notification failed:", pushErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[accept-quote] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Interner Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
