// Online-Zahlung einer Rechnung: leitet auf eine Stripe-Checkout-Seite weiter.
// Aufruf aus der Rechnungs-E-Mail: .../invoice-payment?id=<invoiceId>
// Die Verbuchung übernimmt der stripe-webhook nach erfolgreicher Zahlung.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function page(title: string, message: string, success: boolean): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} – Gross ICT</title>
<style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.card{max-width:420px;text-align:center;background:#1c1c1e;border:1px solid #333;border-radius:16px;padding:36px}
h1{font-size:20px;margin:16px 0 8px}p{color:#aaa;font-size:14px;line-height:1.5}
.icon{font-size:52px}</style></head><body><div class="card">
<div class="icon">${success ? "&#x2705;" : "&#x2139;&#xFE0F;"}</div>
<h1>${title}</h1><p>${message}</p>
<p style="margin-top:20px;color:#777">Gross ICT · info@gross-ict.ch</p>
</div></body></html>`;
  return new Response(html, { headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const status = url.searchParams.get("status");

  if (status === "success") {
    return page("Vielen Dank!", "Ihre Zahlung wurde erfolgreich übermittelt. Sie erhalten die Bestätigung in Kürze.", true);
  }
  if (status === "cancelled") {
    return page("Zahlung abgebrochen", "Die Zahlung wurde nicht abgeschlossen. Sie können den Link in der E-Mail jederzeit erneut öffnen.", false);
  }
  if (!id) return page("Link ungültig", "Diese Zahlungsseite ist nicht gültig.", false);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, paid_amount, status, customer:customers(email, company_name, first_name, last_name)")
      .eq("id", id)
      .maybeSingle();

    if (!invoice) return page("Rechnung nicht gefunden", "Dieser Zahlungslink ist nicht (mehr) gültig.", false);
    if (invoice.status === "cancelled") return page("Rechnung storniert", "Diese Rechnung wurde storniert – es ist keine Zahlung nötig.", false);

    const openAmount = Math.max(0, (invoice.total || 0) - (invoice.paid_amount || 0));
    if (invoice.status === "paid" || openAmount < 0.05) {
      return page("Bereits bezahlt", `Die Rechnung ${invoice.invoice_number} ist bereits vollständig bezahlt. Vielen Dank!`, true);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return page("Nicht verfügbar", "Online-Zahlung ist derzeit nicht verfügbar. Bitte nutzen Sie die Angaben auf der Rechnung.", false);

    const selfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/invoice-payment`;
    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][price_data][currency]": "chf",
      "line_items[0][price_data][product_data][name]": `Rechnung ${invoice.invoice_number} – Gross ICT`,
      "line_items[0][price_data][unit_amount]": String(Math.round(openAmount * 100)),
      "line_items[0][quantity]": "1",
      "metadata[invoice_id]": invoice.id,
      "payment_intent_data[metadata][invoice_id]": invoice.id,
      success_url: `${selfUrl}?id=${invoice.id}&status=success`,
      cancel_url: `${selfUrl}?id=${invoice.id}&status=cancelled`,
    });
    const email = (invoice.customer as any)?.email;
    if (email) params.set("customer_email", email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const session = await res.json();
    if (!res.ok || !session.url) {
      console.error("[invoice-payment] Stripe error:", JSON.stringify(session));
      return page("Fehler", "Die Zahlungsseite konnte nicht erstellt werden. Bitte versuchen Sie es später erneut.", false);
    }

    return new Response(null, { status: 303, headers: { ...corsHeaders, Location: session.url } });
  } catch (e: any) {
    console.error("[invoice-payment] Error:", e);
    return page("Fehler", "Es ist ein unerwarteter Fehler aufgetreten.", false);
  }
});
