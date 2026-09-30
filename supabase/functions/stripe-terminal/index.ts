import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STRIPE_API = "https://api.stripe.com/v1";

function stripeHeaders() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt (supabase secrets set STRIPE_SECRET_KEY=sk_...)");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function stripeRequest(method: string, path: string, params?: Record<string, string>) {
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: stripeHeaders(),
    body: method === "GET" ? undefined : body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe API Fehler (${res.status})`);
  }
  return json;
}

// Findet die erste Terminal-Location oder legt eine Standard-Location an.
// Tap-to-Pay-Reader müssen beim Verbinden einer Location zugeordnet werden.
async function getOrCreateLocation(): Promise<string> {
  const list = await stripeRequest("GET", "/terminal/locations?limit=1");
  if (list.data && list.data.length > 0) {
    return list.data[0].id;
  }

  // Adresse aus dem Stripe-Account übernehmen, falls hinterlegt
  let address: Record<string, string> = { "address[country]": "CH", "address[line1]": "Hauptsitz", "address[city]": "-", "address[postal_code]": "0000" };
  let name = "Gross ICT";
  try {
    const account = await stripeRequest("GET", "/account");
    const a = account?.company?.address || account?.business_profile?.support_address;
    if (a?.line1 && a?.city && a?.postal_code) {
      address = {
        "address[country]": a.country || "CH",
        "address[line1]": a.line1,
        "address[city]": a.city,
        "address[postal_code]": a.postal_code,
      };
    }
    if (account?.business_profile?.name) name = account.business_profile.name;
  } catch (_) { /* Fallback-Adresse verwenden */ }

  const location = await stripeRequest("POST", "/terminal/locations", {
    display_name: name,
    ...address,
  });
  return location.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, amount, description, invoice_id, payment_intent_id } = await req.json();

    if (action === "connection_token") {
      const token = await stripeRequest("POST", "/terminal/connection_tokens");
      return new Response(JSON.stringify({ secret: token.secret }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "location") {
      const locationId = await getOrCreateLocation();
      return new Response(JSON.stringify({ locationId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "create_payment_intent") {
      // amount: Betrag in Rappen (Integer)
      if (!Number.isInteger(amount) || amount < 50) {
        throw new Error("Ungültiger Betrag (mindestens 50 Rappen)");
      }
      const params: Record<string, string> = {
        amount: String(amount),
        currency: "chf",
        "payment_method_types[]": "card_present",
        capture_method: "automatic",
      };
      if (description) params.description = String(description).slice(0, 500);
      if (invoice_id) params["metadata[invoice_id]"] = String(invoice_id);

      const intent = await stripeRequest("POST", "/payment_intents", params);
      return new Response(JSON.stringify({ id: intent.id, clientSecret: intent.client_secret }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "payment_intent_status") {
      if (!payment_intent_id) throw new Error("payment_intent_id fehlt");
      const intent = await stripeRequest("GET", `/payment_intents/${payment_intent_id}`);
      return new Response(JSON.stringify({ id: intent.id, status: intent.status, amount: intent.amount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "cancel_payment_intent") {
      if (!payment_intent_id) throw new Error("payment_intent_id fehlt");
      const intent = await stripeRequest("POST", `/payment_intents/${payment_intent_id}/cancel`);
      return new Response(JSON.stringify({ id: intent.id, status: intent.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unbekannte Aktion: ${action}`);
  } catch (error) {
    console.error("[stripe-terminal] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
