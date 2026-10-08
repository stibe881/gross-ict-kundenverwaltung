// Firmenrecherche über die Google Places API (New) für Akquise-Kampagnen.
//
// Wichtig (Google-Richtlinien): Inhalte der Places API dürfen nicht gespeichert
// werden — ausgenommen die place_id. Diese Function liefert Treffer deshalb nur
// zur ANZEIGE in der App zurück und legt nichts davon in der Datenbank ab.
// Beim Vormerken speichert die App ausschliesslich die place_id.
//
// action "suche":   { action, textQuery, campaignId?, pageToken?, pageSize?, gebiet? }
//   gebiet: { plz: string[], ort: string, radiusKm: number, zentrum?: {lat,lng} }
//   radiusKm > 0: nur Treffer im Umkreis um den Ort/die erste PLZ; 0/leer: nur diese PLZ bzw. dieser Ort
// action "details": { action, placeId }
// Benötigt das Secret GOOGLE_PLACES_API_KEY (nur für die Places API (New) freigeben).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, pruefeMitarbeiter } from "../_shared/sicherheit.ts";
import { imGebiet, normalisiereOrt, umschliessendesRechteck, type Gebiet } from "../_shared/gebiet.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const FELDER_SUCHE = [
  "places.id", "places.displayName", "places.formattedAddress",
  "places.nationalPhoneNumber", "places.websiteUri", "places.googleMapsUri", "places.location", "nextPageToken",
].join(",");
const FELDER_DETAILS = "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,googleMapsUri";

// Koordinaten dienen nur der Umkreisprüfung auf dem Server und werden nicht ausgeliefert.
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

      // Gebiet aus der Anfrage übernehmen und prüfen
      const roh = body.gebiet ?? {};
      const gebiet: Gebiet = {
        plz: (Array.isArray(roh.plz) ? roh.plz : []).map(String).filter((p: string) => /^\d{4}$/.test(p)).slice(0, 20),
        ort: String(roh.ort ?? "").trim().slice(0, 80),
        radiusKm: Math.min(Math.max(Number(roh.radiusKm) || 0, 0), 100),
        zentrum: roh.zentrum && Number.isFinite(roh.zentrum.lat) && Number.isFinite(roh.zentrum.lng)
          ? { lat: Number(roh.zentrum.lat), lng: Number(roh.zentrum.lng) } : undefined,
      };

      if (gebiet.radiusKm > 0 && !gebiet.plz.length && !gebiet.ort) {
        return json({ error: "Für einen Umkreis bitte einen Ort oder eine PLZ als Mittelpunkt angeben." }, 400);
      }

      // Umkreis: Mittelpunkt einmalig über Google bestimmen (Folgeseiten bekommen ihn vom Client zurück)
      if (gebiet.radiusKm > 0 && !gebiet.zentrum) {
        const mitte = [gebiet.plz[0], gebiet.ort].filter(Boolean).join(" ") + ", Schweiz";
        const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.location" },
          body: JSON.stringify({ textQuery: mitte, languageCode: "de", regionCode: "CH", pageSize: 1 }),
        });
        const d = await r.json();
        if (!r.ok) return json({ error: `Google Places: ${d?.error?.message ?? r.status}` }, 502);
        const loc = d.places?.[0]?.location;
        if (!loc) return json({ error: `Ort «${mitte.replace(", Schweiz", "")}» wurde nicht gefunden.` }, 404);
        gebiet.zentrum = { lat: loc.latitude, lng: loc.longitude };
      }

      // Ohne Umkreis den Ort in den Suchtext aufnehmen, damit Google passende Treffer liefert
      let anfrageText = textQuery;
      if (!(gebiet.radiusKm > 0)) {
        const zusatz = gebiet.ort || gebiet.plz[0] || "";
        if (zusatz && !normalisiereOrt(textQuery).includes(normalisiereOrt(zusatz))) anfrageText = `${textQuery} ${zusatz}`;
      }

      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FELDER_SUCHE },
        body: JSON.stringify({
          textQuery: anfrageText,
          languageCode: "de",
          regionCode: "CH",
          pageSize,
          ...(gebiet.radiusKm > 0 && gebiet.zentrum
            ? { locationRestriction: { rectangle: umschliessendesRechteck(gebiet.zentrum, gebiet.radiusKm) } }
            : {}),
          ...(body.pageToken ? { pageToken: String(body.pageToken) } : {}),
        }),
      });
      const daten = await res.json();
      if (!res.ok) return json({ error: `Google Places: ${daten?.error?.message ?? res.status}` }, 502);

      // Genauer Filter (Rechteck ist nur eine Obergrenze): nur Treffer im Gebiet behalten
      const alle = (daten.places ?? []) as any[];
      const imBereich = alle.filter((p) =>
        imGebiet({ adresse: p.formattedAddress ?? "", lat: p.location?.latitude, lng: p.location?.longitude }, gebiet));
      const ausgeblendet = alle.length - imBereich.length;

      // Bereits vorgemerkte Einträge dieser Kampagne markieren (nur place_id-Vergleich)
      let schonDa = new Set<string>();
      if (body.campaignId) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await admin.from("prospects").select("google_place_id").eq("campaign_id", body.campaignId).not("google_place_id", "is", null);
        schonDa = new Set((data ?? []).map((r: any) => r.google_place_id));
      }
      const treffer = imBereich.map(abbilden).map((t: any) => ({ ...t, bereitsVorgemerkt: schonDa.has(t.placeId) }));
      return json({ treffer, nextPageToken: daten.nextPageToken ?? null, ausgeblendet, zentrum: gebiet.zentrum ?? null });
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
