import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEVEL_LABELS = ["Zahlungserinnerung", "1. Mahnung", "2. Mahnung", "Betreibungsandrohung"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Dunning-Settings laden
    const { data: settings } = await supabase
      .from("dunning_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings?.auto_enabled) {
      return new Response(
        JSON.stringify({ message: "Automatische Mahnungen deaktiviert", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const daysAfterDue = settings.days_after_due_reminder || 5;
    const daysBetween = settings.days_between_levels || 10;

    // 2. Überfällige, offene Rechnungen laden (nicht bezahlt, nicht gestoppt)
    const { data: invoices, error: invoicesErr } = await supabase
      .from("invoices")
      .select("*, customer:customers(email, company_name, first_name, last_name)")
      .in("status", ["open", "overdue"])
      .eq("dunning_stopped", false)
      .lt("dunning_level", 3);

    if (invoicesErr) {
      console.error("[process-dunning] Error loading invoices:", invoicesErr);
      return new Response(JSON.stringify({ error: invoicesErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    let processed = 0;
    const results: any[] = [];

    for (const invoice of invoices || []) {
      if (!invoice.customer?.email) continue;

      const dueDate = new Date(invoice.due_date);
      const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentLevel = invoice.dunning_level || 0;

      // Bestimme ob eine Mahnung fällig ist
      let shouldSend = false;
      let nextLevel = currentLevel;

      if (currentLevel === 0 && daysSinceDue >= daysAfterDue) {
        // Noch nie gemahnt, Frist nach Fälligkeit überschritten
        if (!invoice.last_dunning_at) {
          shouldSend = true;
          nextLevel = 0;
        }
      }

      if (invoice.last_dunning_at) {
        const lastDunning = new Date(invoice.last_dunning_at);
        const daysSinceLastDunning = Math.floor((now.getTime() - lastDunning.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastDunning >= daysBetween && currentLevel < 3) {
          shouldSend = true;
          nextLevel = currentLevel + 1;
        }
      }

      if (!shouldSend) continue;

      // Mahnung senden via send-reminder-email Edge Function
      try {
        const { error: sendErr } = await supabase.functions.invoke("send-reminder-email", {
          body: { id: invoice.id, level: nextLevel },
        });

        if (sendErr) {
          console.error(`[process-dunning] Error sending level ${nextLevel} for ${invoice.id}:`, sendErr);
          results.push({ invoice_id: invoice.id, error: sendErr.message });
        } else {
          processed++;
          results.push({
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            level: nextLevel,
            label: LEVEL_LABELS[nextLevel],
          });
        }
      } catch (err: any) {
        console.error(`[process-dunning] Exception for ${invoice.id}:`, err);
        results.push({ invoice_id: invoice.id, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, total: invoices?.length || 0, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[process-dunning] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
