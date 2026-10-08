// Referenzen aus dem CRM für den Website-Build. Nutzt nur den öffentlichen
// anon-Schlüssel; die Datenbank liefert dank Lese-Regel (RLS) ausschliesslich
// AKTIVE Referenzen (Migration 20261025). Kein geheimer Schlüssel im Build.
const SUPABASE_URL = "https://bvluvvyvftygnxtmboxw.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bHV2dnl2ZnR5Z254dG1ib3h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMzU1NTQsImV4cCI6MjA4NTgxMTU1NH0.sw1wb1pLj9Ne-ZoGbQcR6mA5yDHe2PZbImEzt76lP-o";

export interface CrmReferenz {
  name: string;
  titel: string;
  beschreibung: string | null;
  url: string | null;
  url_label: string | null;
  tags: string[] | null;
  bild_url: string | null;
  umgebung_bild_url: string | null;
  bereich?: "web" | "ict" | null;
  sort_order: number;
}

export async function ladeReferenzen(): Promise<CrmReferenz[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/website_references?select=*&active=eq.true&order=sort_order.asc`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return [];
    const daten = await res.json();
    return Array.isArray(daten) ? daten : [];
  } catch (e) {
    console.error("Referenzen konnten nicht geladen werden:", e);
    return [];
  }
}
