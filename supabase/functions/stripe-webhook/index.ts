// Stripe-Webhook: verbucht Online-Zahlungen (checkout.session.completed)
// automatisch auf der Rechnung. Endpoint in Stripe anlegen und das Secret
// als STRIPE_WEBHOOK_SECRET hinterlegen (supabase secrets set ...).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Stripe-Signatur prüfen: HMAC-SHA256 über "t.payload" mit dem Endpoint-Secret
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      sigHeader.split(",").map((p) => p.split("=") as [string, string]),
    );
    const t = parts["t"];
    const v1 = parts["v1"];
    if (!t || !v1) return false;
    // Replay-Schutz: Signatur maximal 10 Minuten alt
    if (Math.abs(Date.now() / 1000 - parseInt(t)) > 600) return false;

    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
    const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return expected === v1;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const payload = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature") || "";

  if (!secret || !(await verifyStripeSignature(payload, signature, secret))) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const event = JSON.parse(payload);
    if (event.type !== "checkout.session.completed") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = event.data?.object;
    const invoiceId = session?.metadata?.invoice_id;
    const amount = (session?.amount_total || 0) / 100;
    if (!invoiceId || amount <= 0) {
      return new Response(JSON.stringify({ received: true, skipped: "no invoice_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotenz: dieselbe Checkout-Session nie doppelt verbuchen
    const marker = `[stripe:${session.id}]`;
    const { data: existing } = await supabase
      .from("invoice_activities")
      .select("id")
      .eq("invoice_id", invoiceId)
      .like("description", `%${marker}%`)
      .limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("invoice_number, total, paid_amount")
      .eq("id", invoiceId)
      .single();
    if (!invoice) throw new Error("Rechnung nicht gefunden: " + invoiceId);

    const newPaid = (invoice.paid_amount || 0) + amount;
    const newStatus = newPaid >= (invoice.total || 0) - 0.01 ? "paid" : "open";
    await supabase.from("invoices").update({ paid_amount: newPaid, status: newStatus }).eq("id", invoiceId);
    await supabase.from("invoice_activities").insert({
      invoice_id: invoiceId,
      type: "payment_added",
      description: `Zahlung von CHF ${amount.toFixed(2)} via Online-Zahlung (Stripe) erfasst. ${newStatus === "paid" ? "Rechnung vollständig bezahlt." : ""} ${marker}`,
    });

    // Push an Admins
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: "all_admins", recipientType: "admin",
          title: "Rechnung online bezahlt 🎉",
          body: `${invoice.invoice_number}: CHF ${amount.toFixed(2)} per Online-Zahlung eingegangen.${newStatus === "paid" ? " Vollständig bezahlt." : ""}`,
          data: { url: `/invoice/${invoiceId}`, category: "invoices" },
        }),
      });
    } catch (e) { console.error("[stripe-webhook] Push fehlgeschlagen:", e); }

    return new Response(JSON.stringify({ received: true, booked: amount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[stripe-webhook] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
