// Firmenrecherche über die Google Places API (New) für Akquise-Kampagnen.
//
// Wichtig (Google-Richtlinien): Inhalte der Places API dürfen nicht gespeichert
// werden — ausgenommen die place_id. Diese Function liefert Treffer deshalb nur
// zur ANZEIGE in der App zurück und legt nichts davon in der Datenbank ab.
// Beim Vormerken speichert die App ausschliesslich die place_id.
//
// action "suche":   { action, textQuery, campaignId?, pageToken?, pageSize? }
// action "details": { action, placeId }
// Benötigt das Secret GOOGLE_PLACES_API_KEY (nur für die Places API (New) freigeben).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, pruefeMitarbeiter } from "../_shared/sicherheit.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const FELDER_SUCHE = [
  "places.id", "places.displayName", "places.formattedAddress",
  "places.nationalPhoneNumber", "places.websiteUri", "places.googleMapsUri", "nextPageToken",
].join(",");
const FELDER_DETAILS = "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,googleMapsUri";

function abbilden(p: any) {
  return {
    placeId: p.id as string,
    name: p.displayName?.text ?? "",
    adresse: p.formattedAddress ?? "",
    telefon: p.nationalPhoneNumber ?? "",
    website: p.websiteUri ?? "",
    mapsUrl: p.googleMapsUri ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nur POST." }, 405);

  const { fehler } = await pruefeMitarbeiter(req);
  if (fehler) return fehler;

  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    return json({ error: "GOOGLE_PLACES_API_KEY ist nicht hinterlegt (Supabase → Edge Functions → Secrets)." }, 500);
  }

  try {
    const body = await req.json();

    if (body.action === "suche") {
      const textQuery = String(body.textQuery ?? "").trim().slice(0, 200);
      if (textQuery.length < 3) return json({ error: "Bitte einen Suchbegriff angeben (z.B. «Sanitär Luzern»)." }, 400);
      const pageSize = Math.min(Math.max(Number(body.pageSize) || 20, 1), 20);

      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FELDER_SUCHE },
        body: JSON.stringify({
          textQuery,
          languageCode: "de",
          regionCode: "CH",
          pageSize,
          ...(body.pageToken ? { pageToken: String(body.pageToken) } : {}),
        }),
      });
      const daten = await res.json();
      if (!res.ok) return json({ error: `Google Places: ${daten?.error?.message ?? res.status}` }, 502);

      // Bereits vorgemerkte Einträge dieser Kampagne markieren (nur place_id-Vergleich)
      let schonDa = new Set<string>();
      if (body.campaignId) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await admin.from("prospects").select("google_place_id").eq("campaign_id", body.campaignId).not("google_place_id", "is", null);
        schonDa = new Set((data ?? []).map((r: any) => r.google_place_id));
      }
      const treffer = (daten.places ?? []).map(abbilden).map((t: any) => ({ ...t, bereitsVorgemerkt: schonDa.has(t.placeId) }));
      return json({ treffer, nextPageToken: daten.nextPageToken ?? null });
    }

    if (body.action === "details") {
      const placeId = String(body.placeId ?? "");
      if (!/^[A-Za-z0-9_-]{10,200}$/.test(placeId)) return json({ error: "Ungültige place_id." }, 400);
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=de`, {
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FELDER_DETAILS },
      });
      const daten = await res.json();
      if (!res.ok) return json({ error: `Google Places: ${daten?.error?.message ?? res.status}` }, res.status === 404 ? 404 : 502);
      return json({ eintrag: abbilden(daten) });
    }

    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (e: any) {
    console.error("places-recherche:", e);
    return json({ error: "Recherche fehlgeschlagen." }, 500);
  }
});
